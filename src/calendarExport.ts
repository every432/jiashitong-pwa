import type {FullAppData} from './model';
import {addDays,todayISO} from './model';
import {nextImportantDate} from './lunar';
const safe=(x:string)=>x.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const stamp=(date:string)=>date.replace(/[-:]/g,'').replace('T','').slice(0,12)+'00';
const dtstart=(s:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);
function event(id:string,title:string,at:string,description:string):string {
 if(!dtstart(at))return '';
 const uid=`${safe(id)}@jiashitong-pwa.local`;
 return ['BEGIN:VEVENT',`UID:${uid}`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${stamp(at)}`,`DURATION:PT30M`, `SUMMARY:${safe(title)}`, `DESCRIPTION:${safe(description)}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${safe(title)}`,'TRIGGER:PT0M','END:VALARM','END:VEVENT'].join('\r\n');
}
/** 导出提醒日历文件，交由用户自己导入受支持的原生系统日历。不会自动获得手机日历权限。 */
export function buildCalendar(data:FullAppData):string{
 const items:string[]=[];
 for(const x of data.memos){if(x.reminderMode!=='none'&&x.remindAt){items.push(event(`memo-${x.id}`,`家事通 · ${x.title}`,x.remindAt,`事项：${x.eventAt}\n${x.note}`));}}
 for(const x of data.debts){if(x.returned||x.reminderMode==='none'||!x.dueOn)continue;
  const remind=addDays(x.dueOn,-Math.max(0,Math.min(365,x.remindDaysBefore??0)));
  items.push(event(`debt-${x.id}`,`家事通 · ${x.kind}：${x.party}`,`${remind}T${x.remindTime||'09:00'}`,`应还：${x.dueOn}，金额：${x.amount} 元`));
 }
 for(const x of data.importantDays){const r=data.birthdayReminders[x.id];if(!r||r.mode==='none')continue;
  let date=nextImportantDate(x,addDays(todayISO(),-Math.min(365,r.daysBefore??0)));
  for(let i=0;date&&i<3;i++){
   const on=addDays(date,-Math.max(0,Math.min(365,r.daysBefore??0)));
   items.push(event(`day-${x.id}-${date}`,`家事通 · ${x.title}${x.category}`,`${on}T${r.time||'09:00'}`,`重要日期：${date}（按${x.calendarType==='lunar'?'农历':'阳历'}换算）`));
   date=nextImportantDate(x,addDays(date,1));
  }
 }
 for(const rule of data.courseData.rules){const course=data.courseData.courses.find(x=>x.id===rule.courseId);if(!course || (data.courseReminderModes[course.id]??'none')==='none')continue;
  const date=new Date(`${todayISO()}T12:00:00`);const offset=(rule.dayOfWeek-date.getDay()+7)%7;
  for(let i=0;i<13;i++){
   const classDate=addDays(todayISO(),offset+7*i);
   const on=addDays(classDate,-Math.max(0,Math.min(365,course.reminderDaysBefore??0)));
   items.push(event(`course-${rule.id}-${classDate}`,`家事通 · ${course.name}上课提醒`,`${on}T${String(course.reminderHour??9).padStart(2,'0')}:${String(course.reminderMinute??0).padStart(2,'0')}`,`预计上课：${classDate} ${String(rule.hour).padStart(2,'0')}:${String(rule.minute).padStart(2,'0')}（仅提醒，不自动扣课时）`));
  }
 }
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//JiaShiTong//PWA 2.6//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH',...items.filter(Boolean),'END:VCALENDAR'].join('\r\n')+'\r\n';
}
export function exportCalendar(data:FullAppData){
 const ics=buildCalendar(data),url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=`家事通_提醒日历_${todayISO()}.ics`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
