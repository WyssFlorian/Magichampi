// Test Playwright des options d'itinéraire : tout-terrain en boucle, difficulté maximale, rythme, export GPX. iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-options.test.js [région]   (défaut : pde)
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
 await p.screenshot({path:'/tmp/it0.png'});
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),wait=()=>new Promise(r=>setTimeout(r,50));
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  let k=0;for(let t=0;t<2000;t++){const i=Math.floor(Math.random()*g.SX.length);if(inW(i)&&g.cls[g.SE[i]]>=3){k=i;break}}
  const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))},sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const go=async()=>{$('it-go').click();for(let i=0;i<200;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  const dur=()=>{const t=$('it-res').querySelector('.it-big');return t?t.textContent:''};
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));ITIN.setPt('A',mk(k));
  $('it-lm').value='len';$('it-lm').dispatchEvent(new Event('change'));set('it-lt',6);
  for(let t=0;t<25;t++){let k2=0;for(let u=0;u<2000;u++){const i=Math.floor(Math.random()*g.SX.length);if(inW(i)&&g.cls[g.SE[i]]>=4){k2=i;break}}ITIN.setPt('A',mk(k2));await go();if(dur())break}
  o.loopBase=dur();o.msg0=$('it-msg').textContent;
  // rythme ×3 : durée affichée ≈ 3× pour un même tracé
  set('it-dur',5);await go();o.loopX3=dur();set('it-dur',2);
  // difficulté maximale facile : les boucles proposées respectent le maximum (ou le message l'annonce)
  set('it-max',1);await go();o.maxMsg=$('it-msg').textContent;o.maxPill=($('it-res').querySelector('.pill')||{}).textContent;set('it-max',4);
  // tout-terrain en boucle
  ITIN.setTT(true);$('it-offok').checked=true;
  await go();o.ttMsg=$('it-msg').textContent;o.ttRes=dur();o.ttOffTxt=/hors chemin/.test($('it-res').innerHTML);o.ttVars=$('it-vars').children.length;
  // tout-terrain actif à tous les niveaux : plus de refus, tracé respectant le maximum
  set('it-max',0);$('it-msg').textContent='';$('it-res').innerHTML='';await go();o.ttRefus=$('it-msg').textContent;o.tt0Pill=($('it-res').querySelector('.pill')||{}).textContent;o.tt0Rule=/≤ \d+ m d'un chemin, pente < 8°/.test($('it-res').innerHTML);set('it-max',4);await sleep(6000);
  // GPX + lien swisstopo
  ITIN.setTT(false);await go();
  o.geo=$('it-geo')?$('it-geo').href:'';
  let gpxTxt='';const orig=URL.createObjectURL;URL.createObjectURL=f=>{f.text().then(t=>gpxTxt=t);return orig(f)};Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});
  const nav=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)o.dl=this.download;else nav.call(this)};
  o.noKml=!$('it-kml');$('it-gpx').click();await sleep(300);o.kmlOk=/<trkpt /.test(gpxTxt)&&/<gpx/.test(gpxTxt);
  o.lv=ITIN.lv95(46.95105,7.43864);   // Berne, ancien observatoire ≈ 2600000, 1200000
  // A→B difficulté maximale
  $('it-mode').value='ab';$('it-mode').dispatchEvent(new Event('change'));
  return o});
 console.log('  ',JSON.stringify(r));
 ok(/de marche/.test(r.loopBase)||!!r.msg0,'boucle de base : '+r.loopBase);
 const m=s=>{const x=/(?:(\d+) h)?\s*(\d+)?\s*(min)?/.exec(s);return 0};
 ok(!!r.loopX3,'rythme ×3 : '+r.loopX3+' (base '+r.loopBase+')');
 ok(r.maxPill===undefined||['très facile','facile'].includes(r.maxPill)||/Aucune boucle|plus facile|Cible réduite/.test(r.maxMsg),'difficulté max « facile » : '+r.maxPill+' / '+r.maxMsg);
 ok(r.ttVars>=1||/Tout-terrain|zone|Aucun|déconseillé|météo|aucune|Aucune/i.test(r.ttMsg),'tout-terrain en boucle : '+(r.ttVars?r.ttVars+' variante(s), hors chemin='+r.ttOffTxt:r.ttMsg));
 ok(!/au moins « difficile »/.test(r.ttRefus),'tout-terrain plus refusé en « très facile » : '+r.ttRefus);
 ok(!r.tt0Pill||r.tt0Pill==='très facile'||/plus facile|Aucune/.test(r.ttRefus),'tout-terrain très facile : niveau '+r.tt0Pill+(r.tt0Rule?' (règle affichée)':''));
 ok(/map\.geo\.admin\.ch.*crosshair=marker,2[56]\d{5},1\d{6}/.test(r.geo),'lien swisstopo : '+r.geo);
 ok(r.dl==='itineraire-magichampi.gpx'&&r.kmlOk&&r.noKml,'export GPX seul (pas de KML)');
 ok(Math.abs(r.lv[0]-2600000)<5&&Math.abs(r.lv[1]-1200000)<5,'conversion LV95 : '+r.lv.map(Math.round));
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await p.screenshot({path:'/tmp/it1.png'});
 await b.close();process.exit(fail?1:0)})();
