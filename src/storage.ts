import type {FullAppData} from './model.ts';
import {DATA_KEY, defaultData, isAppData, parseData} from './data.ts';
import {rawChecksum} from './personal.ts';

export const MIGRATION_PREFIX='jiashitong_pwa_v31_before_';
export const PREVIOUS_KEY='jiashitong_pwa_v31_previous';
export type StoragePort=Pick<Storage,'getItem'|'setItem'>;
export type StoreSnapshot={status:'loading'|'ready'|'blocked';data:FullAppData|null;error:string;dirty:boolean;saving:boolean};
type Lock=<T>(task:()=>Promise<T>)=>Promise<T>;
const direct:Lock=task=>task();
const envelope=(raw:string)=>JSON.stringify({algorithm:'fnv1a64',checksum:rawChecksum(raw),raw});
export function readSnapshotBackup(value:string|null):string|null {
  if(value===null)return null;
  let parsed:unknown;try{parsed=JSON.parse(value);}catch{throw new Error('备份校验失败，已保留原备份');}
  if(!parsed||typeof parsed!=='object'||!('algorithm'in parsed)||parsed.algorithm!=='fnv1a64'||!('raw'in parsed)||typeof parsed.raw!=='string'||!('checksum'in parsed)||parsed.checksum!==rawChecksum(parsed.raw))throw new Error('备份校验失败，已保留原备份');
  return parsed.raw;
}

/** 所有写入集中于此；读取/渲染纯只读。失败不写默认数据，不删除任何存储。 */
export function createDataStore(getStorage:()=>StoragePort,withLock:Lock=direct) {
  let storage:StoragePort|undefined,expectedRaw:string|null=null,openedRaw:string|null=null;
  let initialized=false,conflicted=false,queue=Promise.resolve();
  let snapshot:StoreSnapshot={status:'loading',data:null,error:'',dirty:false,saving:false};
  const listeners=new Set<()=>void>();
  const publish=(patch:Partial<StoreSnapshot>)=>{snapshot={...snapshot,...patch};listeners.forEach(fn=>fn());};
  function ensureUnchanged(){if(!storage||storage.getItem(DATA_KEY)!==expectedRaw){conflicted=true;throw new Error('另一页面已修改资料。已停止写入，请先导出本页未保存资料，再重新打开页面。');}}
  function safeBackup(key:string,raw:string,immutable:boolean) {
    if(!storage)throw new Error('浏览器存储不可用');
    const existing=storage.getItem(key);
    if(existing!==null){
      // 不覆盖无法验证的旧快照；迁移原文备份永远不覆盖。
      const old=readSnapshotBackup(existing);
      if(old===raw)return;
      if(immutable)throw new Error('迁移备份与原文不一致，已停止升级并保留两者');
    }
    storage.setItem(key,envelope(raw));
    if(readSnapshotBackup(storage.getItem(key))!==raw)throw new Error('无法验证备份写入，原资料未修改');
  }
  function write(next:FullAppData,migrating=false) {
    if(!isAppData(next))throw new Error('资料校验未通过，已停止保存');
    ensureUnchanged();const text=JSON.stringify(next);
    if(text===expectedRaw)return;
    if(expectedRaw!==null)safeBackup(migrating?MIGRATION_PREFIX+rawChecksum(expectedRaw):PREVIOUS_KEY,expectedRaw,migrating);
    ensureUnchanged();storage!.setItem(DATA_KEY,text);
    // setItem按单键原子写入；异常时原主键保持不变。跨页正常写入另由Web Locks串行化。
    expectedRaw=text;
  }
  const failureText=(error:unknown)=>error instanceof Error&&error.name==='QuotaExceededError'?'浏览器空间不足，未覆盖原资料。请导出资料并释放其他文件空间后重试；不要清理家事通网站数据。':error instanceof Error?error.message:'浏览器禁止保存，原资料未修改';
  async function initialize() {
    if(initialized)return queue;initialized=true;
    queue=withLock(async()=>{
      try {
        storage=getStorage();expectedRaw=storage.getItem(DATA_KEY);openedRaw=expectedRaw;
        const data=expectedRaw===null?defaultData():parseData(expectedRaw);
        if(expectedRaw!==null&&JSON.stringify(data)!==expectedRaw)write(data,true);
        publish({status:'ready',data,error:'',dirty:false});
      }catch(error){publish({status:'blocked',error:failureText(error),saving:false});}
    }).catch(error=>publish({status:'blocked',error:failureText(error),saving:false}));
    return queue;
  }
  function enqueue(data:FullAppData) {
    queue=queue.then(()=>withLock(async()=>{
      if(conflicted)return;
      publish({saving:true});
      try{write(data);if(snapshot.data===data)publish({dirty:false,error:'',saving:false});}
      catch(error){publish({status:conflicted?'blocked':'ready',error:failureText(error),dirty:true,saving:false});}
    })).catch(error=>publish({error:failureText(error),dirty:true,saving:false}));
    return queue;
  }
  function update(action:FullAppData|((data:FullAppData)=>FullAppData)) {
    if(snapshot.status!=='ready'||!snapshot.data||conflicted)return;
    const next=typeof action==='function'?action(snapshot.data):action;
    publish({data:next,dirty:true});void enqueue(next);
  }
  return {
    initialize,update,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
    getSnapshot:()=>snapshot,
    retry:()=>snapshot.status==='ready'&&snapshot.data?enqueue(snapshot.data):Promise.resolve(),
    settled:()=>queue,
    originalRaw:()=>openedRaw,
    previousRaw:()=>storage?readSnapshotBackup(storage.getItem(PREVIOUS_KEY)):null,
    checkExternal:()=>{
      if(!initialized||!storage)return;
      try{ensureUnchanged();}catch(error){publish({status:'blocked',error:failureText(error),saving:false});}
    },
  };
}

export const browserWriteLock:Lock=task=>{
  if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request('jiashitong_pwa_v1_write',task);
  return task(); // 旧浏览器仍有写前比较与storage事件保护；不宣称原子跨标签页CAS。
};
