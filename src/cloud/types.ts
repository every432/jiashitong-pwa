export type AccountProfile={uid:string;nickname:string;email:string;username:string;anonymous?:boolean};
export type FamilySummary={id:string;name:string;role:'owner'|'member';effectiveRole?:'owner'|'admin'|'member';memberId?:string};
export type EmailFlow='login'|'register';
export type Stage='CONFIG'|'RESTORE_SESSION'|'ANONYMOUS_LOGIN'|'ANONYMOUS_PROFILE'|'V32_CAPABILITIES'|'CONSUME_INVITE'|'JOIN_VERIFY'|'PASSWORD_LOGIN'|'SEND_LOGIN_CODE'|'SEND_REGISTER_CODE'|'VERIFY_LOGIN_CODE'|'VERIFY_REGISTER_CODE'|'GET_PROFILE'|'UPDATE_NICKNAME'|'WHO_AM_I'|'ANDROID_UID'|'LIST_MY_FAMILIES'|'SIGN_OUT'|'FAMILY_REQUEST';
export type SafeIssue={stage:Stage;code:string;message:string;kind:'auth'|'permission'|'network'|'captcha'|'input'|'identity'|'rate'|'unknown';retryAfter?:number};
export type EmailChallenge={flow:EmailFlow;email:string;expiresAt:number;verify:(code:string)=>Promise<void>};
export type PasswordChallenge={email:string;expiresAt:number;verify:(code:string,password:string,confirmation:string)=>Promise<void>};
export type AuthChange={event:string;uid:string|null;managed:boolean};
/** 会话凭据只由SDK管理；适配层不向页面/个人数据模型返回Token。 */
export interface AuthPort {
 restore():Promise<AccountProfile|null>;
 passwordLogin(account:string,password:string):Promise<void>;
 sendLoginCode(email:string):Promise<EmailChallenge>;
 sendRegisterCode(input:{email:string;username:string;password:string;nickname:string}):Promise<EmailChallenge>;
 anonymousLogin():Promise<void>;
 sendPasswordReset(email:string):Promise<PasswordChallenge>;
 changePassword(old:string,password:string,confirmation:string):Promise<void>;
 sendAnonymousUpgrade(email:string,nickname?:string):Promise<PasswordChallenge>;
 profile():Promise<AccountProfile>;
 nickname(value:string):Promise<AccountProfile>;
 signOut():Promise<void>;
 callRead(action:'whoAmI'|'listMyFamilies',signal:AbortSignal):Promise<unknown>;
 callFamily(action:import('./familyTypes.ts').FamilyAction,payload:Record<string,unknown>,uid:string,signal:AbortSignal):Promise<unknown>;
 subscribe(listener:(change:AuthChange)=>void):()=>void;
}
