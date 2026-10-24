// 正式部署启用：导航与资源采用网络优先；无网络时回退至已缓存的页面。
// 离线只是尽力提供，不能代替用户手动导出的 JSON 数据备份。
// 生产构建会注入资源摘要与完整静态清单；开发源码仅用于测试。
const CACHE = 'jiashitong-pwa-shell-3.2-dev';
const SHELL = ['./','./index.html','./manifest.webmanifest','./icon-192.png'];
self.addEventListener('install', e => {
  // 更新等待用户确认；初次安装由浏览器正常激活，不强制接管旧页面。
  e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener('activate', e => {
  // 保留旧静态资源供仍打开的旧页面使用，不清理任何个人或账号存储。
  e.waitUntil(Promise.resolve());
});
self.addEventListener('message', e => {
  if(e.data?.type!=='ACTIVATE_WHEN_SAFE'||!e.source?.url)return;
  const scope=new URL('./',self.location.href),source=new URL(e.source.url);
  if(source.origin!==scope.origin||!source.pathname.startsWith(scope.pathname))return;
  e.waitUntil((async()=>{
    const pages=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(page=>{const u=new URL(page.url);return u.origin===scope.origin&&u.pathname.startsWith(scope.pathname);});
    if(pages.length!==1){e.ports?.[0]?.postMessage({status:'MULTIPLE_WINDOWS'});return;}
    await self.skipWaiting();e.ports?.[0]?.postMessage({status:'ACTIVATING'});
  })());
});
self.addEventListener('fetch', e => {
  const r=e.request;
  const url=new URL(r.url),scope=new URL('./',self.location.href);
  // 仅缓存应用壳与静态文件。认证/API即使将来改为同源代理也不能落入离线缓存。
  if(r.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.search||r.headers.has('authorization')||r.headers.has('x-cloudbase-authorization')||/no-store|private/i.test(r.headers.get('cache-control')||''))return;
  const path=url.pathname.slice(scope.pathname.length);
  const shell=path===''||path==='index.html';
  if(!shell&&!/^(?:assets\/[^/]+\.(?:js|css|woff2?)|icon-\d+\.png|manifest\.webmanifest)$/.test(path))return;
  e.respondWith(fetch(r).then(response=>{
    if(response.ok&&!/no-store|private/i.test(response.headers.get('cache-control')||'')&&!/authorization|cookie/i.test(response.headers.get('vary')||'')&&!response.headers.has('set-cookie')){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{}));}
    return response;
  }).catch(async()=>{
    // 不从旧版本的广泛缓存中找响应，旧缓存可能含有不该离线保留的路径。
    const cache=await caches.open(CACHE),cached=await cache.match(r);if(cached)return cached;
    if(!shell){for(const name of await caches.keys()){if(name!==CACHE&&name.startsWith('jiashitong-pwa-shell-')){const previous=await (await caches.open(name)).match(r);if(previous)return previous;}}}
    if(shell&&r.mode==='navigate'){const fallback=await cache.match('./index.html');if(fallback)return fallback;}
    return Response.error();
  }));
});
