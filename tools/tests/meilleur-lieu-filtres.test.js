// Test Playwright : l'étoile « Meilleur lieu » suit les mêmes filtres que la carte (chasse, zones difficiles d'accès, niveau affiché).
// usage : node tools/tests/meilleur-lieu-filtres.test.js   (région ple, iPhone 13, sans réseau)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z='ple';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2000);
 const r=await p.evaluate(()=>{
  const out={};
  // 1. cases décochées : les filtres ne s'appliquent pas
  $("o-hunt").checked=false;$("o-hard").checked=false;
  out.off=bestFilters();const f0=bestFilters();out.skipOff=f0.skip(0);
  // 2. cases cochées avec des masques factices : la cellule est ignorée
  $("o-hunt").checked=true;$("o-hard").checked=true;state.relief=true;
  const n=meta.cols*meta.rows;
  huntMask={any:true};huntArr=new Uint8Array(n);huntArr[5]=1;hardMask={any:true};hardArr=new Uint8Array(n);hardArr[7]=1;
  const f1=bestFilters();out.hunt=f1.skip(5);out.hard=f1.skip(7);out.free=f1.skip(9);
  // 3. une cellule chassée ne peut pas être élue
  huntArr=new Uint8Array(n).fill(1);const bl=state.best;state.best=true;
  out.bestAllHunt=findBest();
  // 4. niveau minimal : concentration hors période de conditions du moment = classe 2
  state.sp="multi";state.mode="site";out.minMulti=bestFilters().minK;state.mode="now";out.minNow=bestFilters().minK;
  // 5. cellules sans forêt (255) et zones interdites (fx=4) : jamais élues
  huntArr=new Uint8Array(n);state.best=true;state.resp=true;state.sp="multi";state.mode="site";
  const cc=currentClass.slice(),fx0=G.fx.slice();let t=-1;const R=viewRect();for(let r=R.r0;r<R.r1&&t<0;r++)for(let c=R.c0;c<R.c1;c++){const i=r*meta.cols+c;if(cc[i]!==255&&cc[i]>=2){t=i;break}}
  const all=new Uint8Array(n).fill(255);all[t]=3;currentClass=all;G.fx[t]=4;out.t=t;out.forb=findBest();
  G.fx[t]=1;const w=findBest();out.free2=w&&w.i===t;
  currentClass=cc;G.fx=fx0;
  return out});
 ok(r.skipOff===false,'cases décochées : aucune cellule ignorée');
 ok(r.hunt===true,'chasse cochée : cellule hachurée rouge ignorée');
 ok(r.hard===true,'zones difficiles cochées : cellule hachurée grise ignorée');
 ok(r.free===false,'cellule libre conservée');
 ok(r.bestAllHunt===null,'toute la vue en chasse : pas d\'étoile');
 ok(r.minMulti===2&&r.minNow===1,'niveau minimal : concentration = moyen (2), conditions du moment = 1');
 ok(r.forb===null,'zone interdite (fx=4) ou sans forêt (255) : pas d\'étoile');
 ok(r.free2===true,'même cellule hors zone interdite : élue');
 ok(!errs.length,'aucune erreur JS'+(errs.length?' : '+errs[0].slice(0,200):''));
 await b.close();process.exit(fail?1:0)})();
