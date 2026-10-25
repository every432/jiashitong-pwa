import {lazy,Suspense,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {ChangeEvent} from 'react';
import {downloadText,exportJson,mergeBackup,parseImport} from './data';
import {browserWriteLock,createDataStore} from './storage';
import {exportCalendar} from './calendarExport';
import type {FullAppData} from './model';
import Contacts from './features/Contacts';
import Dates from './features/Dates';
import Emergency from './features/Emergency';
import Hotlines from './features/Hotlines';
import Courses from './features/Courses';
import Diary from './features/Diary';
import Memo from './features/Memo';
import Courtesy from './features/Courtesy';
import Debts from './features/Debts';
import Safety from './features/Safety';
import Expenses from './features/Expenses';
import Websites from './features/Websites';
import ReminderCenter from './ReminderCenter';
import {Actions,Header,Modal} from './ui';
import './App.css';
import HomeDashboardV32 from './features/HomeDashboardV32';
import {useNoticesV32,useNoticeSync} from './features/family/useNoticesV32';
import {registerUpdateCheck} from './pwa/updateSafety';
const FamilyAccount=lazy(()=>import('./features/FamilyAccount').catch(()=>({default:({onBack}:{onBack:()=>void})=><main className="page"><Header title="家庭共享" onBack={onBack}/><section className="panel"><h2>账号页面资源未能加载</h2><p>请返回首页继续使用个人资料。联网后刷新页面，再进入家庭共享。</p><p>原有本机资料保持不变。</p></section></main>})));

type Page='home'|'contacts'|'dates'|'diary'|'memo'|'courtesy'|'debts'|'courses'|'emergency'|'hotlines'|'safety'|'expenses'|'websites'|'sharing';
const tiles:{key:Page;icon:string;title:string;subtitle:string;color:string}[]=[
 {key:'contacts',icon:'☎',title:'亲情网',subtitle:'短号拨号 · 自定义排序',color:'lilac'},
 {key:'dates',icon:'🎂',title:'生日与纪念日',subtitle:'农历 / 阳历 · 提前提醒',color:'white'},
 {key:'diary',icon:'📔',title:'日记',subtitle:'每天记录 · 搜索日记',color:'peach'},
 {key:'memo',icon:'📝',title:'重要事项备忘',subtitle:'事项时间 · 自定义提醒',color:'sage'},
 {key:'courtesy',icon:'🎁',title:'人情往来',subtitle:'收到 / 送出 · 多笔明细',color:'peach'},
 {key:'debts',icon:'¥',title:'债权债务',subtitle:'归还状态 · 统计 · 提醒',color:'mist'},
 {key:'courses',icon:'📚',title:'辅导班课时记录',subtitle:'课时余额 · 记录 / 补课 / 请假',color:'sky'},
 {key:'hotlines',icon:'☎',title:'常用投诉举报热线',subtitle:'职能电话 · 快捷拨号',color:'blue'},
 {key:'expenses',icon:'¥',title:'家庭开支统计',subtitle:'分类统计 · 导出报表',color:'lilac'},
 {key:'websites',icon:'🌐',title:'常用网站',subtitle:'家庭写作 · 分类导航',color:'sky'},
 {key:'sharing',icon:'👨‍👩‍👧',title:'家庭共享',subtitle:'原账号登录 · 家庭概览',color:'mist'},
 {key:'safety',icon:'💌',title:'一键报平安',subtitle:'短信准备 · 分享消息',color:'sage'},
];
export default function App(){
 useNoticeSync();const notices=useNoticesV32();
 const [store]=useState(()=>createDataStore(()=>window.localStorage,browserWriteLock));
 useEffect(()=>registerUpdateCheck(()=>{const current=store.getSnapshot();return current.status!=='ready'||current.dirty||current.saving?'个人资料尚未安全保存，请先处理页面提示':null;}),[store]);
 const state=useSyncExternalStore(store.subscribe,store.getSnapshot);
 const [page,setPage]=useState<Page>('home'),[notice,setNotice]=useState(''),[imported,setImported]=useState<FullAppData|null>(null);
 const fileInput=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{void store.initialize();const changed=(e:StorageEvent)=>{if(e.key==='jiashitong_pwa_v1'||e.key===null)store.checkExternal();};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[store]);
 useEffect(()=>{document.title='家事通';},[]);
 useEffect(()=>{if(!state.dirty)return;const prevent=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[state.dirty]);
 function navigate(p:Page){setPage(p);window.scrollTo(0,0);}
 function exportRaw(){const raw=store.originalRaw();if(raw!==null)downloadText(raw,'家事通_原始存储_请保留.txt','text/plain;charset=utf-8');}
 function exportPrevious(){try{const raw=store.previousRaw();if(raw===null){alert('暂无上次可读快照');return;}downloadText(raw,'家事通_上次保存前快照.json');}catch{alert('快照无法校验，原文件已保留。');}}
 async function importFile(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file)return;
   try{setImported(await parseImport(file));}catch(error){alert((error as Error).message||'备份读取失败');}
 }
 if(state.status==='loading')return <main className="page"><h1>家事通</h1><p role="status">正在校验并安全升级个人资料…</p></main>;
 if(state.status==='blocked'||!state.data)return <main className="page recovery-page"><h1>个人资料已保护</h1><p role="alert" className="notice">{state.error}</p><p>已停止编辑和自动保存。请先导出资料；不要清理网站数据或卸载主屏应用。</p><div className="stack"><button className="btn primary" disabled={store.originalRaw()===null} onClick={exportRaw}>导出读取时的原始资料</button>{state.data&&<button className="btn primary" onClick={()=>exportJson(state.data!)}>导出本页资料（含未保存更改）</button>}<button className="btn secondary" onClick={exportPrevious}>导出上次保存前快照</button><button className="btn ghost" onClick={()=>{if(!state.dirty||confirm('请确认已导出本页未保存更改。重新读取将放弃本页草稿，继续？'))window.location.reload();}}>重新读取资料</button></div></main>;
 const data=state.data,setData=store.update,common={data,setData,onBack:()=>navigate('home')};
 const preview=imported?mergeBackup(data,imported):null;
 return <div className="app-shell">
 <div className={`save-state ${state.error?'save-error':''}`} role="status" aria-live="polite">{state.error?`尚未保存：${state.error}`:state.dirty||state.saving?'正在保存本机资料…':'✓ 资料保存在本机'}{state.error&&<Actions><button className="btn secondary" onClick={()=>void store.retry()}>重试保存</button><button className="btn primary" onClick={()=>exportJson(data)}>导出全部资料</button></Actions>}</div>
 {page==='home'?<main className="page home-page"><div className="home-top"><div><h1>家事通</h1><p>把家人的重要事情都放在一起 ❤</p></div><button className="emergency-link" onClick={()=>navigate('emergency')}>✚ 紧急联系人</button></div>
 <HomeDashboardV32 key={notices.uid||"local"} tiles={tiles} uid={notices.uid} total={notices.total} noticeError={notices.error?'消息暂未同步 · 进入刷新':notices.deliveryPending?'新消息仍在投递 · 进入刷新':''} onNavigate={navigate}/>
 <ReminderCenter data={data} showControls={true}/><section className="panel reminder-export"><h2>📅 使用手机系统日历提醒</h2><p className="small muted">网页关闭、锁屏或被系统挂起时不保证提醒。可以导出 .ics，再导入手机日历。包含已设置的事项、生日、债务与未来13周固定课程提醒；数据改动后需要重新导入。</p><button className="btn secondary wide" onClick={()=>exportCalendar(data)}>↓ 导出原生日历提醒（ICS）</button></section>
 <section className="backup-panel"><h2>资料备份</h2><p>包含全部个人资料。导入将预览并合并，不删除本机已有记录；同 ID 冲突保留本机版本。</p><div className="toolbar two"><button className="btn primary" onClick={()=>exportJson(data)}>↓ 一键备份全部</button><button className="btn secondary" onClick={()=>fileInput.current?.click()}>↑ 导入备份</button></div><button className="text-btn" onClick={exportPrevious}>导出上次保存前快照</button><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile}/><p className="hint">兼容旧版 PWA 0.1 / 2.6 备份；安卓版备份暂不能直接导入。个人资料不会自动上传。</p></section>
 <div className="home-bottom"><span>请定期备份个人资料</span><span>PWA 3.2.1</span></div>{notice&&<p className="notice success" role="status">{notice}</p>}
 </main>:page==='sharing'?<Suspense fallback={<main className="page"><Header title="家庭共享" onBack={()=>navigate('home')}/><p role="status">正在加载账号页面…</p></main>}><FamilyAccount onBack={()=>navigate('home')}/></Suspense>:page==='expenses'?<Expenses {...common} onPersist={async action=>{if(store.getSnapshot().status!=='ready')return false;store.update(action);await store.settled();const s=store.getSnapshot();return s.status==='ready'&&!s.dirty&&!s.error;}}/>:page==='websites'?<Websites {...common}/>:page==='contacts'?<Contacts {...common}/>:page==='dates'?<Dates {...common}/>:page==='diary'?<Diary {...common}/>:page==='memo'?<Memo {...common}/>:page==='courtesy'?<Courtesy {...common}/>:page==='debts'?<Debts {...common}/>:page==='courses'?<Courses {...common}/>:page==='emergency'?<Emergency {...common}/>:page==='safety'?<Safety {...common}/>:<Hotlines {...common}/>}
 {page!=='home'&&<ReminderCenter data={data} showControls={false}/>}
 {imported&&preview&&<Modal title="合并备份预览" onClose={()=>setImported(null)}><p>将新增 {preview.added} 条记录，{preview.conflicts} 项同 ID 冲突或课程关联冲突将跳过，保留本机版本。现有记录、排序及设置不会被覆盖。</p><p>导入前会保留本次保存前快照。请保留原备份文件；冲突项如需恢复，可另行核对。</p><Actions><button className="btn ghost" onClick={()=>setImported(null)}>取消</button><button className="btn primary" onClick={()=>{setData(current=>mergeBackup(current,imported).data);setImported(null);setNotice('备份已合并；保存状态请看页面顶部。');navigate('home');}}>确认合并备份</button></Actions></Modal>}
 </div>;
}
