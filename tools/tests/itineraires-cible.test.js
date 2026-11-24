// Test Playwright : le tracé s'approche de la distance / durée choisie (plafond strict, écart ≤ 1 km ou ≤ 30 min) pour A→B et boucles. iPhone 13
// usage : node tools/tests/itineraires-cible.test.js [région]   (défaut : gdv)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'gdv';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{
  const g=await ITIN.loadGraph(),$=i=>document.getElementById(i),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>200&&r>200&&c<meta.cols-200&&r<meta.rows-200};
  const starts=[];for(let q=0;q<4000&&starts.length<4;q++){const i=Math.floor(rnd()*g.SX.length);if(inW(i)&&g.cls[g.SE[i]]>=4&&starts.every(j=>Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j])>2500))starts.push(i)}
  const common=()=>{$('it-max').value=2;$('it-dv').value='0';$('it-env').value=1;$('it-dur').value=2;ITIN.setTT(false);$('it-lt').max=1000;$('it-lt').step='any'};
  const o={loop:[],ab:[],over:0};
  for(const i of starts){   // boucles de 12 km et de 2 h 30 (écart en km, ou en tranches de 30 min)
   for(const [lm,lt] of [['len',12],['dur',150]]){$('it-mode').value='loop';$('it-mode').onchange();common();$('it-lm').value=lm;$('it-lt').value=lt;ITIN.setPt('A',mk(i));await ITIN.compute();
    const S=ITIN.last,cap=ITIN.capOf();if(!S)continue;const v=cap.m==='len'?S.len:S.sec;if(v>cap.lim+1e-6)o.over++;o.loop.push((cap.lim-v)/(lm==='len'?1000:1800))}}
  for(const i of starts){   // A→B avec un plafond de 1,5 × le plus court chemin
   let j=-1;for(let q=0;q<4000&&j<0;q++){const k=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[k],g.SY[i]-g.SY[k]);if(d>1500&&d<3000&&inW(k))j=k}
   if(j<0)continue;$('it-mode').value='ab';$('it-mode').onchange();common();const A=ITIN.snap(mk(i)),B=ITIN.snap(mk(j)),R=A&&B&&ITIN.route(A,B,0);if(!R)continue;
   const L0=ITIN.summarize(R).len;$('it-lm').value='len';$('it-lt').value=Math.round(L0*1.5/100)/10;ITIN.setPt('A',mk(i));ITIN.setPt('B',mk(j));await ITIN.compute();
   const S=ITIN.last,cap=ITIN.capOf();if(!S)continue;if(S.len>cap.lim+1e-6)o.over++;o.ab.push((cap.lim-S.len)/1000)}
  return o});
 console.log('  ',JSON.stringify(r));
 const near=a=>a.filter(x=>x<=1.0).length;
 ok(r.over===0,'aucun tracé ne dépasse le plafond choisi');
 ok(r.ab.length>=2&&near(r.ab)>=r.ab.length-1,'A→B : écart au plafond ≤ 1 km (au plus un hors tolérance) : '+r.ab.map(x=>x.toFixed(1)).join(' '));
 ok(r.loop.length>=6&&near(r.loop)>=r.loop.length-1,'boucles (12 km et 2 h 30) : écart ≤ 1 km / 30 min (au plus une hors tolérance) : '+r.loop.map(x=>x.toFixed(1)).join(' '));
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();process.exit(fail?1:0)})();
