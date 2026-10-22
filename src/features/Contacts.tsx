import { useRef, useState } from 'react';
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react';
import type { AppData, Contact } from '../model';
import { dial, normalizePhone, uid } from '../model';
import { Actions, ConfirmDelete, Empty, Field, Header, Modal, ScaleControl } from '../ui';

type Props={data:AppData;setData:Dispatch<SetStateAction<AppData>>;onBack:()=>void};
export default function Contacts({data,setData,onBack}:Props) {
  const [search,setSearch]=useState('');const [manage,setManage]=useState(false);
  const [editor,setEditor]=useState<Contact|null|undefined>(undefined);
  const [deleting,setDeleting]=useState<Contact|null>(null);
  const [name,setName]=useState('');const [short,setShort]=useState('');const [long,setLong]=useState('');
  const dragId=useRef<string|null>(null);
  function openEditor(c: Contact|null){setEditor(c);setName(c?.name??'');setShort(c?.phone??'');setLong(c?.longPhone??'');}
  function save(){const n=name.trim(),s=short.trim(),l=normalizePhone(long).replace(/^\+86/,'');
    if(!n){alert('请填写家人姓名');return;}
    if(!/^\d{2,6}$/.test(s)){alert('亲情网短号应为 2～6 位数字');return;}
    if(l && !/^1[3-9]\d{9}$/.test(l)){alert('长号应为 11 位手机号，或留空');return;}
    if(data.contacts.some(c=>c.phone===s && c.id!==editor?.id)){alert('该短号已经登记');return;}
    const record={id:editor?.id??uid(),name:n,phone:s,longPhone:l};
    setData(d=>({...d,contacts:editor?d.contacts.map(c=>c.id===record.id?record:c):[...d.contacts,record]}));setEditor(undefined);
  }
  function reorder(source:string,target:string){if(source===target)return;setData(d=>{const next=[...d.contacts];const i=next.findIndex(c=>c.id===source);const j=next.findIndex(c=>c.id===target);if(i<0||j<0||i===j)return d;const [moved]=next.splice(i,1);next.splice(j,0,moved);return {...d,contacts:next};});}
  function shift(id:string,offset:number){const i=data.contacts.findIndex(c=>c.id===id);const target=data.contacts[i+offset];if(target)reorder(id,target.id);}
  function dragMove(e:ReactPointerEvent<HTMLButtonElement>){if(!dragId.current)return;const node=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-contact-id]');const target=node?.getAttribute('data-contact-id');if(target)reorder(dragId.current,target);}
  const matches=data.contacts.filter(c=>[c.name,c.phone,c.longPhone].some(s=>s.toLowerCase().includes(search.trim().toLowerCase())));
  const cols=data.contactScale<90?3:data.contactScale<150?2:1;
  const factor=data.contactScale/180;
  return <main className="page"><Header title="亲情网快捷拨号" subtitle="短号快捷拨号 · 长号仅供查看" onBack={onBack}/>
    <div className="toolbar two"><button className="btn primary" onClick={()=>openEditor(null)}>＋ 添加家人</button><button className="btn secondary" onClick={()=>setManage(!manage)}>{manage?'完成管理':'管理编辑'}</button></div>
    <ScaleControl value={data.contactScale} onChange={n=>setData(d=>({...d,contactScale:n}))}/>
    <input aria-label="搜索家人" className="search" placeholder="搜索家人姓名、短号或长号" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="caption-row"><span>已保存 {data.contacts.length} 位 · 显示 {matches.length} 位</span><span>{manage?'拖动 ↕ 或点击上下箭头排序':'点击绿色按钮打开系统拨号界面'}</span></div>
    {!data.contacts.length?<Empty icon="☎" title="还没有家人号码" description="点击添加家人，录入亲情网短号即可开始使用。"/>:
    !matches.length?<Empty icon="🔎" title="没有找到家人" description="试试输入姓名或号码的一部分。"/>:
    <div className="contact-grid" style={{gridTemplateColumns:`repeat(${cols}, minmax(0,1fr))`}}>
      {matches.map(c=><article className="contact-card" data-contact-id={c.id} key={c.id} style={{padding:`${Math.max(7,Math.min(22,18*factor))}px`}}>
        <div className="person-name" style={{fontSize:`${Math.max(14,27*factor)}px`}}>{c.name}</div>
        <div className="short-num" style={{fontSize:`${Math.max(12,18*factor)}px`}}>{data.contactScale>=150?'亲情网短号':'短号'}：{c.phone}</div>
        {c.longPhone&&<div className="long-num" style={{fontSize:`${Math.max(11,16*factor)}px`}}>长号：{c.longPhone}</div>}
        <button className="btn green wide" onClick={()=>dial(c.phone)}>{data.contactScale>=150?'☎ 拨打短号':'☎ 拨打'}</button>
        {manage&&<div className="management"><button className="text-btn" onClick={()=>openEditor(c)}>编辑</button><button className="text-btn" onClick={()=>setDeleting(c)}>删除</button><div className="reorder"><button title="上移" onClick={()=>shift(c.id,-1)}>↑</button><button title="下移" onClick={()=>shift(c.id,1)}>↓</button><button title="按住并拖动排序" className="drag-handle" style={{touchAction:'none'}} onPointerDown={e=>{dragId.current=c.id;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={dragMove} onPointerUp={e=>{dragId.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{dragId.current=null}}>↕</button></div></div>}
      </article>)}
    </div>}
    {editor!==undefined&&<Modal title={editor?'编辑家人':'添加家人'} onClose={()=>setEditor(undefined)}><Field label="家人姓名"><input value={name} maxLength={40} onChange={e=>setName(e.target.value)}/></Field><Field label="亲情网短号（必填，2～6 位数字）"><input type="tel" value={short} onChange={e=>setShort(e.target.value)}/></Field><Field label="长号（选填，仅显示）"><input type="tel" value={long} onChange={e=>setLong(e.target.value)}/></Field><Actions><button className="btn ghost" onClick={()=>setEditor(undefined)}>取消</button><button className="btn primary" onClick={save}>保存</button></Actions></Modal>}
    {deleting&&<ConfirmDelete title={`确定删除 ${deleting.name} 的亲情网记录吗？`} onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(d=>({...d,contacts:d.contacts.filter(c=>c.id!==deleting.id)}));setDeleting(null)}}/>}
  </main>;
}
