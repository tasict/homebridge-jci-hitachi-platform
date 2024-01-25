import { PlatformConfig, PlatformAccessory } from 'homebridge';
import {AWSThings} from './jci-hitachi-aws-api';
import JciHitachiPlatform from './platform';


export interface JciHitachiPlatformConfig extends PlatformConfig {
  email: string;
  password: string;
  debugMode: boolean;
}

export interface JciHitachiAccessoryContext {
  device: AWSThings;
}

export abstract class JciHitachiAccessory {

  public async updateStatus(): Promise<void>{}
  constructor(protected readonly platform: JciHitachiPlatform, protected readonly accessory: PlatformAccessory<JciHitachiAccessoryContext>  ) { }

}

