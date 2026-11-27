// Test Playwright des boucles par orienteering : même graine = même boucle quelle que soit la vitesse du processeur (aucun budget en secondes),
// plafond et limite de dénivelé tenus, boucle trouvée sous contraintes. iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-orienteering.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(p);
 const run=async rate=>{await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  return p.evaluate(async()=>{const g=await ITIN.loadGraph(),$=i=>document.getElementById(i);let sd=99;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;
   const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>250&&r>250&&c<meta.cols-250&&r<meta.rows-250};
   const rows=[];
   for(let q=0,n=0;q<4000&&n<4;q++){const i=Math.floor(rnd()*g.SX.length);if(!inW(i)||g.cls[g.SE[i]]<4)continue;n++;
    for(const o of [{lt:8,dv:"0"},{lt:8,dv:"both",dvm:300}]){ITIN.cancelRun();$("it-mode").value="loop";$("it-mode").onchange();$("it-max").value=4;$("it-env").value=2;$("it-dv").value=o.dv;$("it-dvm").value=o.dvm||300;$("it-lm").value="len";$("it-lt").value=o.lt;
     ITIN.setSeed(7);ITIN.setPt("A",mk(i));await ITIN.compute();const S=ITIN.last;rows.push(S?{len:Math.round(S.len),up:Math.round(S.up),dn:Math.round(S.dn),lim:o.dv==="both"?o.dvm:0,msg:$("it-msg").textContent.slice(0,60)}:{len:0,msg:$("it-msg").textContent.slice(0,80)})}}
   return rows})};
 const fast=await run(1),slow=await run(6);
 console.log(JSON.stringify(fast));
 ok(fast.length===8&&fast.filter(x=>x.len>0).length>=7,'boucles trouvées ('+fast.filter(x=>x.len>0).length+'/8)');
 ok(fast.every(x=>!x.len||x.len<=8000+1),'plafond de 8 km tenu');
 ok(fast.every(x=>!x.lim||!x.len||(x.up<=x.lim+1&&x.dn<=x.lim+1)||/dénivelé|pentue/.test(x.msg)),'limite de dénivelé tenue ou annoncée');
 ok(JSON.stringify(fast.map(x=>x.len))===JSON.stringify(slow.map(x=>x.len)),'même graine = même boucle à CPU ×1 et ×6 : '+fast.map(x=>x.len).join(' ')+' / '+slow.map(x=>x.len).join(' '));
 ok(errs.length===0,'aucune erreur JS '+errs.join('|').slice(0,300));
 await b.close();process.exit(fail?1:0)})();
