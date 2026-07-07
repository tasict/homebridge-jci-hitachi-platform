import JciHitachiPlatformLogger from './logger';
import axios, { AxiosResponse } from 'axios';
import { AWS_SSL_CERT } from './cert';
import {
    AWS_COGNITO_CLIENT_ID,
    AWS_COGNITO_ENDPOINT,
    AWS_COGNITO_IDP_ENDPOINT,
    AWS_COGNITO_USERPOOL_ID,
    AWS_IOT_ENDPOINT,
} from './jci-hitachi-constants';
import { AWSCredentials, AWSIdentity, AWSThingDictionary, AWSTokens } from './jci-hitachi-models';

const https = require('https');

abstract class JciHitachiAWSHttpConnection {

    log: JciHitachiPlatformLogger;

    constructor(log: JciHitachiPlatformLogger) {
        this.log = log;
    }

    // Request an https connection pinned to AWS_SSL_CERT and return the response.
    protected async requestHttps(url: string, method: string, headers: any, data: any): Promise<AxiosResponse> {
        return await axios.request({
            httpsAgent: new https.Agent({
                ca: [AWS_SSL_CERT],
            }),
            method: method,
            url: url,
            headers: headers,
            data: JSON.stringify(data),
        });
    }
}

export class JciHitachiAWSCognitoConnection extends JciHitachiAWSHttpConnection {

    email: string;
    password: string;
    aws_tokens: AWSTokens|undefined;

    constructor(email: string, password: string, aws_tokens: AWSTokens|undefined, log: JciHitachiPlatformLogger) {
        super(log);
        this.email = email;
        this.password = password;
        this.aws_tokens = aws_tokens;
    }

    protected _generateHeaders(target: string): object {
        return {
            'X-Amz-Target': target,
            'User-Agent': 'Dalvik/2.1.0',
            'content-type': 'application/x-amz-json-1.1',
            'Accept': 'application/json',
        };
    }

    protected _handle_response(response: AxiosResponse): AxiosResponse {
        if (response.status !== 200) {
            this.log.error(`login_req: ${JSON.stringify(response.data)}`);
        }
        return response;
    }

    protected _send(target: string, data: any): Promise<AxiosResponse> {
        const endpoint = `https://${this.constructor.name === 'GetCredentials' ? AWS_COGNITO_ENDPOINT : AWS_COGNITO_IDP_ENDPOINT}`;
        return this.requestHttps(endpoint, 'post', this._generateHeaders(target), data);
    }

    public async login(use_refresh_token: boolean): Promise<AWSTokens|undefined> {

        let login_json_data: any;
        const login_headers = this._generateHeaders('AWSCognitoIdentityProviderService.InitiateAuth');

        if (use_refresh_token && this.aws_tokens) {
            login_json_data = {
                'AuthFlow': 'REFRESH_TOKEN_AUTH',
                'AuthParameters': {
                    'REFRESH_TOKEN': this.aws_tokens.refresh_token,
                },
                'ClientId': AWS_COGNITO_CLIENT_ID,
            };
        } else {
            login_json_data = {
                'AuthFlow': 'USER_PASSWORD_AUTH',
                'AuthParameters': {
                    'USERNAME': this.email,
                    'PASSWORD': this.password,
                },
                'ClientId': AWS_COGNITO_CLIENT_ID,
            };
        }

        const login_req: Promise<AxiosResponse> = this.requestHttps(`https://${AWS_COGNITO_IDP_ENDPOINT}`, 'post', login_headers, login_json_data);

        const response = this._handle_response(await login_req);

        if (response.status === 200) {
            const auth_result = response.data['AuthenticationResult'];

            this.aws_tokens = new AWSTokens(
                auth_result['AccessToken'],
                auth_result['IdToken'],
                use_refresh_token && this.aws_tokens ? this.aws_tokens.refresh_token : auth_result['RefreshToken'],
                // ExpiresIn is in seconds; keep the expiration timestamp in ms.
                new Date().valueOf() + auth_result['ExpiresIn'] * 1000,
            );
        } else {
            this.log.error(`login_req: ${JSON.stringify(response.data)}`);
        }

        return this.aws_tokens;
    }
}

export class GetUser extends JciHitachiAWSCognitoConnection {

    public async get_data(): Promise<AWSIdentity|undefined> {

        if (!this.aws_tokens) {
            return undefined;
        }

        const json_data = {
            'AccessToken': this.aws_tokens.access_token,
        };

        const response: AxiosResponse = await this._send('AWSCognitoIdentityProviderService.GetUser', json_data);

        if (response.status === 200) {
            const user_attributes = response.data['UserAttributes'].reduce((acc: {[key: string]: string}, cur: {Name: string, Value: string}) => {
                acc[cur.Name] = cur.Value;
                return acc;
            }, {});

            return new AWSIdentity(user_attributes['custom:cognito_identity_id'], user_attributes['Username'], user_attributes);
        }
    }
}

export class GetCredentials extends JciHitachiAWSCognitoConnection {

    public async get_data(aws_identity: AWSIdentity): Promise<AWSCredentials|undefined> {

        if (!this.aws_tokens) {
            return undefined;
        }

        const json_data = JSON.parse(`{
            "IdentityId": "${aws_identity.identity_id}",
            "Logins": {
                "${AWS_COGNITO_IDP_ENDPOINT}/${AWS_COGNITO_USERPOOL_ID}": "${this.aws_tokens.id_token}"
            }
        }`);

        const response: AxiosResponse = await this._send('AWSCognitoIdentityService.GetCredentialsForIdentity', json_data);

        if (response.status === 200) {
            return new AWSCredentials(JSON.stringify(response.data['Credentials']));
        }
    }
}

abstract class JciHitachiAWSIoTConnection extends JciHitachiAWSHttpConnection {

    aws_tokens: AWSTokens;

    constructor(aws_tokens: AWSTokens, log: JciHitachiPlatformLogger) {
        super(log);
        this.aws_tokens = aws_tokens;
    }

    protected _generateAWSIOTHeaders(): object {
        return {
            'authorization': `Bearer ${this.aws_tokens.id_token}`,
            'User-Agent': 'Dalvik/2.1.0',
            'content-type': 'application/json',
            'Accept': 'application/json',
        };
    }

    protected _send(target: string, data: any): Promise<AxiosResponse> {
        const endpoint = `https://${AWS_IOT_ENDPOINT}${target}`;
        return this.requestHttps(endpoint, 'post', this._generateAWSIOTHeaders(), data);
    }
}

export class GetAllDevice extends JciHitachiAWSIoTConnection {

    public async get_data(): Promise<AWSThingDictionary> {
        const response: AxiosResponse = await this._send('/GetAllDevice', {});
        return new AWSThingDictionary(JSON.stringify(response.data), this.log);
    }
}
