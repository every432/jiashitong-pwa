export type HomeLayout={order:string[];hidden:string[]};
export function reconcileLayout(value:unknown,defaults:string[]):HomeLayout{
 const input=value as Partial<HomeLayout>|null;
 if(!input||!Array.isArray(input.order)||!Array.isArray(input.hidden)||input.order.some(x=>typeof x!=='string')||input.hidden.some(x=>typeof x!=='string'))throw Error('首页布局偏好无法读取，原文已保留；业务资料不受影响。');
 return{order:[...new Set([...input.order.filter(x=>defaults.includes(x)),...defaults])],hidden:[...new Set(input.hidden.filter(x=>defaults.includes(x)))]};
}
export function moveTile(order:string[],source:string,target:string){if(source===target||!order.includes(source)||!order.includes(target))return order;const next=order.filter(x=>x!==source);next.splice(order.indexOf(target),0,source);return next;}
export async function layoutKey(uid:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('jiashitong-d4g8m8lfcdc047ffe|'+(uid||'personal_local')));return'jiashitong_home_layout_v32_'+Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function saveLayout(storage:Pick<Storage,'getItem'|'setItem'>,key:string,raw:string|null,next:HomeLayout){if(storage.getItem(key)!==raw)throw Error('另一页面已调整首页，请重新打开首页后操作；不会覆盖新顺序。');const encoded=JSON.stringify(next);storage.setItem(key,encoded);return encoded;}
