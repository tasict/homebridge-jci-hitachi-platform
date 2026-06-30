import JciHitachiPlatformLogger from './logger';

export interface NotifyCallback {
    (thingName: AWSThings|undefined): void;
}

// Static device descriptor returned by GetAllDevice.
export interface AWSThingInfo {
    ThingName: string;
    CustomDeviceName: string;
    DeviceType: number;
}

// Live device state pushed over MQTT on the `status` topic. All fields are optional
// because they only appear once the first status response has been received.
export interface AWSThingStatus {
    Switch?: number;
    Mode?: number;
    TemperatureSetting?: number;
    IndoorTemperature?: number;
    IndoorHumidity?: number;
    PM25?: number;
    FanSpeed?: number;
    QuickMode?: number;
    CleanNotification?: number;
    CleanSwitch?: number;
}

// Static device metadata pushed over MQTT on the `registration` topic.
export interface AWSThingRegistration {
    // Packed min/max: min = (value >> 8) & 255, max = value & 255.
    TemperatureSetting?: number;
    FirmwareVersion?: string;
    Model?: string;
}

export class AWSTokens {
    access_token: string;
    id_token: string;
    refresh_token: string;
    expiration: number;

    constructor(access_token = '', id_token = '', refresh_token = '', expiration = 0) {
        this.access_token = access_token;
        this.id_token = id_token;
        this.refresh_token = refresh_token;
        this.expiration = expiration;
    }
}

export class AWSIdentity {
    identity_id: string;
    host_identity_id: string;
    user_name: string;
    user_attributes: {[key: string]: string};

    constructor(identity_id: string, user_name: string, user_attributes: {[key: string]: string}) {
        this.identity_id = identity_id;
        this.host_identity_id = user_attributes['custom:host_identity_id'];
        this.user_name = user_name;
        this.user_attributes = user_attributes;
    }
}

export class AWSCredentials {

    access_key_id = '';
    secret_access_key = '';
    session_token = '';
    expiration = 0;

    constructor(awscredentialsContent: string) {

        const awscredentialsJson = JSON.parse(awscredentialsContent);

        this.access_key_id = awscredentialsJson['AccessKeyId'];
        this.secret_access_key = awscredentialsJson['SecretKey'];
        this.session_token = awscredentialsJson['SessionToken'];
        this.expiration = awscredentialsJson['Expiration'];
    }
}

export class AWSThingDictionary {

    things: {[thingName: string]: AWSThings} = {};
    log: JciHitachiPlatformLogger|undefined;

    constructor(awsallthingsContent: string, log: JciHitachiPlatformLogger|undefined = undefined) {

        this.log = log;

        const awsallthingsJson = JSON.parse(awsallthingsContent);
        const things = awsallthingsJson['results']['Things'];

        for (let i = 0; i < things.length; i++) {
            const thing = new AWSThings(JSON.stringify(things[i]));
            this.things[thing.ThingName] = thing;
        }

        this.log?.info(`You have ${Object.keys(this.things).length} devices.`);
    }

    public getAllThings(): {[thingName: string]: AWSThings} {
        return this.things;
    }

    public hasThingName(thingName: string): boolean {
        return this.things[thingName] !== undefined;
    }

    public getDevice(thingName: string): AWSThings|undefined {
        return this.things[thingName];
    }

    public updateDeviceStatusPayload(thingName: string, payload: AWSThingStatus): void {
        if (this.hasThingName(thingName) === false) {
            return;
        }
        this.things[thingName].updateStatusPayload(payload);
    }

    public updateDeviceRegistrationPayload(thingName: string, payload: AWSThingRegistration): void {
        if (this.hasThingName(thingName) === false) {
            return;
        }
        this.things[thingName].updateRegistrationPayload(payload);
    }
}

export class AWSThings {

    thingObject: AWSThingInfo;
    statusPayload: AWSThingStatus|undefined = undefined;
    registrationPayload: AWSThingRegistration|undefined = undefined;

    constructor(awsthingsContent: string) {
        this.thingObject = JSON.parse(awsthingsContent);
    }

    public get ThingName(): string {
        return this.thingObject.ThingName;
    }

    public get CustomDeviceName(): string {
        return this.thingObject.CustomDeviceName;
    }

    public get DeviceType(): number {
        return this.thingObject.DeviceType;
    }

    public get SwitchOn(): number {
        return this.statusPayload?.Switch ?? 0;
    }

    public get TemperatureSetting(): number|undefined {
        return this.statusPayload?.TemperatureSetting;
    }

    public get TemperatureSettingMin(): number {
        return this.registrationPayload ? ((this.registrationPayload.TemperatureSetting ?? 0) >> 8 & 255) : 16;
    }

    public get TemperatureSettingMax(): number {
        return this.registrationPayload ? ((this.registrationPayload.TemperatureSetting ?? 0) & 255) : 32;
    }

    public get IndoorTemperature(): number|undefined {
        return this.statusPayload?.IndoorTemperature;
    }

    public get IndoorHumidity(): number|undefined {
        return this.statusPayload?.IndoorHumidity;
    }

    public get PM25(): number|undefined {
        return this.statusPayload?.PM25;
    }

    public get FanSpeed(): number|undefined {
        return this.statusPayload?.FanSpeed;
    }

    public get QuickMode(): number {
        return this.statusPayload?.QuickMode ?? 0;
    }

    public get CleanNotification(): number {
        return this.statusPayload?.CleanNotification ?? 0;
    }

    public get CleanSwitch(): number {
        return this.statusPayload?.CleanSwitch ?? 0;
    }

    public get FirmwareVersion(): string|undefined {
        return this.registrationPayload?.FirmwareVersion;
    }

    public get Model(): string|undefined {
        return this.registrationPayload?.Model;
    }

    public updateStatusPayload(payload: AWSThingStatus): void {
        this.statusPayload = payload;
    }

    public updateRegistrationPayload(payload: AWSThingRegistration): void {
        this.registrationPayload = payload;
    }
}
