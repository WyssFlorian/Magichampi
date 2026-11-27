// Test Playwright de la méthode exacte par étiquettes (routeRC) : limites tenues, coût optimal, monotonie, accord avec le plus court chemin sans limite.
// usage : node tools/tests/itineraires-exact.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{
  const g=await ITIN.loadGraph();{const A0=ITIN.snap(L.latLng(g.lat0+g.SY[5]/g.ky,g.lon0+g.SX[5]/g.kx)),B0=ITIN.snap(L.latLng(g.lat0+g.SY[900]/g.ky,g.lon0+g.SX[900]/g.kx));for(const [ev,nz] of [[0,0],[2,0],[2,1]]){ITIN.setNoise(nz?ITIN.mkNoise(.3,99):null);ITIN.route(A0,B0,ev)}ITIN.setNoise(null)}   // chauffe : calcul des repères
let sd=2468;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const o={alt:0,altBad:0,tAlt:0,tDij:0,n:0,limOk:0,limBad:0,same:0,sameBad:0,mono:0,monoBad:0,capOk:0,capBad:0,tight:0,inf:0,max:0,ms:0};
  for(let t=0;t<3000&&o.n<30;t++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d<1500||d>5000)continue;
   const A=ITIN.snap(mk(i)),B=ITIN.snap(mk(j));if(!A||!B||A.e===B.e)continue;
   const R=ITIN.route(A,B,0);if(!R)continue;const S=ITIN.summarize(R);if(S.up<60)continue;o.n++;
   // repères ALT : même coût que Dijkstra pur (sans bonus, avec bonus de détour, avec aléa)
   for(const [ev,nz] of [[0,0],[2,0],[2,1]]){const Z=nz?ITIN.mkNoise(.3,99):null;ITIN.setNoise&&ITIN.setNoise(Z);
    ITIN.setAlt(false);let t0=performance.now();const D=ITIN.route(A,B,ev);o.tDij+=performance.now()-t0;(o['d'+ev+nz]=o['d'+ev+nz]||[0,0])[0]+=performance.now()-t0;ITIN.setAlt(true);t0=performance.now();const T=ITIN.route(A,B,ev);o.tAlt+=performance.now()-t0;o['d'+ev+nz][1]+=performance.now()-t0;
    if(D&&T&&Math.abs(D.cost-T.cost)<=1e-4*D.cost+1e-3)o.alt++;else{o.altBad++;o.bad=[ev,nz,D&&D.cost,T&&T.cost]}}
   ITIN.setNoise&&ITIN.setNoise(null);
   // limite très large : même coût que le plus court chemin
   const W=ITIN.routeRC(A,B,0,[{k:"up",lim:1e6}]);if(W&&Math.abs(W.cost-R.cost)<=1e-3*R.cost+1e-3)o.same++;else o.sameBad++;
   // limites décroissantes : toujours tenues, coût croissant
   let prev=R.cost,mono=true;
   for(const f of [.9,.7,.5]){const lim=S.up*f,t0=performance.now(),X=ITIN.routeRC(A,B,0,[{k:"up",lim}]);o.ms+=performance.now()-t0;
    if(!X){const I=ITIN.RCI;if(I&&I.inf)o.inf++;else o.max++;continue}
    const SX=ITIN.summarize(X);if(SX.up<=lim+.01){o.limOk++;o.tight++}else o.limBad++;
    if(X.cost<prev-1e-3*prev)mono=false;prev=X.cost}
   if(mono)o.mono++;else o.monoBad++;
   // plafond de longueur : tenu, et un plafond égal au plus court chemin est faisable
   const L0=S.len,X=ITIN.routeRC(A,B,0,[{k:"len",lim:L0*1.05}]);if(X){const SX=ITIN.summarize(X);if(SX.len<=L0*1.05+.01)o.capOk++;else o.capBad++}
  }
  return o});
 console.log(JSON.stringify(r));
 ok(r.n>=20,'assez de trajets de test ('+r.n+')');
 ok(r.altBad===0,'repères ALT : même coût que Dijkstra ('+r.alt+' cas, '+Math.round(r.tDij)+' ms → '+Math.round(r.tAlt)+' ms)');
 ok(r.sameBad===0,'limite très large : coût identique au plus court chemin ('+r.same+'/'+r.n+')');
 ok(r.limBad===0&&r.limOk>0,'dénivelé : limite toujours tenue ('+r.limOk+' tracés)');
 ok(r.monoBad===0,'limite plus stricte : coût jamais plus bas');
 ok(r.capBad===0&&r.capOk>0,'plafond de longueur tenu ('+r.capOk+' tracés)');
 ok(r.max===0,'pas de dépassement du nombre d\'étiquettes');
 ok(errs.length===0,'aucune erreur JS '+errs.join('|').slice(0,300));
 await b.close();process.exit(fail?1:0)})();
