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
  // ThingNames that must not be exposed to HomeKit. Managed via the device list
  // in the plugin settings UI.
  ignoredDevices?: string[];
}

export interface JciHitachiAccessoryContext {
  device: AWSThings;
}

export abstract class JciHitachiAccessory {

  public async updateStatus(): Promise<void>{}

  /** Releases resources held by the handler (e.g. polling timers) when the accessory is unregistered. */
  public dispose(): void {}

  constructor(protected readonly platform: JciHitachiPlatform, protected readonly accessory: PlatformAccessory<JciHitachiAccessoryContext>  ) { }

}

