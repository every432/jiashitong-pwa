import type {AuthPort} from './types.ts';
import {functionPayload,assertSameUid} from './familyApi.ts';
import {FamilyClient} from './familyClient.ts';
import {MessageClientV32} from './messagesV32.ts';
import type {UnreadTotals} from './messagesV32.ts';
import {browserPendingStore} from './pending.ts';
import {accountIssue,isAborted} from './errors.ts';
type State=UnreadTotals&{uid:string;loaded:boolean;error:string};
const empty=():State=>({uid:'',loaded:false,total:0,byFamily:{},deliveryPending:false,error:''});
export function createNoticeStore(factory:()=>Promise<AuthPort>,canRead:()=>boolean=()=>true){
 let state=empty(),active=false,scope=new AbortController(),unwatch:(()=>void)|undefined,serial=0,observedUid='';
 const listeners=new Set<()=>void>();
 const publish=(next:State)=>{if(active){state=next;listeners.forEach(fn=>fn());}};
 const clear=()=>{scope.abort();serial++;publish(empty());};
 async function refresh(){
  if(!active||!canRead())return;scope.abort();const own=new AbortController();scope=own;const generation=++serial;
  try{const port=await factory(),profile=await port.restore();if(!active||own.signal.aborted||generation!==serial)return;if(!profile){publish(empty());return;}
   observedUid=profile.uid;if(state.uid!==profile.uid)publish({...empty(),uid:profile.uid});
   const who=functionPayload(await port.callRead('whoAmI',own.signal),'WHO_AM_I');assertSameUid(profile.uid,String(who.uid??''));
   const core=new FamilyClient(port,()=>({uid:active&&generation===serial&&!own.signal.aborted?profile.uid:'',canWrite:false}),browserPendingStore());
   const result=await new MessageClientV32(core).unread(own.signal);if(!active||own.signal.aborted||generation!==serial)return;
   publish({...result,uid:profile.uid,loaded:true,error:''});
  }catch(error){if(!active||own.signal.aborted||isAborted(error)||generation!==serial)return;const issue=accountIssue(error,'FAMILY_REQUEST');publish({...empty(),error:issue.kind==='auth'||issue.kind==='identity'?'账号待重新核对，未读数已隐藏。':'消息暂未同步，请进入家庭共享刷新。'});}
 }
 async function start(){active=true;const generation=++serial;try{const port=await factory();if(!active||generation!==serial)return;unwatch?.();unwatch=port.subscribe(change=>{
  // SDK getUser/资料刷新会重复发布同UID事件，不能因此形成读取/事件/读取循环。
  if(change.event==='SIGNED_OUT'){if(!observedUid&&!state.uid)return;observedUid='';}
  else if(change.uid&&change.uid!==observedUid)observedUid=change.uid;
  else return;
  clear();queueMicrotask(()=>void refresh());
 });await refresh();}catch{if(active)publish({...empty(),error:'账号消息服务暂不可用。'});}}
 return{start,refresh,clear,getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},stop(){active=false;scope.abort();serial++;unwatch?.();unwatch=undefined;observedUid='';state=empty();}};
}
