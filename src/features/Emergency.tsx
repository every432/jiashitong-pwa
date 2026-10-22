import {useState} from 'react';
import type { Dispatch,SetStateAction } from 'react';
import type {AppData,Emergency as Person} from '../model';
import {dial,normalizePhone,uid} from '../model';
import {Header,Modal,Field,Actions,Empty,ConfirmDelete} from '../ui';
export default function Emergency({data,setData,onBack}:{data:AppData;setData:Dispatch<SetStateAction<AppData>>;onBack:()=>void}){
  const [manage,setManage]=useState(false),[editor,setEditor]=useState<Person|null|undefined>(undefined),[del,setDel]=useState<Person|null>(null);
  const [name,setName]=useState(''),[relation,setRelation]=useState(''),[phone,setPhone]=useState('');
  function open(p:Person|null){setEditor(p);setName(p?.name??'');setRelation(p?.relation??'');setPhone(p?.phone??'');}
  function save(){const n=name.trim(),p=normalizePhone(phone);if(!n){alert('请填写姓名');return;}if(!/^(?:\+?\d{2,20})$/.test(p)){alert('电话号码需要 2～20 位数字');return;}const x={id:editor?.id??uid(),name:n,relation:relation.trim(),phone:p};setData(d=>({...d,emergencies:editor?d.emergencies.map(c=>c.id===x.id?x:c):[...d.emergencies,x]}));setEditor(undefined)}
  return <main className="page"><Header title="紧急联系人" subtitle="自己保存关键联系人，需要时快速找到" onBack={onBack}/><div className="toolbar two"><button className="btn primary" onClick={()=>open(null)}>＋ 添加紧急联系人</button><button className="btn secondary" onClick={()=>setManage(!manage)}>{manage?'完成管理':'管理编辑/删除'}</button></div><p className="hint">共 {data.emergencies.length} 位紧急联系人</p>
  {!data.emergencies.length?<Empty icon="🛡" title="还没有紧急联系人" description="可以登记家人、邻居或者其他可信赖的求助电话。"/>:
  <div className="stack">{data.emergencies.map(p=><article className="panel" key={p.id}><h2>{p.name}</h2><p className="muted">{[p.relation,p.phone].filter(Boolean).join(' · ')}</p><button className="btn green wide" onClick={()=>dial(p.phone)}>☎ 拨打电话</button>{manage&&<Actions><button className="btn ghost" onClick={()=>open(p)}>编辑</button><button className="btn ghost" onClick={()=>setDel(p)}>删除</button></Actions>}</article>)}</div>}
  {editor!==undefined&&<Modal title={editor?'编辑紧急联系人':'添加紧急联系人'} onClose={()=>setEditor(undefined)}><Field label="姓名或称呼"><input value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="关系或备注（选填）"><input value={relation} onChange={e=>setRelation(e.target.value)}/></Field><Field label="联系电话"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Actions><button className="btn ghost" onClick={()=>setEditor(undefined)}>取消</button><button className="btn primary" onClick={save}>保存</button></Actions></Modal>}
  {del&&<ConfirmDelete title={`删除 ${del.name} 的紧急联系电话？不会影响系统通讯录。`} onCancel={()=>setDel(null)} onConfirm={()=>{setData(d=>({...d,emergencies:d.emergencies.filter(p=>p.id!==del.id)}));setDel(null)}}/>}
  </main>
}
