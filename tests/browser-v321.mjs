// Chromium触摸模拟 + 合成HTTP错误；不是真实iPhone或线上CloudBase验收。
import {createRequire} from 'node:module';import {homedir} from 'node:os';import {join} from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {defaultData} from '../src/data.ts';
const require=createRequire(import.meta.url),{chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const out='v321_work/browser-v321';await mkdir(out,{recursive:true});const results=[],errors=[],calls=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const seed=defaultData();seed.expenses=[{id:'old-v32',date:'2025-12-31',category:'日常生活',cents:123,note:'原备注\n保持'}];seed.expenseScale=150;
await context.addInitScript(seed=>{if(!localStorage.getItem('v321-seed')){localStorage.setItem('jiashitong_pwa_v1',JSON.stringify(seed));localStorage.setItem('v321-seed','1');localStorage.setItem('keep-user-key','keep');}},seed);
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();calls.push(url.pathname);return route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({error:'server_error',error_description:'synthetic network unavailable'})});});
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
const step=async(name,fn)=>{await fn();results.push({name,passed:true});console.log('PASS '+name);};
try{
 await page.goto('http://127.0.0.1:4174/');await page.getByText('✓ 资料保存在本机',{exact:true}).waitFor();
 await step('统一入口和连续录入不同类别，整数金额、旧记录及缩放保留',async()=>{
  await page.locator('button.tile').filter({hasText:'家庭开支统计'}).click();await page.getByRole('button',{name:'＋记一笔开支',exact:true}).click();
  await page.getByLabel('金额（元）',{exact:true}).fill('0.10');await page.getByLabel('开支类别',{exact:true}).selectOption('网络购物');await page.getByLabel('备注（选填）',{exact:true}).fill('连续第一笔');await page.getByRole('button',{name:'保存并再记一笔',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[inputmode=decimal]')?.value==='');
  await page.getByLabel('金额（元）',{exact:true}).fill('0.20');await page.getByLabel('开支类别',{exact:true}).selectOption('健康养生');await page.getByRole('button',{name:'保存并返回',exact:true}).dblclick();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('✓ 资料保存在本机',{exact:true}).waitFor();
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('jiashitong_pwa_v1')));assert.equal(data.expenses.length,3);assert.deepEqual(data.expenses.find(r=>r.id==='old-v32'),seed.expenses[0]);assert.equal(data.expenseScale,150);assert.equal(data.expenses.filter(r=>r.id!=='old-v32').reduce((s,r)=>s+r.cents,0),30);
 });
 await step('保存失败不关闭录入，重试同一记录ID不重复',async()=>{
  await page.getByRole('button',{name:'＋记一笔开支',exact:true}).click();await page.getByLabel('金额（元）',{exact:true}).fill('2.50');
  await page.evaluate(()=>{window.savedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='jiashitong_pwa_v1')throw new DOMException('synthetic','QuotaExceededError');return window.savedSet.call(this,k,v);};});
  await page.getByRole('button',{name:'保存并返回',exact:true}).click();await page.getByText(/尚未安全保存。请保留此页/).waitFor();assert.equal(await page.getByLabel('金额（元）',{exact:true}).inputValue(),'2.50');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jiashitong_pwa_v1')).expenses.length),3);
  await page.evaluate(()=>{Storage.prototype.setItem=window.savedSet;});await page.getByRole('button',{name:'保存并返回',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jiashitong_pwa_v1')).expenses.length),4);
 });
 await step('刷新保留数据；登录位于创建与加入上方，三个入口可达',async()=>{
  await page.reload();await page.locator('button.tile').filter({hasText:'家庭共享'}).click();await page.getByRole('heading',{name:'欢迎回来',exact:true}).waitFor();
  const login=await page.getByRole('button',{name:'登录家庭共享',exact:true}).boundingBox(),create=await page.getByRole('button',{name:'创建家庭',exact:true}).boundingBox();assert.ok(login.y<create.y);
  await page.getByRole('button',{name:'创建家庭',exact:true}).click();await page.getByRole('heading',{name:'邮箱正式注册',exact:true}).waitFor();await page.getByRole('button',{name:'返回已有账号登录',exact:true}).click();await page.getByRole('button',{name:'加入家庭',exact:true}).click();
  assert.equal(await page.getByLabel('10位加入码或恢复码',{exact:true}).isVisible(),true);
 });
 await step('匿名服务失败显示真实阶段，未发邀请码核销，个人资料保持',async()=>{
  await page.getByLabel('10位加入码或恢复码',{exact:true}).fill('J23456789A');await page.getByLabel('我的家庭昵称',{exact:true}).fill('合成称呼');await page.getByRole('button',{name:'以免邮箱身份加入 / 恢复家庭',exact:true}).click();
  await page.getByText(/阶段：ANONYMOUS_LOGIN/).waitFor();assert.ok(calls.some(p=>p.includes('anonymously')));assert.ok(!calls.some(p=>p.includes('functions')));assert.equal(await page.evaluate(()=>localStorage.getItem('keep-user-key')),'keep');
  await page.setViewportSize({width:320,height:740});await page.addStyleTag({content:'html{font-size:22px}'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(out,'登录与精确阶段.png'),fullPage:true});
 });assert.deepEqual(errors,[]);
}catch(e){results.push({passed:false,error:e.stack});await page.screenshot({path:join(out,'失败定位.png'),fullPage:true});console.error(e);process.exitCode=1;}
finally{await writeFile(join(out,'结果.json'),JSON.stringify({mode:'LOCAL_SYNTHETIC_HTTP_CHROMIUM_NOT_REAL_CLOUD',results,errors,calls},null,2));await context.close();await browser.close();}
