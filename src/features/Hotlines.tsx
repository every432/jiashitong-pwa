import {useState} from 'react';
import type {CSSProperties} from 'react';
import type {Hotline,HotlineCategory} from '../model';
import {dial,normalizePhone,uid,validDial} from '../model';
import {hotlineCategories,sortedHotlines,validWebUrl} from '../personal';
import type {Props} from '../featureTypes';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,ScaleControl,Note} from '../ui';
export default function Hotlines({data,setData,onBack}:Props){
  const [search,setSearch]=useState(''),[category,setCategory]=useState('全部'),[manage,setManage]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [editor,setEditor]=useState<Hotline|null|undefined>(),[del,setDel]=useState<Hotline|null>(null);
  const [duty,setDuty]=useState(''),[phone,setPhone]=useState(''),[remark,setRemark]=useState(''),[url,setUrl]=useState(''),[kind,setKind]=useState<HotlineCategory>('投诉举报'),[error,setError]=useState('');
  function open(h:Hotline|null){setEditor(h);setDuty(h?.duty??'');setPhone(h?.phone??'');setRemark(h?.remark??'');setUrl(h?.url??'');setKind(h?.category??'投诉举报');setError('');}
  function save(){const number=normalizePhone(phone),website=url.trim();
    if(!duty.trim()||(!number&&!website)||(number&&!validDial(number))||(website&&!validWebUrl(website))){setError('请填写名称与有效电话或官网。号码为2～15位数字或有效国际号码；官网需为不含账号密码的HTTP/HTTPS网址。');return;}
    const item:Hotline={...(editor??{}),id:editor?.id??uid(),duty:duty.trim(),phone:number,remark:remark.trim(),url:website,category:kind};
    setData(d=>({...d,hotlines:editor?d.hotlines.map(h=>h.id===item.id?item:h):[...d.hotlines,item]}));setEditor(undefined);setSelected(null);
  }
  const filtered=sortedHotlines(data.hotlines.filter(h=>(category==='全部'||(h.category??'投诉举报')===category)&&[h.duty,h.phone,h.remark].some(x=>x.toLowerCase().includes(search.trim().toLowerCase()))));
  const chosen=filtered.find(h=>h.id===selected),scale={'--card-scale':data.hotlineScale/120} as CSSProperties;
  return <main className="page"><Header title="常用投诉举报热线" subtitle="投诉举报 · 应急求助 · 保险报案" onBack={onBack}/>
    <button className="btn secondary wide" onClick={()=>{setManage(!manage);setSelected(null);}}>{manage?'完成管理':'管理编辑'}</button>
    {manage&&<section className="management-bar" aria-label="热线统一管理"><Note>点击卡片选中，再使用统一操作。</Note><Actions><button className="btn primary" onClick={()=>open(null)}>添加热线</button><button className="btn secondary" disabled={!chosen} onClick={()=>open(chosen!)}>编辑选中</button><button className="btn ghost" disabled={!chosen} onClick={()=>setDel(chosen!)}>删除选中</button><button className="btn secondary" disabled={!chosen} onClick={()=>{if(chosen)setData(d=>({...d,hotlines:d.hotlines.map(h=>h.id===chosen.id?{...h,pinned:!h.pinned}:h)}));}}>{chosen?.pinned?'取消置顶':'置顶'}</button></Actions></section>}
    <input className="search" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}} placeholder="搜索名称、电话号码或备注" aria-label="搜索热线"/>
    <div className="filter-chips" aria-label="热线分类">{['全部',...hotlineCategories].map(v=><button className={`chip ${category===v?'active':''}`} aria-pressed={category===v} key={v} onClick={()=>{setCategory(v);setSelected(null);}}>{v}</button>)}</div>
    <ScaleControl value={data.hotlineScale} onChange={n=>setData(d=>({...d,hotlineScale:n}))}/><Note>已保存 {data.hotlines.length} 条 · 显示 {filtered.length} 条。部分热线受理方式各地不同，请以当地公告为准。保险范围请核对保单。</Note>
    {!filtered.length?<Empty icon="☎" title="没有找到热线" description="换个关键词或分类试试。"/>:<div className="hotline-grid" style={scale}>{filtered.map(h=><article className={`contact-card hotline-card ${selected===h.id?'is-selected':''}`} key={h.id}>
      {manage?<button className="record-select hotline-select" aria-pressed={selected===h.id} onClick={()=>setSelected(h.id)}><strong>{h.pinned?'↑ ':''}{h.favorite?'★ ':''}{h.duty}</strong><span className="short-num">{h.phone||'仅官网'}</span>{h.remark&&<small>{h.remark}</small>}</button>:<><h2>{h.pinned?'↑ ':''}{h.favorite?'★ ':''}{h.duty}</h2><p className="short-num">{h.phone||'仅官网'}</p>{h.remark&&<p className="muted small">{h.remark}</p>}</>}
      <div className="hotline-links"><button className="btn green wide" disabled={!validDial(h.phone)} onClick={()=>dial(h.phone)}>☎ 拨打热线</button>{h.url&&validWebUrl(h.url)&&<a className="btn secondary wide" href={h.url} target="_blank" rel="noopener noreferrer">官方网站</a>}</div>
    </article>)}</div>}
    {editor!==undefined&&<Modal title={editor?'编辑投诉举报热线':'添加投诉举报热线'} onClose={()=>setEditor(undefined)}><Field label="职能名称"><input autoFocus value={duty} onChange={e=>setDuty(e.target.value)}/></Field><Field label="电话号码"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></Field><Field label="官方网站（选填）"><input type="url" autoCapitalize="none" autoCorrect="off" value={url} onChange={e=>setUrl(e.target.value)}/></Field><Field label="热线分类"><select value={kind} onChange={e=>setKind(e.target.value as HotlineCategory)}>{hotlineCategories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="备注（选填）"><textarea value={remark} onChange={e=>setRemark(e.target.value)}/></Field>{error&&<p className="notice" role="alert">{error}</p>}<Actions><button className="btn ghost" onClick={()=>setEditor(undefined)}>取消</button><button className="btn primary" onClick={save}>保存热线</button></Actions></Modal>}
    {del&&<ConfirmDelete title={`删除“${del.duty}”？删除结果会保留，不会在下次启动时重新补回。`} onCancel={()=>setDel(null)} onConfirm={()=>{setData(d=>({...d,hotlines:d.hotlines.filter(h=>h.id!==del.id)}));setDel(null);setSelected(null);}}/>}
  </main>;
}
