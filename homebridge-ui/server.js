'use strict';

const fs = require('fs');
const path = require('path');
const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');

// Reuse the compiled HTTP/auth layer of the plugin. Fetching the device list only
// needs Cognito login + GetAllDevice (plain HTTPS) - no MQTT connection.
const { JciHitachiAWSCognitoConnection, GetAllDevice } = require('../dist/jci-hitachi-connections');
const JciHitachiPlatformLogger = require('../dist/logger').default;

class JciHitachiUiServer extends HomebridgePluginUiServer {

    constructor() {
        super();

        this.log = new JciHitachiPlatformLogger(undefined, false);

        // Cached Cognito tokens so reopening the settings page does not need a fresh
        // password login every time. Same sensitivity level as the plaintext password
        // that already lives in config.json.
        this.tokenCachePath = path.join(this.homebridgeStoragePath, '.jci-hitachi-ui-token.json');

        this.onRequest('/devices', this.handleGetDevices.bind(this));

        this.ready();
    }

    loadCachedTokens(email) {
        try {
            const cache = JSON.parse(fs.readFileSync(this.tokenCachePath, 'utf8'));
            if (cache && cache.email === email && cache.tokens && cache.tokens.refresh_token) {
                return cache.tokens;
            }
        } catch (e) {
            // Missing or unreadable cache simply means a fresh login.
        }
        return undefined;
    }

    saveCachedTokens(email, tokens) {
        try {
            fs.writeFileSync(
                this.tokenCachePath,
                JSON.stringify({ email: email, tokens: tokens, savedAt: new Date().toISOString() }),
                { mode: 0o600 },
            );
        } catch (e) {
            // Not fatal: the device list still works, only the token won't be remembered.
        }
    }

    async handleGetDevices(payload) {

        const email = ((payload && payload.email) || '').trim();
        const password = (payload && payload.password) || '';

        if (!email) {
            throw new RequestError('請先填寫 Email', { status: 400 });
        }

        let tokens;
        let usedCachedToken = false;

        // 1. Try the remembered refresh token first (REFRESH_TOKEN_AUTH).
        const cachedTokens = this.loadCachedTokens(email);
        if (cachedTokens) {
            try {
                tokens = await (new JciHitachiAWSCognitoConnection(email, '', cachedTokens, this.log)).login(true);
                usedCachedToken = !!tokens;
            } catch (e) {
                tokens = undefined;
            }
        }

        // 2. Fall back to a password login.
        if (!tokens) {
            if (!password) {
                throw new RequestError('登入 Token 已失效，請填寫密碼後再重新整理', { status: 401 });
            }
            try {
                tokens = await (new JciHitachiAWSCognitoConnection(email, password, undefined, this.log)).login(false);
            } catch (e) {
                const detail = (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || String(e);
                throw new RequestError(`登入失敗：${detail}`, { status: 401 });
            }
        }

        if (!tokens) {
            throw new RequestError('登入失敗，請確認 Email 與密碼', { status: 401 });
        }

        this.saveCachedTokens(email, tokens);

        let thingDict;
        try {
            thingDict = await (new GetAllDevice(tokens, this.log)).get_data();
        } catch (e) {
            throw new RequestError(`無法取得裝置清單：${(e && e.message) || String(e)}`, { status: 502 });
        }

        const things = thingDict.getAllThings();
        const devices = Object.keys(things).map((thingName) => ({
            thingName: thingName,
            name: things[thingName].CustomDeviceName,
            deviceType: things[thingName].DeviceType,
        }));

        return { devices: devices, usedCachedToken: usedCachedToken };
    }
}

(() => new JciHitachiUiServer())();
