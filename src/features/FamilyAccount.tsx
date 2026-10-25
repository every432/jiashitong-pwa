import {useEffect,useState,useSyncExternalStore} from 'react';
import {Actions,Field,Header,Modal} from '../ui';
import {cloudConfig} from '../cloud/config';
import {cloudBasePort} from '../cloud/sdk';
import {createAccountSession} from '../cloud/session';
import type {EmailFlow} from '../cloud/types';
import './FamilyAccount.css';
import FamilyWorkspace from './family/FamilyWorkspace';
import AccountSecurityV32,{PasswordInput} from './AccountSecurityV32';
import {validatePassword} from '../cloud/authPolicyV32';
import {noticeStore} from './family/useNoticesV32';
import InviteResultReviewV321 from './family/InviteResultReviewV321';

export default function FamilyAccount({onBack}:{onBack:()=>void}){
 const [session]=useState(()=>createAccountSession(()=>cloudBasePort(cloudConfig({publishableKey:import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY,keyConfirmed:import.meta.env.VITE_CLOUDBASE_PUBLIC_KEY_CONFIRMED}))));
 const state=useSyncExternalStore(session.subscribe,session.getSnapshot);
 const [flow,setFlow]=useState<EmailFlow>('login'),[method,setMethod]=useState<'password'|'email'>('password');
 const [accountOpen,setAccountOpen]=useState(false);
 const [security,setSecurity]=useState(false),[anonymousEntry,setAnonymousEntry]=useState(false),[joinCode,setJoinCode]=useState(''),[familyNickname,setFamilyNickname]=useState(''),[registerNickname,setRegisterNickname]=useState('');
 const [account,setAccount]=useState(''),[password,setPassword]=useState(''),[email,setEmail]=useState(''),[username,setUsername]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[code,setCode]=useState('');
 const [androidUid,setAndroidUid]=useState(''),[nickname,setNickname]=useState(''),[editNickname,setEditNickname]=useState(false),[copyUid,setCopyUid]=useState(false),[logout,setLogout]=useState(false),[localError,setLocalError]=useState(''),[clock,setClock]=useState(()=>Date.now());
 useEffect(()=>{void session.start();return()=>session.dispose();},[session]);
 useEffect(()=>{void noticeStore.refresh();},[state.profile?.uid]);
 useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 // 身份来自外部SDK状态；切换后立即关闭旧账号草稿和复制框，不能跨账号复用。
 // eslint-disable-next-line react/set-state-in-effect
 useEffect(()=>{setEditNickname(false);setSecurity(false);setNickname('');setAndroidUid('');setCopyUid(false);},[state.profile?.uid]);
 const cooldown=Math.max(0,Math.ceil((state.cooldownUntil-clock)/1000)),challenge=state.challenge;
 const clearSecrets=()=>{setPassword('');setConfirmPassword('');setCode('');};
 function selectFlow(next:EmailFlow){setFlow(next);clearSecrets();session.clearChallenge();setLocalError('');}
 function send(){
  setLocalError('');if(flow==='register'){try{validatePassword(password,confirmPassword);}catch(e){setLocalError((e as Error).message);return;}}
  const pending=session.sendCode(flow,{email,password,username,...flow==='register'?{nickname:registerNickname}:{}});clearSecrets();void pending;
 }
 async function copy(){try{await navigator.clipboard.writeText(state.profile!.uid);}catch{setCopyUid(true);}}
 const disabled=state.busy||state.phase==='starting';
 const verified=['allMatched','nativeMatched'].includes(state.identity)&&state.familiesLoaded&&state.phase==='signedIn';
 return <main className="page account-page"><div className="family-topbar"><Header title="家庭共享" subtitle="家人共同管理" onBack={onBack}/>{state.profile&&<button className="btn secondary" aria-expanded={accountOpen} onClick={()=>setAccountOpen(!accountOpen)}>账号与身份</button>}</div>
 <p className="hint">家人共同管理 · 个人资料继续保存在本机，不会自动上传。进入家庭前请核对原账号身份。</p>
 {state.busy&&<p role="status" className="notice">正在连接原账号服务，请稍候…</p>}
 {(localError||state.error)&&<section role="alert" className="notice account-error"><p>{localError||state.error?.message}</p>{!localError&&state.error&&<small>阶段：{state.error.stage} · 错误码：{state.error.code}</small>}</section>}
 {state.notice&&(!verified||accountOpen)&&<p role="status" className="notice success">{state.notice}</p>}
 {state.profile?<>{verified&&<InviteResultReviewV321 key={state.profile.uid} uid={state.profile.uid} families={state.families} port={()=>cloudBasePort(cloudConfig({publishableKey:import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY,keyConfirmed:import.meta.env.VITE_CLOUDBASE_PUBLIC_KEY_CONFIRMED}))}/>} {(!verified||accountOpen)&&<>
  <section className="panel"><h2>我的账号</h2><dl className="account-details"><dt>账号昵称</dt><dd>{state.profile.nickname||'尚未设置'}</dd><dt>邮箱</dt><dd>{state.profile.email||'账号未提供邮箱'}</dd><dt>用户名</dt><dd>{state.profile.username||'账号未设置用户名'}</dd><dt>Web SDK UID</dt><dd className="account-uid">{state.profile.uid}</dd></dl>
   <p>{state.profile.anonymous?'免邮箱成员 · 当前浏览器会话':'正式账号'}</p><Actions><button className="btn secondary" onClick={()=>void copy()}>复制账号 UID</button><button className="btn secondary" disabled={disabled||state.phase==='blocked'} onClick={()=>{setNickname(state.profile!.nickname);setEditNickname(true);}}>修改账号昵称</button><button className="btn secondary" disabled={disabled||state.phase==='blocked'} onClick={()=>setSecurity(true)}>{state.profile.anonymous?'绑定邮箱与设置密码':'账户安全'}</button></Actions>
  </section>
  <section className="panel"><h2>核对原账号身份</h2><p>已有安卓正式账号请复制原账号 UID，确保两端完全一致。新建Web账号或免邮箱新设备使用真实SDK身份核对，不冒充原安卓UID。</p>
   <dl className="account-details"><dt>云函数 UID</dt><dd className="account-uid">{state.functionUid||'尚未核对成功'}</dd><dt>安卓版 UID</dt><dd className="account-uid">{state.androidUid||'等待你提供原账号 UID'}</dd><dt>核对结果</dt><dd>{state.identity==='allMatched'?'✓ 三项完全一致':state.identity==='webMatched'?'Web 与云函数一致，等待安卓版核对':state.identity==='mismatch'?'身份不一致，已停止家庭读取':'正在等待云端核对'}</dd></dl>
   <form onSubmit={e=>{e.preventDefault();void session.checkAndroid(androidUid);}}><Field label="安卓版原账号 UID"><input value={androidUid} onChange={e=>setAndroidUid(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} required disabled={disabled}/></Field><button className="btn primary wide" disabled={disabled||!state.functionUid||!androidUid.trim()}>核对安卓版 UID 并读取家庭</button></form>
   {state.identity==='webMatched'&&<button className="btn secondary wide" disabled={disabled} onClick={()=>void session.confirmWebAccount()}>我是新建Web账号或仅使用此Web身份，核对V3.2后进入</button>}<p className="hint">此核对由你提供安卓版原值；不会自动把 Web UID 当作安卓版 UID。刷新或离开此页后需再次提供。</p>
  </section>
  </>}{verified&&<FamilyWorkspace key={state.profile.uid} uid={state.profile.uid} anonymous={state.profile.anonymous===true} nativeOnly={state.identity==='nativeMatched'} families={state.families} identity={()=>{const latest=session.getSnapshot();return{uid:latest.profile?.uid??'',verified:['allMatched','nativeMatched'].includes(latest.identity)&&latest.phase==='signedIn'};}}/>}
 </>:state.phase!=='starting'&&<section className="panel">
  <h2>{flow==='login'?'欢迎回来':'邮箱正式注册'}</h2>
  {flow==='register'&&<button className="text-btn" disabled={disabled} onClick={()=>selectFlow('login')}>返回已有账号登录</button>}
  {flow==='login'&&<div className="account-tabs" role="group" aria-label="登录方式"><button className={`btn ${method==='password'?'primary':'ghost'}`} disabled={disabled} aria-pressed={method==='password'} onClick={()=>{setMethod('password');session.clearChallenge();clearSecrets();}}>用户名 / 邮箱密码</button><button className={`btn ${method==='email'?'primary':'ghost'}`} disabled={disabled} aria-pressed={method==='email'} onClick={()=>{setMethod('email');session.clearChallenge();clearSecrets();}}>邮箱验证码</button></div>}
  {flow==='login'&&method==='password'?<form onSubmit={e=>{e.preventDefault();setLocalError('');const pending=session.passwordLogin(account,password);clearSecrets();void pending;}}>
   <Field label="用户名或邮箱"><input value={account} onChange={e=>setAccount(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" required disabled={disabled}/></Field>
   <PasswordInput label="账号密码" value={password} onChange={setPassword} disabled={disabled}/>
   <button className="btn primary wide" disabled={disabled}>登录家庭共享</button><p className="hint">登录失败不会自动注册。尚未设置密码时，请使用邮箱验证码登录。</p>
  </form>:<>
   <form onSubmit={e=>{e.preventDefault();send();}}>
    <Field label="账号邮箱"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" autoCorrect="off" required disabled={disabled||!!challenge}/></Field>
    {flow==='register'&&<><p className="hint">仅创建新正式账号；已有邮箱返回登录。账号昵称不同于登录用户名、家庭昵称。</p><Field label="注册账号昵称（2～24字）"><input value={registerNickname} onChange={e=>setRegisterNickname(e.target.value)} required autoComplete="nickname" disabled={disabled||!!challenge}/></Field><Field label="新用户名（选填）"><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" disabled={disabled||!!challenge} maxLength={24}/></Field>{!challenge&&<><PasswordInput label="注册密码" value={password} onChange={setPassword} disabled={disabled} fresh/><PasswordInput label="确认注册密码" value={confirmPassword} onChange={setConfirmPassword} disabled={disabled} fresh/></>}<p className="hint">密码8～64位，包含大小写字母、数字和符号。发码后密码仅保留在本次SDK注册闭包，不写入本地资料。</p></>}
    <button className="btn secondary wide" disabled={disabled||cooldown>0||!!challenge}>{cooldown>0?`${cooldown}秒后可再发送`:flow==='register'?'发送注册验证码':'发送登录验证码'}</button>
   </form>
   {challenge&&<form className="account-verification" onSubmit={e=>{e.preventDefault();const pending=session.verifyCode(code);setCode('');void pending;}}><p>正在验证：{challenge.email}</p><Field label="邮箱验证码"><input value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,8}" maxLength={8} required disabled={disabled}/></Field><button className="btn primary wide" disabled={disabled}>{challenge.flow==='register'?'确认验证码并注册新账号':'确认验证码并登录'}</button><button type="button" className="text-btn" disabled={disabled} onClick={()=>{session.clearChallenge();clearSecrets();}}>更换邮箱 / 重新发送</button><p className="hint">本页验证会话最多保留10分钟；验证码有效期以云端为准。若已过期，请重新发送。切换页面会放弃本次验证。</p></form>}
   <p className="hint">若出现腾讯云安全验证码，请按官方验证窗口操作；风控或发送限制不会被绕过。</p>
  </>}
 <button className="text-btn" disabled={disabled} onClick={()=>setSecurity(true)}>忘记密码</button>
 <hr/><h3>第一次使用？</h3><Actions><button className="btn primary" disabled={disabled} onClick={()=>{setAnonymousEntry(false);selectFlow('register');}}>创建家庭</button><button className="btn secondary" disabled={disabled} onClick={()=>{setAnonymousEntry(!anonymousEntry);session.clearChallenge();clearSecrets();}}>加入家庭</button></Actions>
 <p className="hint">创建家庭须先注册或登录正式账号，认证成功后在家庭列表创建。</p>
  {anonymousEntry&&<form className="panel" onSubmit={e=>{e.preventDefault();void session.anonymousJoin(joinCode,familyNickname);}}><h3>10位一次性加入码 / 恢复码</h3><Field label="10位加入码或恢复码"><input value={joinCode} onChange={e=>setJoinCode(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={10} required disabled={disabled}/></Field><Field label="我的家庭昵称"><input value={familyNickname} onChange={e=>setFamilyNickname(e.target.value)} maxLength={40} required disabled={disabled}/></Field><button className="btn primary wide" disabled={disabled}>以免邮箱身份加入 / 恢复家庭</button><p className="hint">通过官方匿名认证获得真实UID。不会替换已有正式账号。请保留浏览器网站数据，加入后建议绑定邮箱；清理数据可能丢失身份。</p></form>}
 <button className="text-btn" disabled={disabled} onClick={()=>{setAnonymousEntry(false);selectFlow('register');}}>注册新账号</button>
 </section>}
 {(!verified||accountOpen)&&<Actions><button className="btn secondary" disabled={disabled} onClick={()=>void session.refresh()}>刷新账号与身份</button><button className="btn ghost" onClick={()=>setLogout(true)}>退出本机账号</button></Actions>}
 {state.phase==='blocked'&&<p className="notice">已停止家庭读取。请核对原账号，或退出后重新登录；不要创建同名家庭。</p>}
 {editNickname&&<Modal title="修改账号昵称" onClose={()=>{if(!state.busy)setEditNickname(false);}}><form onSubmit={e=>{e.preventDefault();void session.saveNickname(nickname).then(()=>{if(session.getSnapshot().notice.includes('昵称已核对保存'))setEditNickname(false);});}}><p>此处只修改账号昵称，不修改登录用户名或家庭称呼。</p><Field label="账号昵称（2～24个字符）"><input value={nickname} onChange={e=>setNickname(e.target.value)} autoComplete="nickname" disabled={disabled} required/></Field><button className="btn primary wide" disabled={disabled}>保存账号昵称</button>{state.error&&<p role="alert">{state.error.message}</p>}</form></Modal>}
 {security&&<AccountSecurityV32 key={state.profile?.uid??'reset'} profile={state.profile} onClose={()=>setSecurity(false)} onChanged={()=>session.refresh()}/>}
 {copyUid&&state.profile&&<Modal title="手动复制账号 UID" onClose={()=>setCopyUid(false)}><Field label="当前账号 UID"><textarea readOnly value={state.profile.uid} onFocus={e=>e.target.select()}/></Field><p>请长按复制此 UID。</p></Modal>}
 {logout&&<Modal title="退出本机账号" onClose={()=>setLogout(false)}><p>退出会隐藏当前账号的家庭概览，本机个人资料继续保留。免邮箱成员退出后无法凭昵称重新取得原会话；请先绑定邮箱，或向管理员索取恢复码。</p><Actions><button className="btn ghost" onClick={()=>setLogout(false)}>取消</button><button className="btn primary" onClick={()=>{clearSecrets();setLogout(false);void session.signOut();}}>确认退出账号</button></Actions></Modal>}
 </main>;
}
