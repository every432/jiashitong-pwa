import {FamilyClient} from './familyClient.ts';
import {FamilyError,accessLost,familyError} from './familyErrors.ts';
import {bool,id,integer,invalid,obj} from './familyProtocol.ts';
import {parseRecord,sortRecords,validMonth,validateFields} from './collabProtocol.ts';
import type {CollabRecord,Module,RecordPage} from './collabProtocol.ts';
import type {Json} from './familyTypes.ts';
import {notificationConfig} from './notificationProtocol.ts';
import type {NotificationConfig} from './notificationProtocol.ts';
import {V32Client} from './v32Client.ts';
export type Mutation={familyId:string;module:Module;kind:'create'|'update'|'delete'|'complete';requestId:string;fields:Json;recordId?:string;expectedRevision?:number;notificationMode?:NotificationConfig['mode'];notificationMemberIds?:string[]};
export function validateOutcome(value:unknown,request:Mutation){
 if(!obj(value)||value.familyId!==request.familyId||value.module!==request.module||value.kind!==request.kind||!value.recordId||value.revision!==(request.kind==='create'?1:Number(request.expectedRevision)+1)||value.deleted!==(request.kind==='delete')||(request.kind!=='create'&&value.recordId!==request.recordId))invalid('COLLAB_CHECK');id(value.recordId);
 integer(value.revision,1);
}
export class CollabClient{
 readonly core:FamilyClient;constructor(core:FamilyClient){this.core=core;}
 async records(family:string,module:Module,month:string,signal:AbortSignal,previous?:RecordPage):Promise<RecordPage>{
  if((module==='schedule'||module==='ledger')&&!validMonth(month))throw new FamilyError('BAD_REQUEST','COLLAB_MONTH');
  if(previous&&(previous.month!==month||previous.complete||previous.records.some(r=>r.familyId!==family||r.module!==module)))invalid('COLLAB_PAGE');
  const rows=previous?[...previous.records]:[],ids=new Set(rows.map(r=>r.id)),seen=new Set(previous?.seenCursors??[]);let cursor=previous?.cursor??null,version=previous?.datasetRevision;
  const stop=rows.length+2000;
  for(;;){
   const result=await this.core.call('listCollabRecords',{familyId:family,module,...module==='schedule'||module==='ledger'?{month}:{},...cursor?{cursor}:{}},signal);
   const revision=integer(result.datasetRevision);if(version!==undefined&&version!==revision)throw new FamilyError('SNAPSHOT_CHANGED','listCollabRecords');version=revision;
   if(!Array.isArray(result.records)||result.records.length>50)invalid('COLLAB_PAGE');
   for(const value of result.records){const record=parseRecord(value,family,module);if(record.deleted||ids.has(record.id)||((module==='ledger'||module==='schedule')&&String(record.fields.date).slice(0,7)!==month))invalid('COLLAB_PAGE');ids.add(record.id);rows.push(record);}
   const more=bool(result.hasMore);if(!more)return{records:sortRecords(rows,module),complete:true,cursor:null,datasetRevision:version,seenCursors:[...seen],month};
   const next=id(result.nextCursor);if(seen.has(next)||!result.records.length)invalid('COLLAB_CURSOR');seen.add(next);cursor=next;
   if(rows.length>=stop)return{records:sortRecords(rows,module),complete:false,cursor,datasetRevision:version,seenCursors:[...seen],month};
  }
 }
 async record(family:string,module:Module,recordId:string,signal:AbortSignal):Promise<CollabRecord>{const r=await this.core.call('getCollabRecord',{familyId:family,module,recordId},signal),record=parseRecord(r.record,family,module);if(record.id!==recordId||record.deleted)invalid('COLLAB_READ');return record;}
 async hasPending(family:string,module:Module){return!!await this.core.pending.read(this.core.slot(family,module));}
 async conflictDraft(family:string,module:Module):Promise<Mutation|null>{
  const value=await this.core.pending.read(this.core.slot(family,module)+'|conflict');if(!value)return null;
  if(value.familyId!==family||value.module!==module||value.kind!=='update'||typeof value.recordId!=='string'||!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<1||!obj(value.fields))throw new FamilyError('STORAGE','CONFLICT_DRAFT');
  return value as Mutation;
 }
 async discardConflict(family:string,module:Module,signal:AbortSignal){const key=this.core.slot(family,module);await this.core.exclusive(key,signal,()=>this.core.pending.ack(key+'|conflict'));}
 private async lookup(request:Mutation,signal:AbortSignal){const result=await this.core.checkReceipt(request.familyId,request.module,request.requestId,signal);if(!bool(result.found))return false;validateOutcome(result.outcome,request);return true;}
 private async send(key:string,request:Mutation,signal:AbortSignal){
  try{const result=await this.core.call('mutateCollabRecord',request,signal);validateOutcome(result,request);await this.core.pending.ack(key);}
  catch(error){const e=familyError(error,'mutateCollabRecord');if(e.definite){
   if(e.code==='CONFLICT'&&request.kind==='update'){
    const previous=await this.core.pending.read(key+'|conflict');
    // 不覆盖另一份尚未处理的冲突草稿；保留当前待核对请求，待用户先处理旧草稿。
    if(previous&&previous.requestId!==request.requestId)throw new FamilyError('STORAGE','CONFLICT_DRAFT','另有冲突草稿未处理，当前请求也已保留。请先恢复或移除旧草稿，再核对本次操作。');
    await this.core.pending.write(key+'|conflict',request);
   }
   await this.core.pending.ack(key);throw e;
  }if(accessLost(e))throw e;try{if(await this.lookup(request,signal)){await this.core.pending.ack(key);return;}}catch(check){if(accessLost(check))throw check;}throw new FamilyError('UNCONFIRMED','mutateCollabRecord');}
 }
 async mutate(family:string,module:Module,kind:Mutation['kind'],fields:Json,signal:AbortSignal,baseline?:CollabRecord,notify?:NotificationConfig){
  id(family);if(kind!=='create'&&(!baseline||baseline.familyId!==family||baseline.module!==module||baseline.deleted))invalid('COLLAB_WRITE');
  if(!['create','update','delete','complete'].includes(kind))invalid('COLLAB_WRITE');
  const key=this.core.slot(family,module);
  await this.core.exclusive(key,signal,async()=>{
  let clean:Json={},notification:NotificationConfig|undefined;if(kind==='create'||kind==='update'){const home=await this.core.home(family,signal);clean=validateFields(module,fields,home.members);if(notify){await new V32Client(this.core).capabilities(signal);notification=notificationConfig(notify.mode,notify.members,home.members);}}else if(kind==='complete'){if(!['todo','shopping'].includes(module)||typeof fields.completed!=='boolean'||Object.keys(fields).length!==1)throw new FamilyError('BAD_REQUEST','COLLAB_COMPLETE');clean={completed:fields.completed};}
   if(await this.core.pending.read(key))throw new FamilyError('PENDING','mutateCollabRecord');
   const request:Mutation={familyId:family,module,kind,requestId:crypto.randomUUID(),fields:clean,...baseline?{recordId:baseline.id,expectedRevision:baseline.revision}:{},...notification?{notificationMode:notification.mode,notificationMemberIds:notification.members}:{}};
   await this.core.pending.write(key,request);await this.send(key,request,signal);
  });
 }
 async retry(family:string,module:Module,signal:AbortSignal){const key=this.core.slot(family,module);await this.core.exclusive(key,signal,async()=>{
  const saved=await this.core.pending.read(key);if(!saved)throw new FamilyError('PENDING','getCollabOperation','没有待确认操作，请刷新列表。');
  if(saved.familyId!==family||saved.module!==module||typeof saved.requestId!=='string'||!/^[a-f0-9-]{32,36}$/i.test(saved.requestId)||!['create','update','delete','complete'].includes(String(saved.kind))||!obj(saved.fields))throw new FamilyError('STORAGE','COLLAB_PENDING');
  const request=saved as Mutation;
  if(await this.lookup(request,signal))await this.core.pending.ack(key);else await this.send(key,request,signal);
 });}
}
