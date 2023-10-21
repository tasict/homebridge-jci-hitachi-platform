import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback, CharacteristicEventTypes } from 'homebridge';
import JciHitachiPlatform from '../platform';
import { DEVICE_STATUS_REFRESH_INTERVAL, MAX_NO_OF_FAILED_LOGIN_ATTEMPTS } from '../settings';
import { JciHitachiAccessoryContext, JciHitachiAccessory} from '../types';
import { AWSThings } from '../jci-hitachi-aws-api';

enum ClimateCommandType {
  Power = 'Switch',
  Mode = 'Mode',
  CurrentTemperature = 'IndoorTemperature',
  TargetTemperature = 'TemperatureSetting',
  FanSpeed = 'FanSpeed',
  VerticalWindDirectionSwitch = 'VerticalWindDirectionSwitch',
  HorizontalWindDirectionSetting = 'HorizontalWindDirectionSetting',
  QuickMode = 'QuickMode',
  CleanSwitch = 'CleanSwitch'

}

enum ClimateFanSpeedMode {
  Auto = 0,
  Silent = 1,
  Low = 2,
  Medium = 3,
  High = 4,
  Rapid = 5,
  Express = 6,

}

enum ClimateMode {
  Cool = 0,
  Dry = 1,
  FanOnly = 2,
  Auto = 3,
  Heat = 4,
}



/**
 * An instance of this class is created for each accessory the platform registers.
 * Each accessory may expose multiple services of different service types.
 */
export default class ClimateAccessory extends JciHitachiAccessory{
  
  private services: Service[] = [];
  private _refreshInterval: NodeJS.Timer | undefined;

  constructor(
    protected readonly platform: JciHitachiPlatform,
    protected readonly accessory: PlatformAccessory<JciHitachiAccessoryContext>,
  ) {

    super(platform, accessory);
    if(!accessory.context.device === undefined) {
      this.platform.log.error('Device is undefined');
      return;
    }


    // Accessory Information
    // https://developers.homebridge.io/#/service/AccessoryInformation
    this.accessory.getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'JciHitachi TW',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        accessory.context.device.Model || 'Unknown',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber, this.accessory.UUID,
    );

    this.accessory.getService(this.platform.Service.AccessoryInformation)
    ?.setCharacteristic(
      this.platform.Characteristic.FirmwareRevision,
      this.accessory.context.device.FirmwareVersion || '0',
    );

    this.services['Climate'] = this.accessory.getService(this.platform.Service.HeaterCooler)
      || this.accessory.addService(this.platform.Service.HeaterCooler);

    
    // This is what is displayed as the default name on the Home app
    this.services['Climate'].setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.CustomDeviceName || '空調',
    );


    this.services['Climate']
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    this.services['Climate']
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .setProps({
        minValue: -100,
        maxValue: 100,
        minStep: 0.01,
      });  

    this.services['Climate']
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    this.services['Climate']
    .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
    .onSet(this.setTargetHeaterCoolerState.bind(this));


    // Cooling Threshold Temperature (optional)
    this.services['Climate']
      .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .setProps({
        minValue: this.accessory.context.device.TemperatureSettingMin,
        maxValue: this.accessory.context.device.TemperatureSettingMax,
        minStep: 1,
      })
      .onSet(this.setCoolingThresholdTemperature.bind(this));

    // Heating Threshold Temperature (optional)
    this.services['Climate']
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.accessory.context.device.TemperatureSettingMin,
        maxValue: this.accessory.context.device.TemperatureSettingMax,
        minStep: 1,
      })
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    this.services['Climate']
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 6,
        minStep: 1,
      })
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    /////
    this.services['HumiditySensor'] = this.accessory.getService(this.platform.Service.HumiditySensor)
    || this.accessory.addService(this.platform.Service.HumiditySensor);

    this.services['HumiditySensor'].getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentRelativeHumidity.bind(this));

   
    /////
    this.services['AirQualitySensor'] = this.accessory.getService(this.platform.Service.AirQualitySensor)
    || this.accessory.addService(this.platform.Service.AirQualitySensor);

    this.services['AirQualitySensor'].getCharacteristic(this.platform.Characteristic.AirQuality)
      .onGet(this.getCurrentAirQuality.bind(this));

    this.services['AirQualitySensor'].getCharacteristic(this.platform.Characteristic.PM2_5Density)
      .onGet(this.getCurrentPM2_5Density.bind(this));

    this.services['AirQualitySensor'].getCharacteristic(this.platform.Characteristic.StatusActive)
      .onGet(this.getActive.bind(this));


    //////////

    if(this.platform.jciHitachiAWSAPI.isHost){

      const buttonQuickModeName = '快速運轉';

      this.services['QuickMode'] = this.accessory.getServiceById(this.platform.Service.Switch, ClimateCommandType.QuickMode) || this.accessory.addService(this.platform.Service.Switch,  buttonQuickModeName, ClimateCommandType.QuickMode);
          
      this.services['QuickMode'].setCharacteristic(this.platform.Characteristic.Name, buttonQuickModeName);
      this.services['QuickMode'].getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setQuickMode.bind(this))
        .onGet(this.getQuickMode.bind(this));
          
      this.services['QuickMode'].addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.services['QuickMode'].setCharacteristic(this.platform.Characteristic.ConfiguredName, buttonQuickModeName);

      const buttonCleanSwitch = '凍結洗淨';

      this.services['CleanSwitch'] = this.accessory.getServiceById(this.platform.Service.Switch, ClimateCommandType.CleanSwitch) || this.accessory.addService(this.platform.Service.Switch,  buttonCleanSwitch, ClimateCommandType.CleanSwitch);
          
      this.services['CleanSwitch'].setCharacteristic(this.platform.Characteristic.Name, buttonCleanSwitch);
      this.services['CleanSwitch'].getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setCleanSwitch.bind(this))
        .onGet(this.getCleanSwitch.bind(this));
          
      this.services['CleanSwitch'].addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
      this.services['CleanSwitch'].setCharacteristic(this.platform.Characteristic.ConfiguredName, buttonCleanSwitch);



    }



    ///////////    


     this.services['LeakSensor'] = this.accessory.getService(this.platform.Service.LeakSensor) || this.accessory.addService(this.platform.Service.LeakSensor, '凍結洗淨通知');
    
     this.services['LeakSensor'].setCharacteristic(this.platform.Characteristic.Name, '凍結洗淨通知');
     this.services['LeakSensor'].getCharacteristic(this.platform.Characteristic.LeakDetected)
    .onGet(this.getCleanNotification.bind(this));

     this.services['LeakSensor'].addOptionalCharacteristic(this.platform.Characteristic.ConfiguredName);
     this.services['LeakSensor'].setCharacteristic(this.platform.Characteristic.ConfiguredName, '凍結洗淨通知');



    
    this.refreshDeviceStatus();

  }

  /**
   * Retrieves the device status from JciHitachi and updates its characteristics.
   */
  async refreshDeviceStatus() {

    this.platform.log.debug(`Accessory: Refresh status for device '${this.accessory.displayName}'`);

    try {
      this.platform.jciHitachiAWSAPI.RefeshDevice(this.accessory.context.device?.ThingName || '');
    } catch (error) {
      this.platform.log.error('An error occurred while refreshing the device status. Turn on debug mode for more information.');

      if (error) {
        this.platform.log.debug(error);
      }
    }

    // Schedule continuous device updates on the first run
    if (!this._refreshInterval) {
      this._refreshInterval = setInterval(
        this.refreshDeviceStatus.bind(this),
        DEVICE_STATUS_REFRESH_INTERVAL,
      );
    }
  }

  async getStatus(actionName:string):Promise<Object|undefined>{
    return this.platform.jciHitachiAWSAPI.GetDeviceStatus(this.accessory.context.device?.ThingName || '', actionName);
  }

  async setStatus(actionName:string, value:number):Promise<Object|undefined>{
    return this.platform.jciHitachiAWSAPI.SetDeviceStatus(this.accessory.context.device?.ThingName || '', actionName, value);
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`Accessory: setActive() for device '${this.accessory.displayName}'`);
    
    this.setStatus(ClimateCommandType.Power, value === this.platform.Characteristic.Active.ACTIVE ? 1 : 0);
    this.services['Climate'].updateCharacteristic(this.platform.Characteristic.Active, value);  
  }

  async getActive():Promise<CharacteristicValue> {       
      return this.accessory.context.device.SwitchOn ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async getRotationSpeed():Promise<CharacteristicValue> {
    return this.accessory.context.device.FanSpeed ? this.accessory.context.device.FanSpeed : 0;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.setStatus(ClimateCommandType.FanSpeed, value as number);
    this.services['Climate'].updateCharacteristic(this.platform.Characteristic.RotationSpeed, value);
  }

  async setQuickMode(value: CharacteristicValue) {

    this.platform.log.debug(`Accessory: setQuickMode() for device '${this.accessory.displayName}' to ${value}}`);

    this.setStatus(ClimateCommandType.QuickMode, value ? 1 : 0);
    this.services['QuickMode'].updateCharacteristic(this.platform.Characteristic.On, value);

  }

  async getQuickMode():Promise<CharacteristicValue> {
    return this.accessory.context.device.QuickMode;
  }

  async setCleanSwitch(value: CharacteristicValue) {
    
    this.platform.log.debug(`Accessory: setCleanSwitch() for device '${this.accessory.displayName}' to ${value}}`);

    this.setStatus(ClimateCommandType.CleanSwitch, value ? 1 : 0);
    this.services['CleanSwitch'].updateCharacteristic(this.platform.Characteristic.On, value);
   
  }
  
  async getCleanSwitch():Promise<CharacteristicValue> {
    return this.accessory.context.device.CleanSwitch;
  }

  async getCleanNotification():Promise<CharacteristicValue> {
    return this.accessory.context.device.CleanNotification;
  }
    

  async getCurrentHeaterCoolerState():Promise<CharacteristicValue> {

    const currentTemperature = await this.getStatus(ClimateCommandType.CurrentTemperature) || 0;
    const setTemperature = await this.getStatus(ClimateCommandType.TargetTemperature) || 0;
    const currentMode = await this.getStatus(ClimateCommandType.Mode) || 0;

    switch (currentMode) 
    {
      // Auto
      case ClimateMode.Auto:
        // Set target state and current state (based on current temperature)
        this.services['Climate'].updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,
          this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
        );

        if (currentTemperature < setTemperature) {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
        } else if (currentTemperature > setTemperature) {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.COOLING);
        } else {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
        }
        break;

      // Heat
      case ClimateMode.Heat:
        this.services['Climate'].updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,
          this.platform.Characteristic.TargetHeaterCoolerState.HEAT,
        );

        if (currentTemperature < setTemperature) {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
        } else {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
        }
        break;

      // Cool
      case ClimateMode.Cool:
        this.services['Climate'].updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,
          this.platform.Characteristic.TargetHeaterCoolerState.COOL,
        );

        if (currentTemperature > setTemperature) {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.COOLING);
        } else {
          this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
        }
        break;

      // Dry (Dehumidifier)
      case ClimateMode.Dry:
        this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
          .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          this.services['Climate'].updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,

          this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
        );
        break;

      // Fan
      case ClimateMode.FanOnly:
        this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
          .updateValue(this.platform.Characteristic.CurrentHeaterCoolerState.IDLE);
          this.services['Climate'].updateCharacteristic(
          this.platform.Characteristic.TargetHeaterCoolerState,

          this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
        );
        break;

      default:
        this.platform.log.error(
          `Unknown TargetHeaterCoolerState state: '${this.accessory.displayName}' '${currentMode}'`);
        break;
    }
    return this.services['Climate'].getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState).value ;
  
  }

  async setCoolingThresholdTemperature(value: CharacteristicValue) {

    this.platform.log.debug(`Accessory: setCoolingThresholdTemperature() for device '${this.accessory.displayName}'`);

    const threshold:number = +value;

    this.setStatus(ClimateCommandType.TargetTemperature, threshold);

    this.services['Climate'].getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
      .updateValue(value);
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {

    this.platform.log.debug(`Accessory: setHeatingThresholdTemperature() for device '${this.accessory.displayName}'`);

    const threshold:number = +value;

    this.setStatus(ClimateCommandType.TargetTemperature, threshold);

    this.services['Climate'].getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .updateValue(value);
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {

    this.platform.log.debug(`Accessory: setTargetHeaterCoolerState() for device '${this.accessory.displayName}'`);

    let mode = ClimateMode.Auto;

    switch (value) {
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        mode = ClimateMode.Auto;
        break;

      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        mode = ClimateMode.Cool;
        break;

      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        mode = ClimateMode.Heat;
        break;

      
      default:
        this.platform.log.error('Unknown TargetHeaterCoolerState', value );
        return;
    }


    this.setStatus(ClimateCommandType.Mode, mode);

    this.services['Climate'].getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .updateValue(value);
  }


  async getCurrentRelativeHumidity(){
    return this.accessory.context.device.IndoorHumidity || 0;
  }

  async getCurrentAirQuality():Promise<CharacteristicValue> {
    const pm25 = this.accessory.context.device.PM25 || 0;
    const pm25Quality = pm25 <= 35 ? 1 : (pm25 <= 53 ? 2 : (pm25 <= 70 ? 3 : (pm25 <= 150 ? 4 : 5)));

    return pm25Quality;
  }

  async getCurrentPM2_5Density():Promise<CharacteristicValue>{
    return this.accessory.context.device.PM25 || 0;
  }

  public async updateStatus() {
    
    this.platform.log.info(`Updating status for device '${this.accessory.displayName}'`);
    
    let temperatureSetting:number = this.accessory.context.device.TemperatureSetting || 0;      
    
    if(temperatureSetting > this.accessory.context.device.TemperatureSettingMax || temperatureSetting < this.accessory.context.device.TemperatureSettingMin){
      temperatureSetting = this.accessory.context.device.IndoorTemperature || this.accessory.context.device.TemperatureSettingMin;
    }      


    this.accessory.getService(this.platform.Service.AccessoryInformation)
    ?.setCharacteristic(
      this.platform.Characteristic.Model,
      this.accessory.context.device.Model || 'Unknown',
    );

    this.accessory.getService(this.platform.Service.AccessoryInformation)
    ?.setCharacteristic(
      this.platform.Characteristic.FirmwareRevision,
      this.accessory.context.device.FirmwareVersion || '0',
    );

    this.services['Climate'].updateCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.context.device.CustomDeviceName || '空調',
    );

    this.services['Climate'].updateCharacteristic(
      this.platform.Characteristic.Active,
      this.accessory.context.device.SwitchOn || 0,
    );

    this.services['Climate'].updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.accessory.context.device.IndoorTemperature || 0,
    );

    this.services['Climate'].updateCharacteristic(
      this.platform.Characteristic.CoolingThresholdTemperature,
      temperatureSetting
    );

    this.services['Climate'].updateCharacteristic(
      this.platform.Characteristic.HeatingThresholdTemperature,
      temperatureSetting
    );

    this.services['Climate'].updateCharacteristic(
      this.platform.Characteristic.CurrentHeaterCoolerState, 
      await this.getCurrentHeaterCoolerState()
    );

    this.services['HumiditySensor'].updateCharacteristic(
      this.platform.Characteristic.CurrentRelativeHumidity,
      this.accessory.context.device.IndoorHumidity || 0,
    );

    this.services['AirQualitySensor'].updateCharacteristic(
      this.platform.Characteristic.AirQuality,
      await this.getCurrentAirQuality()
    );

    this.services['AirQualitySensor'].updateCharacteristic(
      this.platform.Characteristic.PM2_5Density,
      this.accessory.context.device.PM25 || 0,
    );

    this.services['AirQualitySensor'].updateCharacteristic(
      this.platform.Characteristic.StatusActive,
      this.accessory.context.device.SwitchOn || 0,
    );


    if(this.platform.jciHitachiAWSAPI.isHost){
             
      this.services['QuickMode'].updateCharacteristic(this.platform.Characteristic.On, this.accessory.context.device.QuickMode || 0);
      this.services['CleanSwitch'].updateCharacteristic(this.platform.Characteristic.On, this.accessory.context.device.CleanSwitch || 0);

    }

  
  }



}
