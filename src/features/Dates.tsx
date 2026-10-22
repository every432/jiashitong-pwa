import {useMemo,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import type {FullAppData,ImportantDay,ReminderMode} from '../model';
import {reminderModes} from '../model';
import {todayISO,uid} from '../model';
import {daysUntil,festivalFromLunar,lunarAvailable,lunarDayName,lunarMonthName,lunarMonthsForYear,lunarText,nextImportantDate,solarFestival,toLunar} from '../lunar';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,Note,TimeSelect} from '../ui';

type Props={data:FullAppData;setData:Dispatch<SetStateAction<FullAppData>>;onBack:()=>void};
export default function Dates({data,setData,onBack}:Props){
  const [editing,setEditing]=useState<ImportantDay|null|undefined>(undefined),[del,setDel]=useState<ImportantDay|null>(null);
  const [reminderMode,setReminderMode]=useState<ReminderMode>('none'),[reminderDays,setReminderDays]=useState('1'),[reminderTime,setReminderTime]=useState('09:00');
  const [title,setTitle]=useState(''),[category,setCategory]=useState<'生日'|'纪念日'>('生日'),[calendarType,setCalendarType]=useState<'solar'|'lunar'>('solar');
  const [solar,setSolar]=useState(todayISO()),[lunarYear,setLunarYear]=useState(new Date().getFullYear()),[lunarMonth,setLunarMonth]=useState(1),[leap,setLeap]=useState(false),[lunarDay,setLunarDay]=useState(1);
  const months=useMemo(()=>calendarType==='lunar'?lunarMonthsForYear(lunarYear):[],[calendarType,lunarYear]);
  const activeMonth=months.find(m=>m.month===lunarMonth&&m.leap===leap);
  function open(p:ImportantDay|null){const setting=p?data.birthdayReminders[p.id]:undefined;setReminderMode(setting?.mode??'none');setReminderDays(String(setting?.daysBefore??1));setReminderTime(setting?.time??'09:00');setEditing(p);setTitle(p?.title??'');setCategory(p?.category??'生日');setCalendarType(p?.calendarType??'solar');
    setSolar(p?`${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`:todayISO());
    const todayLunar=toLunar(todayISO());setLunarYear(p?.year??todayLunar?.year??new Date().getFullYear());setLunarMonth(p?.month??todayLunar?.month??1);setLeap(p?.isLeapMonth??false);setLunarDay(p?.day??todayLunar?.day??1);
  }
  function save(){const days=Number(reminderDays);if(reminderMode!=='none'&&(!Number.isInteger(days)||days<0||days>365)){alert('提醒天数必须是0到365的整数');return;}if(!title.trim()){alert('请填写姓名或事件名称');return;}let year:number,month:number,day:number;
    if(calendarType==='solar'){if(!/^\d{4}-\d{2}-\d{2}$/.test(solar)){alert('请选择有效阳历日期');return;}[year,month,day]=solar.split('-').map(Number);if(year<1900||year>2100){alert('目前支持登记 1900～2100 年的日期');return;}}
    else {if(!lunarAvailable||!activeMonth||lunarDay<1||lunarDay>activeMonth.lastDay){alert('请选择有效的农历年月日（1900～2100）');return;}year=lunarYear;month=lunarMonth;day=lunarDay;}
    const rec:ImportantDay={id:editing?.id??uid(),title:title.trim(),category,year,month,day,calendarType,isLeapMonth:calendarType==='lunar'?leap:false};
    setData(d=>({...d,importantDays:editing?d.importantDays.map(e=>e.id===rec.id?rec:e):[...d.importantDays,rec],birthdayReminders:{...d.birthdayReminders,[rec.id]:{mode:reminderMode,daysBefore:days,time:reminderTime}}}));setEditing(undefined);
  }
  const ordered=data.importantDays.map(e=>({entry:e,next:nextImportantDate(e)})).sort((a,b)=>(a.next??'9999').localeCompare(b.next??'9999'));
  const soon=ordered.filter(x=>x.next && daysUntil(x.next)<=7);
  const lmonth=activeMonth?.firstSolar;
  const preview=calendarType==='solar'?solar:lmonth?(()=>{const [y,m,d]=lmonth.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+Math.min(lunarDay,activeMonth!.lastDay)-1)).toISOString().slice(0,10);})():null;
  return <main className="page"><Header title="生日与纪念日" subtitle="阳历/农历双历法 · 每年自动计算倒计时" onBack={onBack}/><button className="btn primary wide" onClick={()=>open(null)}>＋ 添加重要日子</button>
    <div className="notice"><strong>🔔 提醒说明</strong><p>已支持提前天数与提醒时间设置，页面打开时会检查并提示。关闭 PWA 后的准时提醒需要 Web Push 服务器支持。</p>{soon.length>0&&<p>未来 7 天：{soon.map(x=>x.entry.title).join('、')}</p>}</div>
    {!ordered.length?<Empty icon="🎂" title="还没有记录" description="添加一位家人的生日，或自己的结婚纪念日吧。"/>:<div className="stack">{ordered.map(({entry:e,next})=>{const days=next?daysUntil(next):null;const lunar=next?toLunar(next):null;const sf=next?solarFestival(Number(next.slice(5,7)),Number(next.slice(8,10))):'';const lf=lunar?festivalFromLunar(lunar):'';
      return <article className="panel date-card" key={e.id}><div className="date-card-head"><div><h2>{e.category==='生日'?'🎂':'♥'} {e.title}</h2><p className="muted small">{e.category} · 按{e.calendarType==='lunar'?'农历':'阳历'}每年重复：{e.calendarType==='lunar'?`${lunarMonthName(e.month,e.isLeapMonth)}${lunarDayName(e.day)}`:`${e.month}月${e.day}日`}</p></div><strong className="countdown">{days===null?'暂无法换算':days===0?'就是今天！':`还有 ${days} 天`}</strong></div>
      <p className="small muted">🔔 {reminderModes.find(m=>m.id===data.birthdayReminders[e.id]?.mode)?.label??'不提醒'}{data.birthdayReminders[e.id]?.mode!=='none'&&data.birthdayReminders[e.id]?` · 提前${data.birthdayReminders[e.id].daysBefore}天 ${data.birthdayReminders[e.id].time}`:''}</p><div className="line"></div><p className="small muted">下一次日期对照</p><div className="date-line"><b>阳历</b><span>{next?next.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日'):'暂无法换算'}{sf&&<em>🎉 {sf}</em>}</span></div><div className="date-line"><b>农历</b><span>{next?lunarText(next):'暂无法换算'}{lf&&<em>🎉 {lf}</em>}</span></div><Actions><button className="text-btn" onClick={()=>open(e)}>编辑</button><button className="text-btn" onClick={()=>setDel(e)}>删除</button></Actions></article>
    })}</div>}
    {editing!==undefined&&<Modal title={editing?'编辑重要日子':'添加重要日子'} onClose={()=>setEditing(undefined)}><Field label="姓名或事件名称"><input value={title} maxLength={50} onChange={e=>setTitle(e.target.value)}/></Field><div className="segmented"><button className={category==='生日'?'active':''} onClick={()=>setCategory('生日')}>生日</button><button className={category==='纪念日'?'active':''} onClick={()=>setCategory('纪念日')}>纪念日</button></div><div className="segmented"><button className={calendarType==='solar'?'active':''} onClick={()=>setCalendarType('solar')}>阳历（公历）</button><button disabled={!lunarAvailable} className={calendarType==='lunar'?'active':''} onClick={()=>setCalendarType('lunar')}>农历</button></div>
    {calendarType==='solar'?<Field label="选择阳历日期"><input type="date" min="1900-01-01" max="2100-12-31" value={solar} onChange={e=>setSolar(e.target.value)}/></Field>:<><Field label="农历年份（1900～2100）"><input type="number" min="1900" max="2100" value={lunarYear} onChange={e=>{setLunarYear(Number(e.target.value));setLunarMonth(1);setLeap(false);setLunarDay(1)}}/></Field><div className="toolbar two"><Field label="农历月份"><select value={`${lunarMonth}-${leap?1:0}`} onChange={e=>{const[m,l]=e.target.value.split('-').map(Number);setLunarMonth(m);setLeap(!!l);setLunarDay(1)}}>{months.map(m=><option key={`${m.month}-${m.leap}`} value={`${m.month}-${m.leap?1:0}`}>{lunarMonthName(m.month,m.leap)}</option>)}</select></Field><Field label="农历日期"><select value={Math.min(lunarDay,activeMonth?.lastDay??29)} onChange={e=>setLunarDay(Number(e.target.value))}>{Array.from({length:activeMonth?.lastDay??29},(_,i)=><option key={i} value={i+1}>{lunarDayName(i+1)}</option>)}</select></Field></div><Note>闰月在该年份不存在时，下一次生日按照普通同名月份计算；三十日遇小月按二十九日。农历换算依赖浏览器的中文历法支持。</Note></>}
    {preview&&<p className="notice">日期对照：阳历 {preview} · 农历 {lunarText(preview)}</p>}<Field label="提醒方式"><select value={reminderMode} onChange={e=>setReminderMode(e.target.value as ReminderMode)}>{reminderModes.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>{reminderMode!=='none'&&<><Field label="提前几天提醒"><input type="number" min="0" max="365" value={reminderDays} onChange={e=>setReminderDays(e.target.value)}/></Field><Field label="提醒时间"><TimeSelect value={reminderTime} onChange={setReminderTime}/></Field></>}
    <Actions><button className="btn ghost" onClick={()=>setEditing(undefined)}>取消</button><button className="btn primary" onClick={save}>保存</button></Actions></Modal>}
    {del&&<ConfirmDelete title={`确定删除“${del.title}”这条重要日子吗？`} onCancel={()=>setDel(null)} onConfirm={()=>{setData(d=>({...d,importantDays:d.importantDays.filter(x=>x.id!==del.id)}));setDel(null)}}/>}
  </main>;
}
