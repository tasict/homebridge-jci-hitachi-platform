import { PlatformConfig, PlatformAccessory } from 'homebridge';
import {AWSThings} from './jci-hitachi-models';
import JciHitachiPlatform from './platform';


export interface JciHitachiPlatformConfig extends PlatformConfig {
  email: string;
  password: string;
  debugMode: boolean;
  // Initial state of each device's 自動凍結洗淨 switch (host account only): start a
  // frost wash once a device has been off for AUTO_CLEAN_DELAY while its clean
  // notification is active. The switch state in HomeKit wins once it has been set.
  autoCleanWhenPowerOff?: boolean;
  // Which optional services each air conditioner exposes (issue #12), for devices
  // without their own entry in `devices`. All default to true; false removes the
  // service from HomeKit. showFrostWash covers the 凍結洗淨通知 sensor and the
  // 凍結洗淨 / 自動凍結洗淨 switches, and also disables the automatic frost wash.
  showFrostWash?: boolean;
  showHumiditySensor?: boolean;
  showAirQualitySensor?: boolean;
  // Per-device overrides of the show* options, keyed by ThingName. Managed via the
  // device list in the plugin settings UI.
  devices?: JciHitachiDeviceConfig[];
  // ThingNames that must not be exposed to HomeKit. Managed via the device list
  // in the plugin settings UI.
  ignoredDevices?: string[];
}

export type ShowOption = 'showFrostWash' | 'showHumiditySensor' | 'showAirQualitySensor';

export interface JciHitachiDeviceConfig extends Partial<Record<ShowOption, boolean>> {
  thingName: string;
}

export interface JciHitachiAccessoryContext {
  device: AWSThings;
  // State of the 自動凍結洗淨 switch. Undefined until it is first toggled, in which
  // case autoCleanWhenPowerOff from the config applies.
  autoClean?: boolean;
}

export abstract class JciHitachiAccessory {

  public async updateStatus(): Promise<void>{}

  /** Releases resources held by the handler (e.g. polling timers) when the accessory is unregistered. */
  public dispose(): void {}

  constructor(protected readonly platform: JciHitachiPlatform, protected readonly accessory: PlatformAccessory<JciHitachiAccessoryContext>  ) { }

}

