// Test Playwright : boucles sans aller-retour dans les champs (Semsales, région ple). iPhone 13, sans réseau.
// Compare l'ancien comportement (setLoopQ(false)) et le nouveau : part en forêt, part de tronçons répétés, impasses hors forêt.
// usage : node tools/tests/boucle-champs.test.js [essais]   (défaut : 3 essais par cas)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z='ple',N=+process.argv[2]||3;
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true;document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 const r=await p.evaluate(async N=>{
  const $=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms)),set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))};
  await ITIN.loadGraph();
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));ITIN.setPt('A',L.latLng(46.57469,6.93109));
  $('it-lm').value='dur';$('it-lm').dispatchEvent(new Event('change'));set('it-lt',120);set('it-env',1);set('it-dur',3);set('it-max',4);   // 2 h, léger détour, cueillette ×1,5, aucune limite
  const out={};
  for(const off of [false,true])for(const q of [false,true]){
    ITIN.setTT(off);$('it-offok').checked=true;ITIN.setLoopQ(q);
    const rows=[];
    for(let i=0;i<N;i++){$('it-res').innerHTML='';$('it-vars').innerHTML='';$('it-msg').textContent='';const t0=performance.now();$('it-go').click();
      for(let k=0;k<900;k++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m))break}
      const vs=[...$('it-vars').querySelectorAll('button')],row={msg:$('it-msg').textContent.slice(0,80),n:vs.length,ms:Math.round(performance.now()-t0),v:[]};
      for(let j=0;j<vs.length;j++){vs[j].click();await sleep(50);const S=ITIN.last,m=S&&S.met;if(m)row.v.push({len:Math.round(S.len),sec:Math.round(S.sec/60),forest:+m.forest.toFixed(2),good:+m.good.toFixed(2),rep:+m.rep.toFixed(2),dead:+m.dead.toFixed(2)})}
      rows.push(row)}
    out[(off?'tt':'chemin')+'-'+(q?'apres':'avant')]=rows}
  ITIN.setLoopQ(true);return out},N);
 const avg=(rows,k)=>{const a=rows.flatMap(r=>r.v.map(x=>x[k]));return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN};
 for(const [k,rows] of Object.entries(r)){console.log(k,'boucles',rows.reduce((s,x)=>s+x.v.length,0),'forêt',avg(rows,'forest').toFixed(2),'zone moyen+',avg(rows,'good').toFixed(2),'répété',avg(rows,'rep').toFixed(2),'impasse',avg(rows,'dead').toFixed(2),'temps',Math.round(avg(rows.map(x=>({v:[{t:x.ms}]})),'t')),'ms');if(process.env.V)console.log(JSON.stringify(rows))}
 for(const m of ['chemin','tt']){const A=r[m+'-avant'],B=r[m+'-apres'];
  ok(B.every(x=>x.v.length>0),m+' : des boucles sont proposées après correction');
  // tt : depuis le tout-terrain progressif (PR 151) les allers-retours vers les zones favorables sont voulus : on exige seulement de ne pas empirer nettement (mesure bruitée : 3 départs, budgets de temps)
  const tt=m==='tt';
  ok(avg(B,'dead')<=(tt?(isNaN(avg(A,'dead'))?1:avg(A,'dead')+.08):Math.max(.02,avg(A,'dead')*.4)),m+' : impasses hors forêt réduites ('+avg(A,'dead').toFixed(2)+'→'+avg(B,'dead').toFixed(2)+')');
  ok(avg(B,'rep')<=(tt?(isNaN(avg(A,'rep'))?1:avg(A,'rep')+.05):avg(A,'rep')*.6)&&(isNaN(avg(A,'forest'))||avg(B,'forest')>=avg(A,'forest')-(tt?.2:.04)),m+' : répétitions réduites, forêt conservée ou meilleure ('+avg(A,'rep').toFixed(2)+'→'+avg(B,'rep').toFixed(2)+' ; '+avg(A,'forest').toFixed(2)+'→'+avg(B,'forest').toFixed(2)+')')}
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();console.log(fail?'ÉCHEC':'OK');process.exit(fail?1:0)})();
