import {useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import type {FullAppData,Hotline} from '../model';
import {dial,normalizePhone,uid,validDial} from '../model';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,ScaleControl,Note} from '../ui';
export default function Hotlines({data,setData,onBack}:{data:FullAppData;setData:Dispatch<SetStateAction<FullAppData>>;onBack:()=>void}){
  const [search,setSearch]=useState(''),[manage,setManage]=useState(false),[editor,setEditor]=useState<Hotline|null|undefined>(undefined),[del,setDel]=useState<Hotline|null>(null);
  const [duty,setDuty]=useState(''),[phone,setPhone]=useState(''),[remark,setRemark]=useState('');
  function open(h:Hotline|null){setEditor(h);setDuty(h?.duty??'');setPhone(h?.phone??'');setRemark(h?.remark??'')}
  function save(){const number=normalizePhone(phone);if(!duty.trim()){alert('请填写职能名称');return;}if(!validDial(number)){alert('请输入有效电话号码');return;}
    const item={id:editor?.id??uid(),duty:duty.trim(),phone:number,remark:remark.trim()};setData(d=>({...d,hotlines:editor?d.hotlines.map(h=>h.id===item.id?item:h):[...d.hotlines,item]}));setEditor(undefined);
  }
  const filtered=data.hotlines.filter(h=>[h.duty,h.phone,h.remark].some(x=>x.toLowerCase().includes(search.trim().toLowerCase())));
  const cols=data.hotlineScale<90?3:data.hotlineScale<150?2:1;
  return <main className="page"><Header title="常用投诉举报热线" subtitle="查询部门职能与联系电话，点击打开拨号界面" onBack={onBack}/><div className="toolbar two"><button className="btn primary" onClick={()=>open(null)}>＋ 添加热线</button><button className="btn secondary" onClick={()=>setManage(!manage)}>{manage?'完成管理':'管理编辑'}</button></div><ScaleControl value={data.hotlineScale} onChange={n=>setData(d=>({...d,hotlineScale:n}))}/><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索职能、电话号码或备注" aria-label="搜索热线"/><Note>已保存 {data.hotlines.length} 条 · 显示 {filtered.length} 条。内置清单来自安卓版源码；各地受理方式可能调整。</Note>
  {!filtered.length?<Empty icon="☎" title="没有找到热线" description="换个关键词试试。"/>:<div className="contact-grid" style={{gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`}}>{filtered.map(h=><article className="contact-card" key={h.id} style={{padding:`${Math.max(7,Math.min(20,18*data.hotlineScale/180))}px`}}><h2 style={{fontSize:`${Math.max(13,27*data.hotlineScale/180)}px`}}>{h.duty}</h2><p className="short-num" style={{fontSize:`${Math.max(12,18*data.hotlineScale/180)}px`}}>电话：{h.phone}</p>{h.remark&&<p className="muted" style={{fontSize:`${Math.max(11,16*data.hotlineScale/180)}px`}}>{h.remark}</p>}<button className="btn green wide" onClick={()=>dial(h.phone)}>☎ 拨打热线</button>{manage&&<Actions><button className="text-btn" onClick={()=>open(h)}>编辑</button><button className="text-btn" onClick={()=>setDel(h)}>删除</button></Actions>}</article>)}</div>}
  {editor!==undefined&&<Modal title={editor?'编辑投诉举报热线':'添加投诉举报热线'} onClose={()=>setEditor(undefined)}><Field label="职能名称"><input value={duty} onChange={e=>setDuty(e.target.value)}/></Field><Field label="电话号码"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Field label="备注（选填）"><textarea value={remark} onChange={e=>setRemark(e.target.value)}/></Field><Actions><button className="btn ghost" onClick={()=>setEditor(undefined)}>取消</button><button className="btn primary" onClick={save}>保存</button></Actions></Modal>}
  {del&&<ConfirmDelete title={`删除“${del.duty}”？删除后不会自动恢复。`} onCancel={()=>setDel(null)} onConfirm={()=>{setData(d=>({...d,hotlines:d.hotlines.filter(h=>h.id!==del.id)}));setDel(null)}}/>}
  </main>;
}
