// version fusion2011
const SHELL="cartes-shell-fusion2011",DATA="cartes-donnees";
self.addEventListener("install",e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(["./","leaflet.js","manifest.webmanifest","icon.svg"])).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("cartes-shell-")&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function fresh(u){return /\/$|\.html$|data\.json$|zone\.js$|files\.json$|sw\.js$/.test(u.pathname)}
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin!==location.origin){
    if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))e.respondWith(caches.open(DATA).then(c=>c.match(r).then(m=>m||fetch(r).then(x=>{c.put(r,x.clone());return x}))));
    return}
  const key=u.origin+u.pathname;
  if(fresh(u)){
    e.respondWith(fetch(r).then(x=>{if(x.ok){const y=x.clone();caches.open(u.pathname.endsWith("/")||u.pathname.endsWith(".html")?SHELL:DATA).then(c=>c.put(key,y))}return x})
      .catch(()=>caches.match(key).then(m=>m||caches.match(r))));return}
  e.respondWith(caches.match(key).then(m=>m||fetch(r).then(x=>{if(x.ok){const y=x.clone();caches.open(DATA).then(c=>c.put(key,y))}return x})));
});
