import type {AccountProfile,AuthPort,EmailChallenge,EmailFlow,FamilySummary,SafeIssue,Stage} from './types.ts';
import {accountIssue,aborted,cancelable,failAccount,isAborted} from './errors.ts';
import {assertSameUid,listMyFamilies,normalizeNickname,whoAmI,functionPayload,parseFamilies} from './familyApi.ts';
import {newInvite,hasControls} from './authPolicyV32.ts';

export type AccountState={phase:'starting'|'signedOut'|'signedIn'|'blocked';profile:AccountProfile|null;functionUid:string;androidUid:string;identity:'pending'|'webMatched'|'allMatched'|'nativeMatched'|'mismatch';families:FamilySummary[];familiesLoaded:boolean;busy:boolean;error:SafeIssue|null;notice:string;challenge:{email:string;flow:EmailFlow;expiresAt:number}|null;cooldownUntil:number};
const initial=():AccountState=>({phase:'starting',profile:null,functionUid:'',androidUid:'',identity:'pending',families:[],familiesLoaded:false,busy:false,error:null,notice:'',challenge:null,cooldownUntil:0});
export function createAccountSession(factory:()=>Promise<AuthPort>,now=()=>Date.now()){
 let state=initial(),scope=new AbortController(),active=true,portPromise:Promise<AuthPort>|undefined,unsubscribe:(()=>void)|undefined,challenge:EmailChallenge|null=null;
 const listeners=new Set<()=>void>();
 const publish=(patch:Partial<AccountState>)=>{if(!active)return;state={...state,...patch};listeners.forEach(fn=>fn());};
 const port=()=>portPromise??=factory().catch(error=>{portPromise=undefined;throw error;});
 const valid=(signal:AbortSignal)=>{if(!active||signal.aborted||signal!==scope.signal)throw aborted();};
 function begin(reset=true){scope.abort();scope=new AbortController();challenge=null;publish({...reset?{...initial(),cooldownUntil:state.cooldownUntil}:{families:[],familiesLoaded:false,challenge:null},busy:true,error:null,notice:''});return scope.signal;}
 function issue(error:unknown,stage:Stage,signal:AbortSignal){
  if(isAborted(error)||signal.aborted||!active||scope.signal!==signal)return;
  const safe=accountIssue(error,stage);
  publish({error:safe,busy:false,...(state.profile?{}:{phase:'signedOut' as const}),...(safe.kind==='identity'?{phase:'blocked' as const,identity:'mismatch' as const,families:[],familiesLoaded:false}:{}),...(safe.kind==='auth'?{phase:'signedOut' as const,profile:null,functionUid:'',androidUid:'',identity:'pending' as const,families:[],familiesLoaded:false}:{}),...(safe.kind==='rate'?{cooldownUntil:now()+(safe.retryAfter??60)*1000}:{})});
 }
 async function resume(signal:AbortSignal,priorAndroid=''){
  const api=await cancelable(port(),signal),profile=await cancelable(api.restore(),signal);valid(signal);
  if(!profile){publish({phase:'signedOut',busy:false});return;}
  publish({phase:'signedIn',profile,identity:'pending'});
  const functionUid=await whoAmI(api,profile.uid,signal);valid(signal);
  const latest=await cancelable(api.profile(),signal);valid(signal);
  if(latest.uid!==profile.uid)failAccount('WHO_AM_I','SESSION_UID_MISMATCH','身份核对期间账号发生变化，已停止读取家庭。','identity');
  publish({profile:latest,functionUid,identity:'webMatched',busy:false,notice:'Web与云函数UID一致。请复制安卓版账号UID完成第三项核对，再读取原家庭列表。'});
  if(latest.anonymous){await confirmNative(signal);return;}
  if(priorAndroid===profile.uid)await checkAndroid(priorAndroid);
 }
 async function resumeExternal(signal:AbortSignal){
  try{await resume(signal);}catch(error){
   valid(signal);
   // 跨页事件与SDK本地会话写入并非原子操作。仅对此已知过渡态重读一次；
   // 不沿用Android确认，不取家庭列表，不重试业务写入或放过真正的UID不一致。
   if(accountIssue(error,'RESTORE_SESSION').code!=='SESSION_UID_MISMATCH')throw error;
   publish({phase:'starting',profile:null,functionUid:'',androidUid:'',identity:'pending',families:[],familiesLoaded:false});
   await resume(signal);
  }
 }
 function watch(api:AuthPort){
  unsubscribe?.();unsubscribe=api.subscribe(change=>{
   if(!active||change.managed)return;
   if(change.event==='SIGNED_OUT'){
    // 跨标签的旧退出事件可能晚于新账号登录到达：先清屏，再由SDK合法会话与whoAmI决定当前身份。
    const signal=begin();publish({phase:'signedOut',notice:'登录状态发生变化，正在重新核对。'});
    queueMicrotask(()=>{void resumeExternal(signal).catch(error=>issue(error,'RESTORE_SESSION',signal));});return;
   }
   if(change.uid&&change.uid!==state.profile?.uid){
    const signal=begin();queueMicrotask(()=>{void resumeExternal(signal).catch(error=>issue(error,'RESTORE_SESSION',signal));});
   }
  });
 }
 async function start(){active=true;const signal=begin();try{const api=await cancelable(port(),signal);valid(signal);watch(api);await resume(signal);}catch(error){issue(error,'RESTORE_SESSION',signal);}}
 async function refresh(){if(state.busy)return;const previous=state.identity==='allMatched'?state.androidUid:'';const signal=begin();try{await resume(signal,previous);}catch(error){issue(error,'RESTORE_SESSION',signal);}}
 async function passwordLogin(account:string,password:string){if(state.busy)return;const signal=begin();try{const api=await cancelable(port(),signal);valid(signal);watch(api);await cancelable(api.passwordLogin(account,password),signal);valid(signal);await resume(signal);}catch(error){issue(error,'PASSWORD_LOGIN',signal);}}
 async function sendCode(flow:EmailFlow,input:{email:string;username?:string;password?:string;nickname?:string}){
  if(state.busy)return;
  const stage=flow==='login'?'SEND_LOGIN_CODE':'SEND_REGISTER_CODE';
  if(now()<state.cooldownUntil){publish({error:{stage,code:'SEND_COOLDOWN',kind:'rate',message:'请等待倒计时结束再发送验证码。'}});return;}
  const signal=begin();
  try{const api=await cancelable(port(),signal);valid(signal);watch(api);
   const next=await cancelable(flow==='login'?api.sendLoginCode(input.email):api.sendRegisterCode({email:input.email,username:input.username??'',password:input.password??'',nickname:input.nickname??''}),signal);valid(signal);
   challenge=next;publish({phase:'signedOut',busy:false,challenge:{email:next.email,flow:next.flow,expiresAt:next.expiresAt},cooldownUntil:now()+60_000,notice:'验证码已发送，请查看邮箱。仅本页保留本次验证会话。'});
  }catch(error){issue(error,stage,signal);}
 }
 async function verifyCode(code:string){
  if(state.busy)return;
  const saved=challenge,stage=saved?.flow==='register'?'VERIFY_REGISTER_CODE':'VERIFY_LOGIN_CODE';
  if(!saved||now()>=saved.expiresAt){challenge=null;publish({challenge:null,error:{stage,code:'OTP_SESSION_EXPIRED',kind:'input',message:'本页验证码会话已过期，请重新发送验证码。'}});return;}
  if(!/^\d{4,8}$/.test(code.trim())){publish({error:{stage,code:'INVALID_OTP_FORMAT',kind:'input',message:'请填写邮件中的数字验证码。'}});return;}
  const signal=scope.signal;publish({busy:true,error:null,notice:''});
  try{await cancelable(saved.verify(code.trim()),signal);valid(signal);challenge=null;publish({challenge:null});await resume(signal);if(saved.flow==='register')await confirmNative(signal);}
  catch(error){if(signal.aborted||!active||signal!==scope.signal)return;issue(error,stage,signal);const safe=accountIssue(error,stage);if(safe.code==='SIGNUP_UNCONFIRMED'||safe.code.includes('EXPIRED')){challenge=null;publish({challenge:null});}}
 }
 async function confirmNative(signal:AbortSignal){
  const api=await cancelable(port(),signal),profile=await cancelable(api.profile(),signal);valid(signal);
  if(state.functionUid!==profile.uid||state.profile?.uid!==profile.uid)failAccount('WHO_AM_I','SESSION_UID_MISMATCH','真实认证身份与云函数不一致，已停止。','identity');
  const capability=functionPayload(await api.callFamily('v32Capabilities',{},profile.uid,signal),'FAMILY_REQUEST');valid(signal);
  if(capability.version!=='3.2'||capability.anonymous!==(profile.anonymous===true))failAccount('WHO_AM_I','V32_IDENTITY_UNSUPPORTED','后端未支持V3.2或正式/匿名类型不一致，已停止新身份访问。','identity');
  const families=parseFamilies(functionPayload(await api.callRead('listMyFamilies',signal),'LIST_MY_FAMILIES'));valid(signal);const after=await api.profile();valid(signal);if(after.uid!==profile.uid)failAccount('WHO_AM_I','SESSION_UID_MISMATCH','读取期间身份发生变化。','identity');
  publish({profile:after,phase:'signedIn',identity:'nativeMatched',families,familiesLoaded:true,busy:false,notice:'当前Web身份与云函数UID及V3.2身份类型已核对。原安卓账号仍需单独核对安卓版UID。'});
 }
 async function anonymousJoin(raw:string,displayName:string){
  if(state.busy)return;const signal=begin();
  try{const invitation=newInvite(raw);if(!displayName.trim()||Array.from(displayName.trim()).length>40||hasControls(displayName))failAccount('PASSWORD_LOGIN','INVALID_NICKNAME','家庭昵称需1～40字，不能含控制字符。');
   const api=await cancelable(port(),signal);valid(signal);watch(api);await cancelable(api.anonymousLogin(),signal);valid(signal);const profile=await api.profile();valid(signal);if(!profile.anonymous)failAccount('WHO_AM_I','ANONYMOUS_REQUIRED','恢复入口只允许真实匿名身份。','identity');const uid=await whoAmI(api,profile.uid,signal);valid(signal);const capability=functionPayload(await api.callFamily('v32Capabilities',{},uid,signal),'FAMILY_REQUEST');if(capability.version!=='3.2'||capability.anonymous!==true)failAccount('WHO_AM_I','V32_IDENTITY_UNSUPPORTED','当前后端未确认匿名协议，未提交加入。','identity');
   functionPayload(await api.callFamily('v32ConsumeInvite',{inviteCode:invitation,displayName:displayName.trim(),type:invitation[0]==='R'?'recovery':'join'},uid,signal),'FAMILY_REQUEST');valid(signal);await resume(signal);
  }catch(error){issue(error,'PASSWORD_LOGIN',signal);}
 }
 async function confirmWebAccount(){if(state.busy)return;const signal=begin(false);try{await confirmNative(signal);}catch(error){issue(error,'WHO_AM_I',signal);}}
 async function checkAndroid(raw:string){
  const profile=state.profile,functionUid=state.functionUid;
  if(!profile||!functionUid){publish({error:{stage:'ANDROID_UID',code:'WEB_IDENTITY_PENDING',kind:'identity',message:'请先完成Web与云函数UID核对。'}});return;}
  const signal=begin(false),androidUid=raw.trim();publish({androidUid,identity:'webMatched'});
  try{assertSameUid(profile.uid,functionUid,androidUid);const api=await cancelable(port(),signal);
   const current=await cancelable(api.profile(),signal);valid(signal);
   if(current.uid!==profile.uid)failAccount('ANDROID_UID','SESSION_UID_MISMATCH','账号已切换，请重新登录并核对UID。','identity');
   const families=await listMyFamilies(api,profile.uid,functionUid,androidUid,signal);valid(signal);
   const after=await cancelable(api.profile(),signal);valid(signal);
   if(after.uid!==profile.uid)failAccount('LIST_MY_FAMILIES','SESSION_UID_MISMATCH','读取期间账号发生变化，已丢弃原家庭列表。','identity');
   publish({phase:'signedIn',profile:after,identity:'allMatched',families,familiesLoaded:true,busy:false,notice:families.length>=100?'三项UID一致。原接口最多返回100个家庭，列表可能不完整。':'三项UID一致，已读取当前原账号的家庭概览。'});
  }catch(error){issue(error,'LIST_MY_FAMILIES',signal);}
 }
 async function saveNickname(value:string){
  if(state.busy||!state.profile||state.phase==='blocked')return;
  const boundUid=state.profile.uid,signal=scope.signal;publish({busy:true,error:null,notice:''});
  try{const desired=normalizeNickname(value),api=await cancelable(port(),signal);valid(signal);const updated=await cancelable(api.nickname(desired),signal);valid(signal);
   if(updated.uid!==boundUid)failAccount('UPDATE_NICKNAME','PROFILE_UID_MISMATCH','昵称返回了其他账号身份，已停止显示。','identity');
   publish({profile:updated,busy:false,notice:'账号昵称已核对保存。用户名和家庭称呼没有修改。'});
  }catch(error){issue(error,'UPDATE_NICKNAME',signal);}
 }
 async function signOut(){
  const signal=begin();publish({phase:'signedOut'});
  try{const api=await port();await api.signOut();valid(signal);publish({...initial(),phase:'signedOut',notice:'本机账号已退出，原有个人资料保持不变。'});}
  catch(error){issue(error,'SIGN_OUT',signal);}
 }
 return {
  start,refresh,passwordLogin,sendCode,verifyCode,checkAndroid,saveNickname,signOut,anonymousJoin,confirmWebAccount,
  clearChallenge(){challenge=null;publish({challenge:null,error:null,notice:''});},
  dispose(){active=false;scope.abort();challenge=null;unsubscribe?.();unsubscribe=undefined;},
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},
  getSnapshot:()=>state,
 };
}
