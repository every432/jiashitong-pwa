import {useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import type {Expense} from '../model';
import {todayISO,uid} from '../model';
import {downloadText} from '../data';
import {expenseCategories,expenseCents,expensesCsv,filterExpenses,money,sumCents,validDate} from '../personal';
import type {Props} from '../featureTypes';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,Note,ScaleControl} from '../ui';

export default function Expenses({data,setData,onBack,onPersist}:Props&{onPersist:(action:(data:Props['data'])=>Props['data'])=>Promise<boolean>}){
  const savingRef=useRef(false),attemptId=useRef<string|null>(null);const [saving,setSaving]=useState(false),[all,setAll]=useState(false);
  const [period,setPeriod]=useState(()=>todayISO().slice(0,7)),[yearly,setYearly]=useState(false),[category,setCategory]=useState('全部类别');
  const [detail,setDetail]=useState<string|null>(null),[manage,setManage]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [editor,setEditor]=useState<Expense|null|undefined>(),[deleting,setDeleting]=useState<Expense|null>(null);
  const [amount,setAmount]=useState(''),[date,setDate]=useState(todayISO),[kind,setKind]=useState<string>(expenseCategories[0]),[note,setNote]=useState(''),[error,setError]=useState('');
  const filtered=filterExpenses(data.expenses,period,category),shown=detail?filtered.filter(r=>r.category===detail):filtered;
  const total=sumCents(filtered),selectedRow=shown.find(r=>r.id===selected);
  const validPeriod=yearly?/^\d{4}$/.test(period):/^\d{4}-(0[1-9]|1[0-2])$/.test(period);
  function back(){if(detail){setDetail(null);setSelected(null);}else if(manage){setManage(false);setSelected(null);}else onBack();}
  function open(row:Expense|null){attemptId.current=row?.id??uid();setEditor(row);setAmount(row?money(row.cents):'');setDate(row?.date??todayISO());setKind(row?.category??detail??expenseCategories[0]);setNote(row?.note??'');setError('');}
  async function save(again=false){
    if(savingRef.current)return;
    const cents=expenseCents(amount);if(cents===null||!validDate(date)){setError('请输入有效日期和正金额，最多两位小数，单笔不超过十亿元。');return;}
    savingRef.current=true;setSaving(true);setError('');
    const row:Expense={...(editor??{}),id:attemptId.current??(attemptId.current=uid()),cents,date,category:kind,note};
    try{
      const ok=await onPersist(d=>({...d,expenses:d.expenses.some(x=>x.id===row.id)?d.expenses.map(x=>x.id===row.id?row:x):[...d.expenses,row]}));
      if(!ok){setError('尚未安全保存。请保留此页并处理顶部存储提示；再次保存会使用同一记录编号，不重复记账。');return;}
      setSelected(null);if(again&&!editor){attemptId.current=uid();setAmount('');setNote('');}else setEditor(undefined);
    }catch{setError('保存未确认，输入已保留，请勿重复新增。');}finally{savingRef.current=false;setSaving(false);}
  }
  const scale={'--card-scale':data.expenseScale/100} as CSSProperties;
  return <main className="page"><Header title={detail??'家庭开支统计'} subtitle="本机个人开支 · 分类统计与明细" onBack={back}/>
    <div className="toolbar two"><Field label="统计方式"><select value={yearly?'year':'month'} onChange={e=>{const next=e.target.value==='year';setYearly(next);setPeriod(next?period.slice(0,4):`${period.slice(0,4)}-${todayISO().slice(5,7)}`);setSelected(null);}}><option value="month">按月</option><option value="year">按年</option></select></Field><Field label="筛选类别"><select value={category} onChange={e=>{setCategory(e.target.value);setDetail(null);setSelected(null);}}>{['全部类别',...expenseCategories].map(v=><option key={v}>{v}</option>)}</select></Field></div>
    <Field label={yearly?'年份（如 2026）':'月份'}><input type={yearly?'text':'month'} inputMode={yearly?'numeric':undefined} value={period} onChange={e=>{setPeriod(e.target.value);setSelected(null);}}/></Field>
    {!validPeriod&&<p className="notice" role="alert">请填写{yearly?'四位年份':'有效月份'}。</p>}
    <section className="metrics"><div className="metric"><b>¥{money(total)}</b><span>所选期间总开支</span></div><div className="metric"><b>{filtered.length}</b><span>所选期间笔数</span></div></section>
    <button className="btn primary wide" onClick={()=>open(null)}>＋记一笔开支</button>
    <button className="btn secondary wide" onClick={()=>{setManage(!manage);setSelected(null);}}>{manage?'完成管理':'管理编辑'}</button>
    {manage&&<section className="management-bar" aria-label="开支统一管理"><Note>点击明细选中，再使用统一操作。</Note><Actions><button className="btn primary" onClick={()=>open(null)}>添加开支</button><button className="btn secondary" disabled={!selectedRow} onClick={()=>open(selectedRow!)}>编辑选中</button><button className="btn ghost" disabled={!selectedRow} onClick={()=>setDeleting(selectedRow!)}>删除选中</button></Actions></section>}
    <ScaleControl value={data.expenseScale} onChange={n=>setData(d=>({...d,expenseScale:n}))}/>
    <button className="btn ghost wide" disabled={!validPeriod} onClick={()=>downloadText(expensesCsv(shown),`家庭开支-${period}${detail?`-${detail}`:''}.csv`,'text/csv;charset=utf-8')}>导出当前筛选 CSV</button>
    {!detail&&!manage?<div className="category-grid" style={scale}>{expenseCategories.filter(c=>category==='全部类别'||c===category).map(cat=>{const i=expenseCategories.indexOf(cat);
      const rows=filtered.filter(r=>r.category===cat),sum=sumCents(rows);
      return <button key={cat} className={`category-tile tone-${i}`} onClick={()=>{setDetail(cat);setSelected(null);}}><strong>{cat}</strong><span>¥{money(sum)} · {rows.length} 笔</span><small>占比 {total===0?'0.0':(sum/total*100).toFixed(1)}% · 点击查看明细</small></button>;
    })}</div>:<><h2 className="section-title">{detail??'全部类别明细'} · ¥{money(sumCents(shown))} · {shown.length} 笔</h2>{!shown.length?<Empty icon="¥" title="暂无开支记录" description="点击记一笔开支添加记录。"/>:<div className="stack" style={scale}>{shown.map(r=><article key={r.id} className={`panel expense-row ${selected===r.id?'is-selected':''}`}>
      {manage?<button className="record-select" aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)}><strong>{r.date} · {r.category}</strong><span>¥{money(r.cents)}</span>{r.note&&<small className="preserve">{r.note}</small>}</button>:<><h3>{r.date} · {r.category}</h3><b>¥{money(r.cents)}</b>{r.note&&<p className="preserve">{r.note}</p>}</>}
    </article>)}</div>}</>}
    {!detail&&!manage&&<section><h2>{all?'全部记录':'最近开支'} · 当前筛选</h2><button className="btn secondary" onClick={()=>setAll(!all)}>{all?'只看最近5笔':'查看全部记录'}</button>{(all?shown:shown.slice(0,5)).map(r=><article className="panel" key={r.id}><b>{r.date} · {r.category} · ¥{money(r.cents)}</b><p className="preserve">{r.note}</p></article>)}{!shown.length&&<p>当前筛选暂无开支，点击“记一笔开支”开始。</p>}</section>}
    <Note>个人开支独立保存在本机，不会上传到家庭共享账本。</Note>
    {editor!==undefined&&<Modal title={editor?'编辑开支':'添加开支'} onClose={()=>{if(!saving)setEditor(undefined);}}><Field label="金额（元）"><input autoFocus inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></Field><Field label="日期"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="开支类别"><select value={kind} onChange={e=>setKind(e.target.value)}>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="备注（选填）"><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}/></Field>{error&&<p role="alert" className="notice">{error}</p>}<Actions><button className="btn ghost" disabled={saving} onClick={()=>setEditor(undefined)}>取消</button>{!editor&&<button className="btn secondary" disabled={saving} onClick={()=>void save(true)}>保存并再记一笔</button>}<button className="btn primary" disabled={saving} onClick={()=>void save(false)}>{saving?'正在保存…':'保存并返回'}</button></Actions></Modal>}
    {deleting&&<ConfirmDelete title={`删除 ${deleting.date} 的 ${money(deleting.cents)} 元开支？`} onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(d=>({...d,expenses:d.expenses.filter(r=>r.id!==deleting.id)}));setDeleting(null);setSelected(null);}}/>}
  </main>;
}
