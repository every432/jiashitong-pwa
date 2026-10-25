import type {AuthPort,FamilySummary} from './types.ts';
import type {Family,FamilyAction,FamilyGate,Home,Json,PendingStore} from './familyTypes.ts';
import {familyWrites} from './familyTypes.ts';
import {functionPayload,parseFamilies} from './familyApi.ts';
import {FamilyError,accessLost,familyError} from './familyErrors.ts';
import {familyText,id,inviteCode,obj,parseFamily,parseHome} from './familyProtocol.ts';
import {CLOUD_ENV} from './config.ts';
import {aborted} from './errors.ts';
import {holdUpdate} from '../pwa/updateSafety.ts';
import {V32Client} from './v32Client.ts';

export class FamilyClient{
 readonly port:AuthPort;readonly gate:()=>FamilyGate;readonly pending:PendingStore;
 private readonly submitting=new Set<string>();
 private readonly boundUid:string;
 constructor(port:AuthPort,gate:()=>FamilyGate,pending:PendingStore){this.port=port;this.gate=gate;this.pending=pending;this.boundUid=gate().uid;}
 slot(family:string,module:string){if(!this.boundUid||this.gate().uid!==this.boundUid)throw new FamilyError('IDENTITY','FAMILY_SCOPE');return `${CLOUD_ENV}|${this.boundUid}|${family}|${module}`;}
 // 在等待跨页锁前同步占位，重复点击不能排队成第二次新增；SDK无法撤回已发出的请求。
 async exclusive<T>(key:string,signal:AbortSignal,task:()=>Promise<T>):Promise<T>{
  const uid=this.gate().uid;if(!uid)throw new FamilyError('IDENTITY','FAMILY_WRITE');
  if(this.submitting.has(key))throw new FamilyError('PENDING','FAMILY_WRITE');
  this.submitting.add(key);
  const release=holdUpdate('家庭操作正在保存或核对');
  try{return await this.pending.lock(key,async()=>{if(signal.aborted)throw aborted();if(this.gate().uid!==uid)throw new FamilyError('IDENTITY','FAMILY_WRITE');return task();});}
  finally{release();this.submitting.delete(key);}
 }
 async call(action:FamilyAction,payload:Json,signal:AbortSignal):Promise<Json>{
  const bound=this.gate();if(!bound.uid||bound.uid!==this.boundUid||(familyWrites.has(action)&&!bound.canWrite))throw new FamilyError('IDENTITY',action);
  if(signal.aborted)throw aborted();
  const release=holdUpdate('家庭请求尚未完成');
  try{
   if(familyWrites.has(action)){
    const identity=functionPayload(await this.port.callFamily('whoAmI',{},bound.uid,signal),'WHO_AM_I');
    if(identity.uid!==bound.uid)throw new FamilyError('IDENTITY','whoAmI','Web与云函数UID不一致，已停止写入。请到右上角“账号与身份”重新核对，不要创建同名家庭。');
    const current=this.gate();if(signal.aborted)throw aborted();if(current.uid!==bound.uid||!current.canWrite)throw new FamilyError('IDENTITY',action);
   }
   const result=await this.port.callFamily(action,payload,bound.uid,signal);if(signal.aborted)throw aborted();if(this.gate().uid!==bound.uid)throw new FamilyError('IDENTITY',action);return functionPayload(result,'FAMILY_REQUEST');
  }
  catch(error){throw familyError(error,action);}
  finally{release();}
 }
 async families(signal:AbortSignal):Promise<FamilySummary[]>{return parseFamilies(await this.call('listMyFamilies',{},signal));}
 async home(family:string,signal:AbortSignal):Promise<Home>{id(family);const first=await this.call('getFamily',{familyId:family},signal),members=await this.call('listMembers',{familyId:family},signal);const home=parseHome(first,members,this.gate().uid,family);const profile=await this.port.profile();if(signal.aborted)throw aborted();if(profile.uid!==this.gate().uid)throw new FamilyError('IDENTITY','LIST_MEMBERS');const self=home.members.find(m=>(m.boundAuthUid??m.uid)===profile.uid);if(self){self.accountNickname=profile.nickname;self.profileUnavailable=false;}return home;}
 async pendingCreation(){return !!await this.pending.read(this.slot('all','create-family'));}
 async allowCreationRetry(signal:AbortSignal):Promise<Family|null>{const key=this.slot('all','create-family');return this.exclusive(key,signal,async()=>{const found=await this.reconcileCreation(signal);if(found)return found;if(signal.aborted)throw aborted();await this.pending.ack(key);return null;});}
 async reconcileCreation(signal:AbortSignal):Promise<Family|null>{
  const key=this.slot('all','create-family'),saved=await this.pending.read(key);if(!saved)return null;
  if(typeof saved.name!=='string'||!Array.isArray(saved.before)||saved.before.some(v=>typeof v!=='string'))throw new FamilyError('STORAGE','CREATE_FAMILY');
  const rows=await this.families(signal);if(rows.length>=100)throw new FamilyError('UNCONFIRMED','CREATE_FAMILY','家庭列表已达100条，不能从不完整列表判断创建结果。');
  const candidates=rows.filter(f=>!(saved.before as string[]).includes(f.id)&&f.name===saved.name&&f.role==='owner');
  if(candidates.length>1)throw new FamilyError('UNCONFIRMED','CREATE_FAMILY','发现多个可能创建的家庭，请人工核对，禁止再次创建。');
  if(candidates.length===1){const home=await this.home(candidates[0].id,signal);if(home.family.ownerUid!==this.gate().uid)throw new FamilyError('IDENTITY','CREATE_FAMILY');await this.pending.ack(key);return home.family;}
  return null;
 }
 async create(name:string,displayName:string,signal:AbortSignal):Promise<Family>{
  familyText(name,displayName);const key=this.slot('all','create-family');
  return this.exclusive(key,signal,async()=>{
   if(await this.pending.read(key)){const recovered=await this.reconcileCreation(signal);if(recovered)return recovered;throw new FamilyError('PENDING','CREATE_FAMILY');}
   const before=await this.families(signal);if(before.length>=100)throw new FamilyError('UNCONFIRMED','CREATE_FAMILY','当前列表可能不完整，已停止新增家庭。');
   await this.pending.write(key,{name:name.trim(),before:before.map(f=>f.id)});
   try{const result=parseFamily(await this.call('createFamily',{name:name.trim(),displayName:displayName.trim()},signal),this.gate().uid);if(result.ownerUid!==this.gate().uid)throw new FamilyError('IDENTITY','CREATE_FAMILY');await this.pending.ack(key);return result;}
   catch(error){const e=familyError(error,'createFamily');if(e.definite){await this.pending.ack(key);throw e;}if(accessLost(e))throw e;try{const found=await this.reconcileCreation(signal);if(found)return found;}catch(check){if(accessLost(check))throw check;}throw new FamilyError('UNCONFIRMED','createFamily','创建结果待确认。已尝试查询列表，请先点击“核对上次创建”，不要重复创建。');}
  });
 }
 async join(invite:string,displayName:string,signal:AbortSignal):Promise<Family>{
  if(invite.trim().length===10){const result=await new V32Client(this).join(invite,displayName,signal);return parseFamily(result,this.gate().uid);}
  familyText(null,displayName);const family=parseFamily(await this.call('joinFamily',{inviteCode:inviteCode(invite),displayName:displayName.trim()},signal),this.gate().uid);return family;
 }
 async manage(action:'renameFamily'|'rotateInvite'|'setMyDisplayName'|'leaveFamily'|'removeMember',family:string,value:string,signal:AbortSignal):Promise<{invite?:string;expires?:number}>{
  const home=await this.home(family,signal),owner=home.family.ownerUid===this.gate().uid;
  if(['renameFamily','rotateInvite','removeMember'].includes(action)&&!owner)throw new FamilyError('FORBIDDEN',action,'仅家主可以执行此管理操作。');
  if(action==='leaveFamily'&&owner)throw new FamilyError('FORBIDDEN',action,'家主不能直接退出；原后端没有转让或解散接口。');
  const payload:Json={familyId:family};
  if(action==='renameFamily'){familyText(value,'');payload.name=value.trim();}
  if(action==='setMyDisplayName'){familyText(null,value,true);payload.displayName=value.trim();}
  if(action==='removeMember'){if(value===home.family.ownerUid||value===this.gate().uid||!home.members.some(m=>m.uid===value))throw new FamilyError('BAD_REQUEST',action,'只能移除当前家庭的普通成员。');payload.targetUid=value;}
  const result=await this.call(action,payload,signal);
  if(action==='rotateInvite'){const invite=inviteCode(String(result.inviteCode??''));if(typeof result.inviteExpiresAt!=='number'||!Number.isSafeInteger(result.inviteExpiresAt)||result.inviteExpiresAt<=0)throw new FamilyError('INVALID_RESPONSE',action);return{invite,expires:result.inviteExpiresAt};}
  return{};
 }
 async checkReceipt(family:string,module:string,requestId:string,signal:AbortSignal):Promise<Json>{return this.call('getCollabOperation',{familyId:family,module,requestId},signal);}
 async listCardsRaw(family:string,signal:AbortSignal){const value=await this.call('listCards',{familyId:family},signal);if(!obj(value))throw new FamilyError('INVALID_RESPONSE','listCards');return value;}
}
