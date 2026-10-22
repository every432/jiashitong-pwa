import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import {exportJson,loadData,parseImport,saveData} from './data';
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
import ReminderCenter from './ReminderCenter';
import './App.css';

type Page='home'|'contacts'|'dates'|'diary'|'memo'|'courtesy'|'debts'|'courses'|'emergency'|'hotlines';
const tiles:{key:Page;icon:string;title:string;subtitle:string;color:string}[]=[
 {key:'contacts',icon:'☎',title:'亲情网',subtitle:'短号拨号 · 自定义排序',color:'lilac'},
 {key:'dates',icon:'🎂',title:'生日与纪念日',subtitle:'农历 / 阳历 · 提前提醒',color:'white'},
 {key:'diary',icon:'📔',title:'日记',subtitle:'每天记录 · 搜索日记',color:'peach'},
 {key:'memo',icon:'📝',title:'重要事项备忘',subtitle:'事项时间 · 自定义提醒',color:'sage'},
 {key:'courtesy',icon:'🎁',title:'人情往来',subtitle:'收到 / 送出 · 多笔明细',color:'peach'},
 {key:'debts',icon:'¥',title:'债权债务',subtitle:'归还状态 · 统计 · 提醒',color:'mist'},
 {key:'courses',icon:'📚',title:'辅导班课时记录',subtitle:'课时余额 · 记录 / 补课 / 请假',color:'sky'},
 {key:'hotlines',icon:'☎',title:'常用投诉举报热线',subtitle:'职能电话 · 快捷拨号',color:'blue'},
];
export default function App(){
 const [data,setData]=useState<FullAppData>(loadData),[page,setPage]=useState<Page>('home'),[saveError,setSaveError]=useState(false),[notice,setNotice]=useState('');
 const fileInput=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{setSaveError(!saveData(data));},[data]);
 useEffect(()=>{document.title='家事通';},[]);
 function navigate(p:Page){setPage(p);window.scrollTo(0,0);}
 async function importFile(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file)return;
   try{const next=await parseImport(file);if(!confirm('恢复会覆盖本设备现有全部 PWA 数据。请先点击「一键备份全部」。确定恢复？'))return;
     setData(next);setNotice('备份恢复成功，已载入所有记录');navigate('home');}
   catch(error){alert((error as Error).message||'备份恢复失败');}
 }
 const common={data,setData,onBack:()=>navigate('home')};
 return <div className="app-shell">
 {page==='home'?<main className="page home-page"><div className="home-top"><div><h1>家事通</h1><p>把家人的重要事情都放在一起 ❤</p></div><button className="emergency-link" onClick={()=>navigate('emergency')}>✚ 紧急联系人</button></div>
 <div className="home-board">{tiles.map(t=><button className={`tile ${t.color}`} key={t.key} onClick={()=>navigate(t.key)}><span className="tile-icon">{t.icon}</span><strong>{t.title}</strong><small>{t.subtitle}</small></button>)}</div>
 <ReminderCenter data={data} showControls={true}/><section className="panel reminder-export"><h2>📅 使用手机系统日历提醒</h2><p className="small muted">如果需要关闭网页后仍能按时收到提醒，可以尝试导出 .ics 日历文件，再导入手机支持的系统日历。包含已设置的事项、生日、债务与未来13周固定课程提醒；数据改动后需要重新导入。不同系统日历的导入操作与兼容性有所不同。</p><button className="btn secondary wide" onClick={()=>exportCalendar(data)}>↓ 导出原生日历提醒（ICS）</button></section>
 <section className="backup-panel"><h2>资料备份</h2><p>记录保存在当前设备的浏览器中。换机、卸载、清理网站数据或浏览器异常，都有可能丢失资料，建议定期导出。</p><div className="toolbar two"><button className="btn primary" onClick={()=>exportJson(data)}>↓ 一键备份全部</button><button className="btn secondary" onClick={()=>fileInput.current?.click()}>↑ 一键恢复全部</button></div><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile}/><p className="hint">兼容旧版 PWA 0.1 的 JSON 备份和新版备份；安卓版备份暂不能直接恢复，两端数据不会自动同步。</p></section>
 <div className="home-bottom"><span>请定期备份个人资料</span><span>PWA 2.6 功能对齐版</span></div>{notice&&<p className="notice success" role="status">{notice}</p>}
 </main>:page==='contacts'?<Contacts {...common}/>:page==='dates'?<Dates {...common}/>:page==='diary'?<Diary {...common}/>:page==='memo'?<Memo {...common}/>:page==='courtesy'?<Courtesy {...common}/>:page==='debts'?<Debts {...common}/>:page==='courses'?<Courses {...common}/>:page==='emergency'?<Emergency {...common}/>:<Hotlines {...common}/>}
 {page!=='home'&&<ReminderCenter data={data} showControls={false}/>}
 {saveError&&<div className="storage-warning" role="alert">⚠ 浏览器保存数据失败，请检查可用空间并尽快导出完整备份。</div>}
 </div>;
}
