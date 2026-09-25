# Homebridge Jci Hitachi Platform

**Website: [tasict.github.io/homebridge-jci-hitachi-platform](https://tasict.github.io/homebridge-jci-hitachi-platform/)** (English, 繁體中文, 日本語)

[![GitHub version](https://img.shields.io/github/package-json/v/tasict/homebridge-jci-hitachi-platform?label=GitHub)](https://github.com/tasict/homebridge-jci-hitachi-platform)
[![npm version](https://img.shields.io/npm/v/homebridge-jci-hitachi-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-jci-hitachi-platform)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

`homebridge-jci-hitachi-platform` is a dynamic platform plugin for [Homebridge](https://homebridge.io) that provides HomeKit support for Jci Hitachi (Hitachi Taiwan) single and multi-split air conditioning systems connected to the AirCloud Home cloud service.

Free and open source. If it keeps your home comfortable, you can [buy me a boba](https://tasict.bobaboba.me) (by card, no PayPal account needed) or [tip with PayPal](https://paypal.me/tasict).

## Features

- Full climate control from the Home app: power, mode (Auto / Cool / Heat), target temperature and fan speed.
- Live status updates pushed from the cloud over MQTT — changes made with the IR remote or the vendor app show up in HomeKit within seconds, plus a 60-second polling fallback.
- Indoor humidity and air quality (PM2.5) sensors.
- Frost wash (凍結洗淨) support: a notification sensor, a manual switch, and a per-device 自動凍結洗淨 switch that starts a wash automatically 5 minutes after the unit is switched off.
- Quick mode (快速運轉) switch.
- Per-device temperature range taken from the device itself, so the Home app only offers set points the unit actually supports.
- Self-healing connection: after a network drop or cloud maintenance outage the plugin keeps retrying with capped exponential backoff and recovers on its own — no Homebridge restart needed.
- Settings UI with a device list, so devices can be reviewed and excluded (`ignoredDevices`) without editing JSON.

## Supported devices

- **Air conditioners** registered in the Jci Hitachi **AirCloud Home** app are supported.
- Dehumidifiers and air purifiers on the same account are recognized but not yet exposed to HomeKit.
- The **AirCloud Go** product line uses a different backend and is **not** supported.

Your devices must be registered and working in the vendor app before this plugin can see them. All supported devices on the account appear in the Home app automatically; devices removed from the account disappear after a Homebridge restart.

## Requirements

- Homebridge `^1.6.0` or `^2.0.0-beta.0`
- Node.js 18, 20, 22 or 24

## Installation

Install through the Homebridge UI (search for `homebridge-jci-hitachi-platform`), or manually:

```sh
npm install -g homebridge-jci-hitachi-platform
```

## Jci Hitachi account

It is recommended to create a **separate account for Homebridge** and share your devices to it from your main account: in the past, using the same account on multiple devices often resulted in being logged out of one of them.

Note that some features are only available to the **host (owner) account**:

- The 快速運轉 (Quick Mode), 凍結洗淨 (Frost Wash) and 自動凍結洗淨 (Auto Frost Wash) switches are only created when the plugin is logged in with the host account.
- The automatic frost wash therefore also requires the host account; with a shared account `autoCleanWhenPowerOff` has no effect and a warning is logged at startup.

If you need these features, log the plugin in with the host account; otherwise a shared secondary account is the more robust choice.

## Configuration

Configure the plugin through the settings UI or directly in the JSON editor:

```json
{
  "platforms": [
    {
      "platform": "JciHitachi Platform",
      "name": "JciHitachi Platform",
      "email": "mail@example.com",
      "password": "********",
      "ignoredDevices": [],
      "autoCleanWhenPowerOff": false,
      "debugMode": false
    }
  ]
}
```

Required:

* `platform` (string):
Tells Homebridge which platform this config belongs to. Leave as is.

* `name` (string):
Will be displayed in the Homebridge log.

* `email` (string):
The username of your Jci Hitachi account.

* `password` (string):
The password of your account.

Optional:

* `ignoredDevices` (array of strings):
`ThingName`s of devices that should not be exposed to HomeKit. The easiest way to manage this list is through the plugin settings UI in Homebridge Config UI X: it shows all devices on your account (remembering the login token between visits) and lets you tick the ones to skip. Restart Homebridge after changing the list.

* `autoCleanWhenPowerOff` (boolean):
The initial state of each device's 自動凍結洗淨 switch (see [Automatic frost wash](#automatic-frost-wash)). Once a switch has been toggled in the Home app, the switch state is kept and this option no longer affects that device. Requires the host (owner) account — see above.

* `debugMode` (boolean):
If `true`, the plugin will print debugging information to the Homebridge log.

## What appears in the Home app

Each air conditioner is exposed as one accessory with the following services:

| Service | What it does |
| --- | --- |
| Heater Cooler | Power, mode (Auto / Cool / Heat), current and target temperature, fan speed |
| Humidity Sensor | Indoor relative humidity reported by the unit |
| Air Quality Sensor | Air quality level derived from the unit's PM2.5 reading, with the raw PM2.5 density |
| Leak Sensor「凍結洗淨通知」 | Turns on when the unit recommends a frost wash, so the Home app can send a notification (HomeKit has no dedicated "cleaning" sensor type, so a leak sensor is used) |
| Switch「快速運轉」(host account only) | Toggles quick mode |
| Switch「凍結洗淨」(host account only) | Starts / indicates a frost wash |
| Switch「自動凍結洗淨」(host account only) | Turns the [automatic frost wash](#automatic-frost-wash) on or off for this unit |

Details:

- **Modes.** HomeKit can set Auto, Cool and Heat. Dry and Fan-only can still be selected from the IR remote or vendor app; the plugin reflects them as the closest HomeKit state.
- **Target temperature** uses the range reported by the device itself (typically 16–32 °C) in 1 °C steps.
- **Fan speed** is mapped to the rotation-speed slider in seven steps: 0 Auto, 1 Silent, 2 Low, 3 Medium, 4 High, 5 Rapid, 6 Express.
- **Current heating/cooling state** (heating / cooling / idle) is derived by comparing the indoor temperature with the set temperature for the active mode.

### Automatic frost wash

With the 自動凍結洗淨 switch on, the plugin watches for the unit being switched off — from the Home app, the IR remote or the vendor app alike. Five minutes later it checks the unit again and starts a frost wash if:

- the unit is still off,
- it reports that a frost wash is recommended (the 凍結洗淨通知 sensor is on), and
- no frost wash is already running.

Switching the unit back on within those five minutes, or turning the 自動凍結洗淨 switch off, cancels the pending wash. The switch state is stored per device and survives Homebridge restarts; a wash that was pending during a restart is not resumed.

## Troubleshooting

- If you have any issues with this plugin, enable `debugMode` in the settings and restart the plugin. This will print additional information to the log. If this doesn't help you resolve the issue, feel free to create a [GitHub issue](https://github.com/tasict/homebridge-jci-hitachi-platform/issues) and attach the available debugging information.

- If you run into login errors despite using the correct login details, make sure you accepted the latest terms and conditions after logging into the Jci Hitachi app.

- During vendor cloud maintenance the plugin will log connection failures and keep retrying automatically; it reconnects on its own once the service is back. No restart is required.

- If the plugin affects the general responsiveness and reliability of your Homebridge setup, you can run it as an isolated [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

## Support

If this plugin is useful to you, I'd love it if you bought me a boba:

- **[Buy me a boba](https://tasict.bobaboba.me)**: pay by card, no PayPal account needed
- **[Tip with PayPal](https://paypal.me/tasict)**

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history.

## Contributing

You can contribute to this project in the following ways:

* Test/use the plugin and [report issues and share feedback](https://github.com/tasict/homebridge-jci-hitachi-platform/issues).

* Review source code changes [before](https://github.com/tasict/homebridge-jci-hitachi-platform/pulls) and [after](https://github.com/tasict/homebridge-jci-hitachi-platform/commits/master) they are published.

* Contribute with your own bug fixes, code clean-ups, or additional features (pull requests are accepted).

## Acknowledgements

* Thanks to [qqaatw](https://github.com/qqaatw) for creating and maintaining [LibJciHitachi](https://github.com/qqaatw/LibJciHitachi), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.

* Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer

All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
