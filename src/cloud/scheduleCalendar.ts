import type {CollabRecord} from './collabProtocol.ts';
import {eventAt} from './collabProtocol.ts';
const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const utc=(at:number)=>new Date(at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
function fold(s:string){const lines:string[]=[];let line='',size=0;for(const c of s){const bytes=new TextEncoder().encode(c).length;if(size+bytes>75){lines.push(line);line=' ';size=1;}line+=c;size+=bytes;}lines.push(line);return lines.join('\r\n');}
export function sharedCalendar(family:string,rows:CollabRecord[],now=Date.now()):string{
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Jiashitong//Family Schedule V3.1//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const r of rows){if(r.familyId!==family||r.module!=='schedule'||r.deleted)continue;const f=r.fields,start=eventAt(String(f.date),String(f.startTime)),end=f.endTime?eventAt(String(f.date),String(f.endTime)):null;
  lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(family)}.${encodeURIComponent(r.id)}@jiashitong.family`,`DTSTAMP:${utc(now)}`,`SEQUENCE:${r.revision}`,`DTSTART:${utc(start)}`,...end!==null&&end>start?[`DTEND:${utc(end)}`]:[],`SUMMARY:${escape(String(f.title))}`,`LOCATION:${escape(String(f.location))}`,`DESCRIPTION:${escape(String(f.note))}`);
  if(Number(f.reminderMinutes)>=0)lines.push('BEGIN:VALARM',`TRIGGER:-PT${Number(f.reminderMinutes)}M`,'ACTION:DISPLAY',`DESCRIPTION:${escape(String(f.title))}`,'END:VALARM');lines.push('END:VEVENT');
 }lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
