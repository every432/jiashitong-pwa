import type {AuthPort} from './types.ts';
import type {PendingStore} from './familyTypes.ts';
import {FamilyClient} from './familyClient.ts';
import {V32Client} from './v32Client.ts';
import {FamilyError,accessLost} from './familyErrors.ts';
// 转正已经完成后同步所有既有成员的类型，不改稳定成员ID或原业务UID。
// 每个家庭独立确认，不能把部分同步失败误报为邮箱绑定失败而再次注册。
export async function syncFormalMemberships(port:AuthPort,uid:string,store:PendingStore,signal:AbortSignal){
 const current=await port.profile();if(current.uid!==uid||current.anonymous)throw new FamilyError('IDENTITY','v32SyncIdentity');
 const core=new FamilyClient(port,()=>({uid,canWrite:true}),store),repo=new V32Client(core);
 if((await repo.capabilities(signal)).anonymous)throw new FamilyError('IDENTITY','v32SyncIdentity','邮箱绑定已提交，但Web与云函数身份类型不一致，已停止同步。请刷新核对原UID，不要重复绑定。');
 const families=await core.families(signal);let unfinished=0;
 for(const family of families){try{await repo.management(family.id,'v32SyncIdentity',{},signal);}catch(error){if(signal.aborted||accessLost(error))throw error;unfinished++;}}
 return unfinished;
}
