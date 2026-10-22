import {useState} from 'react';
import type {MemoEntry,ReminderMode} from '../model';
import {reminderModes,todayISO,uid} from '../model';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,TimeSelect} from '../ui';
import type {Props} from '../featureTypes';
export default function Memo({data,setData,onBack}:Props){
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<MemoEntry|null|undefined>(),[deleting,setDeleting]=useState<MemoEntry|null>(null);
 const [title,setTitle]=useState(''),[eventDate,setEventDate]=useState(todayISO()),[eventTime,setEventTime]=useState('09:00'),[note,setNote]=useState('');
 const [mode,setMode]=useState<ReminderMode>('none'),[remindDate,setRemindDate]=useState(todayISO()),[remindTime,setRemindTime]=useState('09:00');
 function open(x:MemoEntry|null){setEditing(x);setTitle(x?.title??'');setEventDate(x?.eventAt.slice(0,10)??todayISO());setEventTime(x?.eventAt.slice(11,16)??'09:00');setNote(x?.note??'');setMode(x?.reminderMode??'none');setRemindDate(x?.remindAt.slice(0,10)??todayISO());setRemindTime(x?.remindAt.slice(11,16)??'09:00');}
 function save(){if(!title.trim()||!eventDate){alert('请填写事项名称和日期');return;}if(mode!=='none'&&!remindDate){alert('请设置提醒日期');return;}
  const x:MemoEntry={id:editing?.id??uid(),title:title.trim(),eventAt:`${eventDate}T${eventTime}`,note:note.trim(),reminderMode:mode,remindAt:mode==='none'?'':`${remindDate}T${remindTime}`};
  setData(d=>({...d,memos:editing?d.memos.map(e=>e.id===x.id?x:e):[...d.memos,x]}));setEditing(undefined);
 }
 const matches=data.memos.filter(x=>`${x.title} ${x.note} ${x.eventAt}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.eventAt.localeCompare(b.eventAt));
 return <main className="page"><Header title="重要事项备忘" subtitle="安排重要事情 · 支持设置提醒时间" onBack={onBack}/><button className="btn primary wide" onClick={()=>open(null)}>＋ 添加重要事项</button><input className="search" placeholder="按标题、内容、日期搜索" aria-label="搜索重要事项" value={query} onChange={e=>setQuery(e.target.value)}/>
 {!matches.length?<Empty icon="📝" title="暂无重要事项" description="可以添加体检、交费、开会、重要约定等。"/>:<div className="stack">{matches.map(x=><article className="panel entry-card" key={x.id}><div className="entry-top"><h2>📝 {x.title}</h2><span className="small muted">{x.eventAt.replace('T',' ')}</span></div>{x.note&&<p className="preserve">{x.note}</p>}<p className="small muted">🔔 {reminderModes.find(m=>m.id===x.reminderMode)?.label??'不提醒'}{x.reminderMode!=='none'?` · ${x.remindAt.replace('T',' ')}`:''}</p><Actions><button className="text-btn" onClick={()=>open(x)}>编辑</button><button className="text-btn" onClick={()=>setDeleting(x)}>删除</button></Actions></article>)}</div>}
 {editing!==undefined&&<Modal title={editing?'编辑重要事项':'添加重要事项'} onClose={()=>setEditing(undefined)}><Field label="事项名称"><input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></Field><Field label="事项日期"><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)}/></Field><Field label="事项时间"><TimeSelect value={eventTime} onChange={setEventTime}/></Field><Field label="详细备注"><textarea rows={5} maxLength={3000} value={note} onChange={e=>setNote(e.target.value)}/></Field><Field label="提醒方式"><select value={mode} onChange={e=>setMode(e.target.value as ReminderMode)}>{reminderModes.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>{mode!=='none'&&<><Field label="提醒日期（可提前数天）"><input type="date" value={remindDate} onChange={e=>setRemindDate(e.target.value)}/></Field><Field label="提醒时间"><TimeSelect value={remindTime} onChange={setRemindTime}/></Field></>}<p className="hint">PWA 提醒仅在页面打开时检查；后台准时推送还需要服务器接入 Web Push。</p><Actions><button className="btn ghost" onClick={()=>setEditing(undefined)}>取消</button><button className="btn primary" onClick={save}>保存</button></Actions></Modal>}
 {deleting&&<ConfirmDelete title={`删除“${deleting.title}”？`} onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(d=>({...d,memos:d.memos.filter(x=>x.id!==deleting.id)}));setDeleting(null)}}/>}
 </main>;
}
