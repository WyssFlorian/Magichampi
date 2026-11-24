// Test Playwright des points de passage obligatoires (A→B et boucle, ordre, retrait, difficulté, GPX). iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-waypoints.test.js [région]   (défaut : pde)
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
  const A=mid,W1=near(A,700,1200),B=near(W1,700,1200),W2=near(B,500,1000);
  const go=async()=>{$('it-go').click();for(let i=0;i<300;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  const big=()=>{const t=$('it-res').querySelector('.it-big');return t?t.textContent:''};
  ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  await go();o.direct=big();const lenD=ITIN.last.len;
  ITIN.wpAdd(mk(W1));await go();o.one=big();o.legs1=($('it-res').querySelectorAll('.it-legs li')||[]).length;o.lenW=ITIN.last.len;o.wps=ITIN.last.wps&&ITIN.last.wps.length;
  o.markers=document.querySelectorAll('.leaflet-marker-icon div').length;o.list=$('it-wlist').children.length;
  ITIN.wpAdd(mk(W2));await go();o.two=big();o.legs2=$('it-res').querySelectorAll('.it-legs li').length;
  // réordonner
  $('it-wlist').querySelector('button[data-a=dn]').click();await sleep(1500);o.order=ITIN.WP.length;
  // retirer
  $('it-wlist').querySelector('button[data-a=x]').click();await sleep(1500);o.afterRm=ITIN.WP.length;
  // optimisation d'ordre
  $('it-wopt').checked=true;ITIN.wpAdd(mk(W2));await go();o.opt=$('it-msg').textContent;$('it-wopt').checked=false;
  // exports
  let gp='',km='';const orig=URL.createObjectURL;URL.createObjectURL=f=>{f.text().then(t=>/<gpx/.test(t)?gp=t:km=t);return orig(f)};Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});
  const nav=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)o.dl=this.download;else nav.call(this)};
  $('it-gpx').click();await sleep(400);o.gpxWpt=(gp.match(/<wpt /g)||[]).length;o.kmlWpt=0;
  // difficulté maximale très facile : message clair éventuel
  $('it-max').value=0;$('it-max').dispatchEvent(new Event('input'));await sleep(500);await go();o.maxMsg=$('it-msg').textContent;
  $('it-max').value=4;$('it-max').dispatchEvent(new Event('input'));await sleep(2500);
  // boucle
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));ITIN.setPt('A',mk(A));$('it-lt').value=20;await go();o.loop=big();o.loopMsg=$('it-msg').textContent;o.loopLegs=$('it-res').querySelectorAll('.it-legs li').length;
  // tout-terrain
  ITIN.setTT(true);$('it-offok').checked=true;await go();o.tt=big();o.ttMsg=$('it-msg').textContent;
  // clic carte pour placer un point (mode « armé »)
  ITIN.setTT(false);
  $('it-w').click();o.banner=($('it-bt')||{}).textContent;
  return o});
 console.log('  ',JSON.stringify(r));
 ok(/de marche/.test(r.one)&&r.wps===1,'A→B avec 1 point : '+r.one+' (direct '+r.direct+')');
 ok(r.legs1===2&&r.legs2===3,'étapes affichées : '+r.legs1+', '+r.legs2);
 ok(r.markers>=3&&r.list===1,'marqueurs numérotés + liste');
 ok(r.afterRm===1,'retrait d\'un point');
 ok(r.gpxWpt===r.afterRm+0||r.gpxWpt>=1,'GPX : '+r.gpxWpt+' wpt, KML '+r.kmlWpt);
 ok(/de marche/.test(r.loop)&&r.loopLegs>=2,'boucle avec points : '+r.loop+', '+r.loopLegs+' étapes');
 ok(/Point|point/.test(r.maxMsg)||/de passage/.test(r.maxMsg),'message difficulté : '+r.maxMsg);
 ok(/Touchez la carte pour placer le point de passage/.test(r.banner),'bannière : '+r.banner);
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await p.screenshot({path:'/tmp/wp1.png'});
 await b.close();process.exit(fail?1:0)})();
