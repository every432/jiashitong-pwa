import {useEffect,useMemo,useState} from 'react';
import type {FamilyClient} from '../../cloud/familyClient';
import {MessageClientV32} from '../../cloud/messagesV32';
import type {FamilyMessage,MessagePage} from '../../cloud/messagesV32';
import {modules,shanghaiTime} from '../../cloud/collabProtocol';
import type {Module} from '../../cloud/collabProtocol';
import {useFamilyTask,useForegroundRefresh} from './useFamilyTask';
import {noticeStore} from './useNoticesV32';
import {Actions} from '../../ui';
export default function FamilyMessagesV32({client,family,onBack,onOpen,onDenied}:{client:FamilyClient;family:string;onBack:()=>void;onOpen:(module:Module,record:string)=>void;onDenied:(message:string)=>void}){
 const repo=useMemo(()=>new MessageClientV32(client),[client]),{busy,error,run}=useFamilyTask(onDenied),[page,setPage]=useState<MessagePage|null>(null),[notice,setNotice]=useState(''),[fresh,setFresh]=useState(false);
 async function load(signal:AbortSignal,more=false){setFresh(false);const result=await repo.page(family,signal,more?page??undefined:undefined);if(!signal.aborted){setPage(result);setFresh(true);}void noticeStore.refresh();}
 useEffect(()=>{void run(signal=>load(signal));},[family,repo,run]); // eslint-disable-line react-hooks/exhaustive-deps
 useForegroundRefresh(()=>void run(signal=>load(signal)),!busy);
 function read(row:FamilyMessage,open=false){void run(async signal=>{await repo.readOne(family,row.id,signal);if(signal.aborted)return;void noticeStore.refresh();if(open&&!row.deleted&&row.recordId){onOpen(row.module,row.recordId);return;}await load(signal);if(row.deleted||!row.recordId)setNotice('原事项已删除或无法定位，消息历史和已读状态保留。');});}
 return <section><div className="family-heading"><button className="text-btn" onClick={onBack} disabled={busy}>← 家庭首页</button><h2>家庭消息中心</h2></div><p>已读状态保存在云端，只影响本人。前台约60秒刷新；关闭网页、锁屏或后台挂起时不保证通知。</p>{error&&<p className="notice" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">正在读取或确认消息…</p>}{!fresh&&page&&<p className="notice">当前为上次结果，尚未核对最新消息。</p>}
 <Actions><button className="btn secondary" disabled={busy} onClick={()=>void run(signal=>load(signal))}>刷新消息</button><button className="btn secondary" disabled={busy||!fresh||!page?.rows.length} onClick={()=>{if(confirm('确认将本次服务端水位之前的全部消息标为已读？包括尚未加载的历史消息，不影响其他成员。'))void run(async signal=>{await repo.readAll(family,page!.rows[0].id,signal);await load(signal);setNotice('服务端已确认全部已读，历史消息保留。');});}}>全部已读</button></Actions>
 <div className="family-records">{page?.rows.map(row=><article className={`family-record ${row.unread?'family-purple':'family-blue'}`} key={row.id}><button className="family-record-open" disabled={busy||!fresh} onClick={()=>read(row,true)}><strong>{row.unread?'● 未读 · ':''}{row.title||'家庭事项'}</strong><span>{row.actor} · {modules.find(m=>m.key===row.module)?.title} · {{create:'新增',update:'修改',delete:'删除',complete:'完成',reopen:'取消完成'}[row.operation]}</span><small>{shanghaiTime(row.at)}（北京时间）</small>{row.deleted&&<span>原事项已删除</span>}</button>{row.unread&&<button className="btn secondary" disabled={busy||!fresh} onClick={()=>read(row)}>标为已读</button>}</article>)}</div>{page&&!page.rows.length&&<p className="panel">暂无家庭消息。</p>}{page?.cursor&&<button className="btn secondary wide" disabled={busy} onClick={()=>void run(signal=>load(signal,true))}>加载更多消息</button>}</section>;
}
