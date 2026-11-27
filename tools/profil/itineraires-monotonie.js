const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Monotonie des contraintes : un tracé trouvé avec une difficulté maximale M doit aussi l'être avec M' > M (les réglages plus permissifs ne doivent jamais faire échouer).
// usage : node tools/profil/itineraires-monotonie.js ple gdv   (Playwright, iPhone 13, sans réseau, graine fixe, sans ralentissement CPU)
const ROOT=path.resolve(__dirname,'../..'),ZS=process.argv.slice(2).length?process.argv.slice(2):['ple'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch();
for(const z of ZS){
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+z);
 await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{const g=await ITIN.loadGraph(),$=id=>document.getElementById(id);let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>250&&r>250&&c<meta.cols-250&&r<meta.rows-250};
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),out=[];
  const run=async(mode,A,B,M,env)=>{ITIN.cancelRun();$("it-mode").value=mode;$("it-mode").onchange();$("it-max").value=M;$("it-env").value=env;$("it-dv").value="0";
   $("it-lm").value=mode==="loop"?"len":"none";$("it-lt").value=8;ITIN.setSeed(7);ITIN.setPt("A",A);if(B)ITIN.setPt("B",B);const t0=performance.now();await ITIN.compute();const S=ITIN.last;
   return {ok:!!S,ms:Math.round(performance.now()-t0),len:S?Math.round(S.len):0,lvl:S?S.lvl:null,off:S?Math.round(S.off||0):0,msg:$("it-msg").textContent.slice(0,110)}};
  let nl=0,na=0;
  for(let q=0;q<3000&&(nl<6||na<8);q++){const i=Math.floor(rnd()*g.SX.length);if(!inW(i))continue;
   if(nl<6){nl++;const row={type:"boucle 8 km"};for(const M of [1,2,3,4])row["M"+M]=await run("loop",mk(i),null,M,2);out.push(row);continue}
   const j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(!inW(j)||d<1200||d>3500)continue;na++;
   const row={type:"A→B"};for(const M of [1,2,3,4])row["M"+M]=await run("ab",mk(i),mk(j),M,2);out.push(row)}
  return out});
 let viol=0;for(const row of r){const ks=["M1","M2","M3","M4"];for(let a=0;a<4;a++)for(let c=a+1;c<4;c++)if(row[ks[a]].ok&&!row[ks[c]].ok)viol++;
  console.log(z,row.type,ks.map(k=>k+":"+(row[k].ok?"ok "+row[k].len+"m niv"+row[k].lvl+(row[k].off?" hc"+row[k].off:"")+" "+row[k].ms+"ms":"ÉCHEC « "+row[k].msg+" »")).join(" | "))}
 console.log(z,"violations de monotonie (réussi à M, échoue à M' > M) :",viol);
 await ctx.close()}
await b.close()})();
