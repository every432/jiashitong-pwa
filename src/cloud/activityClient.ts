import {FamilyClient} from './familyClient.ts';
import {modules} from './collabProtocol.ts';
import type {Module} from './collabProtocol.ts';
import {bool,id,integer,invalid,obj,text} from './familyProtocol.ts';
export type Activity={id:string;actorUid:string;actorNickname:string;at:number;module:Module;operation:'create'|'update'|'delete'|'complete'|'reopen'};
export type ActivityPage={rows:Activity[];cursor:string|null;cursors:string[];family:string};
export class ActivityClient{
 readonly core:FamilyClient;constructor(core:FamilyClient){this.core=core;}
 async page(family:string,signal:AbortSignal,previous?:ActivityPage):Promise<ActivityPage>{
  if(previous&&(previous.family!==family||!previous.cursor))invalid('COLLAB_ACTIVITY');
  const result=await this.core.call('listCollabActivity',{familyId:family,...previous?.cursor?{cursor:previous.cursor}:{}},signal);
  if(!Array.isArray(result.rows)||result.rows.length>30)invalid('COLLAB_ACTIVITY');
  const ids=new Set(previous?.rows.map(r=>r.id)??[]),cursors=new Set(previous?.cursors??[]),rows=[...previous?.rows??[]];
  for(const v of result.rows){if(!obj(v)||v.familyId!==family||!modules.some(m=>m.key===v.module)||!['create','update','delete','complete','reopen'].includes(String(v.operation)))invalid('COLLAB_ACTIVITY');const activityId=id(v.activityId);if(ids.has(activityId))invalid('COLLAB_ACTIVITY');ids.add(activityId);rows.push({id:activityId,actorUid:text(v.actorUid),actorNickname:typeof v.actorNickname==='string'&&v.actorNickname.trim()?v.actorNickname:'家庭成员',at:integer(v.at),module:v.module as Module,operation:v.operation as Activity['operation']});}
  let cursor:string|null=null;if(bool(result.hasMore)){cursor=id(result.nextCursor);if(cursors.has(cursor)||!result.rows.length)invalid('ACTIVITY_CURSOR');cursors.add(cursor);}
  return{family,rows,cursor,cursors:[...cursors]};
 }
}
