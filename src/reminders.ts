import type {FullAppData,ReminderMode} from './model';
import {addDays,localDateISO} from './model';
import {nextImportantDate} from './lunar';
export type ReminderEvent={key:string; title:string; time:string; mode:ReminderMode};
const valid=(s:string)=>Number.isFinite(new Date(s).getTime());
/** 此函数只用于网页前台检查。没有服务器时不承诺后台运行。 */
export function dueReminders(data:FullAppData,now=new Date()):ReminderEvent[]{
 const today=localDateISO(now),current=now.getTime(),windowMs=24*60*60*1000;
 const alerts:ReminderEvent[]=[];
 function push(key:string,title:string,time:string,mode:ReminderMode){if(mode==='none'||!time||!valid(time))return;
  const when=new Date(time).getTime();if(when<=current && current-when<windowMs) alerts.push({key:`${key}_${time}`,title,time,mode});}
 for(const x of data.memos)push(`memo_${x.id}`,`重要事项：${x.title}`,x.remindAt,x.reminderMode);
 for(const x of data.debts){if(x.returned||x.reminderMode==='none'||!x.dueOn)continue;
   const dueDate=addDays(x.dueOn,-Math.max(0,Math.min(365,x.remindDaysBefore??0)));
   push(`debt_${x.id}`,`${x.kind}到期：${x.party}（¥${x.amount}）`,`${dueDate}T${x.remindTime||'09:00'}`,x.reminderMode);
 }
 for(const x of data.importantDays){const r=data.birthdayReminders[x.id];if(!r||r.mode==='none')continue;
   const days=Math.max(0,Math.min(365,r.daysBefore??0));const next=nextImportantDate(x,addDays(today,-days-2));
   if(next){const due=addDays(next,-days);push(`date_${x.id}_${next}`,`${x.category}：${x.title}`,`${due}T${r.time||'09:00'}`,r.mode);}
 }
 // 每周固定规则只生成提醒事件，不创建实际流水，更不自动扣课时。
 for(const rule of data.courseData.rules){const c=data.courseData.courses.find(x=>x.id===rule.courseId);if(!c)continue;
   const reminderMode=data.courseReminderModes[c.id]??'none';if(reminderMode==='none')continue;
   const before=Math.max(0,Math.min(365,c.reminderDaysBefore??0));const todayDate=new Date(`${today}T12:00`);
   const offset=(rule.dayOfWeek-todayDate.getDay()+7)%7;
   for(const weekShift of [-7,0,7]){
     const date=addDays(today,offset+weekShift);const alertDay=addDays(date,-before);
     const reminderTime=`${alertDay}T${String(c.reminderHour??9).padStart(2,'0')}:${String(c.reminderMinute??0).padStart(2,'0')}`;
     push(`course_${rule.id}_${date}`,`课程提醒：${c.name} · ${date} ${String(rule.hour).padStart(2,'0')}:${String(rule.minute).padStart(2,'0')}`,reminderTime,reminderMode);
     if(c.hourBefore){const classAt=new Date(`${date}T${String(rule.hour).padStart(2,'0')}:${String(rule.minute).padStart(2,'0')}`);classAt.setHours(classAt.getHours()-1);const local=`${localDateISO(classAt)}T${String(classAt.getHours()).padStart(2,'0')}:${String(classAt.getMinutes()).padStart(2,'0')}`;push(`course_before_${rule.id}_${date}`,`一小时后上课：${c.name}`,local,reminderMode);}
   }
 }
 return alerts.sort((a,b)=>a.time.localeCompare(b.time));
}
