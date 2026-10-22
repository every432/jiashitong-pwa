import {useState} from 'react';
import type {CourtesyGroup,CourtesyDetail} from '../model';
import {todayISO,uid} from '../model';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,PaymentSelect} from '../ui';
import type {Props} from '../featureTypes';
const money=(n:number)=>`¥${n.toFixed(2)}`;
export default function Courtesy({data,setData,onBack}:Props){
 const [query,setQuery]=useState(''),[manage,setManage]=useState(false),[groupEdit,setGroupEdit]=useState<CourtesyGroup|null|undefined>(),[groupTitle,setGroupTitle]=useState(''),[groupNote,setGroupNote]=useState('');
 const [groupDelete,setGroupDelete]=useState<CourtesyGroup|null>(null),[expanded,setExpanded]=useState<string|null>(null);
 const [detailEdit,setDetailEdit]=useState<{groupId:string;item:CourtesyDetail|null}|null>(null);
 const [date,setDate]=useState(todayISO()),[direction,setDirection]=useState<'收到'|'送出'>('收到'),[item,setItem]=useState(''),[amount,setAmount]=useState(''),[method,setMethod]=useState<CourtesyDetail['method']>('微信'),[note,setNote]=useState('');
 function openGroup(g:CourtesyGroup|null){setGroupEdit(g);setGroupTitle(g?.title??'');setGroupNote(g?.note??'');}
 function saveGroup(){if(!groupTitle.trim()){alert('请填写往来标题，如「奶奶」「大学同学」');return;}
  const g:CourtesyGroup={id:groupEdit?.id??uid(),title:groupTitle.trim(),note:groupNote.trim(),details:groupEdit?.details??[]};
  setData(d=>({...d,courtesy:groupEdit?d.courtesy.map(x=>x.id===g.id?g:x):[...d.courtesy,g]}));setGroupEdit(undefined);setExpanded(g.id);
 }
 function openDetail(groupId:string,x:CourtesyDetail|null){setDetailEdit({groupId,item:x});setDate(x?.date??todayISO());setDirection(x?.direction??'收到');setItem(x?.item??'');setAmount(x?String(x.amount):'');setMethod(x?.method??'微信');setNote(x?.note??'');}
 function saveDetail(){const n=Number(amount);if(!date||!item.trim()||!Number.isFinite(n)||n<0||n>1e12){alert('请填写日期、往来内容与有效金额（可为0）');return;}
  const x:CourtesyDetail={id:detailEdit?.item?.id??uid(),date,direction,item:item.trim(),amount:n,method,note:note.trim()};const groupId=detailEdit!.groupId;
  setData(d=>({...d,courtesy:d.courtesy.map(g=>g.id===groupId?{...g,details:detailEdit?.item?g.details.map(z=>z.id===x.id?x:z):[...g.details,x]}:g)}));setDetailEdit(null);setExpanded(groupId);
 }
 function removeDetail(groupId:string,id:string){if(!confirm('确定删除这条往来明细？'))return;setData(d=>({...d,courtesy:d.courtesy.map(g=>g.id===groupId?{...g,details:g.details.filter(z=>z.id!==id)}:g)}));}
 const matches=data.courtesy.filter(g=>`${g.title} ${g.note} ${g.details.map(x=>`${x.date} ${x.direction} ${x.item} ${x.method} ${x.note}`).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 const all=data.courtesy.flatMap(g=>g.details);const received=all.filter(x=>x.direction==='收到').reduce((n,x)=>n+x.amount,0);const sent=all.filter(x=>x.direction==='送出').reduce((n,x)=>n+x.amount,0);
 return <main className="page"><Header title="人情往来" subtitle="按人名或事件分组 · 每组多笔明细" onBack={onBack}/><div className="toolbar two"><button className="btn primary" onClick={()=>openGroup(null)}>＋ 新建往来标题</button><button className="btn secondary" onClick={()=>setManage(!manage)}>{manage?'完成管理':'管理编辑'}</button></div>
 <div className="metrics"><div className="metric"><b>{money(received)}</b><span>累计收到</span></div><div className="metric"><b>{money(sent)}</b><span>累计送出</span></div></div>
 <input className="search" placeholder="搜索标题、姓名、大学、奶奶或明细备注" value={query} onChange={e=>setQuery(e.target.value)} aria-label="搜索人情往来"/>
 {!matches.length?<Empty icon="🎁" title="还没有往来记录" description="建立标题后，可在同一个标题下面添加任意多笔记录。"/>:<div className="stack">{matches.map(g=>{const opened=expanded===g.id||!!query;return <article key={g.id} className="panel entry-card"><button className="entry-toggle" onClick={()=>setExpanded(opened?null:g.id)}><span><strong>🎁 {g.title}</strong><small>{g.details.length} 条明细 · {g.note||'点击查看往来记录'}</small></span><span>{opened?'收起 ▲':'展开 ▼'}</span></button>
 {opened&&<><div className="line"/><button className="btn secondary wide" onClick={()=>openDetail(g.id,null)}>＋ 添加一笔收到 / 送出</button>
 {g.details.length===0?<p className="muted small">暂无明细</p>:<div className="stack small-gap">{[...g.details].sort((a,b)=>b.date.localeCompare(a.date)).map(x=><section className="detail-row" key={x.id}><div><b>{x.direction==='收到'?'⬇ 收到':'⬆ 送出'} · {x.item}</b><div className="small muted">{x.date} · {x.method}{x.note?` · ${x.note}`:''}</div></div><div className="detail-side"><strong>{money(x.amount)}</strong>{manage&&<div className="management"><button className="text-btn" onClick={()=>openDetail(g.id,x)}>编辑</button><button className="text-btn" onClick={()=>removeDetail(g.id,x.id)}>删除</button></div>}</div></section>)}</div>}</>}
 {manage&&<Actions><button className="text-btn" onClick={()=>openGroup(g)}>编辑标题</button><button className="text-btn" onClick={()=>setGroupDelete(g)}>删除整组</button></Actions>}</article>})}</div>}
 {groupEdit!==undefined&&<Modal title={groupEdit?'编辑往来标题':'新建往来标题'} onClose={()=>setGroupEdit(undefined)}><Field label="往来标题（如奶奶、大学同学、同事小王）"><input value={groupTitle} maxLength={100} onChange={e=>setGroupTitle(e.target.value)}/></Field><Field label="整组备注"><textarea rows={3} value={groupNote} onChange={e=>setGroupNote(e.target.value)}/></Field><Actions><button className="btn ghost" onClick={()=>setGroupEdit(undefined)}>取消</button><button className="btn primary" onClick={saveGroup}>保存</button></Actions></Modal>}
 {detailEdit&&<Modal title={detailEdit.item?'修改往来明细':'添加往来明细'} onClose={()=>setDetailEdit(null)}><Field label="日期"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="方向"><select value={direction} onChange={e=>setDirection(e.target.value as typeof direction)}><option>收到</option><option>送出</option></select></Field><Field label="往来内容（如生日红包、礼品）"><input value={item} maxLength={100} onChange={e=>setItem(e.target.value)}/></Field><Field label="金额（元，实物可填0）"><input type="number" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><Field label="往来方式"><PaymentSelect value={method} onChange={setMethod}/></Field><Field label="备注"><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}/></Field><Actions><button className="btn ghost" onClick={()=>setDetailEdit(null)}>取消</button><button className="btn primary" onClick={saveDetail}>保存</button></Actions></Modal>}
 {groupDelete&&<ConfirmDelete title={`确认删除“${groupDelete.title}”及其全部 ${groupDelete.details.length} 笔明细？`} onCancel={()=>setGroupDelete(null)} onConfirm={()=>{setData(d=>({...d,courtesy:d.courtesy.filter(g=>g.id!==groupDelete.id)}));setGroupDelete(null)}}/>}
 </main>;
}
