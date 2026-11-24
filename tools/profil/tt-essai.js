// Essai manuel du tout-terrain progressif / des meilleurs points / de l'aléa : paires A→B (ou départs de boucle) fixes, deux graines.
// usage : [OFF=1] [CFG='[[env,max],…]'] [NP=6] node tools/profil/tt-essai.js ple [ab|loop]
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'ple',MODE=process.argv[3]||'ab',OFF=!!process.env.OFF;
const CFG=process.env.CFG?JSON.parse(process.env.CFG):[[0,0],[1,1],[2,2],[3,3],[0,3],[3,0]],NP=+(process.env.NP||6),PER=!!process.env.PER;
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));if(process.env.DBG)p.on('console',m=>{if(/DBG/.test(m.text()))console.log(m.text())});
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async([MODE,OFF,CFG,NP,PER,DBO])=>{const out=[],g=await ITIN.loadGraph(),$=i=>document.getElementById(i),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const pairs=[];for(let q=0;q<20000&&pairs.length<NP;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);
    if(!inW(i)||!inW(j)||g.cls[g.SE[i]]<4||g.cls[g.SE[j]]<4||d<1500||d>3000)continue;pairs.push([i,j])}
  for(const [env,max] of CFG){const agg=[];
   for(const [pi,[i,j]] of pairs.entries()){const row=[];
    for(const sd of [11,22]){$("it-mode").value=MODE;$("it-mode").onchange();$("it-max").value=max;$("it-env").value=env;$("it-off").checked=OFF;$("it-offok").checked=OFF;$("it-lm").value="len";$("it-lt").value=MODE==='ab'?10:6;
     ITIN.setPt("A",mk(i));if(MODE==='ab')ITIN.setPt("B",mk(j));if(ITIN.setSeed)ITIN.setSeed(sd+pi);const t0=performance.now();await ITIN.compute();const S=ITIN.last,t=Math.round(performance.now()-t0);
     const m=/Passe par (\d+) des (\d+)/.exec($("it-msg").textContent)||/passe par (\d+) des (\d+)/.exec($("it-msg").textContent);
     row.push({len:S?Math.round(S.len):0,off:S?Math.round(S.off||0):0,lvl:S?S.lvl:-1,ms:t,top:m?+m[1]:-1,sig:S&&S.ll?Math.round(S.ll.reduce((a,x)=>a+x[0]*1e5%977+x[1]*1e5%911,0)):0,err:S?'':$("it-msg").textContent.slice(0,90)})}
    if(PER)out.push('  pair '+pi+': '+row.map(x=>x.len+'m off '+x.off+' lvl '+x.lvl+(x.err?' ERR':'')).join(' | '));agg.push(row)}
   const f=a=>a.reduce((x,y)=>x+y,0)/a.length,all=agg.flat();
   out.push(`env=${env} max=${max} | len moy ${Math.round(f(all.map(x=>x.len)))} m · hors chemin ${Math.round(f(all.map(x=>x.off)))} m · lvl max ${Math.max(...all.map(x=>x.lvl))} · top moy ${f(all.filter(x=>x.top>=0).map(x=>x.top)).toFixed(1)} (${all.filter(x=>x.top>=0).length}/${all.length}) · ms moy ${Math.round(f(all.map(x=>x.ms)))} max ${Math.max(...all.map(x=>x.ms))} · graines différentes ${agg.filter(r=>r[0].sig!==r[1].sig).length}/${agg.length} · échecs ${all.filter(x=>x.err).length} ${[...new Set(all.filter(x=>x.err).map(x=>x.err))].join(' | ')}`)}
  return out},[MODE,OFF,CFG,NP,PER,process.env.DBO||'{}']);
 for(const x of r)console.log(x);console.log('erreurs',errs.slice(0,3));await b.close()})();
