import {useRef,useState} from 'react';
import type {Website} from '../model';
import {uid} from '../model';
import {sortedWebsites,validWebUrl,websiteCategories} from '../personal';
import type {Props} from '../featureTypes';
import {Actions,ConfirmDelete,Empty,Field,Header,Modal,Note} from '../ui';

export default function Websites({data,setData,onBack}:Props){
  const [root,setRoot]=useState(''),[branch,setBranch]=useState(''),[query,setQuery]=useState(''),[manage,setManage]=useState(false),[selected,setSelected]=useState<string|null>(null);
  const [editor,setEditor]=useState<Website|null|undefined>(),[deleting,setDeleting]=useState<Website|null>(null),[copying,setCopying]=useState<Website|null>(null),[notice,setNotice]=useState('');
  const [name,setName]=useState(''),[category,setCategory]=useState<string>('生活/家庭写作'),[url,setUrl]=useState(''),[note,setNote]=useState(''),[error,setError]=useState('');
  const copyInput=useRef<HTMLInputElement|null>(null);
  const categories=[...new Set([...websiteCategories,...data.websites.map(w=>w.category)])],roots=[...new Set(['工作','生活','学习',...categories.map(c=>c.split('/')[0])])];
  const row=data.websites.find(w=>w.id===selected),search=query.trim().toLowerCase();
  const shown=sortedWebsites(data.websites.filter(w=>search?w.name.toLowerCase().includes(search):w.category===branch));
  function back(){setSelected(null);if(query)setQuery('');else if(branch)setBranch('');else if(root)setRoot('');else if(manage)setManage(false);else onBack();}
  function open(w:Website|null){setEditor(w);setName(w?.name??'');setCategory(w?.category??branch??'生活/家庭写作');if(!w&&!branch)setCategory('生活/家庭写作');setUrl(w?.url??'');setNote(w?.note??'');setError('');}
  function save(){if(!name.trim()||!validWebUrl(url.trim())){setError('请填写名称与有效 HTTP/HTTPS 网址，网址中不能包含账号密码。');return;}
    const next:Website={...(editor??{}),id:editor?.id??uid(),name:name.trim(),category,url:url.trim(),note};
    setData(d=>({...d,websites:editor?d.websites.map(w=>w.id===next.id?next:w):[...d.websites,next]}));setEditor(undefined);setSelected(null);
  }
  function toggle(key:'pinned'|'favorite'){if(!row)return;setData(d=>({...d,websites:d.websites.map(w=>w.id===row.id?{...w,[key]:!w[key]}:w)}));}
  async function copy(w:Website){try{await navigator.clipboard.writeText(w.url);setNotice(`已复制：${w.name}`);}catch{setCopying(w);setNotice('自动复制不可用，请长按或选中文字复制。');}}
  return <main className="page"><Header title="常用网站" subtitle="分类导航 · 网址与说明保存在本机" onBack={back}/>
    <input className="search" aria-label="搜索网站名称（跨分类）" placeholder="搜索网站名称（跨分类）" value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}}/>
    <button className="btn secondary wide" onClick={()=>{setManage(!manage);setSelected(null);}}>{manage?'完成管理':'管理编辑'}</button>
    {manage&&<section className="management-bar" aria-label="网站统一管理"><Note>进入分类或搜索结果后，点击网站选中。</Note><Actions><button className="btn primary" onClick={()=>open(null)}>添加网站</button><button className="btn secondary" disabled={!row} onClick={()=>open(row!)}>编辑选中</button><button className="btn ghost" disabled={!row} onClick={()=>setDeleting(row!)}>删除选中</button><button className="btn secondary" disabled={!row} onClick={()=>toggle('favorite')}>{row?.favorite?'取消收藏':'收藏'}</button><button className="btn secondary" disabled={!row} onClick={()=>toggle('pinned')}>{row?.pinned?'取消置顶':'置顶'}</button></Actions></section>}
    {!search&&!root?<><div className="category-grid">{roots.map((r,i)=><button className={`category-tile tone-${i%6}`} key={r} onClick={()=>{setRoot(r);setSelected(null);}}><strong>{r}</strong><small>点击查看分类</small></button>)}</div><button className="btn ghost wide" onClick={()=>{setRoot('生活');setBranch('生活/家庭写作');}}>家庭写作快捷入口</button></>:!search&&!branch?<><h2 className="section-title">{root}</h2><div className="category-grid">{categories.filter(c=>c.startsWith(`${root}/`)).map((c,i)=><button className={`category-tile tone-${i%6}`} key={c} onClick={()=>{setBranch(c);setSelected(null);}}><strong>{c.split('/').slice(1).join('/')}</strong><small>{data.websites.filter(w=>w.category===c).length} 个网站 · 点击查看</small></button>)}</div></>:<><h2 className="section-title">{search?'搜索结果':branch}</h2>{!shown.length?<Empty icon="🌐" title="暂无网站" description="换一个关键词，或在管理模式添加网站。"/>:<div className="stack">{shown.map(w=><article key={w.id} className={`website-row ${selected===w.id?'is-selected':''}`}>
      {manage?<button className="website-main record-select" aria-pressed={selected===w.id} onClick={()=>setSelected(w.id)}><strong>{w.pinned?'↑ ':''}{w.favorite?'★ ':''}{w.name}</strong><span>{w.url}</span>{w.note&&<small className="preserve">{w.note}</small>}</button>:<a className="website-main" href={validWebUrl(w.url)?w.url:undefined} target="_blank" rel="noopener noreferrer"><strong>{w.pinned?'↑ ':''}{w.favorite?'★ ':''}{w.name}</strong><span>{w.url}</span>{w.note&&<small className="preserve">{w.note}</small>}</a>}
      <button className="text-btn copy-button" aria-label={`复制 ${w.name} 网址`} onClick={()=>void copy(w)}>复制</button>
    </article>)}</div>}</>}
    <Note>网址可离线查看；访问网页需要网络。</Note>{notice&&<p className="notice" role="status">{notice}</p>}
    {editor!==undefined&&<Modal title={editor?'编辑网站':'添加网站'} onClose={()=>setEditor(undefined)}><Field label="网站名称"><input autoFocus value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="网站分类"><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="HTTP/HTTPS 网址"><input type="url" autoCapitalize="none" autoCorrect="off" value={url} onChange={e=>setUrl(e.target.value)}/></Field><Field label="用途说明（选填）"><textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}/></Field>{error&&<p className="notice" role="alert">{error}</p>}<Actions><button className="btn ghost" onClick={()=>setEditor(undefined)}>取消</button><button className="btn primary" onClick={save}>保存网站</button></Actions></Modal>}
    {deleting&&<ConfirmDelete title={`删除“${deleting.name}”？`} onCancel={()=>setDeleting(null)} onConfirm={()=>{setData(d=>({...d,websites:d.websites.filter(w=>w.id!==deleting.id)}));setSelected(null);setDeleting(null);}}/>}
    {copying&&<Modal title="手动复制网址" onClose={()=>setCopying(null)}><p>自动复制不可用，请长按下方网址复制。</p><Field label="网址"><input ref={copyInput} readOnly value={copying.url} onFocus={e=>e.currentTarget.select()}/></Field><button className="btn secondary" onClick={()=>{copyInput.current?.focus();copyInput.current?.select();}}>选中完整网址</button></Modal>}
  </main>;
}
