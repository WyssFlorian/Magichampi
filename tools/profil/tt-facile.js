const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Tout-terrain A→B : le niveau annoncé respecte-t-il la difficulté maximale choisie ? (cas « facile » donnant « moyen »)
// usage : node tools/profil/tt-facile.js ple gdv [trajets]   (Playwright, iPhone 13, sans réseau, graine fixe, sans ralentissement CPU)
const ROOT=path.resolve(__dirname,'../..'),args=process.argv.slice(2),N=+args.find(a=>/^\d+$/.test(a))||8,ZS=args.filter(a=>!/^\d+$/.test(a)).length?args.filter(a=>!/^\d+$/.test(a)):['ple'];
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch();let bad=0,tot=0;
for(const z of ZS){
 const ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+z);
 await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async ([N,ENV,process_TT])=>{const g=await ITIN.loadGraph(),$=id=>document.getElementById(id);let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>250&&r>250&&c<meta.cols-250&&r<meta.rows-250};
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),rows=[];
  for(let q=0,n=0;q<4000&&n<N;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(!inW(i)||!inW(j)||d<1200||d>3500)continue;n++;
   const row={d:Math.round(d)};
   for(const M of [1,2]){ITIN.cancelRun();ITIN.setTT(!process_TT);$("it-offok").checked=true;$("it-mode").value="ab";$("it-mode").onchange();$("it-max").value=M;$("it-env").value=ENV;$("it-dv").value="0";$("it-lm").value="none";ITIN.setSeed(7);
    ITIN.setPt("A",mk(i));ITIN.setPt("B",mk(j));const t0=performance.now();await ITIN.compute();const S=ITIN.last;row["M"+M]=S?{ms:Math.round(performance.now()-t0),len:Math.round(S.len),off:Math.round(S.off||0),lvl:S.lvl,up:Math.round(S.up),min:Math.round(S.sec/60),why:S.reason.slice(0,50)}:{fail:$("it-msg").textContent.slice(0,60)}}
   rows.push(row)}
  return rows},[N,+(process.env.ENV||2),!!process.env.NOTT]);
 for(const w of r){for(const M of [1,2]){const x=w["M"+M];tot++;if(x&&!x.fail&&x.lvl>M)bad++;console.log(z,"d="+w.d,"M"+M,x.fail?"ÉCHEC "+x.fail:`${x.len}m (hors chemin ${x.off}) niv${x.lvl} D+${x.up} ${x.min}min ${x.ms}ms « ${x.why} »`)}}
 await ctx.close()}
console.log("trajets où le niveau dépasse le maximum :",bad+"/"+tot);
await b.close()})();
