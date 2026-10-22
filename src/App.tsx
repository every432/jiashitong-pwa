import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import {exportJson,loadData,parseImport,saveData} from './data';
import type {AppData} from './model';
import Contacts from './features/Contacts';
import Dates from './features/Dates';
import Emergency from './features/Emergency';
import Safety from './features/Safety';
import Hotlines from './features/Hotlines';
import Courses from './features/Courses';
import './App.css';

type Page='home'|'contacts'|'dates'|'emergency'|'safety'|'hotlines'|'courses';
const tiles: {key:Page|string;icon:string;title:string;subtitle:string;color:string;enabled:boolean}[]=[
  {key:'contacts',icon:'☎',title:'亲情网',subtitle:'短号拨号 · 自定义排序',color:'lilac',enabled:true},
  {key:'dates',icon:'🎂',title:'生日与纪念日',subtitle:'农历/阳历 · 倒计时',color:'white',enabled:true},
  {key:'memo',icon:'📝',title:'重要事项备忘',subtitle:'下一批移植',color:'sage',enabled:false},
  {key:'courtesy',icon:'🎁',title:'人情往来',subtitle:'下一批移植',color:'peach',enabled:false},
  {key:'debts',icon:'¥',title:'债权债务',subtitle:'下一批移植',color:'mist',enabled:false},
  {key:'courses',icon:'📚',title:'辅导班课时',subtitle:'月历 · 固定课 · 请假',color:'sky',enabled:true},
  {key:'safety',icon:'✓',title:'一键报平安',subtitle:'短信 · 分享消息',color:'white',enabled:true},
  {key:'hotlines',icon:'☎',title:'常用投诉举报热线',subtitle:'职能电话 · 快捷拨号',color:'blue',enabled:true},
];
export default function App(){
  const [data,setData]=useState<AppData>(loadData);const [page,setPage]=useState<Page>('home');const [saveError,setSaveError]=useState(false);
  const [notice,setNotice]=useState('');const fileInput=useRef<HTMLInputElement|null>(null);
  useEffect(()=>{const ok=saveData(data);setSaveError(!ok);},[data]);
  useEffect(()=>{document.title='家事通';},[]);
  function navigate(p:Page){setPage(p);window.scrollTo(0,0);}
  async function importFile(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{const next=await parseImport(file);if(!confirm('恢复将覆盖当前 PWA 里所有记录，建议先点“一键备份全部”。确定恢复吗？'))return;setData(next);setNotice('恢复成功，记录已保存在本机');navigate('home');}
    catch(error){alert((error as Error).message || '备份恢复失败');}
  }
  const common={data,setData,onBack:()=>navigate('home')};
  return <div className="app-shell">
    {page==='home'?<main className="page home-page"><div className="home-top"><div><h1>家事通</h1><p>把家人的重要事情都放在一起 ❤</p></div><button className="emergency-link" onClick={()=>navigate('emergency')}>✚ 紧急联系人</button></div>
      <div className="home-board">{tiles.map(tile=><button key={tile.key} disabled={!tile.enabled} className={`tile ${tile.color} ${tile.enabled?'':'disabled'}`} onClick={()=>tile.enabled&&navigate(tile.key as Page)}><span className="tile-icon">{tile.icon}</span><strong>{tile.title}</strong><small>{tile.subtitle}</small></button>)}</div>
      <section className="backup-panel"><h2>资料备份</h2><p>记录仅保存在当前设备的浏览器里。换手机、清除网站数据或卸载网页应用，都可能导致记录丢失。</p><div className="toolbar two"><button className="btn primary" onClick={()=>exportJson(data)}>↓ 一键备份全部</button><button className="btn secondary" onClick={()=>fileInput.current?.click()}>↑ 一键恢复全部</button></div><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile}/><p className="hint">仅支持此 PWA 的 JSON 完整备份；安卓版备份尚不能直接全量恢复。两端数据不会自动同步。</p></section>
      <div className="home-bottom"><span>个人资料保存在本机 · 请定期备份</span><span>PWA 0.1 测试版</span></div>
      {notice&&<p className="notice success" role="status">{notice}</p>}
    </main>:page==='contacts'?<Contacts {...common}/>:page==='dates'?<Dates {...common}/>:page==='emergency'?<Emergency {...common}/>:page==='safety'?<Safety {...common}/>:page==='hotlines'?<Hotlines {...common}/>:<Courses {...common}/>}
    {saveError&&<div className="storage-warning" role="alert">⚠ 当前浏览器无法保存数据！请退出无痕模式并检查可用空间，立即导出备份。</div>}
  </div>;
}
