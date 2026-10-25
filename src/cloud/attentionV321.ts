import type {CollabRecord} from './collabProtocol.ts';
import {CollabClient} from './collabClient.ts';
import type {FamilyClient} from './familyClient.ts';
import {FamilyError} from './familyErrors.ts';
export type AttentionCounts={todo:number;schedule:number;shopping:number};
export const shanghaiMonth=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,7);
/** 板块角标与消息中心未读事件分离；日程明确采用本月尚未结束的安排。 */
export function attentionCount(rows:CollabRecord[],family:string,memberUid:string,now=Date.now()):number{
 const seen=new Set<string>();let total=0;
 for(const r of rows){if(r.familyId!==family||r.deleted||seen.has(r.id))continue;seen.add(r.id);const f=r.fields;
  if(r.module==='todo'&&f.completed===false&&(!f.assigneeUid||f.assigneeUid===memberUid))total++;
  if(r.module==='shopping'&&f.completed===false)total++;
  if(r.module==='schedule'&&String(f.date).slice(0,7)===shanghaiMonth(now)){
   const end=Date.parse(`${f.date}T${f.endTime||'23:59'}:00+08:00`);if(Number.isFinite(end)&&end>now)total++;
  }
 }return total;
}
export async function loadAttention(core:FamilyClient,family:string,memberUid:string,signal:AbortSignal,now=Date.now()):Promise<AttentionCounts>{
 const client=new CollabClient(core),counts={} as AttentionCounts;
 for(const module of ['todo','schedule','shopping'] as const){
  const page=await client.records(family,module,shanghaiMonth(now),signal);
  // 2000条保护上限以上不发布部分统计值，也不冒充0。
  if(!page.complete)throw new FamilyError('PARTIAL','ATTENTION','记录超过单次完整统计范围，请进入板块查看；角标暂不显示。');
  counts[module]=attentionCount(page.records,family,memberUid,now);
 }return counts;
}
