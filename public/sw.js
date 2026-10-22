// 正式部署启用：导航与资源采用网络优先；无网络时回退至已缓存的页面。
// 离线只是尽力提供，不能代替用户手动导出的 JSON 数据备份。
const CACHE = 'jiashitong-pwa-shell-0.1';
const SHELL = ['./','./index.html','./manifest.webmanifest','./icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('jiashitong-pwa-shell-') && k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
  e.respondWith(fetch(r).then(response=>{
    if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(r,copy)));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(r);if(cached)return cached;
    if(r.mode==='navigate'){const shell=await caches.match('./index.html');if(shell)return shell;}
    return Response.error();
  }));
});
