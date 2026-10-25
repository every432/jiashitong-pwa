// 纯本地适配层/状态机测试：所有身份、验证码与家庭均为合成值，不连接CloudBase。
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountSession} from '../src/cloud/session.ts';
import {createSdkPort} from '../src/cloud/sdk.ts';
import {cloudConfig,CLOUD_ENV,VERIFIED_REGION} from '../src/cloud/config.ts';
import {AccountError,accountIssue,cancelable} from '../src/cloud/errors.ts';
import {functionPayload,parseFamilies,publicProfile,normalizeNickname} from '../src/cloud/familyApi.ts';
import {privateSdkCall} from '../src/cloud/privacy.ts';
const profile=uid=>({uid,nickname:'测试昵称',email:'synthetic@example.test',username:'synthetic'});
const sdkUser=uid=>({id:uid,email:'synthetic@example.test',user_metadata:{uid,nickName:'测试昵称',username:'synthetic'},is_anonymous:false});
const success=value=>({data:value,error:null});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fakePort(initial='A'){
 let uid=initial,listener=()=>{};const calls=[];
 const port={
  restore:async()=>uid?profile(uid):null,profile:async()=>profile(uid),
  passwordLogin:async()=>{uid='A';},
  sendLoginCode:async email=>({email,flow:'login',expiresAt:1e12,verify:async()=>{uid='A';}}),
  sendRegisterCode:async({email})=>({email,flow:'register',expiresAt:1e12,verify:async()=>{uid='NEW';}}),
  nickname:async value=>({...profile(uid),nickname:value}),signOut:async()=>{uid=null;},
  callRead:async(action,signal)=>{calls.push({action,signal});return {result:{success:true,...action==='whoAmI'?{uid}:{families:[{familyId:`family-${uid}`,name:`原家庭${uid}`,myRole:'owner',body:'不可进入状态'}]}}};},
  subscribe:fn=>{listener=fn;return()=>{listener=()=>{};};}
 };
 return{port,calls,emit(change){listener(change);},switchTo(next){uid=next;listener({event:next?'SIGNED_IN':'SIGNED_OUT',uid:next,managed:false});}};
}
function fakeSdk(){
 let current=null,listener=()=>{};const calls=[];
 const auth={
  getSession:async()=>success({session:current?{user:current,access_token:'SYNTHETIC_TOKEN'}:null}),
  getUser:async()=>success({user:current}),
  signInWithPassword:async input=>{calls.push(['password',input]);current=sdkUser('A');return success({user:current});},
  signInWithOtp:async input=>{calls.push(['otp',input]);return success({verifyOtp:async({token})=>{calls.push(['verifyOtp',token]);current=sdkUser('A');return success({user:current});}});},
  getVerification:async input=>{calls.push(['getVerification',input]);return {is_user:false,verification_id:'synthetic-verification'};},
  verify:async input=>{calls.push(['verify',input]);return {verification_token:'SYNTHETIC_VERIFICATION_TOKEN'};},
  signUp:async input=>{calls.push(['signup',input]);current=sdkUser('NEW');return {user:current};},
  updateUser:async input=>{calls.push(['update',input]);current={...current,user_metadata:{...current.user_metadata,nickName:input.nickname}};return success({user:current});},
  signOut:async input=>{calls.push(['out',input]);current=null;return success({});},
  onAuthStateChange:fn=>{listener=fn;return {data:{subscription:{unsubscribe:()=>{listener=()=>{};}}}};}
 };
 const app={auth,callFunction:async input=>{calls.push(['function',input]);return {result:{success:true,uid:current.id}};}};
 return{auth,app,calls,setUser:value=>{current=value;},emit:()=>listener('SIGNED_IN',{user:current})};
}

test('配置使用用户确认的环境与上海地域，不接受其他地域或未核实Key',()=>{
 assert.deepEqual(cloudConfig(),{env:CLOUD_ENV,region:VERIFIED_REGION});
 assert.throws(()=>cloudConfig({region:'ap-beijing'}),/地域/);
 assert.throws(()=>cloudConfig({publishableKey:'not-confirmed'}),/Key/);
 assert.throws(()=>cloudConfig({publishableKey:'AKID-example',keyConfirmed:'true'}),/Key/);
 assert.equal(cloudConfig({publishableKey:'synthetic-public',keyConfirmed:'true'}).publishableKey,'synthetic-public');
});
test('云函数外层、JSON业务层分别解析，缺失列表不能伪装空家庭',()=>{
 for(const response of [{result:JSON.stringify({success:true,uid:'A'})},{data:{result:{success:true,uid:'A'}},error:null},{success:true,data:{uid:'A'}}])assert.equal(functionPayload(response,'WHO_AM_I').uid,'A');
 for(const response of [{error:{code:'forbidden'}},{result:{success:false,code:'unauthenticated'}},{result:{}},'{broken'])assert.throws(()=>functionPayload(response,'WHO_AM_I'));
 assert.throws(()=>parseFamilies({}));assert.throws(()=>parseFamilies({families:[{familyId:'x',name:'x',myRole:'admin'}]}));
 assert.deepEqual(parseFamilies({families:[{familyId:'x',name:'家',myRole:'member',secret:'ignored'}]}),[{id:'x',name:'家',role:'member'}]);
});
test('SDK用户资料只白名单取值，不生成UID，不接受匿名或互相矛盾身份',()=>{
 assert.deepEqual(publicProfile({...sdkUser('A'),access_token:'sensitive'}),profile('A'));
 assert.throws(()=>publicProfile({id:'',user_metadata:{}}));assert.throws(()=>publicProfile({...sdkUser('A'),is_anonymous:true}));
 assert.throws(()=>publicProfile({...sdkUser('A'),user_metadata:{uid:'B'}}));
});
test('账号昵称按Unicode字符计数，拒绝隐藏方向与控制符',()=>{
 assert.equal(normalizeNickname('  家人😀  '),'家人😀');
 for(const value of ['a','😀'.repeat(25),'家\n人','家\u202e人'])assert.throws(()=>normalizeNickname(value));
});
test('脱敏错误提示覆盖验证码、风控、限流、会话、安全来源、权限与网络',()=>{
 for(const [raw,kind] of [[{code:'captcha_required'},'captcha'],[{code:'verification_code_expired'},'input'],[{status:429,retryAfter:90},'rate'],[{status:401},'auth'],[{code:'invalid_origin'},'permission'],[{code:'forbidden'},'permission'],[new TypeError('Failed to fetch SECRET_TOKEN'),'network']]){const issue=accountIssue(raw,'WHO_AM_I');assert.equal(issue.kind,kind);assert.ok(!JSON.stringify(issue).includes('SECRET_TOKEN'));}
 assert.equal(accountIssue({code:'SECRET_TOKEN',message:'SECRET_PASSWORD'},'PASSWORD_LOGIN').code,'SDK_ERROR');
});
test('SDK密码登录仅调用对应官方接口，用户名和邮箱均不回退注册',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app);
 await port.passwordLogin('existing-name','synthetic-password');await port.passwordLogin('existing@example.test','synthetic-password');
 assert.equal(f.calls.filter(c=>c[0]==='password').length,2);assert.equal(f.calls.some(c=>c[0]==='signup'),false);
 f.auth.signInWithPassword=async()=>success({user:null});await assert.rejects(port.passwordLogin('name','password'));assert.equal(f.calls.some(c=>c[0]==='signup'),false);
});
test('邮箱验证码登录显式shouldCreateUser:false，只使用本次回调',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app),challenge=await port.sendLoginCode('existing@example.test');
 assert.deepEqual(f.calls[0],['otp',{email:'existing@example.test',options:{shouldCreateUser:false}}]);
 await challenge.verify('123456');assert.equal((await port.restore()).uid,'A');assert.equal(f.calls.some(c=>c[0]==='signup'),false);
});
test('注册已有邮箱仅拒绝，不登录也不signUp；状态未知时停止',async()=>{
 for(const result of [{is_user:true,verification_id:'x'},{verification_id:'x'}]){
  const f=fakeSdk();f.auth.getVerification=async()=>result;
  await assert.rejects(createSdkPort(f.app).sendRegisterCode({email:'existing@example.test',username:'',password:'SafePass123!',nickname:'测试昵称'}));assert.equal(f.calls.length,0);
 }
});
test('注册严格先验证邮件，再调用官方注册分支，无登录兜底',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app),challenge=await port.sendRegisterCode({email:'new@example.test',username:'newuser',password:'SafePass123!',nickname:'测试昵称'});
 assert.equal(f.calls.some(c=>c[0]==='signup'),false);await challenge.verify('123456');
 assert.deepEqual(f.calls.map(c=>c[0]),['getVerification','verify','signup','update']);assert.equal(f.calls[2][1].verification_token,'SYNTHETIC_VERIFICATION_TOKEN');
 assert.equal((await port.restore()).uid,'NEW');await assert.rejects(challenge.verify('123456'),/已提交/);assert.equal(f.calls.filter(c=>c[0]==='signup').length,1);
});
test('注册验证码错误允许更正，提交结果不确定禁止重复注册',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app),challenge=await port.sendRegisterCode({email:'new@example.test',username:'',password:'SafePass123!',nickname:'测试昵称'});
 f.auth.verify=async()=>{throw {code:'verification_code_invalid'};};await assert.rejects(challenge.verify('000000'));assert.equal(f.calls.some(c=>c[0]==='signup'),false);
 f.auth.verify=async()=>({verification_token:'SYNTHETIC'});f.auth.signUp=async()=>{throw new TypeError('network synthetic');};
 await assert.rejects(challenge.verify('123456'),e=>e.issue.code==='SIGNUP_UNCONFIRMED');await assert.rejects(challenge.verify('123456'),e=>e.issue.code==='SIGNUP_UNCONFIRMED');
});
test('SDK恢复会话独立核对实时用户；退出只交给SDK处理',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app);assert.equal(await port.restore(),null);f.setUser(sdkUser('A'));assert.equal((await port.restore()).uid,'A');
 f.auth.getUser=async()=>success({user:sdkUser('B')});await assert.rejects(port.restore(),e=>e.issue.code==='SESSION_UID_MISMATCH');
 await port.signOut();assert.deepEqual(f.calls.find(c=>c[0]==='out'),['out',{}]);assert.equal(await port.restore(),null);
});
test('修改昵称只发nickname，并在返回后核对UID及保存值',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app);f.setUser(sdkUser('A'));const updated=await port.nickname('新的昵称');
 assert.deepEqual(f.calls.find(c=>c[0]==='update'),['update',{nickname:'新的昵称'}]);assert.equal(updated.nickname,'新的昵称');
 f.auth.updateUser=async()=>{f.setUser(sdkUser('B'));return success({});};await assert.rejects(port.nickname('其他昵称'),e=>e.issue.kind==='identity');
});
test('family_api适配层仅允许两项action，未登录不发函数请求',async()=>{
 const f=fakeSdk(),port=createSdkPort(f.app),signal=new AbortController().signal;
 await assert.rejects(port.callRead('whoAmI',signal));await assert.rejects(port.callRead('deleteFamily',signal));assert.equal(f.calls.length,0);
 f.setUser(sdkUser('A'));await port.callRead('whoAmI',signal);assert.deepEqual(f.calls[0],['function',{name:'family_api',data:{action:'whoAmI',clientVersion:'3.2'},parse:true}]);
});
test('会话恢复自动核对Web/云函数，未提供安卓版UID绝不读取家庭',async()=>{
 const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();assert.equal(session.getSnapshot().identity,'webMatched');
 assert.deepEqual(f.calls.map(c=>c.action),['whoAmI']);await session.checkAndroid(' A ');assert.equal(session.getSnapshot().identity,'allMatched');assert.equal(session.getSnapshot().families[0].name,'原家庭A');
 assert.deepEqual(Object.keys(session.getSnapshot().families[0]).sort(),['id','name','role']);session.dispose();
});
test('Web/云函数不一致立即阻止；安卓版不一致不发家庭请求',async()=>{
 const f=fakePort();f.port.callRead=async()=>({result:{success:true,uid:'OTHER'}});const session=createAccountSession(async()=>f.port);await session.start();assert.equal(session.getSnapshot().phase,'blocked');assert.equal(session.getSnapshot().error.stage,'WHO_AM_I');session.dispose();
 const g=fakePort(),next=createAccountSession(async()=>g.port);await next.start();await next.checkAndroid('B');assert.equal(next.getSnapshot().identity,'mismatch');assert.deepEqual(g.calls.map(c=>c.action),['whoAmI']);next.dispose();
});
test('函数业务错误保留正确阶段，不能当作空家庭；401清除界面身份',async()=>{
 const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();f.port.callRead=async()=>({result:{success:false,code:'forbidden'}});await session.checkAndroid('A');assert.equal(session.getSnapshot().error.stage,'LIST_MY_FAMILIES');assert.equal(session.getSnapshot().familiesLoaded,false);
 f.port.callRead=async()=>({error:{status:401}});await session.refresh();assert.equal(session.getSnapshot().phase,'signedOut');assert.equal(session.getSnapshot().profile,null);assert.deepEqual(session.getSnapshot().families,[]);session.dispose();
});
test('退出取消旧请求等待，迟到家庭响应不能重新显示',async()=>{
 const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();const pending=deferred();f.port.callRead=()=>pending.promise;
 const old=session.checkAndroid('A');await tick();const signal=f.calls[0].signal;await session.signOut();pending.resolve({result:{success:true,families:[{familyId:'old',name:'旧家',myRole:'owner'}]}});await old;
 assert.equal(signal.aborted,true);assert.equal(session.getSnapshot().profile,null);assert.deepEqual(session.getSnapshot().families,[]);session.dispose();
});
test('跨标签账号切换立即清空家庭，丢弃旧账号异步回包',async()=>{
 const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();await session.checkAndroid('A');const pending=deferred(),normal=f.port.callRead;
 f.port.callRead=(action,signal)=>action==='listMyFamilies'?pending.promise:normal(action,signal);
 const old=session.checkAndroid('A');await tick();f.switchTo('B');assert.deepEqual(session.getSnapshot().families,[]);await tick();pending.resolve({result:{success:true,families:[{familyId:'old',name:'A私有家',myRole:'owner'}]}});await old;await tick();
 assert.equal(session.getSnapshot().profile.uid,'B');assert.equal(session.getSnapshot().androidUid,'');assert.deepEqual(session.getSnapshot().families,[]);session.dispose();
});
test('验证码会话错误、发送倒计时与本页过期保护',async()=>{
 let now=1000;const f=fakePort(null),session=createAccountSession(async()=>f.port,()=>now);let count=0;f.port.sendLoginCode=async email=>{count++;return{email,flow:'login',expiresAt:now+5000,verify:async()=>{throw {code:'verification_code_invalid'};}};};
 await session.start();await session.sendCode('login',{email:'existing@example.test'});await session.sendCode('login',{email:'existing@example.test'});assert.equal(count,1);assert.equal(session.getSnapshot().error.code,'SEND_COOLDOWN');
 await session.verifyCode('123456');assert.equal(session.getSnapshot().error.kind,'input');assert.ok(session.getSnapshot().challenge);now+=6000;await session.verifyCode('123456');assert.equal(session.getSnapshot().challenge,null);assert.equal(session.getSnapshot().error.code,'OTP_SESSION_EXPIRED');session.dispose();
});
test('旧验证码请求迟到失败不能清除新账号验证会话',async()=>{
 let now=1000;const f=fakePort(null),session=createAccountSession(async()=>f.port,()=>now),pending=deferred();
 f.port.sendLoginCode=async email=>({email,flow:'login',expiresAt:1e9,verify:()=>pending.promise});await session.start();await session.sendCode('login',{email:'first@example.test'});const old=session.verifyCode('123456');
 await session.signOut();now+=60001;await session.sendCode('login',{email:'second@example.test'});pending.reject(new AccountError({stage:'VERIFY_LOGIN_CODE',code:'OTP_EXPIRED',kind:'input',message:'旧会话'}));await old;
 assert.equal(session.getSnapshot().challenge.email,'second@example.test');session.dispose();
});
test('卸载页面丢弃延迟认证结果；StrictMode重新启动仍可恢复',async()=>{
 const f=fakePort(),pending=deferred();f.port.restore=()=>pending.promise;const session=createAccountSession(async()=>f.port),old=session.start();await tick();session.dispose();pending.resolve(profile('A'));await old;assert.equal(session.getSnapshot().profile,null);
 f.port.restore=async()=>profile('A');await session.start();assert.equal(session.getSnapshot().identity,'webMatched');session.dispose();
});
test('SDK认证写入串行，登录未结束时退出排队并最终移除会话',async()=>{
 const f=fakeSdk(),pending=deferred();f.auth.signInWithPassword=async()=>{await pending.promise;f.setUser(sdkUser('A'));return success({user:sdkUser('A')});};const port=createSdkPort(f.app),login=port.passwordLogin('user','password'),out=port.signOut();await tick();pending.resolve();await Promise.all([login,out]);assert.equal(await port.restore(),null);
});
test('取消等待不发布结果，第三方SDK日志在异常及嵌套后正确恢复',async()=>{
 const scope=new AbortController(),pending=deferred(),read=cancelable(pending.promise,scope.signal);scope.abort();await assert.rejects(read,e=>e.name==='AbortError');pending.resolve('late');
 const original=console.warn;await assert.rejects(privateSdkCall(async()=>{assert.notEqual(console.warn,original);await privateSdkCall(async()=>{console.warn('SYNTHETIC_SENSITIVE');});throw Error('synthetic');}));assert.equal(console.warn,original);
});
test('认证适配层首次加载失败后可以重试，不永久缓存失败Promise',async()=>{
 let attempts=0;const f=fakePort(),session=createAccountSession(async()=>{attempts++;if(attempts===1)throw new TypeError('synthetic fetch failure');return f.port;});
 await session.start();assert.equal(session.getSnapshot().error.kind,'network');await session.refresh();assert.equal(attempts,2);assert.equal(session.getSnapshot().identity,'webMatched');session.dispose();
});
test('阶段C复用SDK：函数action白名单、禁止伪造身份、关闭自动写重试',async()=>{
 const f=fakeSdk(),calls=[];f.setUser(sdkUser('A'));f.app.callFunction=async(...args)=>{calls.push(args);return{result:{success:true}};};const port=createSdkPort(f.app),signal=new AbortController().signal;
 await assert.rejects(port.callFamily('dropDatabase',{},'A',signal));await assert.rejects(port.callFamily('getFamily',{uid:'forged',familyId:'f'},'A',signal));await assert.rejects(port.callFamily('getFamily',{familyId:'f'},'B',signal));assert.equal(calls.length,0);
 await port.callFamily('mutateCollabRecord',{familyId:'f',module:'memo'},'A',signal);assert.deepEqual(calls[0][0],{name:'family_api',data:{familyId:'f',module:'memo',action:'mutateCollabRecord',clientVersion:'3.2'},parse:true});assert.equal(calls[0][2].retryOptions.retries,0);
});
test('阶段C请求已发出后的会话检查失败必须标记结果不确定',async()=>{
 const f=fakeSdk();f.setUser(sdkUser('A'));f.app.callFunction=async()=>{f.auth.getUser=async()=>({data:{user:null},error:{code:'unauthenticated'}});return{result:{success:true}};};const port=createSdkPort(f.app);
 await assert.rejects(port.callFamily('createFamily',{name:'家'},'A',new AbortController().signal),e=>e.issue.code==='POST_CALL_UNCONFIRMED'&&e.issue.kind==='unknown');
});
test('跨标签迟到的旧退出事件先清屏，再核对当前SDK合法新会话',async()=>{
 const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();await session.checkAndroid('A');f.switchTo('B');await tick();await tick();assert.equal(session.getSnapshot().profile.uid,'B');f.emit({event:'SIGNED_OUT',uid:null,managed:false});assert.equal(session.getSnapshot().profile,null);assert.deepEqual(session.getSnapshot().families,[]);await tick();await tick();assert.equal(session.getSnapshot().profile.uid,'B');assert.equal(session.getSnapshot().identity,'webMatched');assert.equal(session.getSnapshot().androidUid,'');session.dispose();
});

test('D 跨标签SDK过渡态只读重核验一次，不沿用旧安卓确认',async()=>{const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();await session.checkAndroid('A');const restore=f.port.restore;let attempts=0;f.port.restore=async()=>{if(++attempts===1)throw new AccountError({stage:'RESTORE_SESSION',code:'SESSION_UID_MISMATCH',kind:'identity',message:'合成过渡态'});return restore();};f.switchTo('B');await tick();await tick();await tick();assert.equal(attempts,2);assert.equal(session.getSnapshot().profile.uid,'B');assert.equal(session.getSnapshot().androidUid,'');assert.equal(session.getSnapshot().identity,'webMatched');assert.equal(f.calls.filter(c=>c.action==='listMyFamilies').length,1);session.dispose();});
test('D 跨标签持续UID不一致重读后仍阻断，不进入家庭',async()=>{const f=fakePort(),session=createAccountSession(async()=>f.port);await session.start();let attempts=0;f.port.restore=async()=>{attempts++;throw new AccountError({stage:'RESTORE_SESSION',code:'SESSION_UID_MISMATCH',kind:'identity',message:'合成不一致'});};f.switchTo('B');await tick();await tick();assert.equal(attempts,2);assert.equal(session.getSnapshot().phase,'blocked');assert.equal(session.getSnapshot().error.code,'SESSION_UID_MISMATCH');assert.deepEqual(session.getSnapshot().families,[]);assert.equal(f.calls.some(c=>c.action==='listMyFamilies'),false);session.dispose();});
