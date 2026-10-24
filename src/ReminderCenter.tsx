import {useEffect,useMemo,useRef,useState} from 'react';
import type {FullAppData} from './model';
import {dueReminders} from './reminders';
const DISMISS_KEY='jiashitong_pwa_alert_ack_v26';
function readSeen():{value:Record<string,number>;raw:string|null;canWrite:boolean}{
 let raw:string|null=null;
 try{raw=localStorage.getItem(DISMISS_KEY);const value:unknown=JSON.parse(raw??'{}');if(!value||typeof value!=='object'||Array.isArray(value)||!Object.values(value).every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('invalid');return {value:value as Record<string,number>,raw,canWrite:true};}
 catch{return {value:{},raw,canWrite:false};}
}
export default function ReminderCenter({data,showControls}:{data:FullAppData;showControls:boolean}){
 const [clock,setClock]=useState(()=>Date.now()),[seen]=useState(readSeen),[dismissed,setDismissed]=useState<Record<string,number>>(seen.value),[soundEnabled,setSoundEnabled]=useState(false),[notificationStatus,setNotificationStatus]=useState('');
 const seenRaw=useRef(seen.raw);
 const audioRef=useRef<AudioContext|null>(null);
 useEffect(()=>{const interval=window.setInterval(()=>setClock(Date.now()),30000);const wake=()=>setClock(Date.now());document.addEventListener('visibilitychange',wake);return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',wake)};},[]);
 const due=useMemo(()=>dueReminders(data,new Date(clock)).filter(x=>!dismissed[x.key]),[data,clock,dismissed]);
 const alerted=useRef(new Set<string>());
 useEffect(()=>{for(const item of due){if(alerted.current.has(item.key))continue;alerted.current.add(item.key);
   if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&'serviceWorker'in navigator){
     navigator.serviceWorker.ready.then(sw=>sw.showNotification('家事通提醒',{body:item.title,tag:item.key,icon:`${import.meta.env.BASE_URL}icon-192.png`})).catch(()=>{});
   }
 }},[due]);
 useEffect(()=>{if(!soundEnabled||!due.some(x=>x.mode==='alarm'))return;
  const play=()=>{const ctx=audioRef.current;if(!ctx||ctx.state!=='running')return;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=760;
    gain.gain.setValueAtTime(.001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.13,ctx.currentTime+.03);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.3);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.31);};
  play();const id=window.setInterval(play,1800);return()=>clearInterval(id);
 },[due,soundEnabled]);
 const allowSound=async()=>{try{if(!audioRef.current)audioRef.current=new AudioContext();await audioRef.current.resume();setSoundEnabled(true);setNotificationStatus('已启用本次打开期间的提醒铃声');}catch{setNotificationStatus('浏览器禁止了声音，请检查系统静音与浏览器权限');}};
 const askNotification=async()=>{if(!('Notification'in window)){setNotificationStatus('当前浏览器不支持系统通知，可使用页面内提醒');return;}try{const p=await Notification.requestPermission();setNotificationStatus(p==='granted'?'系统通知权限已允许（仅打开网页时自动检查）':`通知权限状态：${p}`);}catch{setNotificationStatus('当前系统暂时无法申请通知权限');}};
 const acknowledge=(key:string)=>{const next={...dismissed,[key]:clock};setDismissed(next);try{if(!seen.canWrite||localStorage.getItem(DISMISS_KEY)!==seenRaw.current)throw new Error('changed');const raw=JSON.stringify(Object.fromEntries(Object.entries(next).filter(([,v])=>v>clock-400*86400000)));localStorage.setItem(DISMISS_KEY,raw);seenRaw.current=raw;}catch{setNotificationStatus('本次已停止提醒；确认状态未保存，原始提醒资料保持不变。');}};
 return <>{showControls&&<section className="reminder-tools panel"><h2>🔔 提醒设置（PWA）</h2><p className="small muted">这里支持网页打开时的到点提示、普通系统通知（设备允许时）和前台响铃；网页关闭、锁屏或系统挂起时不保证提醒。</p><div className="toolbar two"><button className="btn secondary" onClick={askNotification}>允许系统通知</button><button className="btn secondary" onClick={allowSound}>{soundEnabled?'✓ 已启用本次响铃':'启用前台响铃'}</button></div>{notificationStatus&&<p className="small purple" role="status">{notificationStatus}</p>}</section>}
 {due.length>0&&<div className="reminder-alert" role="alertdialog" aria-label="家事通到期提醒"><h2>🔔 有 {due.length} 条提醒待处理</h2><div className="stack small-gap">{due.slice(0,5).map(x=><div className="alert-item" key={x.key}><div><strong>{x.mode==='alarm'?'🔊':'🔔'} {x.title}</strong><p>{x.time.replace('T',' ')}</p></div><button className="btn secondary" onClick={()=>acknowledge(x.key)}>知道了 / 停止</button></div>)}</div></div>}
 </>;
}
