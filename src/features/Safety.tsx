import {useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import type {FullAppData} from '../model';
import {normalizePhone,validDial} from '../model';
import {Field,Header,Note} from '../ui';
const presets=['我一切平安，请放心！','我已平安到达，请放心！','事情已办妥，请放心！'];
export default function Safety({data,setData,onBack}:{data:FullAppData;setData:Dispatch<SetStateAction<FullAppData>>;onBack:()=>void}){
  const [name,setName]=useState(data.safety.name),[phone,setPhone]=useState(data.safety.phone),[message,setMessage]=useState(data.safety.message),[info,setInfo]=useState('');
  const unchanged=name===data.safety.name&&phone===data.safety.phone&&message===data.safety.message;
  const ready=unchanged && !!data.safety.name&&!!data.safety.phone&&!!data.safety.message;
  function save(){const p=normalizePhone(phone);if(!name.trim()){alert('请填写接收人');return;}if(!validDial(p)||p.replace(/\D/g,'').length<6){alert('请输入6～15位有效手机号码');return;}if(!message.trim()){alert('消息内容不能为空');return;}setData(d=>({...d,safety:{...d.safety,name:name.trim(),phone:p,message:message.trim()}}));setName(name.trim());setPhone(p);setMessage(message.trim());setInfo('设置已更新，保存结果请看页面顶部');}
  async function share(){if(!ready)return;try{if(navigator.share){await navigator.share({text:data.safety.message});return;}await navigator.clipboard.writeText(data.safety.message);setInfo('已复制消息，可以粘贴到微信等应用');}catch(e){if((e as Error).name!=='AbortError')setInfo('无法唤起分享，请尝试复制消息');}}
  async function copy(){try{await navigator.clipboard.writeText(data.safety.message);setInfo('消息已复制');}catch{setInfo('复制失败，请手动选择文字复制');}}
  function sms(){if(!ready)return;const p=data.safety.phone,body=encodeURIComponent(data.safety.message);const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent);window.location.href=`sms:${p}${ios?'&':'?'}body=${body}`;}
  return <main className="page" data-update-draft={!unchanged?'true':undefined}><Header title="一键报平安" subtitle="编辑一次联系人与消息，之后快速生成短信" onBack={onBack}/>
  <section className="panel"><h2>📨 报平安设置</h2><Field label="接收人姓名"><input value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="接收人手机号码"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)}/></Field><strong className="field-title">常用报平安消息（点击选用）</strong><div className="stack small-gap">{presets.map((p,i)=><button className={`message-option ${message===p?'selected':''}`} onClick={()=>setMessage(p)} key={p}>{i+1}. {p}</button>)}</div><Field label="报平安消息（可以自行编辑）"><textarea rows={3} value={message} onChange={e=>setMessage(e.target.value)}/></Field><Note>修改后请点击“保存设置”才能用于快速发送。</Note><button className="btn secondary wide" onClick={save}>保存设置</button></section>
  <section className="panel"><h2>快速报平安</h2><p className="muted">{data.safety.name?`接收人：${data.safety.name} · ${data.safety.phone}`:'请先设置接收人'}</p><div className="message-preview">{ready?`消息预览：${data.safety.message}`:'保存上面的设置后，就可以使用以下按钮。'}</div><button className="btn green wide" disabled={!ready} onClick={sms}>打开短信，准备发送</button><button className="btn secondary wide" disabled={!ready} onClick={share}>分享消息（微信等）</button><button className="btn ghost wide" disabled={!ready} onClick={copy}>复制消息</button><Note>不会自动发送短信；请在短信应用中确认。分享时还需要自行选择收件人。</Note></section>
  {!!info&&<p role="status" className="notice success">{info}</p>}
  </main>;
}
