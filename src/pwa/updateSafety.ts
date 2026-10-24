// 只保存阻断原因；不保存输入正文、UID、凭据或家庭数据。
const checks=new Map<symbol,()=>string|null>();
export function registerUpdateCheck(check:()=>string|null){const key=Symbol();checks.set(key,check);return()=>{checks.delete(key);};}
export function holdUpdate(reason:string){return registerUpdateCheck(()=>reason);}
export function updateBlockers(){return [...new Set([...checks.values()].map(check=>{try{return check();}catch{return '无法核对保存状态';}}).filter((v):v is string=>!!v))];}
/** 只读检查已有待确认仓库，不打开/创建未知数据库，不解密或输出家庭内容。 */
export async function hasUnresolvedFamilyOperations(db:IDBFactory=indexedDB):Promise<boolean>{
 if(typeof db.databases!=='function')throw Error('当前浏览器不能核对待确认存储，请关闭全部家事通页面后重新打开');
 const databases=await db.databases();if(!databases.some(item=>item.name==='jiashitong_family_pending_v31'))return false;
 return new Promise((resolve,reject)=>{
  const request=db.open('jiashitong_family_pending_v31');
  // 如果被其他页面同时删除，阻止意外创建新仓库。
  request.onupgradeneeded=()=>request.transaction?.abort();request.onerror=()=>reject(Error('待确认存储无法读取'));
  request.onblocked=()=>reject(Error('待确认存储正在使用'));
  request.onsuccess=()=>{const database=request.result;try{
   const tx=database.transaction('items','readonly'),keys=tx.objectStore('items').getAllKeys();
   keys.onerror=()=>reject(Error('待确认状态无法读取'));tx.onabort=tx.onerror=()=>{database.close();reject(Error('待确认状态无法读取'));};
   tx.oncomplete=()=>{database.close();resolve(keys.result.some(key=>key!=='encryption-key'));};
  }catch{database.close();reject(Error('待确认存储结构无法核对'));}};
 });
}
export async function safeToUpdate(document:Document,pending=hasUnresolvedFamilyOperations){
 const check=()=>{const reasons=updateBlockers();if(document.querySelector('[role="dialog"],[data-update-draft="true"],.course-drag-preview'))reasons.push('请先保存或关闭正在编辑的页面');if([...document.querySelectorAll<HTMLInputElement>('form input:not([type="search"]):not([type="submit"])')].some(input=>!!input.value))reasons.push('账号或业务表单中仍有输入');return reasons;};
 let reasons=check();if(reasons.length)return reasons;
 try{if(await pending())reasons.push('有待核对云操作或冲突草稿，请先在原账号家庭中处理');}catch{reasons.push('无法核对待确认存储，请保留资料并稍后更新');}
 reasons=[...reasons,...check()];return [...new Set(reasons)];
}
