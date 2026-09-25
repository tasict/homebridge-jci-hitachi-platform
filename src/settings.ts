// Name of the plugin (must match the `name` of the package.json).
export const PLUGIN_NAME = 'homebridge-JciHitachi-platform';

// The platform the plugin creates (see config.json).
export const PLATFORM_NAME = 'JciHitachi Platform';

// Base delay before the first reconnect attempt. 30 sec.
export const LOGIN_RETRY_DELAY = 30 * 1000;

// Upper bound for the exponential reconnect backoff. We never stop retrying so the
// plugin can recover on its own once the cloud comes back from maintenance. 10 min.
export const MAX_LOGIN_RETRY_DELAY = 600 * 1000;

// 60 sec = 1 min
export const DEVICE_STATUS_REFRESH_INTERVAL = 60 * 1000;

// How long a device must stay off before the automatic 凍結洗淨 starts, so a unit
// switched straight back on never begins washing. 5 min.
export const AUTO_CLEAN_DELAY = 5 * 60 * 1000;

