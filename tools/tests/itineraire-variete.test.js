// Test Playwright de « Optimiser par variété » (A→B et boucle). iPhone 13, sans réseau.
// usage : node tools/tests/itineraire-variete.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');window.__TTOFF=true;document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>{ITIN.setSeed(20261123);ITIN.setAlea(false)});await p.waitForTimeout(2500);
 await p.screenshot({path:'/tmp/claude-0/-home-user/19a067f0-991f-594a-8130-3fa66ef3d9a1/scratchpad/var0.png'});

 await p.click('summary:has-text("Itinéraire découverte")').catch(()=>{});
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))};
  const go=async()=>{$('it-res').innerHTML='';$('it-msg').textContent='';$('it-go').click();for(let i=0;i<300;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  // deux espèces de saison avec des zones élevées dans la région
  $('it-var').checked=true;$('it-var').dispatchEvent(new Event('change'));await sleep(200);
  o.nList=$('it-varlist').querySelectorAll('[data-sp]').length;
  state.seasonOnly=false;if(typeof render==='function')render();await sleep(300);
  const sea=SPECIES.filter(sp=>!protHidden(sp)&&sp.tier===1);o.nSeason=sea.length;$('it-varlist').innerHTML='';ITIN.varList();
  $('it-varnone').click();
  let pick=[];for(const sp of sea){const C=classesFor(sp).C;let h=0;for(let i=0;i<C.length;i+=7)if(C[i]!==255&&C[i]>=3)h++;if(h>200)pick.push(sp)}
  pick=pick.slice(0,2);o.pick=pick.map(s=>s.id);
  pick.forEach(sp=>{$('it-varlist').querySelector('[data-sp="'+sp.id+'"]').checked=true});$('it-varlist').querySelector('[data-sp]').dispatchEvent(new Event('change'));
  o.varOnlyDetour=+$('it-env').value;$('it-env').value=3;
  const n=g.SX.length;let A=0,B=0;
  for(let t=0;t<4000&&!B;t++){const i=Math.floor(Math.random()*n),j=Math.floor(Math.random()*n);if(!inW(i)||!inW(j))continue;const d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d>2500&&d<3500){A=i;B=j}}
  ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  $('it-mode').value='ab';
  const total=()=>{const t=$('it-msg').textContent;return t};
  await go();o.msgVar=total();o.varOn=!!ITIN.VAR;o.varSps=ITIN.VAR&&ITIN.VAR.sps.length;
  const lenVar=($('it-res').querySelector('.it-big')||{}).textContent;o.resVar=lenVar;
  const rep=S=>{const t=ITIN.varReport(S);let s=0;(t.match(/ (\d+[,.]?\d*) (km|m)\b/g)||[]).forEach(x=>{const m=x.trim().split(' ');s+=m[1]==='km'?parseFloat(m[0].replace(',','.'))*1000:parseFloat(m[0])});return s};
  o.gainVar=rep(ITIN.last);o.lenVar=ITIN.last.len;
  // comparaison : même trajet calculé avec la grille de la carte (option décochée), mesuré avec les mêmes variétés
  $('it-var').checked=false;await go();const Sb=ITIN.last;$('it-var').checked=true;ITIN.prepVar();o.gainBase=rep(Sb);o.lenBase=Sb.len;ITIN.prepVar();
  $('it-var').checked=true;
  // boucle
  $('it-env').value=3;$('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));ITIN.setPt('A',mk(A));$('it-lm').value='len';$('it-lm').dispatchEvent(new Event('change'));set('it-lt',6);
  await go();o.loopMsg=$('it-msg').textContent;o.loopRes=($('it-res').querySelector('.it-big')||{}).textContent;
  // aucune espèce cochée
  $('it-varnone').click();await go();o.none=$('it-msg').textContent;
  // décocher l'option : retour à la grille de la carte
  $('it-var').checked=false;$('it-var').dispatchEvent(new Event('change'));await sleep(500);o.off=!ITIN.VAR;
  return o});
 console.log(JSON.stringify(r,null,1));
 ok(r.nList>=20,'liste de variétés affichée ('+r.nList+')');
 ok(r.pick.length>=1,'au moins une variété de saison avec des zones élevées');
 ok(r.varOn&&/Optimisé pour/.test(r.msgVar),'A→B : message « Optimisé pour »');
 ok(/zone élevée ou mieux/.test(r.msgVar),'A→B : rapport par variété sur le tracé');
 ok(r.gainVar>=r.gainBase&&r.gainVar>0,'A→B : plus de zone élevée avec l\'optimisation ('+r.gainVar+' m ≥ '+r.gainBase+' m)');
 ok(/Optimisé pour/.test(r.loopMsg)&&!!r.loopRes,'boucle optimisée par variété');
 ok(/cochez au moins une variété/.test(r.none),'aucune variété cochée : message');
 ok(r.off,'option décochée : grille de la carte');
 await p.screenshot({path:'/tmp/claude-0/-home-user/19a067f0-991f-594a-8130-3fa66ef3d9a1/scratchpad/var1.png'});
 ok(errs.length===0,'aucune erreur JS '+errs.join(' | '));
 await b.close();console.log(fail?'ÉCHEC':'OK');process.exit(fail?1:0)})();
