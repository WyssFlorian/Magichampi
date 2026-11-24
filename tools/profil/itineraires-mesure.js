const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Mesures des itinéraires (qualité A→B, temps de calcul sur CPU ralenti ×4 ≈ téléphone moyen, escalier du tout-terrain).
// usage : node tools/profil/itineraires-mesure.js ple gdv   (Playwright, iPhone 13, sans réseau)
const ROOT=path.resolve(__dirname,'../..'),ZS=process.argv.slice(2).length?process.argv.slice(2):['ple'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch();
for(const z of ZS){
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+z);
 await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(p);
 // 1) qualité A→B (sans ralentissement)
 const q=await p.evaluate(async()=>{let s=12345;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const g=await ITIN.loadGraph(),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const len=x=>x.seq.reduce((a,[,s0,s1])=>a+Math.abs(s1-s0),0),out={ratio0:[],ratioE3:[],crow:[],fo0:[],fo4:[]};
  const foL=R=>{let t=0,f=0;for(const [e,s0,s1] of R.seq){const l=Math.abs(s1-s0);t+=l;f+=l*g.fo[e]/100}return t?1-f/t:0};
  for(let qn=0,n=0;qn<2000&&n<60;qn++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d<1500||d>6000)continue;
   const A=ITIN.snap(mk(i)),B=ITIN.snap(mk(j));if(!A||!B)continue;
   ITIN.setOffP(0);const R0=ITIN.route(A,B,0);ITIN.setOffP(4);const R4=(ITIN.routeCap||ITIN.route)(A,B,0),R3=(ITIN.routeCap||ITIN.routeGD)(A,B,3);if(!R0||!R4||!R3)continue;n++;
   out.ratio0.push(len(R4)/len(R0));out.ratioE3.push(len(R3)/len(R0));out.crow.push(len(R0)/d);out.fo0.push(foL(R0));out.fo4.push(foL(R4))}
  const st=a=>{a=a.slice().sort((x,y)=>x-y);const P=k=>+a[Math.min(a.length-1,Math.floor(k*a.length))].toFixed(2);return {n:a.length,p50:P(.5),p90:P(.9),max:+a[a.length-1].toFixed(2),mean:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2)}};
  const r={};for(const k in out)r[k]=st(out[k]);return r});
 console.log(z,'AB',JSON.stringify(q));
 // 2) temps de calcul via l'interface, CPU ralenti ×4 (téléphone moyen)
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const scen=[["AB défaut",{mode:"ab"}],["AB diff=facile + D+≤200",{mode:"ab",max:1,dv:"up",dvm:200}],["AB tout-terrain détour",{mode:"ab",off:1,env:2}],
  ["Boucle 8 km",{mode:"loop"}],["Boucle 8 km détour 2",{mode:"loop",env:2}],["Boucle 8 km facile + D± ≤200",{mode:"loop",max:1,dv:"both",dvm:200}],["Boucle 6 km tout-terrain",{mode:"loop",off:1,lt:6,env:2}],["Boucle 8 km (répétition)",{mode:"loop"}]];
 for(const [nm,o] of scen){
  const r=await p.evaluate(async o=>{const g=ITIN.graph,$=id=>document.getElementById(id);
   // point de départ/arrivée fixes : au centre de la fenêtre chargée, sur le réseau
   const cx=meta.x0+meta.cols*meta.res/2,cy=meta.y1-meta.rows*meta.res/2,ll=map.options.crs.unproject?L.Projection.SphericalMercator.unproject(L.point(cx,cy)):null;
   const A=L.latLng(ll.lat,ll.lng),B=L.latLng(ll.lat+0.02,ll.lng+0.025);
   $("it-mode").value=o.mode;$("it-mode").onchange();$("it-max").value=o.max??4;$("it-dv").value=o.dv||"0";$("it-dvm").value=o.dvm||300;$("it-env").value=o.env||0;
   ITIN.setTT(!!o.off);$("it-offok").checked=!!o.off;$("it-lm").value="len";$("it-lt").value=o.lt||8;
   ITIN.setPt("A",A);if(o.mode==="ab")ITIN.setPt("B",B);
   let long=0;const po=new PerformanceObserver(l=>{for(const e of l.getEntries())long=Math.max(long,e.duration)});try{po.observe({entryTypes:["longtask"]})}catch(e){}
   const t0=performance.now();await ITIN.compute();const t=performance.now()-t0;await new Promise(r=>setTimeout(r,50));po.disconnect();
   const S=ITIN.last;return {ms:Math.round(t),longest:Math.round(long),len:S?Math.round(S.len):null,lvl:S?S.lvl:null,up:S?Math.round(S.up):null,met:S&&S.met?{fo:+S.met.forest.toFixed(2),rep:+S.met.rep.toFixed(2)}:null,offlen:S?Math.round(S.off||0):0,msg:$("it-msg").textContent.slice(0,140)}},o);
  console.log(z,nm,JSON.stringify(r));
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 // 3) escalier du tout-terrain : longueur 8-voisins vs simplifiée (10 m)
 const st=await p.evaluate(async()=>{const g=ITIN.graph;let s=777;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};let raw=0,smp=0,n=0;
  for(let q=0;q<400&&n<8;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d<800||d>3000||!inW(i)||!inW(j))continue;
   const R=await ITIN.routeOff(mk(i),mk(j),2,4);if(R.error)continue;n++;
   for(const l of R.pl)if(l.k==='o'&&l.ll.length>2){const P=l.ll.map(([la,lo])=>L.point((lo-g.lon0)*g.kx,(la-g.lat0)*g.ky));const lenP=a=>{let t=0;for(let k=1;k<a.length;k++)t+=a[k].distanceTo(a[k-1]);return t};raw+=lenP(P);smp+=lenP(L.LineUtil.simplify(P,8))}}
  return {n,raw:Math.round(raw),simpl:Math.round(smp),excess:raw?+(raw/smp-1).toFixed(3):null}});
 console.log(z,'escalier',JSON.stringify(st),'erreurs',errs.slice(0,3));
 await ctx.close()}
await b.close()})();
