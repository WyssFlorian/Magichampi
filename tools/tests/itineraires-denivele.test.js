// Test Playwright de la limite de dénivelé (A→B, boucle) : le tracé limité respecte la limite ou le message l'annonce. iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-denivele.test.js [région]   (défaut : pde)
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
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let sd=12345;const rnd=()=>(sd=(sd*16807)%2147483647)/2147483647;   // graine fixe
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))},sel=v=>{$('it-dv').value=v;$('it-dv').dispatchEvent(new Event('change'))};
  const go=async()=>{$('it-res').innerHTML='';$('it-msg').textContent='';$('it-go').click();for(let i=0;i<300;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  o.hiddenAtStart=$('it-dvrow').hidden;
  // A→B : deux points ~2-3 km avec dénivelé notable
  $('it-mode').value='ab';$('it-mode').dispatchEvent(new Event('change'));
  let A=0,B=0,best=0;
  for(let t=0;t<400;t++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length);if(!inW(i)||!inW(j)||g.cls[g.SE[i]]<3||g.cls[g.SE[j]]<3)continue;
    const d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d>1500&&d<3500){A=i;B=j;break}}
  ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  await go();const S0=ITIN.last;o.base=S0&&{up:Math.round(S0.up),dn:Math.round(S0.dn),len:Math.round(S0.len)};
  if(S0){
    const lim=Math.max(50,Math.floor(S0.up*.5/50)*50);
    sel('up');set('it-dvm',lim);await go();const S1=ITIN.last;o.upOnly={lim,up:S1&&Math.round(S1.up),dn:S1&&Math.round(S1.dn),len:S1&&Math.round(S1.len),msg:$('it-msg').textContent,txt:$('it-res').textContent.match(/limite[^)]*\)/)};
    sel('both');await go();const S2=ITIN.last;o.both={lim,up:S2&&Math.round(S2.up),dn:S2&&Math.round(S2.dn),msg:$('it-msg').textContent};
    set('it-dvm',2000);await go();const S3=ITIN.last;o.big={up:S3&&Math.round(S3.up),same:S3&&Math.abs(S3.len-S0.len)<1,txt:/✓ sous/.test($('it-res').textContent)};
    sel('0');o.hiddenAfter=$('it-dvrow').hidden;
  }
  // boucle
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));$('it-lm').value='len';$('it-lm').dispatchEvent(new Event('change'));set('it-lt',6);
  let k=0;for(let t=0;t<2000;t++){const i=Math.floor(rnd()*g.SX.length);if(inW(i)&&g.cls[g.SE[i]]>=4){k=i;break}}
  ITIN.setPt('A',mk(k));await go();const L0=ITIN.last;o.loopBase=L0&&{up:Math.round(L0.up),dn:Math.round(L0.dn),len:Math.round(L0.len)};
  if(L0){const lim=Math.max(50,Math.floor(L0.up*.6/50)*50);sel('both');set('it-dvm',lim);await go();const L1=ITIN.last;o.loopLim={lim,up:L1&&Math.round(L1.up),dn:L1&&Math.round(L1.dn),len:L1&&Math.round(L1.len),msg:$('it-msg').textContent.slice(0,200)}}
  return o});
 console.log(JSON.stringify(r,null,1));
 ok(r.hiddenAtStart===true,'curseur caché au départ');
 ok(!!r.base,'A→B sans limite calculé');
 if(r.upOnly){ok(r.upOnly.up<=r.upOnly.lim+1||/Aucun trajet respectant/.test(r.upOnly.msg),'positif seul : sous la limite ou message');ok(r.upOnly.up<=r.base.up,'positif seul : pas plus de montée que sans limite');
  ok(r.both.up<=r.both.lim+1&&r.both.dn<=r.both.lim+1||/Aucun trajet respectant/.test(r.both.msg),'positif + négatif : sous la limite ou message');ok(r.big.same&&r.big.txt,'grande limite : trajet inchangé, ✓ affiché');ok(r.hiddenAfter===true,'curseur recaché')}
 if(r.loopLim)ok(r.loopLim.up<=r.loopLim.lim+1&&r.loopLim.dn<=r.loopLim.lim+1||/dénivelé/.test(r.loopLim.msg),'boucle : sous la limite ou message');
 ok(errs.length===0,'aucune erreur JS '+errs.join('|').slice(0,300));
 await b.close();process.exit(fail?1:0)})();
