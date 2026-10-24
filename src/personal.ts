import type {CourseLedger, Expense, Hotline, Website} from './model.ts';

export const expenseCategories=['日常生活','网络购物','学习培训','旅游运动','健康养生','其他'] as const;
export const websiteCategories=['工作/教师','工作/医生','工作/文案整理','生活/家庭写作','生活/政务服务','生活/日常生活','学习/学习资源','学习/查询工具'] as const;
export const hotlineCategories=['投诉举报','应急求助','保险报案'] as const;
export const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(`${s}T00:00:00Z`))&&new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s;
export function expenseCents(raw:string):number|null {
  const text=raw.trim();if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
  const [whole,fraction='']=text.split('.');
  const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  return cents>0n&&cents<=100000000000n?Number(cents):null;
}
export const money=(cents:number)=>`${cents<0?'-':''}${Math.floor(Math.abs(cents)/100)}.${String(Math.abs(cents)%100).padStart(2,'0')}`;
export function sumCents(rows:Expense[]):number {
  const total=rows.reduce((n,r)=>n+BigInt(r.cents),0n);
  if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('金额合计超出安全范围，请缩小筛选范围');
  return Number(total);
}
export function filterExpenses(rows:Expense[],period:string,category='全部类别') {
  if(!/^(?:\d{4}|\d{4}-(?:0[1-9]|1[0-2]))$/.test(period))return [];
  return rows.filter(r=>r.date.startsWith(period)&&(category==='全部类别'||r.category===category)).sort((a,b)=>b.date.localeCompare(a.date));
}
export function expensesCsv(rows:Expense[]):string {
  const cell=(s:string)=>`"${(/^[\s\uFEFF]*[=+\-@\t\r]/u.test(s)?"'":'')+s.replace(/"/g,'""')}"`;
  return '\uFEFF日期,类别,金额（元）,备注\r\n'+rows.map(r=>[r.date,r.category,money(r.cents),r.note].map(cell).join(',')).join('\r\n');
}
export function validWebUrl(raw:string):boolean {
  if(!/^https?:\/\//i.test(raw)||Array.from(raw).some(c=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127))return false;
  try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}
}
export const sortedWebsites=(rows:Website[])=>[...rows].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||Number(!!b.favorite)-Number(!!a.favorite));
export const sortedHotlines=(rows:Hotline[])=>[...rows].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||Number(!!b.favorite)-Number(!!a.favorite)||(a.category??'投诉举报').localeCompare(b.category??'投诉举报','zh-CN'));
export function moveById<T extends {id:string}>(rows:T[],source:string,target:string):T[] {
  const from=rows.findIndex(x=>x.id===source),to=rows.findIndex(x=>x.id===target);
  if(from<0||to<0||from===to)return rows;
  const next=[...rows];next.splice(to,0,next.splice(from,1)[0]);return next;
}
export const courseUsed=(rows:CourseLedger[],courseId:string)=>rows.filter(x=>x.courseId===courseId&&x.status!=='leave').reduce((n,x)=>n+x.units,0);

export const extraHotlines:Hotline[]=[
  {id:'v3_emergency_110',duty:'报警求助',phone:'110',remark:'',category:'应急求助'},
  {id:'v3_emergency_119',duty:'消防救援',phone:'119',remark:'',category:'应急求助'},
  {id:'v3_emergency_120',duty:'医疗急救',phone:'120',remark:'',category:'应急求助'},
  {id:'v3_emergency_122',duty:'交通事故报警',phone:'122',remark:'',category:'应急求助'},
  {id:'v3_insurance_picc',duty:'中国人保财险报案',phone:'95518',remark:'',category:'保险报案',url:'https://www.picc.com/'},
];
export const websitePresets=():Website[]=>[
  ['WPS 家庭写作工具','生活/家庭写作','https://www.wps.cn/','家庭通知、请假条、申请书、证明材料的文档与模板工具'],
  ['金山文档','生活/家庭写作','https://www.kdocs.cn/','通过浏览器起草家庭文字材料，网站可能要求登录'],
  ['中国政府网','生活/家庭写作','https://www.gov.cn/','通知、申请与公文表达参考'],
  ['国家政务服务平台','生活/政务服务','https://gjzwfw.www.gov.cn/','政务办理入口'],
  ['国家中小学智慧教育平台','工作/教师','https://basic.smartedu.cn/','教学及学习资源'],
  ['国家卫生健康委员会','工作/医生','https://www.nhc.gov.cn/','卫生政策与资料'],
  ['中国政府网政策文件库','工作/文案整理','https://www.gov.cn/zhengce/zhengcewenjianku/','官方文件写作参考'],
  ['国家智慧教育公共服务平台','学习/学习资源','https://www.smartedu.cn/','学习资源导航'],
].map(([name,category,url,note],i)=>({id:`web_builtin_${i}`,name,category,url,note}));

// FNV-1a 64用于本机原文校验及备份命名，不用于身份认证或加密。
export function rawChecksum(raw:string):string {
  let hash=14695981039346656037n;
  for(const byte of new TextEncoder().encode(raw))hash=BigInt.asUintN(64,(hash^BigInt(byte))*1099511628211n);
  return hash.toString(16).padStart(16,'0');
}
