# Homebridge Jci Hitachi Platform

[![GitHub version](https://img.shields.io/github/package-json/v/tasict/homebridge-jci-hitachi-platform?label=GitHub)](https://github.com/tasict/homebridge-jci-hitachi-platform)
[![npm version](https://img.shields.io/npm/v/homebridge-jci-hitachi-platform?color=%23cb3837&label=npm)](https://www.npmjs.com/package/homebridge-jci-hitachi-platform)

`homebridge-jci-hitachi` is a dynamic platform plugin for [Homebridge](https://homebridge.io) that provides HomeKit support for Jci Hitachi single and multi-split air conditioning systems.

## How it works
The plugin communicates with your AC units through the jci hitachi service. This means your units must be registered and set up there before you can use this plugin.

All devices that are set up on your jci hitachi account will appear in your Home app. If you remove a device from your jci hitachi account, it will also disappear from your Home app after you restart Homebridge.

## jci hitachi account

In the past, using the same account on multiple devices often resulted in being logged out of one of them. This made it necessary to create a secondary account in order for the plugin to operate reliably.

## Homebridge setup
Configure the plugin through the settings UI or directly in the JSON editor:

```json
{
  "platforms": [
    {
        "platform": "JciHitachi Platform",
        "name": "JciHitachi Platform",
        "email": "mail@example.com",
        "password": "********",
        "debugMode": false,
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
The username of your jci hitachi account.

* `password` (string):
The password of your account.

Optional:

* `debugMode` (boolean):
If `true`, the plugin will print debugging information to the Homebridge log.

## Troubleshooting

- If you have any issues with this plugin, enable the debug mode in the settings (and restart the plugin). This will print additional information to the log. If this doesn't help you resolve the issue, feel free to create a [GitHub issue](https://github.com/tasict/homebridge-jci-hitachi/issues) and attach the available debugging information.

- If you run into login errors despite using the correct login details, make sure you accepted the latest terms and conditions after logging into the jci hitachi app.

- If the plugin affects the general responsiveness and reliability of your Homebridge setup, you can run it as an isolated [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

## Contributing

You can contribute to this project in the following ways:

* Test/use the plugin and [report issues and share feedback](https://github.com/tasict/homebridge-jci-hitachi/issues).

* Review source code changes [before](https://github.com/tasict/homebridge-jci-hitachi/pulls) and [after](https://github.com/tasict/homebridge-jci-hitachi/commits/master) they are published.

* Contribute with your own bug fixes, code clean-ups, or additional features (pull requests are accepted).

## Acknowledgements
* Thanks to [qqaatw](https://github.com/qqaatw) for creating and maintaining [LibJciHitachi](https://github.com/qqaatw/LibJciHitachi), which served as motivation for this platform plugin and proved particularly helpful in determining API request/response payloads.

* Thanks to the team behind Homebridge. Your efforts do not go unnoticed.

## Disclaimer
All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.
