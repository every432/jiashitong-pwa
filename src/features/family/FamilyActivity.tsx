import {useEffect,useMemo,useState} from 'react';
import type {FamilyClient} from '../../cloud/familyClient';
import {ActivityClient} from '../../cloud/activityClient';
import type {ActivityPage} from '../../cloud/activityClient';
import {modules,shanghaiTime} from '../../cloud/collabProtocol';
import {useFamilyTask,useForegroundRefresh} from './useFamilyTask';
export default function FamilyActivity({client,family,onBack,onDenied}:{client:FamilyClient;family:string;onBack:()=>void;onDenied:(message:string)=>void}){
 const repo=useMemo(()=>new ActivityClient(client),[client]),{busy,error,run}=useFamilyTask(onDenied),[page,setPage]=useState<ActivityPage|null>(null),[fresh,setFresh]=useState(false);
 async function load(signal:AbortSignal,more=false){setFresh(false);await client.home(family,signal);const result=await repo.page(family,signal,more?page??undefined:undefined);if(!signal.aborted){setPage(result);setFresh(true);}}
 useEffect(()=>{void run(signal=>load(signal));},[family,repo,run]); // eslint-disable-line react-hooks/exhaustive-deps
 useForegroundRefresh(()=>void run(signal=>load(signal)),!busy);
 const labels={create:'新增了记录',update:'修改了记录',delete:'删除了记录',complete:'标记为已完成',reopen:'恢复为未完成'};
 return <section><div className="family-heading"><button className="text-btn" disabled={busy} onClick={onBack}>← 家庭首页</button><h2>家庭动态</h2></div><p>仅展示六大协作模块真实返回的操作者、时间、模块与操作。没有共享家人卡或家庭设置的全部历史；不展示正文、标题或金额。</p><button className="btn secondary wide" disabled={busy} onClick={()=>void run(signal=>load(signal))}>刷新家庭动态</button>{busy&&<p role="status">正在读取家庭动态…</p>}{error&&<p className="notice" role="alert">{error}</p>}{!fresh&&page&&<p className="family-status">显示上次读取的动态，尚未核对为最新结果。</p>}<div className="family-records">{page?.rows.map(row=><article className="family-record family-purple" key={row.id}><strong>{row.actorNickname}</strong><p>{modules.find(m=>m.key===row.module)!.title} · {labels[row.operation]}</p><small>{shanghaiTime(row.at)}（北京时间）</small></article>)}</div>{page&&!page.rows.length&&<p className="panel">暂无家庭协作动态。</p>}{page?.cursor&&<button className="btn secondary wide" disabled={busy||!fresh} onClick={()=>void run(signal=>load(signal,true))}>加载更多动态</button>}<p className="hint">每页最多30条。此列表没有历史快照版本；新动态请刷新查看，不提供后台实时推送。</p></section>;
}
