// 使用实际安装的官方SDK和真实浏览器；云端HTTP全部拦截。此文件不能证明生产云端登录成功。
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaultData} from '../src/data.ts';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const origin=process.env.PWA_TEST_URL??'http://127.0.0.1:4174/',out=resolve(process.env.PWA_TEST_ARTIFACTS??'docs/phase-c-2026-10-24/checkpoint/auth-browser');await mkdir(out,{recursive:true});
const envHost='jiashitong-d4g8m8lfcdc047ffe.api.tcloudbasegateway.com',results=[];
async function step(name,run){await run();results.push({name,passed:true});console.log(`PASS ${name}`);}
function credentials(uid){return {access_token:['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({sub:uid,uid,scope:'user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.'),refresh_token:'SYNTHETIC_REFRESH',expires_in:3600,scope:'user',token_type:'Bearer'};}
async function harness(){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const seed=defaultData();seed.diaries=[{id:'synthetic-personal',date:'2026-10-24',title:'旧个人日记',content:'只留在本机',updatedAt:'2026-10-24T09:00'}];
 await context.addInitScript(data=>{if(!localStorage.getItem('synthetic-auth-seeded')){localStorage.setItem('jiashitong_pwa_v1',JSON.stringify(data));localStorage.setItem('synthetic-auth-seeded','1');}},seed);
 const state={uid:'SYNTHETIC_A',nickname:'测试昵称',email:'existing@example.test',passwordError:false,otpError:false,expired:false,existing:true,serverMismatch:false,blocked:false,delayList:null,requests:[],unexpected:[],errors:[],logs:[]};
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.hostname==='127.0.0.1')return route.continue();
  // 未知域名和路径一律不通网。只记录方法/路径/action，不记录凭据或请求原文。
  if(url.hostname!==envHost){state.unexpected.push(url.origin+url.pathname);return route.abort();}
  const path=url.pathname,method=request.method(),body=request.postDataJSON()??{};
  // 身份必须绑定本次Bearer，不能让旧账号在途请求读到新账号的全局合成UID。
  const subject=()=>{try{const token=(request.headers().authorization??'').replace(/^Bearer /,'');return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).uid;}catch{return null;}};
  state.requests.push({path,method,actor:subject(),...path.includes('/functions/')?{action:body.action}:{}});
  const fulfill=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/auth/v1/signin'){
   if(state.passwordError)return fulfill({error:'invalid_username_or_password',error_description:'SYNTHETIC_PASSWORD_MUST_NOT_LOG'},400);
   if(body.username==='synthetic-b')state.uid='SYNTHETIC_B';
   return fulfill(credentials(state.uid));
  }
  if(path==='/auth/v1/verification'){
   if(body.target==='USER'&&!state.existing)return fulfill({error:'user_not_found'},400);
   assert.ok(body.target==='USER'||body.target==='ANY');return fulfill({is_user:state.existing,verification_id:'SYNTHETIC_VERIFICATION'});
  }
  if(path==='/auth/v1/verification/verify')return state.otpError?fulfill({error:'verification_code_invalid'},400):fulfill({verification_token:'SYNTHETIC_VERIFICATION_TOKEN'});
  if(path==='/auth/v1/signup'){
   assert.equal(state.existing,false);assert.equal(body.verification_token,'SYNTHETIC_VERIFICATION_TOKEN');assert.equal(body.verification_code,'123456');state.uid='SYNTHETIC_NEW';state.email=body.email;state.existing=true;return fulfill(credentials(state.uid));
  }
  if(path==='/auth/v1/user/me'){
   if(state.expired)return fulfill({error:'unauthenticated'},401);
   const uid=subject();if(!uid)return fulfill({error:'unauthenticated'},401);
   if(method!=='GET'){state.nickname=body.nickName??body.name??state.nickname;}
   return fulfill({uid,sub:uid,email:uid==='SYNTHETIC_B'?'second@example.test':state.email,nickName:state.nickname,username:'synthetic',created_at:'2026-10-24'});
  }
  if(path==='/auth/v1/user/signout')return fulfill({});
  if(path==='/auth/v1/user/basic/edit'){
   assert.deepEqual(Object.keys(body),['nickname']);state.nickname=body.nickname;return fulfill({});
  }
  if(path==='/v1/functions/family_api'){
   assert.match(request.headers().authorization??'',/^Bearer /);assert.deepEqual(Object.keys(body),['action','clientVersion']);assert.equal(body.clientVersion,'3.2');
   if(state.blocked)return fulfill({code:'permission_denied',message:'synthetic'},403);
   if(body.action==='v32Capabilities')return fulfill({success:true,version:'3.2',anonymous:false});
   if(body.action==='v32Unread')return fulfill({success:true,total:0,byFamily:{},deliveryPending:false});
   if(body.action==='whoAmI')return fulfill({success:true,uid:state.serverMismatch?'SYNTHETIC_OTHER':subject()});
   assert.equal(body.action,'listMyFamilies');if(state.delayList)await state.delayList;
   return fulfill({success:true,families:[{familyId:'synthetic-family',name:'合成测试家庭',myRole:'owner',privateBody:'SHOULD_NOT_ENTER_UI'}]});
  }
  state.unexpected.push(path);return fulfill({error:'unexpected_test_path'},400);
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>state.errors.push(error.message));page.on('console',message=>state.logs.push(message.text()));
 await page.goto(origin);await page.getByText('✓ 资料保存在本机',{exact:true}).waitFor();
 const personal=await page.evaluate(()=>localStorage.getItem('jiashitong_pwa_v1'));
 await page.evaluate(()=>localStorage.setItem('unrelated-user-key','keep'));
 await page.locator('button.tile').filter({hasText:'家庭共享'}).click();await page.getByLabel('用户名或邮箱',{exact:true}).waitFor();
 const login=async()=>{await page.getByLabel('用户名或邮箱',{exact:true}).fill('synthetic');await page.getByLabel('账号密码',{exact:true}).fill('synthetic123');await page.getByRole('button',{name:'登录家庭共享',exact:true}).click();};
 const logout=async()=>{const menu=page.getByRole('button',{name:'账号与身份',exact:true});if(await menu.isVisible()&&await menu.getAttribute('aria-expanded')==='false')await menu.click();await page.getByRole('button',{name:'退出本机账号',exact:true}).click();await page.getByRole('button',{name:'确认退出账号',exact:true}).click();await page.getByLabel('用户名或邮箱',{exact:true}).waitFor();};
 const list=()=>state.requests.filter(r=>r.action==='listMyFamilies');
 const check=async()=>{assert.deepEqual(state.unexpected,[]);assert.deepEqual(state.errors,[]);assert.ok(state.logs.every(log=>!log.includes('SYNTHETIC_PASSWORD_MUST_NOT_LOG')&&!log.includes('SYNTHETIC_REFRESH')));assert.equal(await page.evaluate(()=>localStorage.getItem('jiashitong_pwa_v1')),personal);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-user-key')),'keep');};
 return{page,context,state,login,logout,list,check};
}
let active;
try{
 await step('实际SDK密码登录、三UID门禁、只读家庭、昵称、备份隔离与退出',async()=>{
  const h=active=await harness(),{page,state}=h;await h.login();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();assert.equal(h.list().length,0);
  await page.getByLabel('安卓版原账号 UID',{exact:true}).fill('SYNTHETIC_A');await page.getByRole('button',{name:'核对安卓版 UID 并读取家庭',exact:true}).click();await page.getByRole('heading',{name:'核对安卓版家庭列表',exact:true}).waitFor();assert.equal(h.list().length,1);assert.ok(!(await page.locator('main').innerText()).includes('SHOULD_NOT_ENTER_UI'));
  await page.getByRole('button',{name:'账号与身份',exact:true}).click();await page.getByRole('button',{name:'修改账号昵称',exact:true}).click();await page.getByLabel('账号昵称（2～24个字符）',{exact:true}).fill('新的昵称');await page.getByRole('button',{name:'保存账号昵称',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(state.nickname,'新的昵称');
  await page.screenshot({path:join(out,'signed-in-390.png'),fullPage:true});await page.setViewportSize({width:320,height:740});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.reload();await page.locator('button.tile').filter({hasText:'家庭共享'}).click();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();assert.equal(h.list().length,1);assert.equal(await page.getByText(/^合成测试家庭(?: · 家主)?$/).count(),0);
  await page.getByRole('button',{name:'← 返回',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'↓ 一键备份全部',exact:true}).click();const file=await download;const stream=await file.createReadStream();let text='';for await(const chunk of stream)text+=chunk;for(const forbidden of ['SYNTHETIC_A','SYNTHETIC_REFRESH','synthetic123','123456','合成测试家庭'])assert.equal(text.includes(forbidden),false);
  await page.locator('button.tile').filter({hasText:'家庭共享'}).click();await page.getByRole('heading',{name:'我的账号',exact:true}).waitFor();await h.logout();assert.equal(await page.getByText(/^合成测试家庭(?: · 家主)?$/).count(),0);await h.check();await h.context.close();active=null;
 });
 await step('密码错误脱敏、登录未知邮箱不注册、注册已有邮箱不转登录',async()=>{
  const h=active=await harness(),{page,state}=h;state.passwordError=true;await h.login();await page.getByText(/错误码：INVALID_USERNAME_OR_PASSWORD/).waitFor();assert.equal(await page.getByLabel('账号密码',{exact:true}).inputValue(),'');assert.equal(state.requests.some(r=>r.path.endsWith('/signup')),false);
  state.passwordError=false;state.existing=false;await page.getByRole('button',{name:'邮箱验证码',exact:true}).click();await page.getByLabel('账号邮箱',{exact:true}).fill('missing@example.test');await page.getByRole('button',{name:'发送登录验证码',exact:true}).click();await page.getByText(/错误码：USER_NOT_FOUND/).waitFor();assert.equal(state.requests.some(r=>r.path.endsWith('/signup')),false);
  state.existing=true;await page.getByRole('button',{name:'注册新账号',exact:true}).click();await page.getByLabel('注册账号昵称（2～24字）',{exact:true}).fill('测试昵称');await page.getByLabel('注册密码',{exact:true}).fill('SafePass123!');await page.getByLabel('确认注册密码',{exact:true}).fill('SafePass123!');await page.getByRole('button',{name:'发送注册验证码',exact:true}).click();await page.getByText(/该邮箱已经注册/).waitFor();assert.equal(state.requests.filter(r=>r.path.endsWith('/signin')).length,1);await h.check();await h.context.close();active=null;
 });
 await step('实际SDK邮箱验证码登录、验证码错误、更正与发送倒计时',async()=>{
  const h=active=await harness(),{page,state}=h;await page.getByRole('button',{name:'邮箱验证码',exact:true}).click();await page.getByLabel('账号邮箱',{exact:true}).fill('existing@example.test');await page.getByRole('button',{name:'发送登录验证码',exact:true}).click();await page.getByLabel('邮箱验证码',{exact:true}).waitFor();assert.match(await page.getByRole('button',{name:/秒后可再发送/}).innerText(),/\d+秒/);
  state.otpError=true;await page.getByLabel('邮箱验证码',{exact:true}).fill('000000');await page.getByRole('button',{name:'确认验证码并登录',exact:true}).click();await page.getByText(/错误码：VERIFICATION_CODE_INVALID/).waitFor();assert.equal(await page.getByLabel('邮箱验证码',{exact:true}).inputValue(),'');state.otpError=false;
  await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByRole('button',{name:'确认验证码并登录',exact:true}).click();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();assert.equal(state.requests.some(r=>r.path.endsWith('/signup')),false);await h.check();await h.context.close();active=null;
 });
 await step('实际SDK邮箱注册：先发验证、后核验、最后一次signup',async()=>{
  const h=active=await harness(),{page,state}=h;state.existing=false;await page.getByRole('button',{name:'注册新账号',exact:true}).click();await page.getByLabel('账号邮箱',{exact:true}).fill('new@example.test');await page.getByLabel('新用户名（选填）',{exact:true}).fill('newuser');await page.getByLabel('注册账号昵称（2～24字）',{exact:true}).fill('测试昵称');await page.getByLabel('注册密码',{exact:true}).fill('newPassword123!');await page.getByLabel('确认注册密码',{exact:true}).fill('newPassword123!');await page.getByRole('button',{name:'发送注册验证码',exact:true}).click();await page.getByLabel('邮箱验证码',{exact:true}).waitFor();assert.equal(state.requests.some(r=>r.path.endsWith('/signup')),false);await page.getByLabel('邮箱验证码',{exact:true}).fill('123456');await page.getByRole('button',{name:'确认验证码并注册新账号',exact:true}).click();await page.getByRole('heading',{name:'核对当前身份的家庭列表',exact:true}).waitFor();assert.equal(state.requests.filter(r=>r.path.endsWith('/signup')).length,1);assert.equal(state.requests.some(r=>r.path.endsWith('/signin')),false);await h.check();await h.context.close();active=null;
 });
 await step('UID不一致停止家庭读取；错误阶段和码可见',async()=>{
  const h=active=await harness(),{page,state}=h;state.serverMismatch=true;await h.login();await page.getByText(/错误码：UID_MISMATCH/).waitFor();assert.equal(h.list().length,0);await page.screenshot({path:join(out,'uid-mismatch-390.png'),fullPage:true});await h.logout();state.serverMismatch=false;await h.login();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();await page.getByLabel('安卓版原账号 UID',{exact:true}).fill('SYNTHETIC_OTHER');await page.getByRole('button',{name:'核对安卓版 UID 并读取家庭',exact:true}).click();await page.getByText(/错误码：ANDROID_UID_MISMATCH/).waitFor();assert.equal(h.list().length,0);await h.check();await h.context.close();active=null;
 });
 await step('家庭请求未返回时退出，迟到结果不重新暴露家庭',async()=>{
  const h=active=await harness(),{page,state}=h;await h.login();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();let release;state.delayList=new Promise(resolve=>{release=resolve;});await page.getByLabel('安卓版原账号 UID',{exact:true}).fill('SYNTHETIC_A');await page.getByRole('button',{name:'核对安卓版 UID 并读取家庭',exact:true}).click();await page.waitForRequest(r=>new URL(r.url()).pathname==='/v1/functions/family_api');await h.logout();release();await page.waitForTimeout(100);assert.equal(await page.getByText(/^合成测试家庭(?: · 家主)?$/).count(),0);await h.check();await h.context.close();active=null;
 });
 await step('实际SDK权限拒绝与会话过期均不显示家庭',async()=>{
  const h=active=await harness(),{page,state}=h;state.blocked=true;await h.login();await page.getByText(/错误码：PERMISSION_DENIED/).waitFor();assert.equal(h.list().length,0);state.blocked=false;await page.getByRole('button',{name:'刷新账号与身份',exact:true}).click();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();state.expired=true;await page.getByRole('button',{name:'刷新账号与身份',exact:true}).click();await page.getByLabel('用户名或邮箱',{exact:true}).waitFor();assert.equal(await page.getByText(/^合成测试家庭(?: · 家主)?$/).count(),0);await h.check();await h.context.close();active=null;
 });
 await step('实际SDK跨标签退出和账号切换，旧家庭即时隐藏且需重新核对',async()=>{
  const h=active=await harness(),{page,state}=h;await h.login();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();await page.getByLabel('安卓版原账号 UID',{exact:true}).fill('SYNTHETIC_A');await page.getByRole('button',{name:'核对安卓版 UID 并读取家庭',exact:true}).click();await page.getByText(/^合成测试家庭(?: · 家主)?$/).waitFor();
  const second=await h.context.newPage();await second.goto(origin);await second.locator('button.tile').filter({hasText:'家庭共享'}).click();await second.getByRole('heading',{name:'我的账号',exact:true}).waitFor();await second.getByRole('button',{name:'退出本机账号',exact:true}).click();await second.getByRole('button',{name:'确认退出账号',exact:true}).click();await page.getByLabel('用户名或邮箱',{exact:true}).waitFor();assert.equal(await page.getByText(/^合成测试家庭(?: · 家主)?$/).count(),0);
  await second.getByLabel('用户名或邮箱',{exact:true}).fill('synthetic-b');await second.getByLabel('账号密码',{exact:true}).fill('synthetic123');await second.getByRole('button',{name:'登录家庭共享',exact:true}).click();await page.getByRole('heading',{name:'我的账号',exact:true}).waitFor();await page.getByText('Web 与云函数一致，等待安卓版核对',{exact:true}).waitFor();assert.equal(state.uid,'SYNTHETIC_B');assert.equal(await page.getByLabel('安卓版原账号 UID',{exact:true}).inputValue(),'');assert.equal(await page.getByText(/^合成测试家庭(?: · 家主)?$/).count(),0);assert.equal(h.list().length,1);await h.check();await h.context.close();active=null;
 });
}catch(error){results.push({passed:false,error:error.stack});if(active){await active.page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error('Sanitized request paths:',active.state.requests,active.state.unexpected);console.error('Session diagnostic:',await active.page.evaluate(async()=>{const {cloudBasePort}=await import('/src/cloud/sdk.ts');const {cloudConfig}=await import('/src/cloud/config.ts');try{return (await(await cloudBasePort(cloudConfig())).restore())?.uid??'no-session';}catch(e){return e.issue?.code??e.name;}}));}console.error(error);process.exitCode=1;}
finally{await writeFile(join(out,'results.json'),JSON.stringify({mode:'Actual installed SDK + intercepted synthetic HTTP only; NOT production CloudBase verification',results},null,2));await browser.close();}
