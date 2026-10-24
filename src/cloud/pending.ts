import {FamilyError} from './familyErrors.ts';
import {obj} from './familyProtocol.ts';
import type {Json,PendingStore} from './familyTypes.ts';
// 独立新命名空间；不升级、清空或遍历任何原有个人数据库。只保存明确提交的待核对请求，不自动重放。
export function browserPendingStore():PendingStore{
 let opening:Promise<IDBDatabase>|undefined;
 const db=()=>opening??=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('jiashitong_family_pending_v31',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('items'))request.result.createObjectStore('items');};
  request.onerror=()=>reject(new FamilyError('STORAGE','PENDING_OPEN'));request.onblocked=()=>reject(new FamilyError('STORAGE','PENDING_OPEN'));
  request.onsuccess=()=>{const result=request.result;result.onversionchange=()=>{result.close();opening=undefined;};resolve(result);};
 }).catch(error=>{opening=undefined;throw error;});
 async function readItem(key:string):Promise<unknown>{const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('items','readonly'),r=tx.objectStore('items').get(key);let value:unknown;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(new FamilyError('STORAGE','PENDING_READ'));});}
 async function putItem(key:string,value:unknown,remove=false){const database=await db();return new Promise<void>((resolve,reject)=>{const tx=database.transaction('items','readwrite');if(remove)tx.objectStore('items').delete(key);else tx.objectStore('items').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new FamilyError('STORAGE','PENDING_WRITE'));});}
 async function lock<T>(key:string,task:()=>Promise<T>):Promise<T>{if(!navigator.locks)throw new FamilyError('STORAGE','PENDING_LOCK','当前浏览器不支持安全的跨页写入锁，家庭只读功能可用，请使用较新的Safari或Chrome。');return navigator.locks.request(`jiashitong:family:${key}`,task);}
 async function key():Promise<CryptoKey>{return lock('encryption-key',async()=>{const saved=await readItem('encryption-key');if(saved!==undefined){if(!(saved instanceof CryptoKey))throw new FamilyError('STORAGE','PENDING_KEY');return saved;}const generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await putItem('encryption-key',generated);return generated;});}
 return{lock,
  async read(slot){try{const value=await readItem(slot);if(value===undefined)return null;if(!obj(value)||!(value.iv instanceof Uint8Array)||!(value.cipher instanceof ArrayBuffer))throw Error();const saved=await readItem('encryption-key');if(!(saved instanceof CryptoKey))throw Error();const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:value.iv as Uint8Array<ArrayBuffer>,additionalData:new TextEncoder().encode(slot)},saved,value.cipher);const decoded:unknown=JSON.parse(new TextDecoder().decode(data));if(!obj(decoded))throw Error();return decoded;}catch{throw new FamilyError('STORAGE','PENDING_READ');}},
  async write(slot,value:Json){try{const secret=await key(),iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(slot)},secret,new TextEncoder().encode(JSON.stringify(value)));await putItem(slot,{iv,cipher});}catch{throw new FamilyError('STORAGE','PENDING_WRITE');}},
  async ack(slot){await putItem(slot,undefined,true);}, // 仅删除本功能中已核对成功的请求回执，不碰个人资料。
 };
}
