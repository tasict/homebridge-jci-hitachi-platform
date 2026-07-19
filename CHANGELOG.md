# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Upgraded TypeScript to 5.9 and migrated to typescript-eslint v8.

## [1.4.0] - 2026-07-07

### Added

- Settings UI (`homebridge-ui`) with a device list, so devices can be reviewed and managed from the Homebridge config UI.
- `ignoredDevices` option to exclude specific devices from being exposed to HomeKit.
- Login token cache, so restarts can resume the session instead of performing a fresh password login every time.
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

[Unreleased]: https://github.com/tasict/homebridge-jci-hitachi-platform/compare/v1.4.0...HEAD
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
