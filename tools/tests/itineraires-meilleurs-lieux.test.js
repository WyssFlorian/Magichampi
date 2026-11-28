// Test Playwright : bouton « ＋ ⭐ Meilleurs lieux » (meilleurs lieux de la vue ajoutés aux points de passage). iPhone 13, sans réseau.
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
  // bouton ⭐ : ajoute les meilleurs lieux comme points manuels (retirables), sans doublon
  state.bestN=3;$('it-star').click();for(let i=0;i<300;i++){await sleep(100);if(ITIN.WP.length&&!$('it-prog').offsetParent)break}await sleep(1500);
  o.star=ITIN.WP.length;o.starOrd=document.getElementById('it-wopt').checked;o.starBest=0;
  $('it-star').click();await sleep(2500);o.star2=ITIN.WP.length;o.minD=Math.min(...ITIN.WP.flatMap((a,i)=>ITIN.WP.slice(i+1).map(b=>a.ll.distanceTo(b.ll))));
  $('it-wlist').querySelector('button[data-a=x]').click();await sleep(1500);o.starRm=ITIN.WP.length;
  return o});
 console.log(JSON.stringify(r));
 ok(r.star>=1&&r.star<=3&&r.starBest===0,'⭐ : '+r.star+' points manuels ajoutés');
 ok(r.starOrd===true,'⭐ : ordre le plus court activé par défaut');
 ok(r.star2>=r.star&&r.minD>=150,'⭐ deux fois (la vue a changé) : aucun point à moins de 150 m d\'un autre ('+Math.round(r.minD)+' m)');
 ok(r.starRm===r.star2-1,'un point ⭐ se retire comme les autres');
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();process.exit(fail?1:0)})();
