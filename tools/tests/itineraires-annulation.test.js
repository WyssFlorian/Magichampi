// Test Playwright : calcul unique et annulable, curseurs sur « change », boucles reproductibles (graine fixe) et seuils de temps (CPU ralenti ×4).
// usage : node tools/tests/itineraires-annulation.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true;document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true});localStorage.setItem('champi-tour2','vu')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 // préparation : boucle de 8 km depuis un point du réseau (centre de la région, premier noeud d'un chemin)
 await p.evaluate(async()=>{const $=i=>document.getElementById(i);await ITIN.loadGraph();
  const cx=meta.x0+meta.cols*meta.res/2,cy=meta.y1-meta.rows*meta.res/2,ll=L.Projection.SphericalMercator.unproject(L.point(cx,cy));ITIN.setPt('A',L.latLng(ll.lat,ll.lng));
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));$('it-lm').value='len';$('it-lm').dispatchEvent(new Event('change'));$('it-lt').value=8;$('it-lt').dispatchEvent(new Event('input'))});
 // 1) un calcul plus récent annule l'ancien : jamais de résultat périmé
 const a=await p.evaluate(async()=>{const $=i=>document.getElementById(i);
  const c1=ITIN.compute();await new Promise(r=>setTimeout(r,300));$('it-lt').value=6;$('it-lt').dispatchEvent(new Event('input'));const c2=ITIN.compute();
  const t0=performance.now();await Promise.all([c1,c2]);const S=ITIN.last;
  return {len:S?S.len:null,runs:ITIN.runs,msg:$('it-msg').textContent.slice(0,120),ms:Math.round(performance.now()-t0)}});
 ok(a.len&&a.len<=6000,'résultat = celui du dernier réglage (plafond 6 km, tracé de '+Math.round(a.len)+' m) ; '+a.msg);
 // 2) le bouton « Effacer » et le changement de mode annulent un calcul en cours
 const c=await p.evaluate(async()=>{const $=i=>document.getElementById(i);$('it-lt').value=8;$('it-lt').dispatchEvent(new Event('input'));
  const c1=ITIN.compute();await new Promise(r=>setTimeout(r,200));$('it-mode').value='ab';$('it-mode').dispatchEvent(new Event('change'));await c1;
  const out={res:$('it-res').innerHTML.length,vars:$('it-vars').innerHTML.length};$('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));return out});
 ok(c.res===0&&c.vars===0,'changement de mode pendant un calcul : rien n\'est affiché par le calcul annulé');
 // 3) curseurs : « input » ne relance rien, « change » relance un seul calcul
 const d=await p.evaluate(async()=>{const $=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  await ITIN.compute();const n0=ITIN.runs;
  for(const id of ['it-env','it-dur','it-max'])$(id).dispatchEvent(new Event('input'));await sleep(200);const n1=ITIN.runs;
  $('it-env').value=1;$('it-env').dispatchEvent(new Event('change'));await sleep(100);const n2=ITIN.runs;
  return {n0,n1,n2}});
 ok(d.n1===d.n0,'curseurs : l\'événement « input » ne lance aucun calcul');ok(d.n2===d.n0+1,'curseur détour : « change » lance un calcul');
 // 4) reproductibilité (graine fixe) et seuils de temps à CPU ×4 (≈ téléphone moyen)
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const run=()=>p.evaluate(async()=>{const $=i=>document.getElementById(i);$('it-env').value=0;$('it-env').dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,50));
  const t0=performance.now();await ITIN.compute();const ms=performance.now()-t0,S=ITIN.last;return {ms:Math.round(ms),len:S&&Math.round(S.len),up:S&&Math.round(S.up),n:$('it-vars').querySelectorAll('button').length}});
 const r1=await run(),r2=await run();
 ok(r1.len>0&&r1.len===r2.len&&r1.up===r2.up,'boucle reproductible à réglages identiques ('+r1.len+' m, +'+r1.up+' m = '+r2.len+' m, +'+r2.up+' m)');
 ok(r1.ms<10000,'boucle 8 km à CPU ×4 en moins de 10 s ('+r1.ms+' ms)');
 // difficulté « facile » + dénivelé limité : avant, 57 à 130 s ; maintenant borné par le budget
 await p.evaluate(()=>{const $=i=>document.getElementById(i);$('it-max').value=1;$('it-max').dispatchEvent(new Event('input'));$('it-dv').value='both';$('it-dv').dispatchEvent(new Event('change'));$('it-dvm').value=200;$('it-dvm').dispatchEvent(new Event('input'))});
 const r3=await run();
 ok(r3.ms<25000,'boucle « facile » + D± ≤ 200 m à CPU ×4 en moins de 25 s ('+r3.ms+' ms, avant : 57 à 130 s)');
 ok(!errs.length,'aucune erreur JS'+(errs.length?' : '+errs[0].slice(0,200):''));
 await b.close();process.exit(fail?1:0);
})();
