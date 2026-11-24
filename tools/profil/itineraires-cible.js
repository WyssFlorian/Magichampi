const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Écart à la cible : la distance ou la durée demandée est un plafond strict ; on mesure de combien le tracé affiché reste en dessous (objectif : ≤ 1 km ou ≤ 30 min).
// usage : node tools/profil/itineraires-cible.js ple gdv   (Playwright, iPhone 13, sans réseau ; 6 départs × scénarios)
const ROOT=path.resolve(__dirname,'../..'),ZS=process.argv.slice(2).length?process.argv.slice(2):['ple'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch();
for(const z of ZS){
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 if(process.env.FD)await ctx.addInitScript(()=>{window.__FD=1});const p=await ctx.newPage();if(process.env.FD)p.on('console',m=>{if(/FILL/.test(m.text()))console.log('  ',m.text().slice(0,220))});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+z);
 await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const res=await p.evaluate(async ([MAXD,SC])=>{
  const g=await ITIN.loadGraph(),$=id=>document.getElementById(id),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  if(ITIN.setSeed)ITIN.setSeed(20261123);
  let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>200&&r>200&&c<meta.cols-200&&r<meta.rows-200};
  const starts=[];for(let q=0;q<4000&&starts.length<6;q++){const i=Math.floor(rnd()*g.SX.length);if(inW(i)&&g.cls[g.SE[i]]>=4&&starts.every(j=>Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j])>2500))starts.push(i)}
  const pair=i=>{for(let q=0;q<4000;q++){const j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d>1500&&d<3000&&inW(j))return j}return -1};
  const scen=[["boucle 5 km",{mode:"loop",lm:"len",lt:5}],["boucle 8 km",{mode:"loop",lm:"len",lt:8}],["boucle 12 km",{mode:"loop",lm:"len",lt:12}],["boucle 90 min",{mode:"loop",lm:"dur",lt:90}],["boucle 2 h 30",{mode:"loop",lm:"dur",lt:150}],
   ["boucle 8 km tout-terrain",{mode:"loop",lm:"len",lt:8,off:1}],["A→B plafond 1,5×",{mode:"ab",lm:"len",k:1.5}],["A→B plafond 2×",{mode:"ab",lm:"len",k:2}],["A→B durée 1,5×",{mode:"ab",lm:"dur",k:1.5}]];
  const out=[];
  for(const [nm,o] of scen){if(SC&&!nm.includes(SC))continue;const rows=[];
   for(const i of starts){const j=o.mode==="ab"?pair(i):-1;if(o.mode==="ab"&&j<0)continue;
    $("it-mode").value=o.mode;$("it-mode").onchange();$("it-max").value=MAXD;$("it-dv").value="0";$("it-env").value=1;$("it-dur").value=2;
    ITIN.setTT(!!o.off);$("it-offok").checked=!!o.off;$("it-lm").value=o.lm;let lt=o.lt;
    if(o.mode==="ab"){const A=ITIN.snap(mk(i)),B=ITIN.snap(mk(j));ITIN.setOffP&&ITIN.setOffP(0);const R=A&&B&&ITIN.route(A,B,0);if(!R){continue}const S0=ITIN.summarize(R);lt=o.lm==="len"?Math.round(S0.len*o.k/100)/10:Math.ceil(S0.sec*o.k/900)*15}
    $("it-lt").min=0;$("it-lt").max=1000;$("it-lt").step="any";$("it-lt").value=lt;
    ITIN.setPt("A",mk(i));if(o.mode==="ab")ITIN.setPt("B",mk(j));
    const t0=performance.now();await ITIN.compute();const ms=Math.round(performance.now()-t0);
    const S=ITIN.last,cap=ITIN.capOf();if(!S||!cap){rows.push({fail:1,msg:$("it-msg").textContent.slice(0,80)});continue}
    const v=cap.m==="len"?S.len:S.sec,gap=cap.lim-v;rows.push({lim:cap.lim,v:Math.round(v),gap:Math.round(gap),over:v>cap.lim+1e-6,ms,lvl:S.lvl})}
   out.push([nm,rows])}
  return out},[+(process.env.MAXD||2),process.env.SC||'']);
 for(const [nm,rows] of res){const ok=rows.filter(r=>!r.fail),dur=/min|h|durée/.test(nm),tol=dur?1800:1000;
  const near=ok.filter(r=>r.gap<=tol&&!r.over).length,over=ok.filter(r=>r.over).length,gaps=ok.map(r=>r.gap).sort((a,c)=>a-c);
  const f=x=>dur?Math.round(x/60)+"′":(x/1000).toFixed(1)+"km";
  console.log(z.padEnd(4),nm.padEnd(26),`proches(≤${dur?"30′":"1 km"}) ${near}/${ok.length}`,`échecs ${rows.length-ok.length}`,`dépassements ${over}`,`écart méd ${gaps.length?f(gaps[Math.floor(gaps.length/2)]):"-"} max ${gaps.length?f(gaps[gaps.length-1]):"-"}`,"ms moy",ok.length?Math.round(ok.reduce((a,r)=>a+r.ms,0)/ok.length):"-","|",ok.map(r=>f(r.gap)).join(" "))}
 console.log(z,'erreurs',errs.slice(0,3));await ctx.close()}
await b.close()})();
