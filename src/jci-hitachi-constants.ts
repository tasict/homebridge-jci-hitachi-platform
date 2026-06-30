import { mqtt5 } from 'aws-iot-device-sdk-v2';

// AWS backend coordinates for the Jci Hitachi (AirCloud Home) smart-home cloud.
// These are specific to that backend; a different product line (e.g. AirCloud Go)
// uses a different user pool / client id and is not supported here.
export const AWS_REGION = 'ap-northeast-1';
export const AWS_COGNITO_IDP_ENDPOINT = `cognito-idp.${AWS_REGION}.amazonaws.com`;
export const AWS_COGNITO_ENDPOINT = `cognito-identity.${AWS_REGION}.amazonaws.com`;
export const AWS_COGNITO_CLIENT_ID = '7kfnjsb66ei1qt5s5gjv6j1lp6';
export const AWS_COGNITO_USERPOOL_ID = `${AWS_REGION}_aTZeaievK`;

export const AWS_IOT_ENDPOINT = 'iot-api.jci-hitachi-smarthome.com';
export const AWS_MQTT_ENDPOINT = `a8kcu267h96in-ats.iot.${AWS_REGION}.amazonaws.com`;

export const QOS = mqtt5.QoS.AtLeastOnce;
