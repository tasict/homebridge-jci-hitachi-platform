import JciHitachiPlatformLogger from './logger';
import axios from 'axios';
import { mqtt5, auth, iot } from 'aws-iot-device-sdk-v2';
import { once } from 'events';
import { toUtf8 } from '@aws-sdk/util-utf8-browser';
import { AWS_MQTT_ENDPOINT, AWS_REGION, QOS } from './jci-hitachi-constants';
import {
    JciHitachiAWSCognitoConnection,
    GetUser,
    GetCredentials,
    GetAllDevice,
} from './jci-hitachi-connections';
import {
    AWSCredentials,
    AWSIdentity,
    AWSThingDictionary,
    AWSThings,
    AWSTokens,
    NotifyCallback,
} from './jci-hitachi-models';

// How long Login() waits for the MQTT connection to be established before
// giving up and letting the platform's backoff retry with fresh credentials.
const MQTT_CONNECT_TIMEOUT = 30 * 1000;

// Upper bound for MQTT teardown steps (unsubscribe/stop) during Logout().
const MQTT_TEARDOWN_TIMEOUT = 5 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

function generateRandomHex(length: number): string {
    const characters = 'abcdef0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

export default class JciHitachiAWSAPI {

    email: string;
    password: string;
    log: JciHitachiPlatformLogger;

    mqttclient: mqtt5.Mqtt5Client|undefined;

    aws_tokens: AWSTokens|undefined;
    aws_credentials: AWSCredentials|undefined;
    aws_identity: AWSIdentity|undefined;
    aws_thing_dict: AWSThingDictionary|undefined;
    task_id = 0;
    is_host = false;
    last_received_time = 0;

    callback: NotifyCallback|undefined;

    isConnected = false;
    isLoginFailed = false;
    isLoggingIn = false;

    constructor(email: string, password: string, log: JciHitachiPlatformLogger) {
        this.email = email;
        this.password = password;
        this.log = log;
    }

    deconstructor() {
        this.Logout();
    }

    setCallback(callback: NotifyCallback) {
        this.callback = callback;
    }

    public async Login(): Promise<boolean> {

        // Many callers (the platform retry timer, every accessory's refresh interval and
        // the MQTT stale-connection check) can ask to log in at the same time. Coalesce
        // them into a single attempt, otherwise concurrent logins fight each other and
        // the plugin ends up in a connect/disconnect storm.
        if (this.isLoggingIn) {
            this.log.debug('Login already in progress; skipping duplicate request.');
            return this.isConnected;
        }

        this.isLoggingIn = true;

        try {

            await this.Logout();

            // Reset before a fresh attempt so a previous transient failure (e.g. a TLS
            // negotiation error or a cloud-maintenance outage) does not stick forever.
            this.isLoginFailed = false;

            this.aws_tokens = await (new JciHitachiAWSCognitoConnection(this.email, this.password, undefined, this.log)).login(false);

            if (!this.aws_tokens) {
                this.log.info('Login failed');
                return false;
            }

            this.aws_identity = await (new GetUser(this.email, this.password, this.aws_tokens, this.log)).get_data();
            this.aws_thing_dict = await (new GetAllDevice(this.aws_tokens, this.log)).get_data();

            this.log.debug('aws_identity:' + JSON.stringify(this.aws_identity));

            if (this.aws_identity) {

                this.aws_credentials = await (new GetCredentials(this.email, this.password, this.aws_tokens, this.log)).get_data(this.aws_identity);

                this.log.debug(JSON.stringify(this.aws_identity) + ` host_user_id: ${this.aws_identity.host_identity_id}`);

                this.is_host = this.aws_identity.identity_id === this.aws_identity.host_identity_id;

                if (this.aws_credentials && this.aws_identity.host_identity_id.length > 0) {
                    this.log.debug(JSON.stringify(this));
                    this.mqttclient = this.createMQTTClient();
                }

                if (this.mqttclient) {

                    const connectionSuccess = once(this.mqttclient, 'connectionSuccess');
                    const connectionFailure = once(this.mqttclient, 'connectionFailure');

                    this.mqttclient.start();

                    // The mqtt5 client retries internally with the same static SigV4
                    // credentials, so a failed websocket upgrade (e.g.
                    // AWS_ERROR_HTTP_WEBSOCKET_UPGRADE_FAILURE with stale credentials)
                    // may never succeed. Awaiting connectionSuccess unconditionally used
                    // to hang Login() forever with the isLoggingIn mutex held, blocking
                    // every reconnect attempt until Homebridge was restarted. Race the
                    // outcome instead and fail the login, so the platform backoff
                    // retries with freshly fetched credentials.
                    const connected = await new Promise<boolean>((resolve) => {
                        const finish = (result: boolean) => {
                            clearTimeout(timer);
                            resolve(result);
                        };
                        const timer = setTimeout(() => {
                            this.log.error(`MQTT connection timed out after ${MQTT_CONNECT_TIMEOUT} ms.`);
                            finish(false);
                        }, MQTT_CONNECT_TIMEOUT);
                        connectionSuccess.then(() => finish(true), () => finish(false));
                        connectionFailure.then(() => finish(false), () => finish(false));
                    });

                    if (!connected) {
                        this.log.error('MQTT connection could not be established; aborting login.');
                        await this.Logout();
                        this.isLoginFailed = true;
                        return false;
                    }

                    const suback = await this.mqttclient.subscribe({
                        subscriptions: [
                            { qos: QOS, topicFilter: `${this.aws_identity.host_identity_id}/+/+/response` },
                        ],
                    });

                    this.log.debug('Suback result: ' + JSON.stringify(suback));

                    await this.RefeshAWSThingDictionary('registration');
                    await this.RefeshAWSThingDictionary('status');

                    return true;
                }
            }

        } catch (e) {
            this.log.error(`Login Error: ${e}`);
            // Surface the real server response so login failures are diagnosable
            // (e.g. Cognito 400 NotAuthorized / unsupported account, see issue #10).
            if (axios.isAxiosError(e) && e.response) {
                this.log.error(`Login response (HTTP ${e.response.status}): ${JSON.stringify(e.response.data)}`);
            }
            this.isLoginFailed = true;
        } finally {
            this.isLoggingIn = false;
        }

        return false;
    }

    public async Logout(): Promise<boolean> {

        const client = this.mqttclient;
        const wasConnected = this.isConnected;

        this.isConnected = false;
        this.mqttclient = undefined;

        if (!client) {
            return true;
        }

        // Never await MQTT teardown unbounded: 'disconnection' only fires when the
        // client was actually connected, and the offline operation queue can park
        // unsubscribe/stop forever - a hung Logout() also hangs the Login() that
        // calls it, with the isLoggingIn mutex held (no reconnect ever runs again).
        if (wasConnected) {
            try {
                const unsuback = await withTimeout(client.unsubscribe({
                    topicFilters: [
                        `${this.aws_identity?.host_identity_id}/#`,
                    ],
                }), MQTT_TEARDOWN_TIMEOUT, 'MQTT unsubscribe');
                this.log.debug('Unsuback result: ' + JSON.stringify(unsuback));
            } catch (e) {
                this.log.debug(`Logout unsubscribe error: ${e}`);
            }
        }

        try {
            const stopped = once(client, 'stopped');
            client.stop();
            await withTimeout(stopped, MQTT_TEARDOWN_TIMEOUT, 'MQTT stop');
        } catch (e) {
            this.log.debug(`Logout stop error: ${e}`);
        }

        try {
            // Release the native client, otherwise an abandoned instance keeps
            // retrying its connection (and spamming failures) in the background.
            client.close();
        } catch (e) {
            this.log.debug(`Logout close error: ${e}`);
        }

        return true;
    }

    public get isHost(): boolean {
        return this.is_host;
    }

    public getDevices(): AWSThingDictionary|undefined {
        return this.aws_thing_dict;
    }

    public getDevice(thingName: string): AWSThings|undefined {
        return this.aws_thing_dict?.getDevice(thingName);
    }

    public async RefeshAWSThingDictionary(actionName = 'status') {

        if (!this.aws_thing_dict) {
            return;
        }

        for (const thingName in this.aws_thing_dict.getAllThings()) {
            this.publish(thingName, actionName);
        }
    }

    public async RefeshDevice(thingName: string): Promise<boolean> {

        if (this.last_received_time !== 0 && Math.ceil(Date.now() / 1000) - this.last_received_time > 600) {

            this.log.error('MQTT Connection Timeout');

            // Funnel through the platform's single backoff reconnect (via the callback)
            // instead of logging in here, so the stale path doesn't become a second,
            // competing reconnect (see issue #11).
            await this.Logout();

            if (this.callback) {
                this.callback(undefined);
            }

            return false;
        }

        if (this.aws_thing_dict?.hasThingName(thingName)) {
            return await this.publish(thingName, 'status');
        }

        return false;
    }

    public async GetDeviceStatus(thingName: string, status_name: string, need_refresh = false): Promise<Object|undefined> {

        if (need_refresh) {
            await this.RefeshDevice(thingName);
        }

        const device = this.aws_thing_dict?.getDevice(thingName);

        if (!device || device.statusPayload === undefined) {
            return undefined;
        }

        return device.statusPayload[status_name];
    }

    public async SetDeviceStatus(thingName: string, status_name: string, status_value: number): Promise<boolean> {

        const payload = {
            'Condition': {
                'ThingName': thingName,
                'Index': 0,
                'Geofencing': {
                    'Arrive': null,
                    'Leave': null,
                },
            },
            'TaskID': this.task_id++,
            'Timestamp': Math.ceil(Date.now() / 1000),
        };

        payload[status_name] = status_value;

        return await this.publish(thingName, 'control', payload);
    }

    protected handleMQTTMessage(topic: string, payload: any): void {

        try {

            const topic_parts = topic.split('/');
            const thingName = topic_parts[1];
            const actionName = topic_parts[2];
            const actionType = topic_parts[3];
            const payloadContent = payload ? JSON.parse(toUtf8(payload as Buffer)) : {};

            this.log.debug(`Received: ${topic} ${JSON.stringify(payloadContent)}`);

            if (actionType !== 'response') {
                return;
            }

            if (this.aws_thing_dict === undefined) {
                return;
            }

            this.last_received_time = Math.ceil(Date.now() / 1000);

            if (this.getDevice(thingName)) {

                if (actionName === 'status') {

                    this.aws_thing_dict.updateDeviceStatusPayload(thingName, payloadContent);

                    if (this.callback) {
                        this.callback(this.getDevice(thingName));
                    }

                } else if (actionName === 'registration') {
                    this.aws_thing_dict.updateDeviceRegistrationPayload(thingName, payloadContent);
                } else if (actionName === 'control') {
                    this.RefeshDevice(thingName);
                }
            }

        } catch (e) {
            this.log.error(`MQTT Message Error: ${e}`);
        }
    }

    protected createMQTTClient(): mqtt5.Mqtt5Client {

        if (this.aws_credentials === undefined || this.aws_identity === undefined) {
            throw new Error('aws_credentials is undefined');
        }

        const wsConfig: iot.WebsocketSigv4Config = {
            credentialsProvider: auth.AwsCredentialsProvider.newStatic(this.aws_credentials.access_key_id, this.aws_credentials.secret_access_key, this.aws_credentials.session_token),
            region: AWS_REGION,
        };

        const builder: iot.AwsIotMqtt5ClientConfigBuilder = iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(
            AWS_MQTT_ENDPOINT,
            wsConfig,
        );

        const clientId = `${this.aws_identity.identity_id}_${generateRandomHex(16)}`;
        this.log.debug(`clientId: ${clientId}`);

        builder.withConnectProperties({ keepAliveIntervalSeconds: 120, clientId: `${clientId}` });

        const client: mqtt5.Mqtt5Client = new mqtt5.Mqtt5Client(builder.build());

        client.on('error', (error) => {
            this.log.error('Error event: ' + error.toString());
            this.isConnected = false;
            this.isLoginFailed = true;
        });

        client.on('messageReceived', (eventData: mqtt5.MessageReceivedEvent): void => {
            this.handleMQTTMessage(eventData.message.topicName, eventData.message.payload);
        });

        client.on('attemptingConnect', () => {
            this.log.debug('Attempting Connect event');
        });

        client.on('connectionSuccess', (eventData: mqtt5.ConnectionSuccessEvent) => {
            this.log.debug('Connection Success event');
            this.log.debug('Connack: ' + JSON.stringify(eventData.connack));
            this.log.debug('Settings: ' + JSON.stringify(eventData.settings));
            this.isConnected = true;
        });

        client.on('connectionFailure', (eventData: mqtt5.ConnectionFailureEvent) => {

            this.log.error('Connection failure event: ' + eventData.error.toString());
            this.isConnected = false;
            this.isLoginFailed = true;

            if (this.callback) {
                this.callback(undefined);
            }
        });

        client.on('disconnection', (eventData: mqtt5.DisconnectionEvent) => {

            this.log.debug('Disconnection event: ' + eventData.error.toString());
            if (eventData.disconnect !== undefined) {
                this.log.debug('Disconnect packet: ' + JSON.stringify(eventData.disconnect));
            }

            this.isConnected = false;

            if (this.callback) {
                this.callback(undefined);
            }
        });

        client.on('stopped', () => {
            this.log.debug('Stopped event');
        });

        return client;
    }

    protected async publish(thingName: string, request: string, payload: Object|undefined = undefined): Promise<boolean> {

        try {

            const defaultPayload = JSON.stringify({ 'Timestamp': Math.ceil(Date.now() / 1000) });

            if (this.mqttclient && this.isConnected) {

                const topic = `${this.aws_identity?.host_identity_id}/${thingName}`;

                await this.mqttclient.publish({
                    qos: QOS,
                    topicName: `${topic}/${request}/request`,
                    payload: payload ? JSON.stringify(payload) : defaultPayload,
                });

                this.log.debug(`${topic}/${request}/request ${payload ? JSON.stringify(payload) : defaultPayload}`);

                return true;
            }

        } catch (e) {
            this.log.error(`Publish Error: ${e}`);
            this.Logout();

            if (this.callback) {
                this.callback(undefined);
            }
        }

        return false;
    }
}
