import {useCallback,useEffect,useRef,useState} from 'react';
import {accessLost,familyMessage} from '../../cloud/familyErrors';
import {isAborted} from '../../cloud/errors';
export function useFamilyTask(onDenied:(message:string)=>void){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const working=useRef(false),scope=useRef(new AbortController()),active=useRef(true),denied=useRef(onDenied);
 useEffect(()=>{denied.current=onDenied;},[onDenied]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;scope.current.abort();working.current=false;};},[]);
 const run=useCallback(async(task:(signal:AbortSignal)=>Promise<void>)=>{
  if(working.current)return false;working.current=true;scope.current.abort();const controller=new AbortController();scope.current=controller;setBusy(true);setError('');
  try{await task(controller.signal);return active.current&&!controller.signal.aborted;}
  catch(e){if(controller.signal.aborted||!active.current||isAborted(e))return false;const message=familyMessage(e);setError(message);if(accessLost(e))denied.current(message);return false;}
  finally{if(active.current&&scope.current===controller){working.current=false;setBusy(false);}}
 },[]);
 return{busy,error,setError,run};
}
export function useForegroundRefresh(refresh:()=>void,enabled:boolean){
 const latest=useRef({refresh,enabled});useEffect(()=>{latest.current={refresh,enabled};},[refresh,enabled]);
 useEffect(()=>{let timer:number|undefined;const wake=()=>{if(document.visibilityState!=='visible')return;clearTimeout(timer);timer=window.setTimeout(()=>{if(latest.current.enabled)latest.current.refresh();},250);};document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);window.addEventListener('online',wake);const poll=window.setInterval(wake,60000);return()=>{clearInterval(poll);window.removeEventListener('online',wake);clearTimeout(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);};},[]);
}
export function useFamilyScale(module:string){
 const key='jiashitong_family_scale_v31_'+module;
 const [scale,setScale]=useState(()=>{try{const raw=localStorage.getItem(key),n=raw===null?120:Number(raw);return Number.isInteger(n)&&n>=80&&n<=180?n:120;}catch{return 120;}}),[error,setError]=useState('');
 const change=(n:number)=>{const next=Math.min(180,Math.max(80,Math.round(n/10)*10));setScale(next);try{localStorage.setItem(key,String(next));setError('');}catch{setError('本机缩放偏好未能保存，个人资料未修改。');}};
 return{scale,change,error};
}
