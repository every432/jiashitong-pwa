import type { AppData,FullAppData, Hotline,CourseLedger } from './model';
import {localDateISO, normalizePhone} from './model.ts';
import {expenseCategories, extraHotlines, validDate, validWebUrl, websitePresets} from './personal.ts';

export const builtInHotlines: Hotline[] = [
  ['消费者维权','12315','原 12358、12331、12330 均整合至市场监管 12315'],
  ['政务服务热线','12345','受理大部分的问题、咨询'],
  ['文化旅游投诉','12318','全国号码保留，多地话务并入 12345'],
  ['生态环境投诉','12369','部分地区已接入 12345，噪音、污水、废气、工地扰民'],
  ['安全生产隐患举报','12350',''],['交通运输投诉','12328',''],['快递问题投诉','12305',''],
  ['税务违法举报','12366','偷税漏税、违规开票'],['公安民警违法违纪全国举报热线','12389',''],
  ['中央网信办网上违法和不良信息举报','12377',''],['骚扰/诈骗信息、个人信息泄露举报','12321',''],
  ['间谍、危害国家安全举报','12339',''],['法律援助、免费法律咨询','12348',''],
  ['工会职工帮扶调解','12351','总工会热线，调解欠薪劳资纠纷，非官方劳动执法专线'],
  ['社保/劳资咨询投诉','12333','欠薪维权优先拨打本号码，人社劳动监察法定渠道'],
  ['公积金业务投诉咨询','12329',''],['妇联维权、妇女儿童求助','12338',''],
  ['电力、能源、乱收费投诉','12398',''],['纪检监察举报','12388','公职人员违纪、腐败、不作为'],
  ['干部选人用人违规举报','12380','组织部专线'],['检察服务热线','12309','受理控告申诉、法律咨询、国家赔偿等'],
  ['防震减灾求助','12322','部分地区归并 12345，无法接通就打 12345'],
  ['烟草违规举报','12313',''],['残联服务维权','12385',''],['证券金融违规举报','12386',''],
].map(([duty,phone,remark],i) => ({ id: `hotline_${i+1}`, duty,phone,remark }));

const hotlineNameUpdates:Record<string,string>={hotline_5:'安全生产举报',hotline_10:'网信办网上违法和不良信息举报',hotline_11:'骚扰/诈骗信息和信息泄露举报',hotline_12:'间谍国安举报'};
export const defaultData = (): FullAppData => ({
  format: 'jiashitong-pwa',version:1, contacts:[],emergencies:[],safety:{name:'',phone:'',message:'我一切平安，请放心！'},
  importantDays:[], hotlines:[...builtInHotlines,...extraHotlines].map(x=>({...x,duty:hotlineNameUpdates[x.id]??x.duty,category:x.category??'投诉举报'})), contactScale:120, hotlineScale:120,
  courseData:{courses:[],rules:[],meetings:[]},
  diaries:[],memos:[],courtesy:[],debts:[],courseLedger:[],birthdayReminders:{},courseNotes:{},courseReminderModes:{},
  schemaVersion:31,expenses:[],websites:websitePresets(),expenseScale:100,migrations:{hotlinesV31:true},
});
export const DATA_KEY='jiashitong_pwa_v1'; // 保留旧 KEY、format 和 version。
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const strings=(v:unknown,keys:string[])=>record(v)&&keys.every(k=>typeof v[k]==='string');
const numbers=(v:Record<string,unknown>,keys:string[])=>keys.every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));
const rows=(v:unknown,keys:string[],extra:(r:Record<string,unknown>)=>boolean=()=>true)=>{
  if(!Array.isArray(v))return false;const ids=new Set<string>();
  return v.every(r=>strings(r,['id',...keys])&&(r.id as string).length>0&&!ids.has(r.id as string)&&!!ids.add(r.id as string)&&extra(r));
};
const optional=(x:Record<string,unknown>,key:string,check:(v:unknown)=>boolean)=>x[key]===undefined||check(x[key]);
const dictionary=(v:unknown,check:(x:unknown)=>boolean)=>record(v)&&Object.values(v).every(check);
const mode=(v:unknown)=>['none','notification','alarm'].includes(v as string);
/** 校验失败整体停止读取，不把已存在但不合法的字段替换成空数组。未知字段原样保留。 */
export const isAppData=(d:unknown):d is AppData=>{
  if(!record(d)||d.format!=='jiashitong-pwa'||d.version!==1||!record(d.courseData))return false;
  const c=d.courseData;
  return strings(d.safety,['name','phone','message'])&&numbers(d,['contactScale','hotlineScale'])&&
    rows(d.contacts,['name','phone','longPhone'])&&rows(d.emergencies,['name','relation','phone'])&&
    rows(d.importantDays,['title','category','calendarType'],r=>numbers(r,['year','month','day'])&&typeof r.isLeapMonth==='boolean')&&
    rows(d.hotlines,['duty','phone','remark'],r=>optional(r,'url',x=>typeof x==='string')&&optional(r,'category',x=>['投诉举报','应急求助','保险报案'].includes(x as string))&&optional(r,'pinned',x=>typeof x==='boolean')&&optional(r,'favorite',x=>typeof x==='boolean'))&&
    rows(c.courses,['name'],r=>numbers(r,['purchased','reminderHour','reminderMinute','reminderDaysBefore'])&&typeof r.hourBefore==='boolean')&&
    rows(c.rules,['courseId'],r=>numbers(r,['dayOfWeek','hour','minute','durationMinutes','consumeUnits']))&&
    rows(c.meetings,['courseId','startsAt','status','note','originRuleId'],r=>numbers(r,['durationMinutes','consumeUnits'])&&typeof r.manuallyAdjusted==='boolean'&&['planned','done','cancelled'].includes(r.status as string))&&
    optional(d,'diaries',v=>rows(v,['date','title','content','updatedAt']))&&
    optional(d,'memos',v=>rows(v,['title','eventAt','note','remindAt'],r=>mode(r.reminderMode)))&&
    optional(d,'courtesy',v=>rows(v,['title','note'],r=>rows(r.details,['date','direction','item','method','note'],a=>numbers(a,['amount']))))&&
    optional(d,'debts',v=>rows(v,['kind','party','occurredOn','method','dueOn','remindTime','note'],r=>numbers(r,['amount','remindDaysBefore'])&&mode(r.reminderMode)&&typeof r.returned==='boolean'&&typeof r.includeInStats==='boolean'))&&
    optional(d,'courseLedger',v=>rows(v,['courseId','date','time','status','note'],r=>numbers(r,['units'])&&['normal','leave','makeup'].includes(r.status as string)))&&
    optional(d,'birthdayReminders',v=>dictionary(v,r=>record(r)&&mode(r.mode)&&numbers(r,['daysBefore'])&&typeof r.time==='string'))&&
    optional(d,'courseNotes',v=>dictionary(v,r=>typeof r==='string'))&&optional(d,'courseReminderModes',v=>dictionary(v,mode))&&
    optional(d,'schemaVersion',v=>v===31)&&optional(d,'expenseScale',v=>typeof v==='number'&&v>=50&&v<=200)&&
    optional(d,'expenses',v=>rows(v,['date','category','note'],r=>Number.isSafeInteger(r.cents)&&Number(r.cents)>0&&Number(r.cents)<=100000000000&&validDate(r.date as string)&&expenseCategories.includes(r.category as typeof expenseCategories[number])))&&
    optional(d,'websites',v=>rows(v,['name','category','url','note'],r=>validWebUrl(r.url as string)&&(r.category as string).includes('/')&&optional(r,'pinned',x=>typeof x==='boolean')&&optional(r,'favorite',x=>typeof x==='boolean')))&&
    optional(d,'migrations',v=>record(v)&&optional(v,'hotlinesV31',x=>typeof x==='boolean'));
};
/** 从 0.1 旧排课数据导入已经明确标记“已上课/请假”的记录；不扣除仅计划中的课程。 */
function migrateLegacyMeetings(base:AppData):CourseLedger[]{
  return base.courseData.meetings.filter(m=>m.status==='done'||m.status==='cancelled').map(m=>({
    id:`legacy_meeting_${m.id}`,legacyMeetingId:m.id,courseId:m.courseId,date:m.startsAt.slice(0,10),time:m.startsAt.slice(11,16)||'14:00',
    units:Number.isFinite(m.consumeUnits)?m.consumeUnits:1,status:m.status==='done'?'normal' as const:'leave' as const,note:m.note||'',
  }));
}
export function normalizeData(parsed:AppData):FullAppData {
  const x=parsed as AppData & Partial<FullAppData>;
  const renames=hotlineNameUpdates;
  const hotlines:Hotline[]=x.hotlines.map(h=>{
    const original=builtInHotlines.find(b=>b.id===h.id);
    return {...h,category:h.category??'投诉举报' as const,...(original&&h.phone===original.phone&&h.duty===original.duty&&renames[h.id]?{duty:renames[h.id]}:{})};
  });
  if(!x.migrations?.hotlinesV31)hotlines.push(...extraHotlines.filter(h=>!hotlines.some(old=>old.id===h.id||normalizePhone(old.phone)===h.phone)).map(h=>({...h})));
  return {...defaultData(),...x,hotlines,courseLedger:x.courseLedger??migrateLegacyMeetings(parsed),schemaVersion:31,
    migrations:{...x.migrations,hotlinesV31:true}};
}
export function parseData(raw:string):FullAppData {
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new Error('原始资料不是有效 JSON，已停止保存并保留原文。');}
  if(!isAppData(parsed))throw new Error('资料结构不兼容或已损坏，原文未修改');return normalizeData(parsed);
}
export function downloadText(contents:string,filename:string,type='application/json'){
  const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function exportJson(data:FullAppData){
  const contents=JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2);
  downloadText(contents,`家事通PWA完整备份_${localDateISO(new Date())}.json`);
}
export async function parseImport(file:File):Promise<FullAppData>{
  if(file.size>8_000_000)throw new Error('备份文件超过 8 MB，请先检查');
  const raw=await file.text(),normalized=parseData(raw),source=JSON.parse(raw) as AppData & Partial<FullAppData>;
  // 导入只带入文件实际保存的记录，不把规范化补出的默认记录当成用户备份。
  // 因此导入老备份不会复活本机已经删掉的V3.1预置热线/网站。
  normalized.hotlines=normalized.hotlines.filter(h=>source.hotlines.some(old=>old.id===h.id));
  normalized.websites=source.websites??[];
  return normalized;
}
const comparable=(v:unknown):unknown=>Array.isArray(v)?v.map(comparable):record(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,comparable(v[k])])):v;
const sameContent=(a:unknown,b:unknown)=>JSON.stringify(comparable(a))===JSON.stringify(comparable(b));
/** 非覆盖合并：同ID以本机为准，冲突课程的附属记录不导入，防止错绑课时。 */
export function mergeBackup(current:FullAppData,incoming:FullAppData):{data:FullAppData;added:number;conflicts:number} {
  let added=0,conflicts=0;
  const merge=<T extends {id:string}>(a:T[],b:T[]):T[]=>{
    const ids=new Map(a.map(x=>[x.id,x]));const next=[...a];
    for(const row of b){const old=ids.get(row.id);if(!old){next.push(row);ids.set(row.id,row);added++;}else if(!sameContent(old,row))conflicts++;}
    return next;
  };
  const blockedCourses=new Set(incoming.courseData.courses.filter(c=>current.courseData.courses.some(old=>old.id===c.id&&!sameContent(old,c))).map(c=>c.id));
  const newCourseIds=new Set(incoming.courseData.courses.filter(c=>!current.courseData.courses.some(old=>old.id===c.id)).map(c=>c.id));
  const newDayIds=new Set(incoming.importantDays.filter(c=>!current.importantDays.some(old=>old.id===c.id)).map(c=>c.id));
  const related=<T extends {courseId:string}>(rows:T[])=>rows.filter(r=>{if(blockedCourses.has(r.courseId)){conflicts++;return false;}return true;});
  const data={...incoming,...current,
    contacts:merge(current.contacts,incoming.contacts),emergencies:merge(current.emergencies,incoming.emergencies),importantDays:merge(current.importantDays,incoming.importantDays),hotlines:merge(current.hotlines,incoming.hotlines),
    diaries:merge(current.diaries,incoming.diaries),memos:merge(current.memos,incoming.memos),courtesy:merge(current.courtesy,incoming.courtesy),debts:merge(current.debts,incoming.debts),expenses:merge(current.expenses,incoming.expenses),websites:merge(current.websites,incoming.websites),
    courseData:{...incoming.courseData,...current.courseData,courses:merge(current.courseData.courses,incoming.courseData.courses),rules:merge(current.courseData.rules,related(incoming.courseData.rules)),meetings:merge(current.courseData.meetings,related(incoming.courseData.meetings))},
    courseLedger:merge(current.courseLedger,related(incoming.courseLedger)),birthdayReminders:{...Object.fromEntries(Object.entries(incoming.birthdayReminders).filter(([id])=>newDayIds.has(id))),...current.birthdayReminders},
    courseNotes:{...Object.fromEntries(Object.entries(incoming.courseNotes).filter(([id])=>newCourseIds.has(id))),...current.courseNotes},
    courseReminderModes:{...Object.fromEntries(Object.entries(incoming.courseReminderModes).filter(([id])=>newCourseIds.has(id))),...current.courseReminderModes},
    safety:current.safety.name||current.safety.phone||current.safety.message!==defaultData().safety.message?current.safety:incoming.safety,
  };
  return {data,added,conflicts};
}
