// Test Playwright des itinéraires (graphe, A→B, boucle, tout-terrain, météo, déclaration), émulation iPhone 13, sans réseau.
// usage : node tools/tests/itineraires.test.js [région ...]   (par défaut : les huit régions) ; nécessite `playwright` (Chromium).
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),ZS=process.argv.slice(2).length?process.argv.slice(2):['ple','lsn','gdv','nyn','bro','vul','chb','pde'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch();
 for(const z of ZS){
  console.log('== '+z);
  const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1')}catch(e){}});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();
   const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});
   r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
  await p.goto('https://loc.test/index.html?r='+z);
  await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
  const r=await p.evaluate(async()=>{
   const o={};const t0=performance.now();const g=await ITIN.loadGraph();o.load=Math.round(performance.now()-t0);o.nE=g.nE;
   const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
   let ab=0,abOk=0,off=0,offOk=0,tmax=0,pair=null;
   for(let q=0;q<400&&ab<12;q++){const i=Math.floor(Math.random()*g.SX.length),j=Math.floor(Math.random()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d<1500||d>6000)continue;
    const A=ITIN.snap(mk(i)),B=ITIN.snap(mk(j));if(!A||!B)continue;ab++;const t1=performance.now(),R=ITIN.route(A,B,2);tmax=Math.max(tmax,performance.now()-t1);
    if(R){abOk++;const S=ITIN.summarize(R);if(!(S.len>0&&S.sec>0&&S.lvl>=0&&S.lvl<=4))o.bad=1;if(!pair&&inW(i)&&inW(j))pair=[i,j]}}
   o.ab=ab;o.abOk=abOk;o.tmax=Math.round(tmax);
   if(pair){const R=await ITIN.routeOff(mk(pair[0]),mk(pair[1]),3);o.off=R.error?R.error:Math.round(R.off.len)}
   const k=Math.floor(g.SX.length/2),L2=await ITIN.loopRoutes(ITIN.snap(mk(k)),mk(k),'len',8000,2);o.loops=L2.length;
   o.wx=ITIN.wx(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
   return o});
  console.log('  ',JSON.stringify(r));
  ok(r.nE>1000,'graphe chargé ('+r.nE+' arêtes, '+r.load+' ms)');
  ok(r.ab>0&&r.abOk/r.ab>=.5,'A→B : '+r.abOk+'/'+r.ab+' trajets trouvés (≥ 50 %), pire temps '+r.tmax+' ms');
  ok(!r.bad,'statistiques et difficulté cohérentes');
  ok(r.loops>=1,'boucles : '+r.loops+' proposée(s)');
  ok(r.off===undefined||typeof r.off==='number'||/Tout-terrain|zone|Aucun|déconseillé|météo|aucune/i.test(r.off),'tout-terrain : '+(r.off===undefined?'pas de paire':r.off));
  ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
  await ctx.close();
 }
 // déclaration : sans acceptation mémorisée, le calcul attend la modale
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r=pde');await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});
 const shown=await p.evaluate(()=>{ITIN.declare(true);return !document.getElementById('it-decl-modal').hidden});
 ok(shown,'déclaration de responsabilité affichée avant le premier calcul');
 await p.evaluate(()=>document.getElementById('it-decl-no').click());
 ok(await p.evaluate(()=>document.getElementById('it-decl-modal').hidden),'refus : la modale se ferme');
 await b.close();process.exit(fail?1:0);
})();
