import {useState} from 'react';
import type {DiaryEntry} from '../model';
import {todayISO,uid} from '../model';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal} from '../ui';
import type {Props} from '../featureTypes';
export default function Diary({data,setData,onBack}:Props){
 const [query,setQuery]=useState(''),[editing,setEditing]=useState<DiaryEntry|null|undefined>(),[deleting,setDeleting]=useState<DiaryEntry|null>(null);
 const [date,setDate]=useState(todayISO()),[title,setTitle]=useState(''),[content,setContent]=useState('');
 const matches=data.diaries.filter(x=>`${x.title} ${x.content} ${x.date}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt));
 function open(x:DiaryEntry|null){setEditing(x);setDate(x?.date??todayISO());setTitle(x?.title??'');setContent(x?.content??'');}
 function save(){if(!title.trim()&&!content.trim()){alert('标题或日记内容至少填写一个');return;}if(!date){alert('请选择日期');return;}
  const x:DiaryEntry={id:editing?.id??uid(),date,title:title.trim()||'随手记',content:content.trim(),updatedAt:new Date().toISOString()};
  setData(d=>({...d,diaries:editing?d.diaries.map(e=>e.id===x.id?x:e):[...d.diaries,x]}));setEditing(undefined);
 }
 return <main className="page"><Header title="日记" subtitle="记录每天的心情和重要小事" onBack={onBack}/><button className="btn primary wide" onClick={()=>open(null)}>＋ 写日记</button>
 <input className="search" aria-label="搜索日记" placeholder="搜索日期、标题、日记内容" value={query} onChange={e=>setQuery(e.target.value)}/>
 <p className="small muted">共 {data.diaries.length} 篇 · 找到 {matches.length} 篇</p>
 {!matches.length?<Empty icon="📔" title="还没有符合条件的日记" description="每天记录一点，回头看很有意思。"/>:<div className="stack">{matches.map(x=><article className="panel entry-card" key={x.id}><div className="entry-top"><h2>📖 {x.title}</h2><span className="muted small">{x.date}</span></div><p className="preserve">{x.content}</p><Actions><button className="text-btn" onClick={()=>open(x)}>编辑</button><button className="text-btn" onClick={()=>setDeleting(x)}>删除</button></Actions></article>)}</div>}
 {editing!==undefined&&<Modal title={editing?'修改日记':'写一篇日记'} onClose={()=>setEditing(undefined)}><Field label="日期"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="标题"><input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="今天发生了什么？"/></Field><Field label="日记内容"><textarea rows={9} maxLength={12000} value={content} onChange={e=>setContent(e.target.value)} placeholder="随便写点什么……"/></Field><Actions><button className="btn ghost" onClick={()=>setEditing(undefined)}>取消</button><button className="btn primary" onClick={save}>保存日记</button></Actions></Modal>}
 {deleting&&<ConfirmDelete title={`确定删除“${deleting.title}”吗？`} onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(d=>({...d,diaries:d.diaries.filter(x=>x.id!==deleting.id)}));setDeleting(null)}}/>}
 </main>;
}
