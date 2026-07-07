import { PlatformConfig, PlatformAccessory } from 'homebridge';
import {AWSThings} from './jci-hitachi-models';
import JciHitachiPlatform from './platform';


export interface JciHitachiPlatformConfig extends PlatformConfig {
  email: string;
  password: string;
  debugMode: boolean;
  // Trigger a frost wash (凍結洗淨) automatically when a device turns off while
  // its clean notification is active. Host-account only.
  autoCleanWhenPowerOff?: boolean;
}

export interface JciHitachiAccessoryContext {
  device: AWSThings;
}

export abstract class JciHitachiAccessory {

  public async updateStatus(): Promise<void>{}
  constructor(protected readonly platform: JciHitachiPlatform, protected readonly accessory: PlatformAccessory<JciHitachiAccessoryContext>  ) { }

}

