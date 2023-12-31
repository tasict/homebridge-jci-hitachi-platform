// Name of the plugin (must match the `name` of the package.json).
export const PLUGIN_NAME = 'homebridge-JciHitachi-platform';

// The platform the plugin creates (see config.json).
export const PLATFORM_NAME = 'JciHitachi Platform';

// 360 sec = 6 min
export const LOGIN_RETRY_DELAY = 360 * 1000;

export const MAX_NO_OF_FAILED_LOGIN_ATTEMPTS = 5;

// Used to renew the token periodically. Only a safety measure, since we are handling
// network errors dynamically and re-issuing a login upon a 401 Unauthorized error.
// 604,800 sec = 7 days
export const LOGIN_TOKEN_REFRESH_INTERVAL = 604800 * 1000;

// 60 sec = 1 min
export const DEVICE_STATUS_REFRESH_INTERVAL = 60 * 1000;

