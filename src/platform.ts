import {
  API,
  APIEvent,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';
import JciHitachiAWSAPI, {AWSThings, AWSThingDictionary} from './jci-hitachi-aws-api';
import ClimateAccessory from './accessories/climate';
import JciHitachiPlatformLogger from './logger';
import { JciHitachiAccessoryContext, JciHitachiPlatformConfig, JciHitachiAccessory } from './types';
import {
  LOGIN_RETRY_DELAY,
  MAX_NO_OF_FAILED_LOGIN_ATTEMPTS,
  PLATFORM_NAME,
  PLUGIN_NAME,
} from './settings';

const SUPPORT_DEVICE_TYPE = {
  CLIMATE: 1,
  DEHUMIDIFIER: 2,
  AIR_PURIFIER: 3
}

/**
 * JciHitachi JciHitachiAWSAPI Platform Plugin for Homebridge
 * Based on https://github.com/homebridge/homebridge-plugin-template
 */
export default class JciHitachiPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // Used to track restored cached accessories
  private readonly accessories: PlatformAccessory<JciHitachiAccessoryContext>[] = [];

  private _loginRetryTimeout: NodeJS.Timer | undefined;
  private noOfFailedLoginAttempts = 0;

  public jciHitachiAWSAPI: JciHitachiAWSAPI;
  public readonly log: JciHitachiPlatformLogger;

  public platformConfig: JciHitachiPlatformConfig;

  protected jciHitachiAccessoryDict:{[thingName:string]:JciHitachiAccessory} = {};

  /**
   * This constructor is where you should parse the user config
   * and discover/register accessories with Homebridge.
   *
   * @param logger Homebridge logger
   * @param config Homebridge platform config
   * @param api Homebridge API
   */
  constructor(
    homebridgeLogger: Logger,
    config: PlatformConfig,
    private readonly api: API,
  ) {
    this.platformConfig = config as JciHitachiPlatformConfig;

    // Initialise logging utility
    this.log = new JciHitachiPlatformLogger(homebridgeLogger, this.platformConfig.debugMode);

    this.jciHitachiAWSAPI = new JciHitachiAWSAPI(
      this.platformConfig.email,
      this.platformConfig.password,
      this.log
    );
    
    this.jciHitachiAWSAPI.setCallback(this.notifyCallback.bind(this));

    /**
     * When this event is fired it means Homebridge has restored all cached accessories from disk.
     * Dynamic Platform plugins should only register new accessories after this event was fired,
     * in order to ensure they weren't added to homebridge already. This event can also be used
     * to start discovery of new accessories.
     */
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug('Finished launching and restored cached accessories.');
      this.configurePlugin();
    });
  }

  protected notifyCallback (thing: AWSThings|undefined){

    if(this.jciHitachiAWSAPI.isConnected == false){
      
      this._loginRetryTimeout = setTimeout(
        this.loginAndDiscoverDevices.bind(this),
        LOGIN_RETRY_DELAY,
      );

      return;
    }

    if(thing === undefined) return;
    
    this.log.debug(`NotifyCallback: ${JSON.stringify(thing)}`);  

    const jciHitachiAccessory = this.jciHitachiAccessoryDict[thing.ThingName];

    if(jciHitachiAccessory !== undefined){
      jciHitachiAccessory.updateStatus();
    }
    else{

      this.log.debug(`NotifyCallback: ${thing.ThingName} is not registered.`);
      this.discoverDevices();

    }

  }

  async configurePlugin() {
    await this.loginAndDiscoverDevices();
  }

  async loginAndDiscoverDevices() {
    if (!this.platformConfig.email) {
      this.log.error('Email is not configured - aborting plugin start. '
        + 'Please set the field `email` in your config and restart Homebridge.');
      return;
    }

    if (!this.platformConfig.password) {
      this.log.error('Password is not configured - aborting plugin start. '
        + 'Please set the field `password` in your config and restart Homebridge.');
      return;
    }

    if(this.jciHitachiAWSAPI === undefined || this.jciHitachiAWSAPI.isLoginFailed == true){

        this.log.info('Creating New JciHitachiAWSAPI.');

        // Create JciHitachiAWSAPI communication module
        this.jciHitachiAWSAPI = new JciHitachiAWSAPI(
          this.platformConfig.email,
          this.platformConfig.password,
          this.log
        );
        
        this.jciHitachiAWSAPI.setCallback(this.notifyCallback.bind(this));
    }


    this.log.info('Attempting to log into JciHitachiAWSAPI.');
    this.jciHitachiAWSAPI.Login()
      .then(() => {
        if(this.jciHitachiAWSAPI.isConnected){
          this.log.info('Successfully logged in.');
          this.noOfFailedLoginAttempts = 0;
          this.discoverDevices();
        }
        else{
          this.log.error('Login failed. Skipping device discovery.');
          this.noOfFailedLoginAttempts++;
        }

      })
      .catch(() => {
        this.log.error('Login failed. Skipping device discovery.');
        this.noOfFailedLoginAttempts++;

        if (this.noOfFailedLoginAttempts < MAX_NO_OF_FAILED_LOGIN_ATTEMPTS) {
          this.log.error(
            'The JciHitachiAWSAPI server might be experiencing issues at the moment. '
            + `The plugin will try to log in again in ${LOGIN_RETRY_DELAY / 1000} seconds. `
            + 'If the issue persists, make sure you configured the correct email and password '
            + 'and run the latest version of the plugin. '
            + 'Restart Homebridge when you change your config.',
          );

          this._loginRetryTimeout = setTimeout(
            this.loginAndDiscoverDevices.bind(this),
            LOGIN_RETRY_DELAY,
          );
        } else {
          this.log.error(
            'Maximum number of failed login attempts reached '
            + `(${MAX_NO_OF_FAILED_LOGIN_ATTEMPTS}). `
            + 'Check your login details and restart Homebridge to reset the plugin.',
          );
        }
      });
  }

  /**
   * This function is invoked when Homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<JciHitachiAccessoryContext>) {
    this.log.info(`Loading accessory '${accessory.displayName}' from cache.`);

    /**
     * We don't have to set up the handlers here,
     * because our device discovery function takes care of that.
     *
     * But we need to add the restored accessory to the
     * accessories cache so we can access it during that process.
     */
    this.accessories.push(accessory);
  }

  isSupportedDevice(deviceType:number): boolean {

    if(deviceType == SUPPORT_DEVICE_TYPE.CLIMATE){
      return true;
    }

    this.log.debug(`isUnsupportedDevice: ${deviceType}`);

    return false;

  }

  /**
   * Fetches all of the user's devices from JciHitachiAWSAPI and sets up handlers.
   *
   * Accessories must only be registered once. Previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    
    this.log.info('Discovering devices on JciHitachiAWSAPI.');

    try {
      const aws_thing_dict:AWSThingDictionary | undefined = this.jciHitachiAWSAPI.getDevices();

      // Loop over the discovered (indoor) devices and register each
      // one if it has not been registered before.
      for (const thingName in aws_thing_dict?.getAllThings()) {

        const device:AWSThings|undefined = aws_thing_dict?.getDevice(thingName);

       
        if(device === undefined) {
          continue;
        }

        // Check if the device is supported
        if (!this.isSupportedDevice(device.DeviceType)) {
          this.log.info(`Skipping unsupport device '${device.CustomDeviceName}' with ${device.DeviceType}`);
          continue;
        }

        // Generate a unique id for the accessory.
        // This should be generated from something globally unique,
        // but constant, for example, the device serial number or MAC address
        const uuid = this.api.hap.uuid.generate(device.ThingName);

        // Check if an accessory with the same uuid has already been registered and restored from
        // the cached devices we stored in the `configureAccessory` method above.
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory !== undefined) {
          // The accessory already exists
          this.log.info(`Restoring accessory '${existingAccessory.displayName}' `
            + `(${device.ThingName}) from cache.`);

          // If you need to update the accessory.context then you should run
          // `api.updatePlatformAccessories`. eg.:
          existingAccessory.context.device = device;
          this.api.updatePlatformAccessories([existingAccessory]);

          // Create the accessory handler for the restored accessory

          let jciHitachiAccessory = this.createJciHitachiAccessory(device.DeviceType, this, existingAccessory);

          if(jciHitachiAccessory !== undefined){
            this.jciHitachiAccessoryDict[device.ThingName] = jciHitachiAccessory;
          }

          this.api.updatePlatformAccessories([existingAccessory]);


        } else {
          this.log.info(`Adding accessory '${device.CustomDeviceName}' (${device.ThingName}).`);
          // The accessory does not yet exist, so we need to create it
          const accessory = new this.api.platformAccessory<JciHitachiAccessoryContext>(
            device.CustomDeviceName, uuid);

          // Store a copy of the device object in the `accessory.context` property,
          // which can be used to store any data about the accessory you may need.
          accessory.context.device = device;

          // Create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          let jciHitachiAccessory = this.createJciHitachiAccessory(device.DeviceType, this, accessory);

          if(jciHitachiAccessory !== undefined){
            this.jciHitachiAccessoryDict[device.ThingName] = jciHitachiAccessory;
          }


          // Link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      }

      // At this point, we set up all devices from JciHitachiAWSAPI, but we did not unregister
      // cached devices that do not exist on the JciHitachiAWSAPI account anymore.
      for (const cachedAccessory of this.accessories) {

        if (cachedAccessory.context.device) {
          const thingName = cachedAccessory.context.device.ThingName;

          if (this.jciHitachiAWSAPI.getDevice(thingName) === undefined) {
            // This cached devices does not exist on the JciHitachiAWSAPI account (anymore).
            this.log.info(`Removing accessory '${cachedAccessory.displayName}' (${thingName}) `
              + 'because it does not exist on the JciHitachiAWSAPI account (anymore?).');

            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);
          }
        }
      }
    } catch (error) {
      this.log.error('An error occurred during device discovery. '
        + 'Turn on debug mode for more information.');
      this.log.debug(error);
    }
  }

  protected createJciHitachiAccessory(
    deviceType: number,
    platform: JciHitachiPlatform,
    accessory: PlatformAccessory<JciHitachiAccessoryContext>):JciHitachiAccessory|undefined {

      

    if(deviceType == SUPPORT_DEVICE_TYPE.CLIMATE){
      return new ClimateAccessory(platform, accessory);
        
    }

    this.log.info(`Skipping unsupported deviceType: '${deviceType}' `);
    
    return undefined;
  }

}
