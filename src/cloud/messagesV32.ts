import type {FamilyClient} from './familyClient.ts';
import {V32Client} from './v32Client.ts';
import {bool,id,integer,invalid,obj,text} from './familyProtocol.ts';
import {modules} from './collabProtocol.ts';
import type {Module} from './collabProtocol.ts';
import {FamilyError} from './familyErrors.ts';
export type FamilyMessage={id:string;family:string;module:Module;recordId:string;actor:string;title:string;operation:string;at:number;unread:boolean;deleted:boolean};
export type MessagePage={rows:FamilyMessage[];cursor:string|null;seen:string[]};
export type UnreadTotals={total:number;byFamily:Record<string,{total:number;modules:Record<Module,number>}>;deliveryPending:boolean};
export function parseUnread(r:Record<string,unknown>):UnreadTotals{
 if(!obj(r.byFamily))invalid('v32Unread');const byFamily:UnreadTotals['byFamily']={};let sum=0;
 for(const [key,v] of Object.entries(r.byFamily)){id(key);if(!obj(v)||!obj(v.modules))invalid('v32Unread');const counts={} as Record<Module,number>;for(const m of modules)counts[m.key]=integer(v.modules[m.key]);const count=integer(v.total);if(Object.values(counts).reduce((n,c)=>n+c,0)!==count)invalid('v32Unread');Object.defineProperty(byFamily,key,{value:{total:count,modules:counts},enumerable:true});sum+=count;}
 const total=integer(r.total);if(!Number.isSafeInteger(sum)||sum!==total)invalid('v32Unread');return{total,byFamily,deliveryPending:bool(r.deliveryPending)};
}
export class MessageClientV32 {
 readonly core:FamilyClient;constructor(core:FamilyClient){this.core=core;}
 async unread(signal:AbortSignal){await new V32Client(this.core).capabilities(signal);let result:UnreadTotals|undefined;for(let batch=0;batch<5;batch++){result=parseUnread(await this.core.call('v32Unread',{},signal));if(!result.deliveryPending)return result;}return result!;}
 async page(family:string,signal:AbortSignal,previous?:MessagePage):Promise<MessagePage>{
  if(previous&&!previous.cursor)invalid('v32Messages');await new V32Client(this.core).capabilities(signal);
  const r=await this.core.call('v32Messages',{familyId:id(family),...(previous?.cursor?{cursor:previous.cursor}:{})},signal);
  if(!Array.isArray(r.rows)||r.rows.length>30)invalid('v32Messages');const seenIds=new Set(previous?.rows.map(v=>v.id)),rows=r.rows.map(v=>{
   if(!obj(v)||v.familyId!==family||!modules.some(m=>m.key===v.module)||!['create','update','delete','complete','reopen'].includes(String(v.operation)))invalid('v32Messages');const key=id(v.activityId);if(seenIds.has(key))invalid('v32Messages');seenIds.add(key);const title=text(v.title,false);if(Array.from(title).length>160)invalid('v32Messages');return{id:key,family,module:v.module as Module,recordId:typeof v.recordId==='string'&&v.recordId?id(v.recordId):'',actor:text(v.actorNickname),title,operation:text(v.operation),at:integer(v.at),unread:bool(v.unread),deleted:bool(v.deleted)};
  });
  const more=bool(r.hasMore),cursor=more?id(r.nextCursor):null,seen=new Set(previous?.seen??[]);
  if(cursor&&(seen.has(cursor)||cursor===previous?.cursor||!rows.length))invalid('v32Messages');if(cursor)seen.add(cursor);
  return{rows:[...(previous?.rows??[]),...rows],cursor,seen:[...seen]};
 }
 async readOne(family:string,activity:string,signal:AbortSignal){return this.core.call('v32ReadMessages',{familyId:id(family),activityIds:[id(activity)]},signal);}
 async readAll(family:string,through:string,signal:AbortSignal){
  let sequence:number|undefined;
  for(let batch=0;batch<100;batch++){
   const r=await this.core.call('v32ReadMessages',{familyId:id(family),all:true,through:id(through),...(sequence!==undefined?{throughSequence:sequence}:{})},signal),next=integer(r.readThroughSequence);
   if(sequence!==undefined&&sequence!==next)invalid('v32ReadMessages');sequence=next;if(!bool(r.hasMore))return;
  }
  throw new FamilyError('PARTIAL','v32ReadMessages','已提交已读水位，但后台投递清理尚未全部确认，请刷新核对。不会删除消息。');
 }
}
