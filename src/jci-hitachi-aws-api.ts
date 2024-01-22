import JciHitachiPlatformLogger from './logger';
import axios,{ AxiosError, AxiosResponse, all } from 'axios';
import {mqtt5, auth, iot} from "aws-iot-device-sdk-v2";
import {once} from "events";
import {toUtf8} from "@aws-sdk/util-utf8-browser";
import { AWS_SSL_CERT } from './cert';

const https = require( "https" );


const AWS_REGION = "ap-northeast-1";
const AWS_COGNITO_IDP_ENDPOINT = `cognito-idp.${AWS_REGION}.amazonaws.com`;
const AWS_COGNITO_ENDPOINT = `cognito-identity.${AWS_REGION}.amazonaws.com`;
const AWS_COGNITO_CLIENT_ID = "7kfnjsb66ei1qt5s5gjv6j1lp6";
const AWS_COGNITO_USERPOOL_ID = `${AWS_REGION}_aTZeaievK`;



const AWS_IOT_ENDPOINT = "iot-api.jci-hitachi-smarthome.com";
const AWS_MQTT_ENDPOINT = `a8kcu267h96in-ats.iot.${AWS_REGION}.amazonaws.com`;
const QOS = mqtt5.QoS.AtLeastOnce;

export interface NotifyCallback {
    (thingName: AWSThings|undefined): void;
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

class AWSTokens {
    access_token: string
    id_token: string
    refresh_token: string
    expiration: number

    constructor(access_token: string = "", id_token: string = "", refresh_token: string = "", expiration: number = 0) {
        this.access_token = access_token;
        this.id_token = id_token;
        this.refresh_token = refresh_token;
        this.expiration = expiration;
    }
}
class AWSIdentity {
    identity_id: string
    host_identity_id: string
    user_name: string
    user_attributes: {[key: string]: string}

    constructor(identity_id: string, user_name: string, user_attributes: {[key: string]: string}) {
        this.identity_id = identity_id;
        this.host_identity_id = user_attributes["custom:host_identity_id"],
        this.user_name = user_name;
        this.user_attributes = user_attributes;
        
    }
}


class AWSCredentials{

    access_key_id: string = ""
    secret_access_key: string = ""
    session_token: string = ""
    expiration: number = 0

    constructor(awscredentialsContent: string ){

        const awscredentialsJson = JSON.parse(awscredentialsContent);
       
        this.access_key_id = awscredentialsJson['AccessKeyId'];
        this.secret_access_key = awscredentialsJson['SecretKey'];
        this.session_token = awscredentialsJson['SessionToken'];
        this.expiration = awscredentialsJson['Expiration'];

    }

}

export class AWSThingDictionary{
    
        things: {[thingName:string]:AWSThings} = {};
        log: JciHitachiPlatformLogger|undefined
    
        constructor(awsallthingsContent: string, log: JciHitachiPlatformLogger|undefined = undefined){

            this.log = log;

            const awsallthingsJson = JSON.parse(awsallthingsContent);
            const things = awsallthingsJson['results']['Things'];

            for (let i = 0; i < things.length; i++) {

                const thing = new AWSThings(JSON.stringify(things[i]));
                this.things[thing.ThingName] = thing;
            }

            this.log?.info(`You have ${Object.keys(this.things).length} devices.`);
    
        }

        public getThingNameByCustomDeviceName(customDeviceName: string): string|undefined {
                
                for (let i = 0; i < Object.keys(this.things).length; i++) {
    
                    if (this.things[i].CustomDeviceName == customDeviceName) {
                        return this.things[i].ThingName;
                    }
                }
    
                return undefined;
        }

        public getAllThings(): {[thingName:string]:AWSThings} {
            return this.things;
        }

        public hasThingName(thingName: string): boolean {
            return this.things[thingName] !== undefined;
        }
        public getDevice(thingName: string): AWSThings|undefined {
            return this.things[thingName];
        }

        public updateDeviceStatusPayload(thingName: string, payload: Object): void {
            
            if(this.hasThingName(thingName) == false){
                return;
            }            
            
            this.things[thingName].updateStatusPayload(payload);
        }

        public updateDeviceRegistrationPayload(thingName: string, payload: Object): void {
                
            if(this.hasThingName(thingName) == false){
                return;
            }            
                
            this.things[thingName].updateRegistrationPayload(payload);
        }

}

export class AWSThings{

    thingObject: Object;
    statusPayload: Object|undefined = undefined
    registrationPayload: Object|undefined = undefined

    constructor(awsthingsContent: string ){
        this.thingObject = JSON.parse(awsthingsContent);
    }

    public get ThingName(): string {
        return this.thingObject['ThingName'];
    }

    public get CustomDeviceName(): string {
        return this.thingObject['CustomDeviceName'];
    }

    public get DeviceType(): number {
        return this.thingObject['DeviceType'];
    }

    public get SwitchOn(): boolean {
        return this.statusPayload ? this.statusPayload['Switch'] : false;
    }

    public get TemperatureSetting(): number|undefined {
        return this.statusPayload ? this.statusPayload['TemperatureSetting'] : undefined;
    }

    public get TemperatureSettingMin(): number{
        return this.registrationPayload ? (this.registrationPayload['TemperatureSetting'] >> 8 & 255) : 16;
    }

    public get TemperatureSettingMax(): number{
        return this.registrationPayload ? (this.registrationPayload['TemperatureSetting'] & 255) : 32;
    }

    public get IndoorTemperature(): number|undefined {
        return this.statusPayload ? this.statusPayload['IndoorTemperature'] : undefined;
    }

    public get IndoorHumidity(): number|undefined {
        return this.statusPayload ? this.statusPayload['IndoorHumidity'] : undefined;
    }

    public get PM25(): number|undefined {
        return this.statusPayload ? this.statusPayload['PM25'] : undefined;
    }

    public get FanSpeed(): number|undefined {
        return this.statusPayload ? this.statusPayload['FanSpeed'] : undefined;
    }

    public get QuickMode(): boolean {
        return this.statusPayload ? this.statusPayload['QuickMode'] : false;
    }

    public get CleanNotification(): boolean {
        return this.statusPayload ? this.statusPayload['CleanNotification'] : false;
    }


    public get CleanSwitch(): boolean {
        return this.statusPayload ? this.statusPayload['CleanSwitch'] : false;
    }

    public get FirmwareVersion(): string|undefined {
        return this.registrationPayload ? this.registrationPayload['FirmwareVersion'] : undefined;
    }

    public get Model(): string|undefined {
        return this.registrationPayload ? this.registrationPayload['Model'] : undefined;
    }

    public updateStatusPayload(payload: Object): void {
        this.statusPayload = payload;
    }

    public updateRegistrationPayload(payload: Object): void {
        this.registrationPayload = payload;
    }
}


abstract class JciHitachiAWSHttpConnection {

    log: JciHitachiPlatformLogger;

    constructor(log: JciHitachiPlatformLogger){
        this.log = log;
    }
        
    //Request https connection with AWS_SSL_CERT, and return the response
    protected async requestHttps(url: string, method: string, headers: any, data: any): Promise<AxiosResponse> {

        return await axios.request({
            httpsAgent: new https.Agent({
                ca: [AWS_SSL_CERT],
            }),
            method: method,
            url: url,
            headers: headers,
            data: JSON.stringify(data)
        });
    }
        


}

class JciHitachiAWSCognitoConnection extends JciHitachiAWSHttpConnection {

    email: string;
    password: string;
    aws_tokens: AWSTokens|undefined;

    constructor(email: string, password: string, aws_tokens:AWSTokens|undefined, log: JciHitachiPlatformLogger) {
     
        super(log);
        this.email = email;
        this.password = password;
        this.aws_tokens = aws_tokens;

    }

    protected _generateHeaders(target: string): object {
        return {
          "X-Amz-Target": target,
          "User-Agent": "Dalvik/2.1.0",
          "content-type": "application/x-amz-json-1.1",
          "Accept": "application/json",
        };
    }

    protected _handle_response(response: AxiosResponse):AxiosResponse {

       
        if (response.status == 200) {

            //this.log.debug(`login_req: ${JSON.stringify(response.data)}`);

            return response;
        }
        else {

            this.log.error(`login_req: ${JSON.stringify(response.data)}`);

            return response;
        }
    }

    protected _send(target: string, data : any): Promise<AxiosResponse> {

        const endpoint = `https://${this.constructor.name === 'GetCredentials' ? AWS_COGNITO_ENDPOINT : AWS_COGNITO_IDP_ENDPOINT}`;

        return this.requestHttps(endpoint, 'post', this._generateHeaders(target), data)
    }

    public getAWSTokens(): AWSTokens|undefined {
        return this.aws_tokens
    }

    public async login(use_refresh_token: boolean): Promise<AWSTokens|undefined> {
        

        let login_json_data: any;
        const login_headers = this._generateHeaders("AWSCognitoIdentityProviderService.InitiateAuth");
            
        if(use_refresh_token && this.aws_tokens){
            login_json_data = {
                "AuthFlow": 'REFRESH_TOKEN_AUTH',
                "AuthParameters":{
                    'REFRESH_TOKEN': this.aws_tokens.refresh_token,
                },
                "ClientId": AWS_COGNITO_CLIENT_ID,
            }
        }
        else{

            login_json_data = {
                "AuthFlow": 'USER_PASSWORD_AUTH',
                "AuthParameters": {
                    'USERNAME': this.email,
                    'PASSWORD': this.password,
                },
                "ClientId": AWS_COGNITO_CLIENT_ID,
            }
        }

        const login_req:Promise<AxiosResponse> = this.requestHttps(`https://${AWS_COGNITO_IDP_ENDPOINT}`, 'post', login_headers, login_json_data);
        
        const response = this._handle_response(await login_req);


        if(response.status == 200){
            
            const auth_result = response.data['AuthenticationResult'];

            this.aws_tokens = new AWSTokens(
                    auth_result['AccessToken'],
                    auth_result['IdToken'],
                    use_refresh_token && this.aws_tokens ? this.aws_tokens.refresh_token : auth_result['RefreshToken'],
                    new Date().valueOf() + auth_result['ExpiresIn']
            );
        
        }

        return this.aws_tokens;

    }

    


}

class GetUser extends JciHitachiAWSCognitoConnection {

    public async get_data(): Promise<AWSIdentity|undefined> {

        if(!this.aws_tokens){
            return undefined;
        }
        
        const json_data = {
            "AccessToken": this.aws_tokens.access_token,
        }

        const response:AxiosResponse = await this._send("AWSCognitoIdentityProviderService.GetUser", json_data);

        if(response.status == 200){
            
            const user_attributes = response.data['UserAttributes'].reduce((acc: {[key: string]: string}, cur: {Name: string, Value: string}) => {
                acc[cur.Name] = cur.Value;
                return acc;
            }, {});


            return new AWSIdentity(user_attributes['custom:cognito_identity_id'],user_attributes['Username'], user_attributes);
        }
    
    }


}




class GetCredentials extends JciHitachiAWSCognitoConnection {

    public async get_data(aws_identity:AWSIdentity): Promise<AWSCredentials|undefined> {

        if(!this.aws_tokens){
            return undefined;
        }

        const json_data = JSON.parse(`{
            "IdentityId": "${aws_identity.identity_id}",
            "Logins": {
                "${AWS_COGNITO_IDP_ENDPOINT}/${AWS_COGNITO_USERPOOL_ID}": "${this.aws_tokens.id_token}"
            }
        }`);

        const response:AxiosResponse = await this._send("AWSCognitoIdentityService.GetCredentialsForIdentity", json_data);

        if(response.status == 200){
            return new AWSCredentials(JSON.stringify(response.data['Credentials']));
        }


    }    


}


class JciHitachiAWSIoTConnection extends JciHitachiAWSHttpConnection{

    aws_tokens: AWSTokens;

    constructor(aws_tokens: AWSTokens, log: JciHitachiPlatformLogger) {
        super(log);
        this.aws_tokens = aws_tokens;
    }

    protected _generateAWSIOTHeaders(need_access_token: boolean): object {
        
        let headers = {};

        if(need_access_token){
            headers = {
                "authorization": `Bearer ${this.aws_tokens.id_token}`,
                "accesstoken": `Bearer ${this.aws_tokens.access_token}`,
                "User-Agent": "Dalvik/2.1.0",
                "content-type": "application/json",
                "Accept": "application/json",
            };
        }
        else{
            headers = {
                "authorization": `Bearer ${this.aws_tokens.id_token}`,
                "User-Agent": "Dalvik/2.1.0",
                "content-type": "application/json",
                "Accept": "application/json",
            };
        }

        return headers;

    }

    protected _handle_response(response: AxiosResponse):AxiosResponse {

       
        if (response.status == 200) {

            this.log.debug(`login_req: ${JSON.stringify(response.data)}`);

            return response;
        }
        else {

            this.log.error(`login_req: ${JSON.stringify(response.data)}`);

            return response;
        }
    }

    protected _send(target: string, data : any, need_access_token:boolean): Promise<AxiosResponse> {

        const endpoint = `https://${AWS_IOT_ENDPOINT}${target}`;

        return this.requestHttps(endpoint, 'post', this._generateAWSIOTHeaders(need_access_token), data);
    }

}

class GetAllDevice extends JciHitachiAWSIoTConnection {

    public async get_data(): Promise<AWSThingDictionary> {
       
        const response:AxiosResponse = await this._send('/GetAllDevice', {}, false);

        return new AWSThingDictionary(JSON.stringify(response.data), this.log);
    }

}

class ListSubUser extends JciHitachiAWSIoTConnection {

    public async getHostUserID(): Promise<string> {
       
        const response:AxiosResponse = await this._send('/ListSubUser', {}, false);

        const familyMemberList = response.data['results']['FamilyMemberList'];

        for(const familyMember of familyMemberList){
            if(familyMember['isHost']){

                this.log.info(`Host User : ${familyMember['firstName']},${familyMember['lastName']}`);
                return familyMember['userId'];
            }
        }

        this.log.error(`No Host User : ${JSON.stringify(response.data)}`);

        return '';
    }
}


class GetAllGroup extends JciHitachiAWSIoTConnection {

    public async get_data(): Promise<Object> {
       
        const response:AxiosResponse = await this._send('/GetAllGroup', {}, false);

        return response.data;
    }
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
    task_id:number = 0;
    is_host:boolean = false;

    callback:NotifyCallback|undefined;
    
    isConnected: boolean = false;

    constructor(email: string, password: string, log: JciHitachiPlatformLogger) {
        this.email = email;
        this.password = password;
        this.log = log;
    }

    deconstructor(){
        this.Logout();
    }

    setCallback(callback:NotifyCallback){
        this.callback = callback;
    }

    public async Login(): Promise<boolean> {

        try{

            if(this.isConnected){
                return true;
            }

            this.aws_tokens = await (new JciHitachiAWSCognitoConnection(this.email, this.password, undefined, this.log)).login(false);

            if(!this.aws_tokens){
                return false;
            }


            this.aws_identity = await (new GetUser(this.email, this.password, this.aws_tokens, this.log)).get_data();
            this.aws_thing_dict = await (new GetAllDevice(this.aws_tokens, this.log)).get_data();

            this.log.debug(JSON.stringify(this.aws_identity));
            
            
            if(this.aws_identity){

                this.aws_credentials = await (new GetCredentials(this.email, this.password, this.aws_tokens, this.log)).get_data(this.aws_identity);

                this.log.debug(JSON.stringify(this.aws_identity) + ` host_user_id: ${this.aws_identity.host_identity_id}`);

                this.is_host = this.aws_identity.identity_id === this.aws_identity.host_identity_id;
        
                if(this.aws_credentials && this.aws_identity.host_identity_id.length > 0){

                    this.log.debug(JSON.stringify(this));

                    this.mqttclient = this.createMQTTClient();
                }
                
                if(this.mqttclient){
    
                    const attemptingConnect = once(this.mqttclient, "attemptingConnect");
                    const connectionSuccess = once(this.mqttclient, "connectionSuccess");
                
                    this.mqttclient.start();
                
                    await attemptingConnect;
                    await connectionSuccess;
                
                    const suback = await this.mqttclient.subscribe({
                        subscriptions: [
                            { qos: QOS, topicFilter: `${this.aws_identity.host_identity_id}/+/+/response` }
                        ]
                    });
    
                    this.log.debug('Suback result: ' + JSON.stringify(suback));

                    await this.RefeshAWSThingDictionary('registration');
                    await this.RefeshAWSThingDictionary('status');
                    
                    return true;

                }
        
            }


        }catch(e){
            this.log.error(`Login Error: ${e}`);            
        }
    


        return false;
    }

    public async Logout(): Promise<boolean> {

        try{

            if(this.mqttclient){

                const unsuback = await this.mqttclient.unsubscribe({
                    topicFilters: [
                        `${this.aws_identity?.host_identity_id}/#`
                    ]
                });
                this.log.debug('Unsuback result: ' + JSON.stringify(unsuback));
            
                const disconnection = once(this.mqttclient, "disconnection");
                const stopped = once(this.mqttclient, "stopped");
    
                this.mqttclient.stop();
    
                await disconnection;
                await stopped;
            
            }

            this.isConnected = false;

            return true;
        }catch(e){
            this.log.error(`Logout Error: ${e}`);
        }




        return true;
    }

    public get isHost(): boolean {
        return this.is_host;
    }

    public getDevices(): AWSThingDictionary|undefined {
        return this.aws_thing_dict;

    }

    public getDevice(thingName:string): AWSThings|undefined {
        return this.aws_thing_dict?.getDevice(thingName);
    }

    public async RefeshAWSThingDictionary(actionName:string = 'status'){

        if(!this.aws_thing_dict){
            return;
        }

        for(const thingName in this.aws_thing_dict.getAllThings()){
            this.publish(thingName, actionName);
        }

    }

    public async RefeshDevice(thingName:string): Promise<boolean> {

        if(this.aws_thing_dict?.hasThingName(thingName)){
            return await this.publish(thingName, 'status');
        }

        return false;

    }

    public async GetDeviceStatus(thingName:string, status_name:string, need_refresh:boolean = false): Promise<Object|undefined> {
        
        if(need_refresh){
            await this.RefeshDevice(thingName);
        }

        const device = this.aws_thing_dict?.getDevice(thingName);

        if(!device || device.statusPayload === undefined){
            return undefined;
        }

        return device.statusPayload[status_name];

    }
    

    public async SetDeviceStatus(thingName:string, status_name:string, status_value:number): Promise<boolean> {
    
        const payload = {
            "Condition": {
                "ThingName": thingName,
                "Index": 0,
                "Geofencing": {
                    "Arrive": null,
                    "Leave": null
                },
            },
            "TaskID": this.task_id++,
            "Timestamp":  Math.ceil(Date.now() / 1000)
        };

        payload[status_name] = status_value;
    
        return await this.publish(thingName, 'control', payload);

    }

    protected handleMQTTMessage(topic: string, payload: any): void {

        try{

            const topic_parts = topic.split('/');
            const thingName = topic_parts[1];
            const actionName = topic_parts[2];
            const actionType = topic_parts[3];
            const payloadContent = payload ? JSON.parse(toUtf8(payload as Buffer)) : {};
    
            this.log.debug(`Received: ${topic} ${JSON.stringify(payloadContent)}`);
    
            if(actionType !== 'response'){
                return;
            }

            if(this.aws_thing_dict === undefined){
                return;     
            }    
    
    
            if(this.getDevice(thingName)){
    
                if(actionName === 'status'){

                    this.aws_thing_dict.updateDeviceStatusPayload(thingName, payloadContent);

                    if(this.callback){
                        this.callback(this.getDevice(thingName));
                    }

                }
                else if(actionName === 'registration'){
                    this.aws_thing_dict.updateDeviceRegistrationPayload(thingName, payloadContent);
                }
                else if(actionName === 'control'){
                    this.RefeshDevice(thingName);
                }
            }

        }catch(e){
            this.log.error(`MQTT Message Error: ${e}`);
        }
    }


    protected createMQTTClient(): mqtt5.Mqtt5Client {

        if(this.aws_credentials === undefined || this.aws_identity === undefined){
            throw new Error('aws_credentials is undefined');
        }
        

        const wsConfig : iot.WebsocketSigv4Config = {
            credentialsProvider: auth.AwsCredentialsProvider.newStatic(this.aws_credentials.access_key_id, this.aws_credentials.secret_access_key, this.aws_credentials.session_token),
            region: AWS_REGION        
        }

        const builder: iot.AwsIotMqtt5ClientConfigBuilder = iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(
            AWS_MQTT_ENDPOINT,
            wsConfig
        )

        const clientId = `${this.aws_identity.identity_id}_${generateRandomHex(16)}`;
        this.log.debug(`clientId: ${clientId}`);

        builder.withConnectProperties({ keepAliveIntervalSeconds: 120, clientId: `${clientId}` });

        const client : mqtt5.Mqtt5Client = new mqtt5.Mqtt5Client(builder.build());

        client.on('error', (error) => {
            this.log.error("Error event: " + error.toString());
            this.isConnected = false;
        });

        client.on("messageReceived",(eventData: mqtt5.MessageReceivedEvent) : void => {
            this.handleMQTTMessage(eventData.message.topicName, eventData.message.payload);
        } );


        client.on('attemptingConnect', (eventData: mqtt5.AttemptingConnectEvent) => {
            this.log.debug("Attempting Connect event");
        });


        client.on('connectionSuccess', (eventData: mqtt5.ConnectionSuccessEvent) => {
            this.log.debug("Connection Success event");
            this.log.debug("Connack: " + JSON.stringify(eventData.connack));
            this.log.debug("Settings: " + JSON.stringify(eventData.settings));
            this.isConnected = true;

        });

        client.on('connectionFailure', (eventData: mqtt5.ConnectionFailureEvent) => {
            this.log.error("Connection failure event: " + eventData.error.toString());
            this.isConnected = false;
            //throw new Error("Connection failure event: " + eventData.error.toString());

            if(this.callback){
                this.callback(undefined);
            }

        });

        client.on('disconnection', (eventData: mqtt5.DisconnectionEvent) => {
            this.log.debug("Disconnection event: " + eventData.error.toString());
            if (eventData.disconnect !== undefined) {
                this.log.debug('Disconnect packet: ' + JSON.stringify(eventData.disconnect));
            }

            this.isConnected = false;

            if(this.callback){
                this.callback(undefined);
            }


        });

        client.on('stopped', (eventData: mqtt5.StoppedEvent) => {
            this.log.debug("Stopped event");
        });

        return client;
    }

    protected async publish(thingName: string, request:string, payload: Object|undefined = undefined): Promise<boolean> {
        
        try{

            const defaultPayload = JSON.stringify({ "Timestamp": Math.ceil(Date.now() / 1000) });

            if(this.mqttclient && this.isConnected){

                const topic = `${this.aws_identity?.host_identity_id}/${thingName}`;
    
                const qosPublishRegistrationResult = await this.mqttclient.publish({
                    qos: QOS,
                    topicName: `${topic}/${request}/request`,
                    payload: payload ? JSON.stringify(payload) : defaultPayload
                });

                this.log.debug(`${topic}/${request}/request ${payload ? JSON.stringify(payload) : defaultPayload}`);
    
                return true;
        
            }   


        }catch(e){
            this.log.error(`Publish Error: ${e}`);
            this.Logout();

            if(this.callback){
                this.callback(undefined);
            }

        }

        return false;
      
    
    }

}