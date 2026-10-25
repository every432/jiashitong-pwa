import type {AuthPort} from './types.ts';
import type {PendingStore} from './familyTypes.ts';
import {functionPayload,assertSameUid,parseFamilies} from './familyApi.ts';
import {parseHome,digest,obj} from './familyProtocol.ts';
import {FamilyError,familyError} from './familyErrors.ts';
import {CLOUD_ENV} from './config.ts';
import {holdUpdate} from '../pwa/updateSafety.ts';
/** 保存不含邀请码/昵称的指纹与原家庭列表。未知结果只读核对，不自动核销第二次。 */
export async function consumeInviteSafely(api:AuthPort,store:PendingStore,uid:string,code:string,displayName:string,signal:AbortSignal){
 const key=`${CLOUD_ENV}|${uid}|all|invite-join-v321`,release=holdUpdate('邀请码加入结果正在核对');
 try{return await store.lock(key,async()=>{
  const check=async()=>{const p=await api.profile();if(signal.aborted)throw new DOMException('取消','AbortError');assertSameUid(uid,p.uid);};
  await check();const fingerprint=await digest({code,displayName});let pending=await store.read(key);
  const list=async()=>{try{const value=parseFamilies(functionPayload(await api.callRead('listMyFamilies',signal),'LIST_MY_FAMILIES'));await check();return value;}catch(e){throw familyError(e,'LIST_MY_FAMILIES');}};
  const verify=async(family:string)=>{try{const f=functionPayload(await api.callFamily('getFamily',{familyId:family},uid,signal),'JOIN_VERIFY'),m=functionPayload(await api.callFamily('listMembers',{familyId:family},uid,signal),'JOIN_VERIFY');await check();parseHome(f,m,uid,family);await store.ack(key);return family;}catch(e){throw familyError(e,'JOIN_VERIFY');}};
  if(pending){
   const families=await list();
   if(typeof pending.family==='string'&&families.some(f=>f.id===pending!.family))return verify(pending.family);
   if(pending.fingerprint===fingerprint&&Array.isArray(pending.before)){
    const added=families.filter(f=>!(pending!.before as unknown[]).includes(f.id));
    // 列表变化无法证明是此邀请码导致，不能推测目标家庭并清除待核对状态。
    if(added.length)throw new FamilyError('UNCONFIRMED','JOIN_VERIFY','家庭列表已变化，请刷新账号进入已有家庭核对。上次邀请码可能已成功，不会重复核销。');
   }
   throw new FamilyError('UNCONFIRMED','JOIN_VERIFY','上次邀请码结果未确认。请刷新账号核对家庭列表，或请管理员核对使用状态；不会自动再次核销。');
  }
  const before=await list();pending={fingerprint,before:before.map(f=>f.id)};await store.write(key,pending);try{await check();}catch(e){await store.ack(key);throw e;}
  let result:Record<string,unknown>;
  try{result=functionPayload(await api.callFamily('v32ConsumeInvite',{inviteCode:code,displayName,type:code[0]==='R'?'recovery':'join'},uid,signal),'CONSUME_INVITE');}
  catch(error){const safe=familyError(error,'v32ConsumeInvite');if(safe.definite)await store.ack(key);else throw new FamilyError('UNCONFIRMED','CONSUME_INVITE','邀请码提交结果未确认，可能已加入。请刷新账号核对家庭列表，不要换身份或重复核销。');throw safe;}
  if(!obj(result.family)||typeof result.family.familyId!=='string')throw new FamilyError('UNCONFIRMED','JOIN_VERIFY');
  const family=result.family.familyId;await store.write(key,{...pending,family});return verify(family);
 });}finally{release();}
}
