import {cloneElement,isValidElement,useEffect,useId,useRef} from 'react';
import type { ReactNode } from 'react';
export function Header({title,subtitle,onBack}:{title:string;subtitle?:string;onBack:()=>void}) {
  return <header className="sub-header"><button type="button" className="text-btn" onClick={onBack}>← 返回</button><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></header>;
}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}) {
  const modal=useRef<HTMLElement|null>(null);
  const backdrop=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const sync=()=>{const style=backdrop.current?.style;if(!style)return;style.setProperty('--visual-height',`${viewport.height}px`);style.setProperty('--visual-top',`${viewport.offsetTop}px`);style.setProperty('--visual-left',`${viewport.offsetLeft}px`);style.setProperty('--visual-width',`${viewport.width}px`);};const resize=()=>{sync();requestAnimationFrame(()=>{if(modal.current?.contains(document.activeElement))(document.activeElement as HTMLElement)?.scrollIntoView({block:'nearest'});});};sync();viewport.addEventListener('resize',resize);viewport.addEventListener('scroll',sync);return()=>{viewport.removeEventListener('resize',resize);viewport.removeEventListener('scroll',sync);};},[]);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';if(!modal.current?.contains(document.activeElement))modal.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();return()=>{document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
  return <div ref={backdrop} className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation"><section ref={modal} className="modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}if(e.key==='Tab'){const nodes=modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]');if(nodes?.length){const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}}><div className="modal-head"><h2>{title}</h2><button type="button" className="close-btn" aria-label="关闭" onClick={onClose}>✕</button></div><div className="modal-body">{children}</div></section></div>;
}
export function Field({label,children}:{label:string;children:ReactNode}) {
  const id=useId(),labelId=useId();
  const native=isValidElement<{id?:string}>(children)&&typeof children.type==='string'&&['input','textarea','select'].includes(children.type);
  const controlId=native?(children.props.id??id):undefined;
  // 显式关联，避免旧textarea正文成为标签的一部分；复合时间控件单独分组。
  return <div className="field" role={native?undefined:'group'} aria-labelledby={native?undefined:labelId}>{native?<label htmlFor={controlId}>{label}</label>:<span id={labelId}>{label}</span>}{native?cloneElement(children,{id:controlId}):children}</div>;
}
export function Actions({children}:{children:ReactNode}) {return <div className="actions">{children}</div>}
export function Empty({icon,title,description}:{icon:string;title:string;description:string}) {return <div className="panel empty"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p></div>}
export function ScaleControl({value,onChange}:{value:number;onChange:(n:number)=>void}) {const id=useId();return <div className="scale-panel"><label htmlFor={id}>卡片整体大小：<b>{value}%</b></label><input id={id} type="range" min="50" max="200" step="10" value={value} onChange={e=>onChange(Number(e.target.value))}/><div className="scale-presets">{[80,120,180].map(n=><button className="chip" type="button" key={n} onClick={()=>onChange(n)}>{n}%</button>)}</div></div>}
export function ConfirmDelete({title,onCancel,onConfirm}:{title:string;onCancel:()=>void;onConfirm:()=>void}) {return <Modal title="确认删除" onClose={onCancel}><p>{title}</p><Actions><button className="btn ghost" onClick={onCancel}>取消</button><button className="btn danger" onClick={onConfirm}>确认删除</button></Actions></Modal>}
export function Note({children}:{children:ReactNode}) {return <p className="hint">{children}</p>}
/** 24 小时制小时/分钟下拉，避免依赖各品牌自带的圆盘时间选择器。 */
export function TimeSelect({value,onChange}:{value:string;onChange:(v:string)=>void}) {
  const [h='09',m='00']=value.split(':');
  return <div className="time-select"><select aria-label="小时" value={h} onChange={e=>onChange(`${e.target.value}:${m}`)}>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(v=><option key={v} value={v}>{v} 时</option>)}</select><span>:</span><select aria-label="分钟" value={m} onChange={e=>onChange(`${h}:${e.target.value}`)}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(v=><option key={v} value={v}>{v} 分</option>)}</select></div>;
}
export function PaymentSelect({value,onChange}:{value:'现金'|'微信'|'支付宝'|'其他';onChange:(x:'现金'|'微信'|'支付宝'|'其他')=>void}) {
 return <select value={value} onChange={e=>onChange(e.target.value as typeof value)}>{['现金','微信','支付宝','其他'].map(x=><option key={x} value={x}>{x}</option>)}</select>;
}
