const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Boucles vers les zones colorées : part en forêt, part en zone « moyen » ou mieux en forêt (good), temps. Départs : Semsales + N départs au hasard sur le réseau.
// usage : node tools/profil/boucles-zones.js ple gdv [départs]   (Playwright, iPhone 13, sans réseau, CPU ralenti ×4)
const ROOT=path.resolve(__dirname,'../..'),args=process.argv.slice(2),N=+args.find(a=>/^\d+$/.test(a))||8,ZS=args.filter(a=>!/^\d+$/.test(a)).length?args.filter(a=>!/^\d+$/.test(a)):['ple'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch();
for(const z of ZS){
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true}catch(e){}});
 const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+z);
 await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const r=await p.evaluate(async({N,z})=>{const g=await ITIN.loadGraph(),$=id=>document.getElementById(id);let s=777;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>250&&r>250&&c<meta.cols-250&&r<meta.rows-250};
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),rows=[],starts=[];
  if(z==='ple')starts.push(L.latLng(46.57469,6.93109));
  for(let q=0;q<4000&&starts.length<N+(z==='ple'?1:0);q++){const i=Math.floor(rnd()*g.SX.length);if(inW(i))starts.push(mk(i))}
  const sc=[{},{max:1,dv:"both",dvm:250},{env:0}];
  for(const A of starts)for(const o of sc){ITIN.cancelRun();$("it-mode").value="loop";$("it-mode").onchange();$("it-max").value=o.max??4;$("it-env").value=o.env??2;$("it-dv").value=o.dv||"0";$("it-dvm").value=o.dvm||300;$("it-lm").value="len";$("it-lt").value=8;ITIN.setSeed(7);ITIN.setPt("A",A);
   const t0=performance.now();await ITIN.compute();const S=ITIN.last,m=S&&S.met;rows.push(S?{o:JSON.stringify(o),ms:Math.round(performance.now()-t0),len:Math.round(S.len),fo:m?+m.forest.toFixed(2):null,good:m?+m.good.toFixed(2):null,rep:m?+m.rep.toFixed(2):null}:{o:JSON.stringify(o),fail:1})}
  return rows},{N,z});
 for(const w of r)console.log(z,JSON.stringify(w));
 const ok=r.filter(w=>!w.fail),av=k=>+(ok.reduce((a,w)=>a+(w[k]||0),0)/ok.length).toFixed(3);
 console.log(z,'MOY n',r.length,'échecs',r.length-ok.length,'len',av('len'),'forêt',av('fo'),'zone',av('good'),'rep',av('rep'),'ms',av('ms'));
 await ctx.close()}
await b.close()})();
