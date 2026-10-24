import {useState} from 'react';
import {Actions,Field,Modal} from '../../ui';
import type {CollabRecord,Fields,Module} from '../../cloud/collabProtocol';
import {cents,expenseCategories,incomeCategories,money,modules} from '../../cloud/collabProtocol';
import type {Member} from '../../cloud/familyTypes';
import NotificationRecipients from './NotificationRecipients';
import type {NotificationConfig} from '../../cloud/notificationProtocol';
import {familyMessage} from '../../cloud/familyErrors';
export function RecordFields({fields,members}:{fields:Fields;members:Member[]}){
 const member=(uid:unknown)=>!uid?'未指定':members.find(m=>m.uid===uid)?.accountNickname||members.find(m=>m.uid===uid)?.displayName||'原家庭成员';
 return <div className="family-content">{Object.entries(fields).filter(([key])=>!['title','timezone'].includes(key)).map(([key,value])=>{
  const labels:Record<string,string>={body:'正文',note:'备注',assigneeUid:'负责人',deadlineDate:'截止日期',deadlineTime:'截止时间',completed:'完成状态',date:'日期（北京时间）',startTime:'开始时间',endTime:'结束时间',location:'地点',reminderMinutes:'提前提醒',quantity:'数量',unit:'单位',importance:'重要程度',pinned:'置顶',entryType:'类型',amountCents:'金额',category:'分类',payerUid:'付款/收款成员'};
  const display=key==='amountCents'?money(Number(value))+' 元':key==='assigneeUid'||key==='payerUid'?member(value):key==='reminderMinutes'?Number(value)<0?'不提醒':`提前 ${value} 分钟`:key==='entryType'?value==='income'?'收入':'支出':key==='importance'?value==='important'?'重要':'普通':typeof value==='boolean'?value?'是':'否':String(value)||'未填写';
  return <p key={key}><b>{labels[key]??key}：</b>{display}</p>;
 })}</div>;
}
export default function CollabEditor({module,draft,onDraft,baseline,members,busy,error,pending,conflict,onSave,onClose,onLatest,onAcceptLatest,onRefreshMembers,notification,onNotification,selfUid}:{module:Module;draft:Fields;onDraft:(fields:Fields)=>void;baseline?:CollabRecord;members:Member[];busy:boolean;error:string;pending:boolean;conflict:CollabRecord|null;onSave:(fields:Fields)=>void;onClose:()=>void;onLatest:()=>void;onAcceptLatest:()=>void;onRefreshMembers:()=>void;notification?:NotificationConfig;onNotification?:(value:NotificationConfig)=>void;selfUid?:string}){
 const [amount,setAmount]=useState(()=>Number(draft.amountCents)>0?money(Number(draft.amountCents)):'');const [localError,setLocalError]=useState('');
 const put=(key:string,value:string|number|boolean)=>onDraft({...draft,[key]:value});
 const input=(key:string,label:string,options:{type?:string;optional?:boolean;max?:number;min?:number|string;maxValue?:number|string}={})=><Field label={label}><input value={String(draft[key]??'')} type={options.type??'text'} step={options.type==='time'?60:undefined} required={!options.optional} maxLength={options.max} min={options.min} max={options.maxValue} disabled={busy} onChange={e=>put(key,options.type==='number'&&e.target.value!==''?Number(e.target.value):e.target.value)}/></Field>;
 const multiline=(key:string,label:string)=><Field label={label}><textarea value={String(draft[key]??'')} onChange={e=>put(key,e.target.value)} rows={8} disabled={busy}/></Field>;
 const memberSelect=(key:string,label:string)=><Field label={label}><select value={String(draft[key]??'')} disabled={busy} onChange={e=>put(key,e.target.value)}><option value="">未指定</option>{!!draft[key]&&!members.some(m=>m.uid===draft[key])&&<option value={String(draft[key])}>原成员已离开，请重新选择</option>}{members.map(m=><option value={m.uid} key={m.uid}>{m.accountNickname||m.displayName||'家庭成员'}{m.displayName?`（${m.displayName}）`:''}</option>)}</select></Field>;
 const check=(key:string,label:string)=><label className="family-check"><input type="checkbox" checked={draft[key]===true} disabled={busy} onChange={e=>put(key,e.target.checked)}/>{label}</label>;
 return <Modal title={`${baseline?'编辑':'新增'}${modules.find(m=>m.key===module)!.title}`} onClose={()=>{if(!busy&&confirm('关闭将放弃尚未保存的草稿。确认关闭？'))onClose();}}><form onSubmit={e=>{e.preventDefault();try{const final={...draft};if(module==='ledger')final.amountCents=cents(amount);setLocalError('');onSave(final);}catch(e){setLocalError(familyMessage(e));}}}>
 <p>保存到当前家庭云端，授权成员共同查看和编辑。</p>
 {module!=='ledger'&&input('title',module==='shopping'?'商品名称':'标题',{max:80})}
 {module==='todo'&&<>{multiline('body','待办内容')}{memberSelect('assigneeUid','负责人')}{input('deadlineDate','截止日期',{type:'date',optional:true,min:'2000-01-01',maxValue:'2199-12-31'})}{input('deadlineTime','截止时间',{type:'time',optional:true})}{check('completed','已完成')}</>}
 {module==='schedule'&&<>{input('date','日程日期',{type:'date',min:'2000-01-01',maxValue:'2199-12-31'})}{input('startTime','开始时间',{type:'time'})}{input('endTime','结束时间',{type:'time',optional:true})}{input('location','地点',{optional:true,max:200})}{multiline('note','日程备注')}{input('reminderMinutes','提前提醒分钟（-1为不提醒）',{type:'number',min:-1,maxValue:525600})}<p className="hint">统一北京时间。PWA不提供原生后台闹钟；保存提醒偏好后可导出日历由手机系统提醒。</p></>}
 {module==='memo'&&multiline('body','备忘录正文（最多6000字，保留换行）')}
 {module==='shopping'&&<>{input('quantity','数量（最多三位小数）')}{input('unit','单位',{optional:true,max:20})}{multiline('note','购物备注')}{check('completed','已采购')}</>}
 {module==='notice'&&<>{multiline('body','公告正文')}<Field label="公告重要程度"><select value={String(draft.importance)} disabled={busy} onChange={e=>put('importance',e.target.value)}><option value="normal">普通公告</option><option value="important">重要公告</option></select></Field>{check('pinned','置顶公告')}</>}
 {module==='ledger'&&<><Field label="收支类型"><select value={String(draft.entryType)} disabled={busy} onChange={e=>onDraft({...draft,entryType:e.target.value,category:'其他'})}><option value="expense">支出</option><option value="income">收入</option></select></Field><Field label="金额（元）"><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" required disabled={busy}/></Field>{input('date','账本日期',{type:'date',min:'2000-01-01',maxValue:'2199-12-31'})}<Field label="账本分类"><select value={String(draft.category)} disabled={busy} onChange={e=>put('category',e.target.value)}>{(draft.entryType==='income'?incomeCategories:expenseCategories).map(c=><option key={c}>{c}</option>)}</select></Field>{memberSelect('payerUid','付款或收款成员')}{multiline('note','账本备注')}<p className="hint">此账本与个人开支分类、金额范围分别校验，不读取本地开支或债务。</p></>}
 {notification&&onNotification&&<NotificationRecipients value={notification} members={members.filter(m=>m.uid!==selfUid)} disabled={busy} onChange={onNotification}/>}
 {(module==='todo'||module==='ledger')&&<button type="button" className="btn secondary" disabled={busy} onClick={onRefreshMembers}>刷新有效家庭成员</button>}
 {(localError||error)&&<p className="notice" role="alert">{localError||error}</p>}{pending&&<p className="notice">上次操作结果待核对，当前草稿保留；请关闭后使用“核对并重试同一次操作”。</p>}
 {baseline&&<button className="btn secondary wide" type="button" disabled={busy} onClick={onLatest}>读取最新版本并比较</button>}
 {conflict&&<section className="panel"><h3>云端最新内容</h3><strong>{String(conflict.fields.title??conflict.fields.category)}</strong><RecordFields fields={conflict.fields} members={members}/><p>上方表单仍是你的草稿。请比较后决定是否以最新版本继续编辑，不会自动覆盖。</p><button className="btn secondary" type="button" disabled={busy} onClick={onAcceptLatest}>保留我的草稿，以最新版本继续编辑</button></section>}
 <Actions><button className="btn primary" disabled={busy||pending||!!conflict}>保存到本家庭</button><button className="btn ghost" type="button" disabled={busy} onClick={()=>{if(confirm('确认放弃未保存草稿？'))onClose();}}>取消编辑</button></Actions>
 </form></Modal>;
}
