// Test Playwright : se déplacer sur la carte (changement de région, donc d'altitude médiane et de saison) ne doit pas changer l'espèce choisie.
// usage : node tools/tests/espece-deplacement.test.js
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z='ple';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/manifest+json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});
 const r=await p.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  state.seasonOnly=true;
  // une espèce en saison à une altitude et hors saison à une autre (altitude médiane de la région d'arrivée)
  const alts=[200,400,600,800,1000,1200,1400,1600,1800,2000];let sp=null,aIn=0,aOut=0;
  outer:for(const s of SPECIES){if(!inTier(s))continue;REG_ALT=800;for(const a of alts){REG_ALT=a;if(inSeason(s)){for(const b of alts){REG_ALT=b;if(!inSeason(s)){sp=s;aIn=a;aOut=b;break outer}}}}}
  if(!sp)return {none:true};
  REG_ALT=aIn;state.sp=state.lastSp=sp.id;render();
  const before=state.sp;
  REG_ALT=aOut;   // arrivée dans une région d'une autre altitude : l'espèce sort de la saison
  KEEP_SP=true;render();
  const kept=state.sp,card=document.querySelector('#species .sp[data-id="'+sp.id+'"]'),shown=card&&!card.hidden;
  // sans l'indicateur (changement de date par exemple) le comportement habituel reste
  render();
  return {before,kept,shown,out:!inSeason(sp),after:state.sp}});
 console.log(JSON.stringify(r));ok(!r.none,'une espèce de saison variable existe');
 ok(r.out,'l\'espèce est bien hors saison à la nouvelle altitude');
 ok(r.kept===r.before&&r.shown,'après un déplacement, l\'espèce choisie reste sélectionnée et visible');
 ok(r.after!==r.before,'sans déplacement (ex. changement de date), le remplacement habituel reste');
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();console.log(fail?'ÉCHEC':'OK');process.exit(fail?1:0)})();
