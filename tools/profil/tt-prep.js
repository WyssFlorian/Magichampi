// Temps de routeOff (tout-terrain A→B) : total, répartition par ligne (profileur CPU) et mêmes tracés répétés. usage : node tools/profil/tt-prep.js ple [cpu=1]
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'ple',CPU=+(process.argv[3]||1);
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});
 const p=await ctx.newPage();p.on('pageerror',e=>console.log(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU});
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:300});
 const run=async()=>p.evaluate(async()=>{const g=await ITIN.loadGraph(),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const pairs=[];for(let q=0;q<20000&&pairs.length<8;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);
    if(!inW(i)||!inW(j)||g.cls[g.SE[i]]<4||g.cls[g.SE[j]]<4||d<1500||d>3000)continue;pairs.push([i,j])}
  const out=[];for(const [env,M] of [[0,0],[2,2],[3,3]]){const t0=performance.now();let n=0,len=0;for(const [i,j] of pairs){ITIN.setSeed(5);const R=await ITIN.routeOff(mk(i),mk(j),env,M);if(!R.error){n++;len+=ITIN.summarize(R).len}}out.push([env,M,n,Math.round(performance.now()-t0),Math.round(len)])}return out});
 await cdp.send('Profiler.start');const r=await run();const {profile}=await cdp.send('Profiler.stop');
 console.log(Z,'cpu x'+CPU,'[envie,diff,tracés,ms,somme longueurs m]',JSON.stringify(r));
 const self={},byId={};profile.nodes.forEach(n=>byId[n.id]=n);const dt=profile.timeDeltas;
 profile.samples.forEach((s,i)=>{const n=byId[s],k=n.callFrame.functionName+':'+(n.callFrame.lineNumber+1);self[k]=(self[k]||0)+dt[i]/1000});
 Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([k,v])=>console.log(v.toFixed(0).padStart(7),'ms',k));
 await b.close()})();
