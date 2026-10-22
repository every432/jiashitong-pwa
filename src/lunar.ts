import type { ImportantDay } from './model';
import { addDays, dateNumber, todayISO } from './model';

const monthNames = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
const digit = ['','一','二','三','四','五','六','七','八','九','十'];
export const lunarDayName = (day: number) => day <= 10 ? `初${digit[day]}` : day < 20 ? `十${digit[day-10]}` : day === 20 ? '二十' : day < 30 ? `廿${digit[day-20]}` : '三十';
export const lunarMonthName = (month: number, leap: boolean) => `${leap?'闰':''}${monthNames[month-1] ?? `${month}月`}`;
export type LunarFields = { year: number; month: number; day: number; leap: boolean };
export type LunarMonth = { year: number; month: number; leap: boolean; firstSolar: string; lastDay: number };
let chineseFormatter: Intl.DateTimeFormat | null = null;
try { chineseFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Shanghai'}); }
catch { chineseFormatter = null; }
export const lunarAvailable = !!chineseFormatter;
function chineseParts(iso: string) {
  const [y,m,d] = iso.split('-').map(Number);
  return chineseFormatter?.formatToParts(new Date(Date.UTC(y,m-1,d,4))) ?? [];
}
export function toLunar(iso: string): LunarFields | null {
  if (!chineseFormatter) return null;
  const ps = chineseParts(iso);
  const rawYear = ps.find(p=>(p.type as string)==='relatedYear')?.value;
  const rawMonth = ps.find(p=>p.type==='month')?.value ?? '';
  const rawDay = ps.find(p=>p.type==='day')?.value;
  const normalizedMonth = rawMonth.replace(/^闰/,'').replace('十一月','冬月').replace('十二月','腊月').replace('一月','正月');
  const month = monthNames.findIndex(n => normalizedMonth === n) + 1;
  const year = Number(rawYear), day = Number(rawDay);
  if (!month || !Number.isInteger(year) || !Number.isInteger(day)) return null;
  return {year,month,day,leap:rawMonth.startsWith('闰')};
}
const monthCache = new Map<number,LunarMonth[]>();
export function lunarMonthsForYear(year: number): LunarMonth[] {
  if (!lunarAvailable || !Number.isInteger(year) || year < 1900 || year > 2100) return [];
  const cached = monthCache.get(year); if (cached) return cached;
  const list: LunarMonth[] = [];
  for (let iso = `${year}-01-01`; iso < `${year+1}-03-01`; iso=addDays(iso,1)) {
    const part=toLunar(iso);
    if (!part || part.year!==year) continue;
    if (part.day===1) list.push({year,month:part.month,leap:part.leap,firstSolar:iso,lastDay:29});
    if (part.day===30) {
      const current=list.find(x=>x.month===part.month && x.leap===part.leap);
      if (current) current.lastDay=30;
    }
  }
  monthCache.set(year,list);
  return list;
}
export function festivalFromLunar(p: LunarFields): string {
  if (p.leap) return '';
  const names: Record<string,string> = {'1-1':'春节','1-15':'元宵节','2-2':'龙抬头','5-5':'端午节','7-7':'七夕节','7-15':'中元节','8-15':'中秋节','9-9':'重阳节','12-8':'腊八节'};
  if (p.month===12 && p.day===lunarMonthsForYear(p.year).find(x=>x.month===12&&!x.leap)?.lastDay) return '除夕';
  return names[`${p.month}-${p.day}`]??'';
}
export const solarFestival = (month:number,day:number) => ({'1-1':'元旦','5-1':'劳动节','6-1':'儿童节','9-10':'教师节','10-1':'国庆节'} as Record<string,string>)[`${month}-${day}`] ?? '';
const solarISO = (y:number,m:number,d:number) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
export function nextImportantDate(entry: ImportantDay, today=todayISO()): string | null {
  const currentYear=Number(today.slice(0,4));
  if (entry.calendarType==='solar') {
    for (let y=Math.max(currentYear,entry.year); y<=Math.max(currentYear,entry.year)+2;y++) {
      const lastDay = new Date(y,entry.month,0).getDate();
      const result=solarISO(y,entry.month,Math.min(entry.day,lastDay));
      if (result>=today) return result;
    }
    return null;
  }
  const lunarCurrent=toLunar(today);
  if (!lunarCurrent) return null;
  const baseYear=Math.max(lunarCurrent.year,entry.year);
  for (let y=baseYear;y<=baseYear+2;y++) {
    const months=lunarMonthsForYear(y);
    const chosen=months.find(m=>m.month===entry.month&&m.leap===entry.isLeapMonth) ?? months.find(m=>m.month===entry.month&&!m.leap);
    if (!chosen) continue;
    const date=addDays(chosen.firstSolar,Math.min(entry.day,chosen.lastDay)-1);
    if (date>=today) return date;
  }
  return null;
}
export const daysUntil = (date: string) => dateNumber(date)-dateNumber(todayISO());
export function lunarText(solar: string): string {
  const f = toLunar(solar); return f ? `${f.year}年${lunarMonthName(f.month,f.leap)}${lunarDayName(f.day)}` : '此浏览器暂不支持农历换算';
}
