import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';
import type {CourseLedger,TrainingCourse} from '../model';
import {formatUnits} from '../model';
import {courseUsed,moveById} from '../personal';

type Drag={id:string;pointer:number;startX:number;startY:number;y:number;active:boolean;timer:number;frame:number;ids:string[];left:number;width:number;height:number};
export default function SortableCourses({courses,ledger,onOpen,onReorder}:{courses:TrainingCourse[];ledger:CourseLedger[];onOpen:(id:string)=>void;onReorder:(ids:string[])=>void}){
  const list=useRef<HTMLDivElement|null>(null),session=useRef<Drag|null>(null);
  const [order,setOrder]=useState<string[]|null>(null),[ghost,setGhost]=useState<{id:string;top:number;left:number;width:number}|null>(null),[announcement,setAnnouncement]=useState('');
  useEffect(()=>()=>{const drag=session.current;if(drag){clearTimeout(drag.timer);cancelAnimationFrame(drag.frame);}},[]);
  function move(y:number){
    const drag=session.current;if(!drag?.active)return;drag.y=y;
    setGhost({id:drag.id,top:y-drag.height/2,left:drag.left,width:drag.width});
    const rows=list.current?.querySelectorAll<HTMLElement>('[data-course-id]');
    for(const row of rows??[]){const id=row.dataset.courseId!;if(id===drag.id)continue;const bounds=row.getBoundingClientRect(),from=drag.ids.indexOf(drag.id),to=drag.ids.indexOf(id);
      if(y>=bounds.top&&y<=bounds.bottom&&((to>from&&y>bounds.top+bounds.height/2)||(to<from&&y<bounds.top+bounds.height/2))){drag.ids=moveById(drag.ids.map(id=>({id})),drag.id,id).map(r=>r.id);setOrder([...drag.ids]);break;}
    }
  }
  function autoScroll(){const drag=session.current;if(!drag?.active)return;const delta=drag.y<95?-12:drag.y>window.innerHeight-95?12:0;if(delta){window.scrollBy(0,delta);move(drag.y);}drag.frame=requestAnimationFrame(autoScroll);}
  function start(e:ReactPointerEvent<HTMLButtonElement>,id:string){
    if(e.button!==0||session.current)return;
    const row=e.currentTarget.closest<HTMLElement>('[data-course-id]')!,rect=row.getBoundingClientRect();
    const drag:Drag={id,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,y:e.clientY,active:false,timer:0,frame:0,ids:courses.map(c=>c.id),left:rect.left,width:rect.width,height:rect.height};
    // 捕获指针到不会随排序移动的列表，避免iOS/Chromium在DOM换位时丢失捕获。
    session.current=drag;list.current?.setPointerCapture(e.pointerId);
    drag.timer=window.setTimeout(()=>{if(session.current!==drag)return;drag.active=true;setOrder([...drag.ids]);setAnnouncement('已拿起课程，拖动后松手保存顺序。');move(drag.y);drag.frame=requestAnimationFrame(autoScroll);},380);
  }
  function finish(cancel=false){const drag=session.current;if(!drag)return;clearTimeout(drag.timer);cancelAnimationFrame(drag.frame);session.current=null;
    if(drag.active&&!cancel&&drag.ids.some((id,i)=>id!==courses[i]?.id)){onReorder(drag.ids);setAnnouncement('课程顺序已更新，课时流水保持不变。');}else if(drag.active)setAnnouncement(cancel?'已取消排序，顺序保持不变。':'课程顺序未改变。');
    setOrder(null);setGhost(null);
  }
  const shown=order?order.map(id=>courses.find(c=>c.id===id)).filter((c):c is TrainingCourse=>!!c):courses;
  return <><p className="hint">长按右侧 ↕ 手柄拖动排序；在卡片其他位置滑动可滚动页面，也可用上下移按钮。</p><div className="stack course-sort-list" ref={list} onPointerMove={e=>{const drag=session.current;if(!drag||drag.pointer!==e.pointerId)return;if(!drag.active&&Math.hypot(e.clientY-drag.startY,e.clientX-drag.startX)>8){finish(true);return;}if(drag.active){e.preventDefault();move(e.clientY);}}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}>{shown.map((c,index)=>{const used=courseUsed(ledger,c.id);return <article className={`course-sort-row ${ghost?.id===c.id?'dragging':''}`} data-course-id={c.id} key={c.id}>
    <button className="course-overview panel" onClick={()=>{if(!ghost)onOpen(c.id);}} disabled={!!ghost}><div className="meeting-head"><h2>{c.name}</h2><b className="purple">查看 →</b></div><p>总 {formatUnits(c.purchased)} · 已用 {formatUnits(used)} · 剩余 {formatUnits(c.purchased-used)} 课时</p><progress value={Math.max(0,Math.min(used,c.purchased))} max={c.purchased}/><p className="small muted">记录 {ledger.filter(r=>r.courseId===c.id).length} 笔 · 仅按真实流水扣减</p></button>
    <div className="course-sort-tools"><button className="text-btn" disabled={index===0||!!ghost} aria-label={`${c.name}上移`} onClick={()=>onReorder(moveById(courses,c.id,courses[index-1].id).map(r=>r.id))}>↑</button><button className="text-btn" disabled={index===courses.length-1||!!ghost} aria-label={`${c.name}下移`} onClick={()=>onReorder(moveById(courses,c.id,courses[index+1].id).map(r=>r.id))}>↓</button><button className="course-drag-handle" aria-label={`长按拖动${c.name}`} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>start(e,c.id)} onPointerMove={e=>{const drag=session.current;if(!drag||drag.pointer!==e.pointerId)return;if(!drag.active&&Math.hypot(e.clientY-drag.startY,e.clientX-drag.startX)>8){finish(true);return;}if(drag.active){e.preventDefault();move(e.clientY);}}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}>↕</button></div>
  </article>;})}</div>{ghost&&<div className="course-drag-preview" style={{top:ghost.top,left:ghost.left,width:ghost.width}}><strong>{courses.find(c=>c.id===ghost.id)?.name}</strong><p>拖动排序 · 松手保存</p></div>}<p className="sr-only" role="status">{announcement}</p></>;
}
