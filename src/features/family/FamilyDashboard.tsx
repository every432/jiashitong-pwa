import {useEffect,useState} from 'react';
import type {FamilyClient} from '../../cloud/familyClient';
import type {Home} from '../../cloud/familyTypes';
import {modules} from '../../cloud/collabProtocol';
import type {Module} from '../../cloud/collabProtocol';
import {familyMessage} from '../../cloud/familyErrors';
import SharedCards from './SharedCards';
import CollabScreen from './CollabScreen';
import FamilyMessagesV32 from './FamilyMessagesV32';
import {useNoticesV32} from './useNoticesV32';
import {badge} from '../../cloud/authPolicyV32';
import {roleLabel} from '../../cloud/v32Client';
export default function FamilyDashboard({clientPromise,home,uid,onDenied,onNavigate}:{clientPromise:Promise<FamilyClient>;home:Home;uid:string;onDenied:(message:string)=>void;onNavigate:()=>void}){
 const notices=useNoticesV32(),counts=notices.uid===uid?notices.byFamily[home.family.id]:undefined;
 const[target,setTarget]=useState<string|undefined>(undefined);
 const [client,setClient]=useState<FamilyClient|null>(null),[error,setError]=useState(''),[route,setRoute]=useState<'home'|'cards'|'activity'|Module>('home');
 useEffect(()=>{let active=true;void clientPromise.then(c=>{if(active)setClient(c);},e=>{if(active)setError(familyMessage(e));});return()=>{active=false;};},[clientPromise]);
 function navigate(next:typeof route){setTarget(undefined);onNavigate();setRoute(next);window.scrollTo(0,0);}
 if(error)return <p className="notice" role="alert">{error}</p>;if(!client)return <p role="status">正在加载家庭接口…</p>;
 if(route==='cards')return <SharedCards client={client} family={home.family.id} onBack={()=>navigate('home')} onDenied={onDenied}/>;
 if(route==='activity')return <FamilyMessagesV32 client={client} family={home.family.id} onBack={()=>navigate('home')} onDenied={onDenied} onOpen={(module,record)=>{setTarget(record);setRoute(module);}}/>;
 if(route!=='home')return <CollabScreen key={route+(target??'')} targetRecordId={target} client={client} family={home.family.id} module={route} uid={home.family.myMemberUid??uid} onBack={()=>navigate('home')} onDenied={onDenied}/>;
 return <section><p>{roleLabel(home.family.effectiveRole??home.family.role)} · {home.members.length}位成员 · 同一家庭云端记录</p>{notices.uid===uid&&notices.deliveryPending&&<p className="notice">新消息仍在投递，未读数可能继续变化，请稍后刷新。</p>}<div className="family-grid"><button className="family-tile family-blue" onClick={()=>navigate('cards')}><strong>☎ 共享家人卡</strong><span>短号 · 长号 · 家人资料</span></button>{modules.map(m=><button key={m.key} className={`family-tile family-${m.color}`} onClick={()=>navigate(m.key)}><strong>{m.icon} {m.title}{!!counts?.modules[m.key]&&<span className="unread-badge">{badge(counts.modules[m.key])}</span>}</strong><span>本家庭共同查看与编辑</span></button>)}<button className="family-tile family-purple" onClick={()=>navigate('activity')}><strong>◷ 家庭消息中心{!!counts?.total&&<span className="unread-badge">{badge(counts.total)}</span>}</strong><span>六大模块 · 云端已读状态</span></button></div><p className="hint">进入、手动刷新和回到前台时读取云端。没有后台实时推送或离线自动提交。</p></section>;
}
