import {FamilyError} from './familyErrors.ts';
import {bool,id,integer,invalid,obj,text} from './familyProtocol.ts';
import type {Json,Member} from './familyTypes.ts';
import {parseNotification} from './notificationProtocol.ts';
import type {NotificationConfig} from './notificationProtocol.ts';
export const modules=[{key:'todo',title:'家庭待办',icon:'☑',color:'blue'},{key:'schedule',title:'家庭日程',icon:'▦',color:'green'},{key:'memo',title:'家庭备忘录',icon:'✎',color:'peach'},{key:'shopping',title:'家庭购物清单',icon:'▤',color:'purple'},{key:'notice',title:'家庭公告',icon:'!',color:'red'},{key:'ledger',title:'家庭共享账本',icon:'¥',color:'teal'}] as const;
export type Module=typeof modules[number]['key'];
export type Fields=Record<string,string|number|boolean>;
export type CollabRecord={id:string;familyId:string;module:Module;revision:number;fields:Fields;createdBy:string;createdAt:number;updatedBy:string;updatedAt:number;deleted:boolean;notification?:NotificationConfig};
export type RecordPage={records:CollabRecord[];complete:boolean;cursor:string|null;datasetRevision:number;seenCursors:string[];month:string};
export const expenseCategories=['餐饮','购物','交通','住房','水电','医疗','教育','其他'];
export const incomeCategories=['工资','奖金','转账收入','其他'];
export const validDate=(v:string)=>/^(20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export const validTime=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const validMonth=(v:string)=>/^(20|21)\d{2}-(0[1-9]|1[0-2])$/.test(v);
export const shanghaiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const eventAt=(date:string,time:string)=>Date.parse(`${date}T${time}:00+08:00`);
export const shanghaiTime=(at:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));
export function monthCells(month:string):Array<string|null>{if(!validMonth(month))throw new FamilyError('BAD_REQUEST','MONTH');const first=new Date(month+'-01T00:00:00Z'),offset=(first.getUTCDay()+6)%7,count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i>=offset&&i<offset+count?`${month}-${String(i-offset+1).padStart(2,'0')}`:null);}
export function cents(raw:string):number{const s=raw.trim();if(!/^\d{1,10}(\.\d{1,2})?$/.test(s))throw new FamilyError('BAD_REQUEST','LEDGER_INPUT','金额需大于零，最多两位小数，最大9999999999.99元。');const [a,b='']=s.split('.'),value=BigInt(a)*100n+BigInt(b.padEnd(2,'0'));if(value<1n||value>999999999999n)throw new FamilyError('BAD_REQUEST','LEDGER_INPUT','金额需大于零且不超过9999999999.99元。');return Number(value);}
export function money(value:number|bigint):string{let n=BigInt(value);const sign=n<0n?'-':'';if(n<0n)n=-n;return sign+String(n/100n)+'.'+String(n%100n).padStart(2,'0');}
const allowed:Record<Module,string[]>={todo:['title','body','assigneeUid','deadlineDate','deadlineTime','completed'],schedule:['title','date','startTime','endTime','location','note','timezone','reminderMinutes'],memo:['title','body'],shopping:['title','quantity','unit','note','completed'],notice:['title','body','importance','pinned'],ledger:['entryType','amountCents','date','category','payerUid','note']};
export function validateFields(module:Module,value:Json,members?:Member[]):Fields{
 const fail=(message:string):never=>{throw new FamilyError('BAD_REQUEST',module.toUpperCase()+'_INPUT',message);};
 if(!obj(value)||Object.keys(value).some(k=>!allowed[module].includes(k)))fail('存在不允许提交的字段，请重新读取记录。');
 const out:Fields={};
 const str=(key:string,max:number,required=false,trim=false)=>{const raw=value[key]??'';if(typeof raw!=='string')fail('文字字段格式不正确。');const s=trim?(raw as string).trim():raw as string;if((required&&!s.trim())||Array.from(s).length>max||Array.from(s).some(c=>{const n=c.charCodeAt(0);return n<32&&![9,10,13].includes(n);}))fail(`${fieldLabel(key)}长度或格式不正确（最多${max}字）。`);out[key]=s;return s;};
 const boolean=(key:string)=>{if(value[key]!==undefined&&typeof value[key]!=='boolean')fail('完成或置顶状态格式不正确。');out[key]=value[key]===true;};
 const member=(key:string)=>{const selected=str(key,256,false,true);if(selected&&members&&!members.some(m=>m.uid===selected))throw new FamilyError('INVALID_ASSIGNEE','COLLAB_INPUT');};
 if(module!=='ledger'){const title=str('title',80,true,true);if(title.length>80)fail('标题最多80个字符。');}
 if(['todo','memo','notice'].includes(module))str('body',6000);
 if(['schedule','shopping','ledger'].includes(module))str('note',6000);
 if(module==='todo'){member('assigneeUid');const date=str('deadlineDate',10,false,true),time=str('deadlineTime',5,false,true);if((date&&!validDate(date))||(time&&(!date||!validTime(time))))fail('截止日期或时间无效，请先选择有效日期。');boolean('completed');}
 if(module==='schedule'){const date=str('date',10,true,true),start=str('startTime',5,true,true),end=str('endTime',5,false,true);if(!validDate(date)||!validTime(start)||(end&&(!validTime(end)||end<start)))fail('日期或起止时间无效，结束不能早于开始。');str('location',200);if(value.timezone!=='Asia/Shanghai')fail('家庭日程统一使用北京时间。');out.timezone='Asia/Shanghai';if(typeof value.reminderMinutes!=='number'||!Number.isSafeInteger(value.reminderMinutes)||value.reminderMinutes< -1||value.reminderMinutes>525600)fail('提醒提前分钟需为-1（不提醒）或0～525600的整数。');out.reminderMinutes=value.reminderMinutes as number;}
 if(module==='shopping'){const quantity=str('quantity',16,true,true);if(!/^(0|[1-9]\d{0,6})(\.\d{1,3})?$/.test(quantity)||Number(quantity)<=0)fail('数量需大于零，最多7位整数和3位小数，不允许前导零。');str('unit',20,false,true);boolean('completed');}
 if(module==='notice'){if(!['normal','important'].includes(String(value.importance)))fail('请选择普通或重要公告。');out.importance=value.importance as string;boolean('pinned');}
 if(module==='ledger'){if(!['income','expense'].includes(String(value.entryType)))fail('请选择收入或支出。');if(!Number.isSafeInteger(value.amountCents)||Number(value.amountCents)<=0||Number(value.amountCents)>999999999999)fail('金额必须为合法整数分。');if(typeof value.date!=='string'||!validDate(value.date))fail('账本日期无效。');if(!(value.entryType==='income'?incomeCategories:expenseCategories).includes(String(value.category)))fail('分类必须与收支类型一致。');out.entryType=value.entryType as string;out.amountCents=value.amountCents as number;out.date=value.date as string;out.category=value.category as string;member('payerUid');}
 return out;
}
export function parseRecord(value:unknown,family:string,module:Module):CollabRecord{
 if(!obj(value)||value.familyId!==family||value.module!==module||!obj(value.fields))invalid('COLLAB_READ');
 const raw={...value.fields};if(module==='schedule')delete raw.startAt;
 let fields:Fields;try{fields=validateFields(module,raw);}catch{invalid('COLLAB_READ');}
 if(module==='schedule'&&(value.fields.timezone!=='Asia/Shanghai'||value.fields.startAt!==eventAt(String(fields.date),String(fields.startTime))))invalid('COLLAB_TIME');
 const notification=parseNotification(value);
 return{id:id(value.recordId),familyId:family,module,revision:integer(value.revision,1),fields,createdBy:text(value.createdBy),updatedBy:text(value.updatedBy),createdAt:integer(value.createdAt),updatedAt:integer(value.updatedAt),deleted:bool(value.deleted),...(notification?{notification}:{})};
}
export function defaultFields(module:Module,uid:string,date:string):Fields{
 const all:Record<Module,Fields>={todo:{title:'',body:'',assigneeUid:'',deadlineDate:'',deadlineTime:'',completed:false},schedule:{title:'',date,startTime:'09:00',endTime:'',location:'',note:'',timezone:'Asia/Shanghai',reminderMinutes:-1},memo:{title:'',body:''},shopping:{title:'',quantity:'1',unit:'',note:'',completed:false},notice:{title:'',body:'',importance:'normal',pinned:false},ledger:{entryType:'expense',amountCents:0,date,category:'其他',payerUid:uid,note:''}};return all[module];
}
export function sortRecords(rows:CollabRecord[],module:Module):CollabRecord[]{return [...rows].sort((a,b)=>{
 const f=a.fields,g=b.fields,compare=(x:unknown,y:unknown)=>String(x).localeCompare(String(y));let n=0;
 if(module==='todo'||module==='shopping')n=Number(f.completed)-Number(g.completed)||b.updatedAt-a.updatedAt;
 else if(module==='schedule')n=compare(f.date,g.date)||compare(f.startTime,g.startTime);
 else if(module==='notice')n=Number(g.pinned)-Number(f.pinned)||b.createdAt-a.createdAt;
 else if(module==='ledger')n=compare(g.date,f.date)||b.createdAt-a.createdAt;
 else n=b.updatedAt-a.updatedAt;return n||a.id.localeCompare(b.id);
 });}
export function titleOf(row:CollabRecord){return row.module==='ledger'?`${row.fields.entryType==='income'?'收入':'支出'} · ${row.fields.category}`:String(row.fields.title);}
export function ledgerTotals(rows:CollabRecord[]){let income=0n,expense=0n;for(const r of rows){if(r.module!=='ledger'||r.deleted)continue;const n=BigInt(r.fields.amountCents);if(r.fields.entryType==='income')income+=n;else expense+=n;}return{income,expense,balance:income-expense};}
const labels:Record<string,string>={title:'标题',body:'正文',assigneeUid:'负责人',deadlineDate:'截止日期',deadlineTime:'截止时间',completed:'完成状态',date:'日期',startTime:'开始时间',endTime:'结束时间',location:'地点',note:'备注',reminderMinutes:'提前提醒分钟',timezone:'时区',quantity:'数量',unit:'单位',importance:'重要程度',pinned:'置顶',entryType:'收支类型',amountCents:'金额',category:'分类',payerUid:'付款/收款成员'};
export const fieldLabel=(key:string)=>labels[key]??key;
