// Test Playwright : édition du tracé par clic-glisse (souris, puis doigt via CDP) -> point de passage ajouté, étapes recalculées, carte non déplacée.
// usage : node tools/tests/itineraires-glisser.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');localStorage.setItem('champi-tour2','vu')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 await p.evaluate(()=>{const m=document.getElementById('menu-close');});
 // prépare un trajet A→B
 const pre=await p.evaluate(async()=>{
  const g=await ITIN.loadGraph(),$=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const cand=[];for(let i=0;i<g.SX.length;i+=Math.floor(g.SX.length/4000)||1)if(inW(i)&&g.cls[g.SE[i]]>=4)cand.push(i);
  const mid=cand[Math.floor(cand.length/2)],d=(i,j)=>Math.hypot((g.SX[i]-g.SX[j]),(g.SY[i]-g.SY[j]));
  const near=(k,r1,r2)=>{for(const i of cand)if(d(i,k)>r1&&d(i,k)<r2)return i;return -1};
  const A=mid,B=near(A,1500,2500);ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  $('it-go').click();for(let i=0;i<300;i++){await sleep(100);if($('it-res').innerHTML)break}await sleep(500);
  window.__mk=mk;return {len:ITIN.last.len}});
 await p.waitForTimeout(800);
 // point de départ du glisser : milieu du tracé, en pixels d'écran
 const pick=async()=>p.evaluate(()=>{const ll=ITIN.last.ll,m=ll[Math.floor(ll.length/2)],c=map.latLngToContainerPoint(m),r=map.getContainer().getBoundingClientRect();
   return {x:r.left+c.x,y:r.top+c.y,center:map.getCenter()}});
 const s1=await pick();ok(pre.len>0,'trajet A→B de base ('+Math.round(pre.len)+' m)');
 // 1) souris
 await p.mouse.move(s1.x,s1.y);await p.mouse.down();await p.mouse.move(s1.x+20,s1.y-40,{steps:4});await p.mouse.move(s1.x+40,s1.y-90,{steps:4});
 const mid=await p.evaluate(()=>!!document.querySelector('.leaflet-marker-icon div')&&document.querySelectorAll('.leaflet-marker-icon div').length);
 await p.mouse.up();await p.waitForFunction(()=>ITIN.WP.length===1,null,{timeout:60000}).catch(()=>{});await p.waitForTimeout(1500);
 const r1=await p.evaluate(()=>({wp:ITIN.WP.length,legs:document.querySelectorAll('.it-legs li').length,msg:document.getElementById('it-msg').textContent,c:map.getCenter()}));
 ok(r1.wp===1,'souris : 1 point de passage ajouté ('+r1.msg.slice(0,90)+')');
 ok(r1.legs===2,'souris : 2 étapes recalculées');
 ok(Math.abs(r1.c.lat-s1.center.lat)<1e-6&&Math.abs(r1.c.lng-s1.center.lng)<1e-6,'souris : la carte ne s\'est pas déplacée');
 // 2) doigt (CDP)
 const s2=await pick(),cdp=await ctx.newCDPSession(p);
 const tp=(t,x,y)=>cdp.send('Input.dispatchTouchEvent',{type:t,touchPoints:t==='touchEnd'?[]:[{x,y,id:1}]});
 await tp('touchStart',s2.x,s2.y);for(let i=1;i<=8;i++){await tp('touchMove',s2.x-i*6,s2.y+i*9);await p.waitForTimeout(30)}await tp('touchEnd');
 await p.waitForFunction(()=>ITIN.WP.length===2,null,{timeout:60000}).catch(()=>{});await p.waitForTimeout(1500);
 const r2=await p.evaluate(()=>({wp:ITIN.WP.length,legs:document.querySelectorAll('.it-legs li').length,c:map.getCenter()}));
 ok(r2.wp===2,'doigt : 2e point de passage ajouté');
 ok(r2.legs===3,'doigt : 3 étapes');
 ok(Math.abs(r2.c.lat-s2.center.lat)<1e-6,'doigt : la carte ne s\'est pas déplacée');
 // 3) un simple appui sur le tracé ne change rien
 const s3=await pick();await p.mouse.click(s3.x,s3.y);await p.waitForTimeout(500);
 ok(await p.evaluate(()=>ITIN.WP.length)===2,'simple clic : aucun point ajouté');
 // 4) hors tracé : la carte se déplace normalement
 const before=await p.evaluate(()=>map.getCenter());await p.mouse.move(40,200);await p.mouse.down();await p.mouse.move(120,260,{steps:5});await p.mouse.up();await p.waitForTimeout(300);
 const after=await p.evaluate(()=>map.getCenter());ok(Math.abs(after.lat-before.lat)>1e-5||Math.abs(after.lng-before.lng)>1e-5,'glisser hors tracé : la carte se déplace');
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await p.screenshot({path:'/tmp/glisser.png'});
 await b.close();console.log(fail?'ÉCHEC':'OK');process.exit(fail?1:0)})();
