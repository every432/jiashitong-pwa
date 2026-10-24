import {useEffect,useRef,useState} from 'react';
import {safeToUpdate} from './updateSafety';
export default function PwaUpdates(){
 const [registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null),[ready,setReady]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[dismissed,setDismissed]=useState(false);
 const mounted=useRef(true),initialController=useRef<ServiceWorker|null>(null),working=useRef(false);
 useEffect(()=>{
  mounted.current=true;if(!import.meta.env.PROD||!('serviceWorker'in navigator))return;
  const container=navigator.serviceWorker;initialController.current=container.controller;let disposed=false,lastCheck=0,reg:ServiceWorkerRegistration|undefined;const removals:(()=>void)[]=[];
  const offered=()=>{if(!disposed){setReady(true);setDismissed(false);}};
  const changed=()=>{if(initialController.current&&container.controller!==initialController.current)offered();};container.addEventListener('controllerchange',changed);
  const check=()=>{if(document.visibilityState==='hidden'||!reg||Date.now()-lastCheck<60000)return;lastCheck=Date.now();void reg.update().catch(()=>{});};
  const start=async()=>{try{const value=await container.register(`${import.meta.env.BASE_URL}sw.js`,{updateViaCache:'none'});if(disposed)return;reg=value;setRegistration(value);if(value.waiting)offered();
   const installing=()=>{const worker=value.installing;if(!worker)return;const state=()=>{if(worker.state==='installed'&&value.waiting)offered();};worker.addEventListener('statechange',state);removals.push(()=>worker.removeEventListener('statechange',state));};value.addEventListener('updatefound',installing);removals.push(()=>value.removeEventListener('updatefound',installing));installing();check();
  }catch{if(!disposed)setMessage('离线更新暂不可用；个人资料保持不变，联网后可重新检查。');}};
  if(document.readyState==='complete')void start();else{window.addEventListener('load',start,{once:true});removals.push(()=>window.removeEventListener('load',start));}
  document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);
  return()=>{disposed=true;mounted.current=false;container.removeEventListener('controllerchange',changed);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);removals.forEach(remove=>remove());};
 },[]);
 if(!import.meta.env.PROD||!('serviceWorker'in navigator))return null;
 async function update(){
  if(working.current)return;working.current=true;setBusy(true);setMessage('');
  try{
   const reasons=await safeToUpdate(document);if(reasons.length){setMessage(reasons.join('；'));return;}
   const waiting=registration?.waiting;
   if(waiting){
    const reply=await new Promise<string>((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error());},10000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data?.status??'UNKNOWN');};waiting.postMessage({type:'ACTIVATE_WHEN_SAFE'},[channel.port2]);});
    if(reply!=='ACTIVATING'){setMessage(reply==='MULTIPLE_WINDOWS'?'请先保存并关闭其他家事通标签页或主屏窗口，再点击更新。':'新版尚未就绪，请稍后重新检查。');return;}
    if(navigator.serviceWorker.controller!==waiting)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);reject(Error());},10000);const changed=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve();};navigator.serviceWorker.addEventListener('controllerchange',changed);if(navigator.serviceWorker.controller===waiting)changed();});
   }
   const after=await safeToUpdate(document);if(after.length){setMessage(after.join('；'));return;}
   window.location.reload();
  }catch{setMessage('更新尚未确认，没有刷新。请保留资料，联网后重试。');}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 }
 return <aside className={`pwa-updates ${ready&&!dismissed?'pwa-update-ready':''}`} aria-label="应用版本更新">
  {ready&&!dismissed&&<><strong>发现新版本</strong><p>先保存输入并核对云操作；更新会重新打开页面，不清除本机资料或账号。</p><div className="actions"><button className="btn primary" disabled={busy} onClick={()=>void update()}>安全更新并刷新</button><button className="btn ghost" disabled={busy} onClick={()=>setDismissed(true)}>稍后更新</button></div></>}
  <button className="text-btn" disabled={busy||!registration} onClick={()=>{if(ready){setDismissed(false);return;}setMessage('正在检查应用版本…');void registration?.update().then(()=>{if(mounted.current)setMessage(registration.waiting?'发现新版本，请先保存后更新。':'版本检查完成；如有新版，安装后会提示。');}).catch(()=>setMessage('网络不可用，暂不能检查更新。'));}}>检查新版本{ready?'（已有新版）':''}</button>
  {message&&<p role="status">{message}</p>}
 </aside>;
}
