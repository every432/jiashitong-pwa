import {useEffect,useState} from 'react';
import type {FamilySummary,AuthPort} from '../../cloud/types';
import {browserPendingStore} from '../../cloud/pending';
import {CLOUD_ENV} from '../../cloud/config';
import {functionPayload,assertSameUid} from '../../cloud/familyApi';
import {parseHome} from '../../cloud/familyProtocol';
import {familyMessage} from '../../cloud/familyErrors';
/** 用户核对未知结果后，只清除该次本机标记，不再次核销邀请或改变成员关系。 */
export default function InviteResultReviewV321({uid,families,port}:{uid:string;families:FamilySummary[];port:()=>Promise<AuthPort>}){
 const [store]=useState(browserPendingStore),[pending,setPending]=useState(false),[family,setFamily]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=`${CLOUD_ENV}|${uid}|all|invite-join-v321`;
 useEffect(()=>{let active=true;void store.read(key).then(p=>{if(active)setPending(!!p);},()=>{if(active)setError('邀请待核对状态暂不能读取，请保留浏览器资料。');});return()=>{active=false;};},[key,store]);
 async function verify(){if(busy||!family||!confirmed)return;setBusy(true);setError('');
  try{await store.lock(key,async()=>{const saved=await store.read(key);if(!saved)return;const api=await port(),profile=await api.profile();assertSameUid(uid,profile.uid);if(saved.family&&saved.family!==family)throw Error('请核对原邀请对应的家庭');
   const signal=new AbortController().signal,f=functionPayload(await api.callFamily('getFamily',{familyId:family},uid,signal),'JOIN_VERIFY'),m=functionPayload(await api.callFamily('listMembers',{familyId:family},uid,signal),'JOIN_VERIFY');parseHome(f,m,uid,family);assertSameUid(uid,(await api.profile()).uid);await store.ack(key);
  });setPending(false);}catch(e){setError(familyMessage(e));}finally{setBusy(false);}
 }
 if(!pending)return error?<p role="alert" className="notice">{error}</p>:null;
 return <section className="panel"><h3>上次邀请码结果待核对</h3><p>请先与家主或管理员核对目标家庭及成员身份。此处只验证已有成员关系并结束本机待核对状态，不会再次使用邀请码。</p><label>核对后的目标家庭<select value={family} onChange={e=>{setFamily(e.target.value);setConfirmed(false);}} disabled={busy}><option value="">请选择</option>{families.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>我已向管理员核实，这是上次邀请对应的家庭，且当前身份正确</label><button className="btn secondary wide" disabled={busy||!family||!confirmed} onClick={()=>void verify()}>验证成员关系并结束待核对</button>{error&&<p className="notice" role="alert">{error}</p>}</section>;
}
