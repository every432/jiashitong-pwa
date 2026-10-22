import { useEffect, useMemo, useState } from 'react';
import type {Dispatch,SetStateAction} from 'react';
import type {AppData,CourseData,CourseMeeting,TrainingCourse,WeeklyRule} from '../model';
import { addDays,finiteBetween,formatUnits,todayISO,uid,weekdayName } from '../model';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,Note} from '../ui';

type Props={data:AppData;setData:Dispatch<SetStateAction<AppData>>;onBack:()=>void};
type Status=CourseMeeting['status'];
const colors:Record<Status,string>={planned:'待上课',done:'已上课',cancelled:'请假/取消'};
const currentMonth=()=>todayISO().slice(0,7);
const nextMonth=(month:string,offset:number)=> {const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+offset,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
const keyForRule=(r:WeeklyRule,day:string)=>`R_${r.id}_${day.replaceAll('-','')}`;
// 与安卓版相同：自动生成未来 42 天，并且能针对正在查看的未来月份扩展。
// 不回填过去月份的固定课，以免把过去没记过的课程算进历史。
function generate(data:CourseData,month:string):CourseData {
  const ids=new Set(data.meetings.map(x=>x.id));
  const today=todayISO();const target=new Set<string>();
  for(let i=0;i<=42;i++)target.add(addDays(today,i));
  const [y,m]=month.split('-').map(Number);const maxDay=new Date(y,m,0).getDate();
  for(let d=1;d<=maxDay;d++) {const day=`${month}-${String(d).padStart(2,'0')}`;if(day>=today)target.add(day);}
  const added:CourseMeeting[]=[];
  for(const day of target){const date=new Date(`${day}T12:00:00`);for(const rule of data.rules){
    if(date.getDay()!==rule.dayOfWeek||!data.courses.some(c=>c.id===rule.courseId))continue;
    const id=keyForRule(rule,day);if(ids.has(id))continue;ids.add(id);
    added.push({id,courseId:rule.courseId,startsAt:`${day}T${String(rule.hour).padStart(2,'0')}:${String(rule.minute).padStart(2,'0')}`,durationMinutes:rule.durationMinutes,consumeUnits:rule.consumeUnits,status:'planned',note:'',originRuleId:rule.id,manuallyAdjusted:false});
  }}
  return added.length ? {...data,meetings:[...data.meetings,...added]} : data;
}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><b>{value}</b><span>{label}</span></div>}
function MonthCalendar({month,meetings,selected,onMonth,onSelect}:{month:string;meetings:CourseMeeting[];selected:string;onMonth:(o:number)=>void;onSelect:(s:string)=>void}){
  const [year,m]=month.split('-').map(Number);const maxDay=new Date(year,m,0).getDate();const offset=(new Date(year,m-1,1).getDay()+6)%7;
  const rows=Math.ceil((offset+maxDay)/7)*7;const today=todayISO();
  const byDay=useMemo(()=>{const map=new Map<string,CourseMeeting[]>();for(const x of meetings){const key=x.startsAt.slice(0,10);map.set(key,[...(map.get(key)??[]),x]);}return map;},[meetings]);
  return <section className="calendar panel"><div className="calendar-top"><button onClick={()=>onMonth(-1)}>‹ 上月</button><h3>{year}年{m}月</h3><button onClick={()=>onMonth(1)}>下月 ›</button></div><button className="text-btn calendar-today" onClick={()=>{onMonth(0);onSelect(today)}}>回到今天</button><div className="calendar-grid">{['一','二','三','四','五','六','日'].map(t=><span key={t} className="weeklabel">{t}</span>)}{Array.from({length:rows},(_,i)=>{const d=i-offset+1;if(d<1||d>maxDay)return <span key={i} className="calendar-blank"/>;const day=`${month}-${String(d).padStart(2,'0')}`;const dayMeetings=byDay.get(day)??[];
    const priority:Status|undefined=dayMeetings.some(x=>x.status==='planned')?'planned':dayMeetings.some(x=>x.status==='done')?'done':dayMeetings.some(x=>x.status==='cancelled')?'cancelled':undefined;
    return <button type="button" key={i} onClick={()=>onSelect(day)} className={`day ${day===today?'today ':''}${day===selected?'chosen ':''}${priority??''}`} title={`${day} · ${dayMeetings.length} 次课程`}><span>{d}</span>{dayMeetings.length>0&&<span className="day-dot"/>}</button>})}</div><div className="legend"><span>🔵 今天</span><span>🟣 待上</span><span>🟢 已上</span><span>🟠 请假</span></div></section>;
}
function MeetingCard({m,onStatus,onEdit,onDelete}:{m:CourseMeeting;onStatus:(s:Status)=>void;onEdit:()=>void;onDelete:()=>void}){return <article className="meeting-card"><div className="meeting-head"><b>{m.startsAt.slice(0,10)} {m.startsAt.slice(11,16)}</b><span className={`status ${m.status}`}>{colors[m.status]}</span></div><p className="small">{m.durationMinutes}分钟 · 扣 {formatUnits(m.consumeUnits)} 课时 · {m.originRuleId?'固定课':'临时课'}</p>{m.note&&<p className="small muted">备注：{m.note}</p>}<div className="meeting-actions">
  {m.status!=='done'&&<button onClick={()=>onStatus('done')}>✓ 已上课</button>}{m.status==='done'&&<button onClick={()=>onStatus('planned')}>撤销勾选</button>}{m.status==='planned'&&<button onClick={()=>onStatus('cancelled')}>请假/取消</button>}{m.status==='cancelled'&&<button onClick={()=>onStatus('planned')}>恢复排课</button>}
  <button onClick={onEdit}>改时间/编辑</button>{!m.originRuleId&&<button onClick={onDelete}>删除</button>}
</div></article>}
export default function Courses({data,setData,onBack}:Props){
  const [selectedId,setSelectedId]=useState<string|null>(null),[month,setMonth]=useState(currentMonth()),[day,setDay]=useState(todayISO()),[expanded,setExpanded]=useState(false);
  const [courseEditing,setCourseEditing]=useState<TrainingCourse|null|undefined>(undefined),[deleteCourse,setDeleteCourse]=useState<TrainingCourse|null>(null);
  const [ruleEditing,setRuleEditing]=useState(false),[deleteRule,setDeleteRule]=useState<WeeklyRule|null>(null);
  const [meetingEditing,setMeetingEditing]=useState<CourseMeeting|null|undefined>(undefined),[deleteMeeting,setDeleteMeeting]=useState<CourseMeeting|null>(null);
  const [name,setName]=useState(''),[purchased,setPurchased]=useState('40'),[remindDays,setRemindDays]=useState('1'),[remindTime,setRemindTime]=useState('20:00'),[hourBefore,setHourBefore]=useState(false);
  const [ruleWeek,setRuleWeek]=useState(6),[ruleTime,setRuleTime]=useState('14:00'),[ruleDuration,setRuleDuration]=useState('120'),[ruleUnits,setRuleUnits]=useState('2');
  const [meetingStart,setMeetingStart]=useState(''),[meetingDuration,setMeetingDuration]=useState('60'),[meetingUnits,setMeetingUnits]=useState('1'),[meetingNote,setMeetingNote]=useState('');
  function update(change:(d:CourseData)=>CourseData,targetMonth=month){setData(d=>{const next=generate(change(d.courseData),targetMonth);return next===d.courseData?d:{...d,courseData:next};});}
  useEffect(()=>{setData(d=>{const updated=generate(d.courseData,month);return updated===d.courseData?d:{...d,courseData:updated};});},[month,setData]);
  const cd=data.courseData;const selected=cd.courses.find(c=>c.id===selectedId);
  const meetings=selected?cd.meetings.filter(x=>x.courseId===selected.id):[];
  const used=meetings.filter(x=>x.status==='done').reduce((sum,x)=>sum+x.consumeUnits,0);
  const cancelled=meetings.filter(x=>x.status==='cancelled').length;
  const soon=cd.meetings.filter(m=>m.status==='planned' && new Date(m.startsAt).getTime()>=Date.now() && new Date(m.startsAt).getTime()<Date.now()+7*86400000).length;
  const planned=meetings.filter(m=>m.status==='planned' && m.startsAt.slice(0,10)>=todayISO()).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const history=meetings.filter(m=>m.status!=='planned'||m.startsAt.slice(0,10)<todayISO()).sort((a,b)=>b.startsAt.localeCompare(a.startsAt));
  const [showAll,setShowAll]=useState(false);
  function changeMonth(offset:number){if(offset===0){setMonth(currentMonth());setDay(todayISO());return;}const next=nextMonth(month,offset);setMonth(next);setDay(`${next}-01`);}
  function openCourse(c:TrainingCourse|null){setCourseEditing(c);setName(c?.name??'');setPurchased(String(c?.purchased??40));setRemindDays(String(c?.reminderDaysBefore??1));setRemindTime(`${String(c?.reminderHour??20).padStart(2,'0')}:${String(c?.reminderMinute??0).padStart(2,'0')}`);setHourBefore(c?.hourBefore??false);}
  function saveCourse(){const p=Number(purchased),days=Number(remindDays);if(!name.trim()||!finiteBetween(p,0,100000)||!/^\d+$/.test(remindDays)||!finiteBetween(days,0,365)){alert('请填写有效培训班名称、总课时和提前天数');return;}const [hour,minute]=remindTime.split(':').map(Number);if(!finiteBetween(hour,0,23)||!finiteBetween(minute,0,59)){alert('提醒时间无效');return;}
    const c:TrainingCourse={id:courseEditing?.id??uid(),name:name.trim(),purchased:p,reminderDaysBefore:days,reminderHour:hour,reminderMinute:minute,hourBefore};update(cd=>({...cd,courses:courseEditing?cd.courses.map(x=>x.id===c.id?c:x):[...cd.courses,c]}));setCourseEditing(undefined);
  }
  function saveRule(){const duration=Number(ruleDuration),units=Number(ruleUnits),[hour,minute]=ruleTime.split(':').map(Number);if(!selected||!finiteBetween(duration,1,1440)||!Number.isInteger(duration)||!finiteBetween(units,0.01,1000)){alert('上课时长或消耗课时无效');return;}
    if(cd.rules.some(r=>r.courseId===selected.id&&r.dayOfWeek===ruleWeek&&r.hour===hour&&r.minute===minute)){alert('该固定时间已经存在');return;}
    const r:WeeklyRule={id:uid(),courseId:selected.id,dayOfWeek:ruleWeek,hour,minute,durationMinutes:duration,consumeUnits:units};update(cd=>({...cd,rules:[...cd.rules,r]}));setRuleEditing(false);
  }
  function openMeeting(m:CourseMeeting|null,preferred?:string){setMeetingEditing(m);setMeetingStart(m?.startsAt??`${preferred??todayISO()}T14:00`);setMeetingDuration(String(m?.durationMinutes??60));setMeetingUnits(String(m?.consumeUnits??1));setMeetingNote(m?.note??'');}
  function saveMeeting(){if(!selected)return;const duration=Number(meetingDuration),units=Number(meetingUnits);
    if(!meetingStart||!Number.isFinite(new Date(meetingStart).getTime())||!finiteBetween(duration,1,1440)||!Number.isInteger(duration)||!finiteBetween(units,0.01,1000)){alert('请填写有效日期、上课分钟数与消耗课时');return;}
    const m:CourseMeeting={id:meetingEditing?.id??uid(),courseId:selected.id,startsAt:meetingStart,durationMinutes:duration,consumeUnits:units,status:meetingEditing?.status??'planned',note:meetingNote.trim(),originRuleId:meetingEditing?.originRuleId??'',manuallyAdjusted:!!meetingEditing?.originRuleId};
    update(cd=>({...cd,meetings:meetingEditing?cd.meetings.map(x=>x.id===m.id?m:x):[...cd.meetings,m]}));setMeetingEditing(undefined);setDay(m.startsAt.slice(0,10));setMonth(m.startsAt.slice(0,7));
  }
  function setStatus(id:string,s:Status){update(cd=>({...cd,meetings:cd.meetings.map(m=>m.id===id?{...m,status:s}:m)}));}
  function chooseDate(date:string){setDay(date);setExpanded(true);}
  const dayMeetings=meetings.filter(m=>m.startsAt.slice(0,10)===day).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const renderMeeting=(m:CourseMeeting)=><MeetingCard key={m.id} m={m} onStatus={s=>setStatus(m.id,s)} onEdit={()=>{openMeeting(m);setExpanded(false)}} onDelete={()=>setDeleteMeeting(m)}/>;
  return <main className="page"><Header title={selected?selected.name:'辅导班课时记录'} subtitle="固定课程、临时排课与课时统计" onBack={()=>selected?setSelectedId(null):onBack()}/>
    {!selected?<><div className="metrics"><Metric label="培训班" value={`${cd.courses.length} 个`}/><Metric label="未来7天待上" value={`${soon} 次`}/></div><button className="btn primary wide" onClick={()=>openCourse(null)}>＋ 添加培训班</button>{!cd.courses.length?<Empty icon="📚" title="还没有培训班" description="先添加数学、英语等课程，再安排每周固定课或临时课。"/>:<div className="stack">{cd.courses.map(c=>{const ms=cd.meetings.filter(m=>m.courseId===c.id),consumed=ms.filter(m=>m.status==='done').reduce((a,b)=>a+b.consumeUnits,0),next=ms.filter(m=>m.status==='planned'&&m.startsAt.slice(0,10)>=todayISO()).sort((a,b)=>a.startsAt.localeCompare(b.startsAt))[0];return <button className="course-overview panel" key={c.id} onClick={()=>{setSelectedId(c.id);setMonth(currentMonth());setDay(todayISO())}}><div className="meeting-head"><h2>{c.name}</h2><span className="purple">查看 →</span></div><p>已上 {formatUnits(consumed)} / {formatUnits(c.purchased)} 课时 · 剩余 {formatUnits(c.purchased-consumed)}</p><progress max={c.purchased||1} value={Math.min(consumed,c.purchased||1)}></progress><p className="small muted">{next?`下次：${next.startsAt.slice(0,10)} ${next.startsAt.slice(11)}`:'暂无待上课安排'}</p></button>})}</div>}<Note>只有勾选“已上课”才扣课时；请假/取消不扣除。</Note></>:
    <><div className="metrics quad"><Metric label="总课时" value={formatUnits(selected.purchased)}/><Metric label="已上" value={formatUnits(used)}/><Metric label="剩余" value={formatUnits(selected.purchased-used)}/><Metric label="请假课次" value={`${cancelled} 次`}/></div>
      <div className="toolbar two"><button className="btn secondary" onClick={()=>openCourse(selected)}>编辑培训班</button><button className="btn ghost" onClick={()=>setDeleteCourse(selected)}>删除培训班</button></div>
      <div className="section-title"><h2>固定排课</h2></div><div className="stack small-gap">{cd.rules.filter(r=>r.courseId===selected.id).map(r=><div key={r.id} className="rule-row"><span>每{weekdayName[r.dayOfWeek]} {String(r.hour).padStart(2,'0')}:{String(r.minute).padStart(2,'0')} · {r.durationMinutes}分钟 · {formatUnits(r.consumeUnits)}课时</span><button className="text-btn" onClick={()=>setDeleteRule(r)}>移除</button></div>)}</div><button className="btn secondary wide" onClick={()=>{setRuleWeek(6);setRuleTime('14:00');setRuleDuration('120');setRuleUnits('2');setRuleEditing(true)}}>＋ 新增每周固定时间</button>
      <div className="section-title"><h2>上课记录</h2><button className="text-btn" onClick={()=>setExpanded(true)}>⛶ 放大日历</button></div><button className="btn primary wide" onClick={()=>openMeeting(null)}>＋ 临时排课 / 补录课时</button>
      <p className="small muted">待上课程：{planned.length} 次</p><MonthCalendar month={month} meetings={meetings} selected={day} onMonth={changeMonth} onSelect={chooseDate}/><Note>蓝色：今天；紫色：待上；绿色：已上；橙色：请假/取消。点击日期查看当天课程。</Note>
      <h2 className="section-title">历史 / 已处理（{history.length}）</h2>{history.length===0?<p className="muted small">还没有历史记录</p>:<div className="stack small-gap">{(showAll?history:history.slice(0,12)).map(renderMeeting)}{history.length>12&&<button className="text-btn" onClick={()=>setShowAll(!showAll)}>{showAll?'收起记录':'显示全部记录'}</button>}</div>}
      <Note>iOS PWA 系统后台通知暂未实现；提前提醒天数等设置目前仅保存，不能在关闭页面后主动推送。</Note>
    </>}
    {expanded&&selected&&<Modal title={`${selected.name} · 日历`} onClose={()=>setExpanded(false)}><MonthCalendar month={month} meetings={meetings} selected={day} onMonth={changeMonth} onSelect={setDay}/><h3>{day} · {dayMeetings.length} 次课程</h3><button className="btn primary wide" onClick={()=>{openMeeting(null,day);setExpanded(false)}}>＋ 在这一天临时排课 / 补录</button>{dayMeetings.length?<div className="stack small-gap">{dayMeetings.map(renderMeeting)}</div>:<p className="muted">这一天没有课程安排。</p>}</Modal>}
    {courseEditing!==undefined&&<Modal title={courseEditing?'编辑培训班':'添加培训班'} onClose={()=>setCourseEditing(undefined)}><Field label="培训班名称"><input value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="购买/总课时"><input type="number" min="0" max="100000" step="0.5" value={purchased} onChange={e=>setPurchased(e.target.value)}/></Field><Field label="提前提醒天数（0～365）"><input type="number" min="0" max="365" value={remindDays} onChange={e=>setRemindDays(e.target.value)}/></Field><Field label="提醒时刻"><input type="time" value={remindTime} onChange={e=>setRemindTime(e.target.value)}/></Field><label className="check-row"><input type="checkbox" checked={hourBefore} onChange={e=>setHourBefore(e.target.checked)}/> 上课前1小时再提醒一次（待接入推送）</label><Note>提醒配置目前仅保存，不会在 iPhone 后台自动推送。</Note><Actions><button className="btn ghost" onClick={()=>setCourseEditing(undefined)}>取消</button><button className="btn primary" onClick={saveCourse}>保存</button></Actions></Modal>}
    {deleteCourse&&<ConfirmDelete title={`删除“${deleteCourse.name}”后，该课程的固定课、历史课次和课时数据都将删除。`} onCancel={()=>setDeleteCourse(null)} onConfirm={()=>{const id=deleteCourse.id;update(cd=>({courses:cd.courses.filter(x=>x.id!==id),rules:cd.rules.filter(x=>x.courseId!==id),meetings:cd.meetings.filter(x=>x.courseId!==id)}));setSelectedId(null);setDeleteCourse(null)}}/>}
    {ruleEditing&&<Modal title="添加固定上课时间" onClose={()=>setRuleEditing(false)}><Field label="每周星期"><select value={ruleWeek} onChange={e=>setRuleWeek(Number(e.target.value))}>{weekdayName.map((w,i)=><option key={w} value={i}>{w}</option>)}</select></Field><Field label="上课时刻"><input type="time" value={ruleTime} onChange={e=>setRuleTime(e.target.value)}/></Field><Field label="每次时长（分钟）"><input type="number" min="1" max="1440" value={ruleDuration} onChange={e=>setRuleDuration(e.target.value)}/></Field><Field label="每次消耗课时"><input type="number" min="0.01" max="1000" step="0.5" value={ruleUnits} onChange={e=>setRuleUnits(e.target.value)}/></Field><Actions><button className="btn ghost" onClick={()=>setRuleEditing(false)}>取消</button><button className="btn primary" onClick={saveRule}>添加</button></Actions></Modal>}
    {deleteRule&&<ConfirmDelete title="移除固定课后，未处理、未手动调整的未来排课会移除；已上课或已请假的历史记录会保留。" onCancel={()=>setDeleteRule(null)} onConfirm={()=>{const id=deleteRule.id;const today=todayISO();update(cd=>({...cd,rules:cd.rules.filter(r=>r.id!==id),meetings:cd.meetings.filter(m=>!(m.originRuleId===id && m.status==='planned' && !m.manuallyAdjusted && m.startsAt.slice(0,10)>=today))}));setDeleteRule(null)}}/>}
    {meetingEditing!==undefined&&<Modal title={meetingEditing?'调整本次课程':'临时排课 / 补录'} onClose={()=>setMeetingEditing(undefined)}><Field label="日期与上课时间"><input type="datetime-local" value={meetingStart} onChange={e=>setMeetingStart(e.target.value)}/></Field><Field label="本次时长（分钟）"><input type="number" min="1" max="1440" value={meetingDuration} onChange={e=>setMeetingDuration(e.target.value)}/></Field><Field label="本次消耗课时"><input type="number" min="0.01" max="1000" step="0.5" value={meetingUnits} onChange={e=>setMeetingUnits(e.target.value)}/></Field><Field label="备注"><textarea rows={3} value={meetingNote} onChange={e=>setMeetingNote(e.target.value)}/></Field><Note>修改固定课程只影响当前这一节，不改变后续每周的固定课表。</Note><Actions><button className="btn ghost" onClick={()=>setMeetingEditing(undefined)}>取消</button><button className="btn primary" onClick={saveMeeting}>保存</button></Actions></Modal>}
    {deleteMeeting&&<ConfirmDelete title="删除这节临时课？" onCancel={()=>setDeleteMeeting(null)} onConfirm={()=>{const id=deleteMeeting.id;update(cd=>({...cd,meetings:cd.meetings.filter(m=>m.id!==id)}));setDeleteMeeting(null)}}/>}
  </main>;
}
