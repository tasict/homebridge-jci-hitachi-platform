# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.0] - 2026-10-23

### Added

- The frost wash, humidity and air quality options can now be set per device: each air conditioner in the settings page's device list has its own tags, plus an *All air conditioners* row that changes every unit at once. They are stored in a new `devices` list; the top-level `show*` options remain the default for devices without their own setting, so 1.6.0 configurations keep working.
- The settings page is available in English, Traditional Chinese and Japanese and follows the language of the Homebridge UI.

### Changed

- The device list and the 在「家庭」App 顯示 card are merged into one Devices card: a switch per device replaces the 略過 (skip) checkbox, with that device's tags below it.

## [1.6.0] - 2026-10-23

### Added

- Choose what each air conditioner shows in the Home app ([#12](https://github.com/tasict/homebridge-jci-hitachi-platform/issues/12)): the frost wash sensor and switches (`showFrostWash`), the humidity sensor (`showHumiditySensor`) and the air quality sensor (`showAirQualitySensor`) can each be turned off from the new 在「家庭」App 顯示 section of the settings page. All stay on by default; hiding frost wash also stops the automatic frost wash.

### Changed

- Updated dependencies: `aws-iot-device-sdk-v2` 1.28, `axios` 1.20 and `@homebridge/plugin-ui-utils` 2.2.6; the plugin is now built against Homebridge 2.4 types with TypeScript 6.0, and linted with ESLint 10 (flat config).

### Removed

- Unused or replaceable dependencies `uuid`, `util`, `tslog` and `@aws-sdk/util-utf8-browser` (no longer maintained); the plugin now relies on Node's built-ins for these.

## [1.5.0] - 2026-09-25

### Added

- 自動凍結洗淨 (Auto Frost Wash) switch on every air conditioner (host account only). While it is on, a frost wash starts automatically once the unit has been off for 5 minutes and reports that cleaning is recommended; switching the unit back on within those 5 minutes cancels it. Each unit has its own switch, and its state survives restarts.
- Project website in English, Traditional Chinese and Japanese: [tasict.github.io/homebridge-jci-hitachi-platform](https://tasict.github.io/homebridge-jci-hitachi-platform/). It is now the plugin's homepage in the Homebridge UI.
- You can now support the plugin by buying me a boba (paid by card, no PayPal account needed) as well as with PayPal: from the bottom of the plugin settings, the donate link in the Homebridge UI, the README or GitHub's Sponsor button.

### Changed

- `autoCleanWhenPowerOff` now sets the initial state of the new 自動凍結洗淨 switches, and the automatic wash waits 5 minutes after power-off instead of starting right away.
- The settings page now shows every option itself, in task order: account, device list, then the rarely used options under 進階 (Advanced).
- Upgraded TypeScript to 5.9 and migrated to typescript-eslint v8.
- Rewrote the README: feature overview, supported devices, HomeKit service mapping (including the fan speed steps and host-only switches), full configuration reference and expanded troubleshooting; fixed repository links that pointed to the wrong repo name.

### Removed

- The npm package no longer contains the development test script (`dist/test.*`); it now ships only what the plugin needs to run, plus the changelog.
- `docs/dual-account-setup.md`, which described a different vendor's app.

## [1.4.0] - 2026-07-07

### Added

- Settings UI (`homebridge-ui`) with a device list, so devices can be reviewed and managed from the Homebridge config UI.
- `ignoredDevices` option to exclude specific devices from being exposed to HomeKit.
- The settings UI remembers the login token, so reopening the device list doesn't need a fresh password login every time.
- `autoCleanWhenPowerOff` option to automatically trigger frost wash (凍結洗淨) when the air conditioner is powered off.

### Changed

- Reconnects now reuse the Cognito refresh token instead of performing a full password login each time.

### Fixed

- Login deadlock when the MQTT websocket upgrade keeps failing, which could leave the plugin stuck and unable to retry.
- Credentials no longer leak into log output.
- Accessory handlers (refresh timers, event listeners) are now disposed when devices are removed or ignored.
- The device's supported temperature range from the registration payload is now applied to the HomeKit thermostat characteristics.
- Build error: added `warn()` to `JciHitachiPlatformLogger`.

## [1.3.1] - 2026-07-03

### Fixed

- Repeated device discovery loop triggered by unsupported devices ([#11](https://github.com/tasict/homebridge-jci-hitachi-platform/issues/11)).
- Build error: fall back to `INACTIVE` when `CurrentHeaterCoolerState` is null.

## [1.3.0] - 2026-06-30

### Changed

- Reworked AWS reconnection handling: reconnection is now owned by the platform with a single capped exponential backoff timer that never permanently gives up, so the plugin self-heals after cloud maintenance outages.
- Split the cloud client into modules (`jci-hitachi-connections`, `jci-hitachi-models`, `jci-hitachi-constants`) for maintainability.
- Updated README.

## [1.2.7] - 2025-01-03

### Fixed

- `engines.node` in `package.json` was not compatible with Node 22.

## [1.2.6] - 2025-01-03

- Maintenance release, no functional changes.

## [1.2.5] - 2024-12-30

- Maintenance release, no functional changes.

## [1.2.4] - 2024-09-04

### Added

- Homebridge v2 support: `engines` now accepts `homebridge ^1.6.0 || ^2.0.0-beta.0` and `node ^18.20.4 || ^20.15.1`.

### Changed

- Dependency updates.

## [1.2.3] - 2024-02-27

### Fixed

- MQTT client state was not fully reset after a disconnect, which could prevent reconnection.

Note: version 1.2.2 was skipped.

## [1.2.1] - 2024-02-16

### Fixed

- AWS IoT reconnecting issue.

## [1.2.0] - 2024-02-13

### Changed

- Device status updates now detect a disconnected AWS IoT client and trigger a re-login instead of failing silently.
- Login failures are now logged with the server response.
- Dependency updates (`aws-iot-device-sdk-v2` 1.19.1, `axios` 1.6.7).

## [1.0.14] - 2024-01-25

Note: the version number was reset below the earlier 1.1.x releases; 1.0.14 is newer than 1.1.3.

### Fixed

- Login issue.
- Timeout issue: the session is now logged out and the MQTT client reset after a timeout.

## [1.1.3] - 2024-01-07

### Changed

- Minor code cleanup in the climate accessory.

## [1.1.2] - 2024-01-07

- Maintenance release, no functional changes.

## [1.1.1] - 2024-01-03

### Fixed

- Connection failed issue: the disconnect callback is now fired so reconnection gets triggered.

## [1.1.0] - 2023-12-31

### Fixed

- MQTT client ID and subscribed topics.

## [1.0.10] - 2023-12-28

### Changed

- Dependency updates.

## [1.0.9] - 2023-11-27

### Changed

- Increased connection stability: disconnects now notify the platform callback instead of throwing.

## [1.0.8] - 2023-11-27

First tagged release.

### Added

- Initial release of the plugin: HomeKit support for Jci Hitachi air conditioners via the AWS cloud backend (Cognito auth + IoT Core MQTT), with heater/cooler, humidity and air quality services.

### Fixed

- Connection issue from the initial version.

[Unreleased]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.7...v1.3.0
[1.2.7]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.6...v1.2.7
[1.2.6]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.1...v1.2.3
[1.2.1]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.0.14...v1.2.0
[1.0.14]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.1.3...v1.0.14
[1.1.3]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.0.10...v1.1.0
[1.0.10]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/tasict/homebridge-jci-hitachi-platform/releases/tag/v1.0.8
