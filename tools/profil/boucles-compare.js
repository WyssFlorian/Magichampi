const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Boucles : orienteering (nouveau) contre l'ancienne méthode, mêmes départs, mêmes réglages (boucle 8 km, détour 2, difficulté max).
// usage : node tools/profil/boucles-compare.js ple gdv [départs]   (Playwright, iPhone 13, sans réseau, CPU ralenti ×4 pour les durées)
const ROOT=path.resolve(__dirname,'../..'),args=process.argv.slice(2),N=+args.find(a=>/^\d+$/.test(a))||10,ZS=args.filter(a=>!/^\d+$/.test(a)).length?args.filter(a=>!/^\d+$/.test(a)):['ple'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch();
for(const z of ZS){
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true}catch(e){}});
 const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+z);
 await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const r=await p.evaluate(async N=>{const g=await ITIN.loadGraph(),$=id=>document.getElementById(id);let s=777;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>250&&r>250&&c<meta.cols-250&&r<meta.rows-250};
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),rows=[];
  const run=async(or,A,o)=>{ITIN.cancelRun();ITIN.setLoopOR(or);$("it-mode").value="loop";$("it-mode").onchange();$("it-max").value=o.max??4;$("it-env").value=o.env??2;$("it-dv").value=o.dv||"0";$("it-dvm").value=o.dvm||300;
   $("it-lm").value="len";$("it-lt").value=o.lt||8;ITIN.setSeed(7);ITIN.setPt("A",A);const t0=performance.now();await ITIN.compute();const S=ITIN.last,m=S&&S.met;
   return S?{ms:Math.round(performance.now()-t0),len:Math.round(S.len),lvl:S.lvl,up:Math.round(S.up),fo:m?+m.forest.toFixed(2):null,rep:m?+m.rep.toFixed(2):null,dead:m?+m.dead.toFixed(2):null,top:(document.getElementById("it-msg").textContent.match(/passe par (\d+) des (\d+)/)||[]).slice(1).join("/")}:{ms:Math.round(performance.now()-t0),fail:1}};
  const sc=[{},{max:1,dv:"both",dvm:250},{env:0}];
  for(let q=0,n=0;q<3000&&n<N;q++){const i=Math.floor(rnd()*g.SX.length);if(!inW(i)||g.cls[g.SE[i]]<3)continue;n++;
   for(const o of sc){rows.push({o:JSON.stringify(o),or:await run(true,mk(i),o),old:await run(false,mk(i),o)})}}
  ITIN.setLoopOR(true);return rows},N);
 const f=x=>x.fail?"ÉCHEC "+x.ms+"ms":x.len+"m niv"+x.lvl+" D+"+x.up+" fo"+x.fo+" rep"+x.rep+" imp"+x.dead+" "+x.ms+"ms top"+x.top;
 for(const w of r)console.log(z,w.o,"\n   OR  ",f(w.or),"\n   ancien",f(w.old));
 const av=(k,s)=>{const a=r.filter(w=>!w[k].fail).map(w=>w[k][s]).filter(x=>x!=null);return a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):null};
 for(const k of ["or","old"])console.log(z,k,"échecs",r.filter(w=>w[k].fail).length+"/"+r.length,"moy: len",av(k,"len"),"fo",av(k,"fo"),"rep",av(k,"rep"),"imp",av(k,"dead"),"ms",av(k,"ms"));
 await ctx.close()}
await b.close()})();
