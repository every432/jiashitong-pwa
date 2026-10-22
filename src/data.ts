import type { AppData,FullAppData, Hotline,CourseLedger } from './model';
import {localDateISO, uid} from './model';

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

export const defaultData = (): FullAppData => ({
  format: 'jiashitong-pwa',version:1, contacts:[],emergencies:[],safety:{name:'',phone:'',message:'我一切平安，请放心！'},
  importantDays:[], hotlines:builtInHotlines.map(x=>({...x})), contactScale:120, hotlineScale:120,
  courseData:{courses:[],rules:[],meetings:[]},
  diaries:[],memos:[],courtesy:[],debts:[],courseLedger:[],birthdayReminders:{},courseNotes:{},courseReminderModes:{},
});
const KEY='jiashitong_pwa_v1'; // 不改旧 KEY，旧用户数据自然沿用。
export const isAppData = (d: unknown): d is AppData => {
  if (!d||typeof d!=='object')return false;
  const x=d as Partial<AppData>;
  return x.format==='jiashitong-pwa'&&x.version===1&&Array.isArray(x.contacts)&&Array.isArray(x.emergencies)&&
    Array.isArray(x.importantDays)&&Array.isArray(x.hotlines)&&!!x.safety&&typeof x.safety.name==='string'&&
    !!x.courseData&&Array.isArray(x.courseData.courses)&&Array.isArray(x.courseData.rules)&&Array.isArray(x.courseData.meetings);
};
const arr=(v:unknown)=>Array.isArray(v)?v:[];
const obj=(v:unknown): Record<string,unknown> => v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** 从 0.1 旧排课数据导入已经明确标记“已上课/请假”的记录；不扣除仅计划中的课程。 */
function migrateLegacyMeetings(base:AppData):CourseLedger[]{
  return base.courseData.meetings.filter(m=>m.status==='done'||m.status==='cancelled').map(m=>({
    id:uid(),legacyMeetingId:m.id,courseId:m.courseId,date:m.startsAt.slice(0,10),time:m.startsAt.slice(11,16)||'14:00',
    units:Number.isFinite(m.consumeUnits)?m.consumeUnits:1,status:m.status==='done'?'normal' as const:'leave' as const,note:m.note||'',
  }));
}
export function normalizeData(parsed:AppData):FullAppData {
  const x=parsed as AppData & Partial<FullAppData>;
  const sourceLedger=Array.isArray(x.courseLedger)?x.courseLedger:migrateLegacyMeetings(parsed);
  return {...defaultData(),...x,diaries:arr(x.diaries),memos:arr(x.memos),courtesy:arr(x.courtesy),debts:arr(x.debts),
    courseLedger:sourceLedger,birthdayReminders:obj(x.birthdayReminders) as FullAppData['birthdayReminders'],
    courseNotes:obj(x.courseNotes) as FullAppData['courseNotes'],
    courseReminderModes:obj(x.courseReminderModes) as FullAppData['courseReminderModes']};
}
export const loadData=():FullAppData=>{
  try{const raw=localStorage.getItem(KEY);if(!raw)return defaultData();const parsed:unknown=JSON.parse(raw);
    return isAppData(parsed)?normalizeData(parsed):defaultData();
  }catch{return defaultData();}
};
export const saveData=(data:FullAppData):boolean=>{
  try{localStorage.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}
};
export function exportJson(data:FullAppData){
  const contents=JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2);
  const url=URL.createObjectURL(new Blob([contents],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`家事通PWA完整备份_${localDateISO(new Date())}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export async function parseImport(file:File):Promise<FullAppData>{
  if(file.size>8_000_000)throw new Error('备份文件超过 8 MB，请先检查');
  const raw:unknown=JSON.parse(await file.text());
  if(!isAppData(raw))throw new Error('不是可识别的家事通 PWA 备份；安卓版数据格式暂不能直接导入');
  const x=raw as AppData & Partial<FullAppData>;
  const checkArray=(xs:unknown,keys:string[])=>Array.isArray(xs)&&xs.length<=10000&&xs.every(item=>item&&typeof item==='object'&&keys.every(k=>typeof (item as Record<string,unknown>)[k]==='string'));
  if(!checkArray(x.contacts,['id','name','phone','longPhone'])||!checkArray(x.emergencies,['id','name','phone','relation'])||
    !checkArray(x.hotlines,['id','duty','phone','remark'])||!checkArray(x.importantDays,['id','title','category','calendarType'])||
    !checkArray(x.courseData.courses,['id','name'])||!checkArray(x.courseData.rules,['id','courseId'])||
    !checkArray(x.courseData.meetings,['id','courseId','startsAt','status']))throw new Error('旧版基础数据结构异常');
  const checkNew=(value:unknown,keys:string[])=>value===undefined||checkArray(value,keys);
  if(!checkNew(x.diaries,['id','date','title','content'])||!checkNew(x.memos,['id','title','eventAt','note'])||
    !checkNew(x.courtesy,['id','title'])||!checkNew(x.debts,['id','kind','party','occurredOn'])||
    !checkNew(x.courseLedger,['id','courseId','date','status']))throw new Error('新版记录格式异常');
  if(x.courtesy && x.courtesy.some(g=>!Array.isArray(g.details)||g.details.length>10000))throw new Error('人情往来明细格式异常');
  return normalizeData(x);
}
