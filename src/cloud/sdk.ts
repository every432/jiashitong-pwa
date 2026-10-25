import type cloudbase from '@cloudbase/js-sdk';
import type {AccountProfile,AuthPort,EmailChallenge} from './types.ts';
import type {CloudConfig} from './config.ts';
import {CLOUD_ENV,FAMILY_FUNCTION,VERIFIED_REGION} from './config.ts';
import {accountIssue,AccountError,cancelable,failAccount} from './errors.ts';
import {normalizeNickname,publicProfile} from './familyApi.ts';
import {privateSdkCall} from './privacy.ts';
import {familyActions} from './familyTypes.ts';
import {validatePassword} from './authPolicyV32.ts';

type App=ReturnType<typeof cloudbase.init>;
type SdkAuth=App['auth'];
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object';
function sdkError(value:unknown):void {if(object(value)&&value.error)throw value.error;}
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254;
export function createSdkPort(app:App):AuthPort {
 const auth:SdkAuth=app.auth;
 let lane:Promise<unknown>=Promise.resolve(),managed=0;
 let identityBlocked=false;
 const quarantineKey='jiashitong_auth_identity_block_v32';
 function quarantine(){identityBlocked=true;try{localStorage.setItem(quarantineKey,'UID_MISMATCH');}catch{/* 本页继续阻断；不可降级放行。 */}}
 function checkQuarantine(){let blocked=identityBlocked;try{blocked ||= localStorage.getItem(quarantineKey)!==null;}catch{ /* SDK仍负责会话存储；内存阻断有效。 */ }if(blocked)failAccount('RESTORE_SESSION','UPGRADE_UID_MISMATCH','绑定返回了不同UID，已停止家庭访问。请停止重复绑定，核对认证配置后明确退出账号。','identity');}
 function mutate<T>(task:()=>Promise<T>):Promise<T>{
  const next=lane.then(()=>privateSdkCall(async()=>{managed++;try{return await task();}finally{managed--;}}));
  lane=next.then(()=>undefined,()=>undefined);return next;
 }
 async function profileDirect():Promise<AccountProfile>{checkQuarantine();const result=await auth.getUser();sdkError(result);return publicProfile(result.data.user,true);}
 async function restoreDirect():Promise<AccountProfile|null>{
  checkQuarantine();
  // 3.10.3无本机凭证时getSession可能返回UNAUTHENTICATED；仅SDK明确报告
  // 同步本地会话不存在时按未登录处理。过期但仍存在的会话必须刷新/报错，不新建匿名UID。
  if(typeof auth.hasLoginState==='function'&&auth.hasLoginState()===null)return null;
  const result=await auth.getSession();sdkError(result);
  if(!result.data.session)return null;
  const sessionUser=publicProfile(result.data.session.user,true),profile=await profileDirect();
  if(profile.uid!==sessionUser.uid)failAccount('RESTORE_SESSION','SESSION_UID_MISMATCH','会话与用户资料的UID不一致，已停止显示账号数据。','identity');
  return profile;
 }
 function email(value:string,stage:'SEND_LOGIN_CODE'|'SEND_REGISTER_CODE'){const trimmed=value.trim();if(!validEmail(trimmed))failAccount(stage,'INVALID_EMAIL','请填写完整有效的邮箱地址。');return trimmed;}
 return {
  async restore(){await lane;return privateSdkCall(restoreDirect);},
  async passwordLogin(account,password){
   if(!account.trim()||!password)failAccount('PASSWORD_LOGIN','MISSING_CREDENTIALS','请填写用户名或邮箱和密码。');
   await mutate(async()=>{const result=await auth.signInWithPassword(account.includes('@')?{email:account.trim(),password}:{username:account.trim(),password});sdkError(result);publicProfile(result.data.user);});
  },
  async sendLoginCode(value){const address=email(value,'SEND_LOGIN_CODE');
   await lane;return privateSdkCall(async()=>{
    const result=await auth.signInWithOtp({email:address,options:{shouldCreateUser:false}});sdkError(result);
    const verify=result.data.verifyOtp;if(!verify)failAccount('SEND_LOGIN_CODE','SDK_CONTRACT_ERROR','SDK未提供本次验证码的校验回调，已停止登录。','unknown');
    return {flow:'login',email:address,expiresAt:Date.now()+10*60_000,verify:async code=>{await mutate(async()=>{const checked=await verify({token:code});sdkError(checked);publicProfile(checked.data.user);});}};
   });
  },
  async sendRegisterCode(input){
   const address=email(input.email,'SEND_REGISTER_CODE'),username=input.username.trim();
   const desired=normalizeNickname(input.nickname);
   if(username&&!/^[a-zA-Z0-9][a-zA-Z0-9_.:+@ -]{4,23}$/.test(username))failAccount('SEND_REGISTER_CODE','INVALID_USERNAME','选填用户名需5～24位，以字母或数字开头，使用英文、数字或 -_.:+@ 和空格。');
   validatePassword(input.password);
   await lane;return privateSdkCall(async()=>{
    // 该版本signUp({email})回调会把已存在邮箱自动当作登录；用同SDK官方原生接口明确区分新用户。
    const sent=await auth.getVerification({email:address,target:'ANY'});
    if(sent.is_user===true)failAccount('SEND_REGISTER_CODE','EMAIL_ALREADY_EXISTS','该邮箱已经注册，请回到“登录已有账号”。');
    if(sent.is_user!==false||!sent.verification_id)failAccount('SEND_REGISTER_CODE','REGISTRATION_STATE_UNKNOWN','未能确认新账号状态，已停止注册。请先用邮箱验证码登录核对。','unknown');
    let consumed=false;
    const challenge:EmailChallenge={flow:'register',email:address,expiresAt:Date.now()+10*60_000,verify:async code=>{
     await mutate(async()=>{
      if(consumed)failAccount('VERIFY_REGISTER_CODE','SIGNUP_UNCONFIRMED','本次注册已提交，请先用邮箱验证码登录核对，不要重复创建。','unknown');
      const verified=await auth.verify({verification_id:sent.verification_id!,verification_code:code});
      if(!verified.verification_token)failAccount('VERIFY_REGISTER_CODE','SDK_CONTRACT_ERROR','云端未返回注册验证凭证，未提交注册。','unknown');
      consumed=true;
      try{
       const request:Parameters<SdkAuth['signUp']>[0]={email:address,verification_token:verified.verification_token,verification_code:code,...(username?{username}:{}),...(input.password?{password:input.password}:{}),...(desired?{name:desired}:{})};
       // 此官方兼容分支返回LoginState，不把它误当作现代{data,error}；随后统一核对SDK会话。
       const result=await auth.signUp(request);sdkError(result);
       if(desired){const after=await profileDirect();if(after.anonymous)failAccount('VERIFY_REGISTER_CODE','INVALID_ACCOUNT_IDENTITY','注册未返回正式身份，已停止。','identity');const named=await auth.updateUser({nickname:desired});sdkError(named);const checked=await profileDirect();if(checked.uid!==after.uid)failAccount('VERIFY_REGISTER_CODE','PROFILE_UID_MISMATCH','注册后昵称核对期间身份变化，已停止。','identity');if(checked.nickname!==desired)failAccount('VERIFY_REGISTER_CODE','SIGNUP_UNCONFIRMED','账号已创建，但昵称未核对。请登录原账号后编辑昵称，不要再次注册。','unknown');}
      }catch(error){
       const issue=accountIssue(error,'VERIFY_REGISTER_CODE');
       if(issue.kind==='network'||issue.kind==='unknown')failAccount('VERIFY_REGISTER_CODE','SIGNUP_UNCONFIRMED','注册结果尚未确认，账号可能已经创建。请改用邮箱验证码登录核对，不要重复注册。','unknown');
       throw new AccountError(issue);
      }
     });
    }};
    return challenge;
   });
  },

  async anonymousLogin(){await mutate(async()=>{checkQuarantine();let current:AccountProfile|null;try{current=await restoreDirect();}catch(e){throw new AccountError(accountIssue(e,'RESTORE_SESSION'));}if(current){if(!current.anonymous)failAccount('ANONYMOUS_LOGIN','FORMAL_SESSION_EXISTS','当前为正式账号，请使用正式账号邀请码加入，不会替换身份。');return;}try{const result=await auth.signInAnonymously();sdkError(result);}catch(e){throw new AccountError(accountIssue(e,'ANONYMOUS_LOGIN'));}let profile:AccountProfile;try{profile=await profileDirect();}catch(e){throw new AccountError(accountIssue(e,'ANONYMOUS_PROFILE'));}if(!profile.anonymous)failAccount('ANONYMOUS_PROFILE','ANONYMOUS_IDENTITY_MISMATCH','官方SDK未返回匿名身份，已停止。','identity');});},
  async sendPasswordReset(value){
   const address=email(value,'SEND_LOGIN_CODE');await lane;
   return privateSdkCall(async()=>{const before=await restoreDirect();if(before&&(before.anonymous||before.email.toLowerCase()!==address.toLowerCase()))failAccount('GET_PROFILE','EMAIL_ACCOUNT_MISMATCH','只能为当前正式账号已绑定的邮箱设置密码；请勿切换身份。');
    const sent=await auth.resetPasswordForEmail(address);sdkError(sent);const verify=sent.data.updateUser;if(!verify)failAccount('SEND_LOGIN_CODE','SDK_CONTRACT_ERROR','SDK未返回密码验证回调。','unknown');let consumed=false;
    return {email:address,expiresAt:Date.now()+600000,verify:async(code,password,confirmation)=>mutate(async()=>{validatePassword(password,confirmation);if(consumed)failAccount('PASSWORD_LOGIN','PASSWORD_RESET_UNCONFIRMED','重置已提交，结果可能已生效。请用新密码登录，不要重复重置。','unknown');const current=await restoreDirect();if(current?.uid!==before?.uid)failAccount('GET_PROFILE','SESSION_UID_MISMATCH','密码验证期间身份已变化。','identity');consumed=true;const result=await verify({nonce:code,password});try{sdkError(result);const after=await profileDirect();if(before&&after.uid!==before.uid){quarantine();failAccount('GET_PROFILE','SESSION_UID_MISMATCH','密码重置返回了其他账号，已阻断家庭访问。','identity');}}catch(error){const issue=accountIssue(error,'PASSWORD_LOGIN');if(issue.kind==='identity')throw error;if(/VERIFICATION|OTP/.test(issue.code)){consumed=false;throw new AccountError(issue);}failAccount('PASSWORD_LOGIN','PASSWORD_RESET_UNCONFIRMED','重置结果未确认，密码可能已保存。请先使用新密码登录原账号；不要注册新账号。','unknown');}})};
   });
  },
  async changePassword(old,password,confirmation){await mutate(async()=>{validatePassword(password,confirmation);if(!old)failAccount('PASSWORD_LOGIN','MISSING_OLD_PASSWORD','请填写旧密码，或选择邮箱验证设置。');const before=await profileDirect();if(before.anonymous)failAccount('PASSWORD_LOGIN','ANONYMOUS_PASSWORD','免邮箱身份请先绑定邮箱。');const result=await auth.resetPasswordForOld({old_password:old,new_password:password});sdkError(result);const after=await profileDirect();if(after.uid!==before.uid){quarantine();failAccount('GET_PROFILE','SESSION_UID_MISMATCH','修改密码期间账号UID发生变化。','identity');}});},
  async sendAnonymousUpgrade(value,nickname='家庭成员'){
   const address=email(value,'SEND_REGISTER_CODE'),desired=normalizeNickname(nickname);await lane;return privateSdkCall(async()=>{
    const before=await profileDirect();if(!before.anonymous)failAccount('GET_PROFILE','NOT_ANONYMOUS','当前不是免邮箱身份，不进行账号合并。');
    const sent=await auth.getVerification({email:address,target:'ANY'});if(sent.is_user!==false||!sent.verification_id)failAccount('SEND_REGISTER_CODE','EMAIL_ALREADY_EXISTS','此邮箱已注册或状态无法确认；不能合并到其他账号，请换一个未注册邮箱。');let consumed=false;
    return {email:address,expiresAt:Date.now()+600000,verify:async(code,password,confirmation)=>mutate(async()=>{
     validatePassword(password,confirmation);const current=await profileDirect();if(current.uid!==before.uid||!current.anonymous)failAccount('GET_PROFILE','SESSION_UID_MISMATCH','绑定前身份发生变化，已停止。','identity');if(consumed)failAccount('GET_PROFILE','UPGRADE_UNCONFIRMED','本次绑定已提交，先核对原UID，禁止重复注册或绑定。','unknown');
     const verified=await auth.verify({verification_id:sent.verification_id!,verification_code:code});if(!verified.verification_token)failAccount('GET_PROFILE','SDK_CONTRACT_ERROR','缺少邮箱验证凭证。','unknown');const session=await auth.getSession();sdkError(session);if(!session.data.session?.access_token)failAccount('GET_PROFILE','UNAUTHENTICATED','原匿名会话已过期，请恢复原会话。','auth');const ready=await profileDirect();if(ready.uid!==before.uid||!ready.anonymous||session.data.session.user?.id!==before.uid)failAccount('GET_PROFILE','SESSION_UID_MISMATCH','邮箱验证期间账号已切换，未提交绑定。','identity');
     // 官方anonymous_token只在SDK闭包中使用，不复制设备凭据、不写入业务存储/备份。
     consumed=true;
     try{const result=await auth.signUp({email:address,password,verification_token:verified.verification_token,anonymous_token:session.data.session.access_token,name:desired});sdkError(result);const after=await profileDirect();if(after.uid!==before.uid){quarantine();failAccount('GET_PROFILE','UPGRADE_UID_MISMATCH','匿名转正返回不同UID，已停止家庭访问。请停止重试并核对账号配置。','identity');}if(after.anonymous||after.email.toLowerCase()!==address.toLowerCase())failAccount('GET_PROFILE','UPGRADE_UNCONFIRMED','邮箱绑定状态未确认，请先刷新账号核对原UID，不要重复注册。','unknown');const named=await auth.updateUser({nickname:desired});sdkError(named);const checked=await profileDirect();if(checked.uid!==before.uid){quarantine();failAccount('GET_PROFILE','UPGRADE_UID_MISMATCH','保存绑定昵称期间身份变化。','identity');}}
     catch(error){if(accountIssue(error,'GET_PROFILE').kind==='identity')throw error;failAccount('GET_PROFILE','UPGRADE_UNCONFIRMED','绑定结果待核对。请保留原身份，停止重复绑定，刷新资料确认邮箱与UID。','unknown');}
    })};
   });
  },
  async profile(){await lane;return privateSdkCall(profileDirect);},
  async nickname(raw){const desired=normalizeNickname(raw);return mutate(async()=>{
   const before=await profileDirect();let failure:unknown;
   try{const result=await auth.updateUser({nickname:desired});sdkError(result);}catch(error){failure=error;}
   const after=await profileDirect();
   if(after.uid!==before.uid)failAccount('UPDATE_NICKNAME','PROFILE_UID_MISMATCH','账号在保存期间发生变化，已停止显示旧资料。','identity');
   if(after.nickname===desired)return after;
   if(failure)throw failure;
   failAccount('UPDATE_NICKNAME','NICKNAME_UNCONFIRMED','昵称保存结果未确认，请先刷新资料核对；无需重新注册。','unknown');
  });},
  async signOut(){await mutate(async()=>{const result=await auth.signOut({});sdkError(result);const check=await auth.getSession();sdkError(check);if(check.data.session)failAccount('SIGN_OUT','SIGNOUT_UNCONFIRMED','退出结果未确认，已隐藏家庭资料，请重试退出。','auth');identityBlocked=false;try{localStorage.removeItem(quarantineKey);}catch{/* 隔离标记无法清除时下次仍保守阻断。 */}});},
  async callRead(action,signal){
   if(action!=='whoAmI'&&action!=='listMyFamilies')failAccount('WHO_AM_I','ACTION_NOT_ALLOWED','阶段B仅允许身份核对和家庭列表读取。','permission');
   await cancelable(lane,signal);
   return cancelable(privateSdkCall(async()=>{
    const session=await restoreDirect();if(!session)failAccount('RESTORE_SESSION','UNAUTHENTICATED','请先登录原账号。','auth');
    if(signal.aborted)throw new DOMException('已取消','AbortError');
    return app.callFunction({name:FAMILY_FUNCTION,data:{action,clientVersion:'3.2'},parse:true});
   }),signal);
  },
  async callFamily(action,payload,uid,signal){
   if(!familyActions.includes(action)||['uid','action'].some(k=>k in payload)||('role' in payload&&(action!=='v32SetMemberRole'||!['admin','member'].includes(String(payload.role)))))failAccount('FAMILY_REQUEST','ACTION_NOT_ALLOWED','家庭接口或操作者参数不允许。','permission');
   await cancelable(lane,signal);
   return cancelable(privateSdkCall(async()=>{
    const before=await restoreDirect();if(!before||before.uid!==uid)failAccount('FAMILY_REQUEST','SESSION_UID_MISMATCH','账号已变化，已停止家庭操作。','identity');
    if(signal.aborted)throw new DOMException('已取消','AbortError');
    // 旧家庭/卡片写入没有幂等接口，明确关闭SDK自动重试；协作重试只由回执核对入口显式发起。
    const result=await app.callFunction({name:FAMILY_FUNCTION,data:{...payload,action,clientVersion:'3.2'},parse:true},undefined,{timeout:20000,retryOptions:{retries:0}});
    if(signal.aborted)throw new DOMException('已取消','AbortError');
    // 已发出请求后的身份检查失败不能当成“写入确定被拒绝”，必须保留待核对回执。
    let after:AccountProfile|null;try{after=await restoreDirect();}catch{failAccount('FAMILY_REQUEST','POST_CALL_UNCONFIRMED','云端响应后的会话检查未完成，写入可能已成功，请先核对回执。','unknown');}
    if(!after||after.uid!==uid)failAccount('FAMILY_REQUEST','SESSION_UID_MISMATCH','响应期间账号已变化，已丢弃家庭结果。','identity');return result;
   }),signal);
  },
  subscribe(listener){const result=auth.onAuthStateChange((event,session)=>{const value:unknown=session?.user;listener({event,uid:object(value)&&typeof value.id==='string'?value.id:null,managed:managed>0});});return()=>result.data.subscription.unsubscribe();},
 };
}
let portPromise:Promise<AuthPort>|undefined;
export function cloudBasePort(config:CloudConfig):Promise<AuthPort>{
 if(config.env!==CLOUD_ENV||config.region!==VERIFIED_REGION)failAccount('CONFIG','ENVIRONMENT_MISMATCH','环境或地域与已核实配置不一致，已停止初始化。','identity');
 return portPromise??=privateSdkCall(async()=>{
  const {default:sdk}=await import('@cloudbase/js-sdk');
  const app=sdk.init({env:config.env,region:config.region,persistence:'local',debug:false,endPointMode:'GATEWAY',auth:{detectSessionInUrl:false},...(config.publishableKey?{accessKey:config.publishableKey}:{})});
  return createSdkPort(app);
 }).catch(error=>{portPromise=undefined;throw error;});
}
