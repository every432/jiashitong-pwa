import {failAccount} from './errors.ts';
export const CLOUD_ENV='jiashitong-d4g8m8lfcdc047ffe';
export const FAMILY_FUNCTION='family_api';
// 2026-10-24用户从现有控制台明确确认；不是沿用SDK的默认地域。
export const VERIFIED_REGION='ap-shanghai';
export const SDK_VERSION='3.10.3';
export type CloudConfig={env:string;region:string;publishableKey?:string};
export function cloudConfig(values:{region?:string;publishableKey?:string;keyConfirmed?:string}={}):CloudConfig {
 const region=values.region?.trim()||VERIFIED_REGION;
 if(region!==VERIFIED_REGION)failAccount('CONFIG','REGION_NOT_VERIFIED','配置地域与已确认的现有环境不一致，已停止连接。');
 const key=values.publishableKey?.trim();
 if(key&&(values.keyConfirmed!=='true'||/AKID|PRIVATE KEY|secret[_ -]?(id|key)|admin[_ -]?token/i.test(key)))failAccount('CONFIG','UNVERIFIED_PUBLIC_KEY','只可配置从控制台明确核实可公开的Publishable Key。已拒绝未确认的Key。');
 return {env:CLOUD_ENV,region,...(key?{publishableKey:key}:{})};
}
