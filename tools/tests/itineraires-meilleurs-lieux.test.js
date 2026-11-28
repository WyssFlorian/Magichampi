// Test Playwright : option « Passer par les meilleurs lieux » (meilleurs lieux de la vue = points de passage). iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-meilleurs-lieux.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true;document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 await p.screenshot({path:'/tmp/wp0.png'});
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const cand=[];for(let i=0;i<g.SX.length;i+=Math.floor(g.SX.length/4000)||1)if(inW(i)&&g.cls[g.SE[i]]>=4)cand.push(i);
  const mid=cand[Math.floor(cand.length/2)],d=(i,j)=>Math.hypot((g.SX[i]-g.SX[j]),(g.SY[i]-g.SY[j]));
  const near=(k,r1,r2)=>{for(const i of cand)if(d(i,k)>r1&&d(i,k)<r2)return i;return -1};
  const A=mid,B=near(A,2500,4000);
  const go=async()=>{$('it-go').click();for(let i=0;i<400;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  map.fitBounds(L.latLngBounds([mk(A),mk(B)]).pad(.4));await sleep(1500);
  await go();o.directLen=ITIN.last.len;o.direct=ITIN.WP.length;
  state.bestN=3;$('it-bestwp').checked=true;
  const exp=findBestN(3).length;o.exp=exp;
  await go();o.nbest=ITIN.WP.filter(w=>w.best).length;o.wps=ITIN.WP.length;o.msg=$('it-msg').textContent;o.res=$('it-res').textContent.slice(0,80);
  await go();o.again=ITIN.WP.filter(w=>w.best).length;   // pas de doublons au second calcul
  o.ok=ITIN.last&&ITIN.last.len>0;
  state.bestN=1;await go();o.n1=ITIN.WP.filter(w=>w.best).length;
  $('it-bestwp').checked=false;$('it-bestwp').dispatchEvent(new Event('change'));await sleep(1500);o.off=ITIN.WP.length;
  return o});
 console.log(JSON.stringify(r));
 ok(r.direct===0,'sans option : aucun point de passage');
 ok(r.exp>=1,'la vue contient des meilleurs lieux ('+r.exp+')');
 ok(r.nbest>=1&&r.nbest<=3,'jusqu\'à 3 lieux deviennent des points de passage ('+r.nbest+')');
 ok(r.again===r.nbest,'second calcul : pas de doublons ('+r.again+')');
 ok(r.ok,'tracé calculé');
 ok(r.n1===1||r.n1===0,'réglage 1 : un seul lieu ('+r.n1+')');
 ok(r.off===0,'option décochée : les points automatiques disparaissent');
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();process.exit(fail?1:0)})();
