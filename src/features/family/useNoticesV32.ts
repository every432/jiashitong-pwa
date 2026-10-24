import {useEffect,useSyncExternalStore} from 'react';
import {createNoticeStore} from '../../cloud/noticesV32';
import {cloudBasePort} from '../../cloud/sdk';
import {cloudConfig} from '../../cloud/config';
export const noticeStore=createNoticeStore(()=>cloudBasePort(cloudConfig({publishableKey:import.meta.env.VITE_CLOUDBASE_PUBLISHABLE_KEY,keyConfirmed:import.meta.env.VITE_CLOUDBASE_PUBLIC_KEY_CONFIRMED})),()=>document.visibilityState==='visible'&&navigator.onLine);
export function useNoticesV32(){return useSyncExternalStore(noticeStore.subscribe,noticeStore.getSnapshot);}
export function useNoticeSync(){useEffect(()=>{
 let last=0;void noticeStore.start();
 const wake=()=>{if(document.visibilityState!=='visible'||!navigator.onLine||Date.now()-last<1000)return;last=Date.now();void noticeStore.refresh();};
 const timer=setInterval(wake,60000);document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);window.addEventListener('focus',wake);
 return()=>{noticeStore.stop();clearInterval(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('focus',wake);};
 },[]);}
