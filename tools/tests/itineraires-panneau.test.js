// Test Playwright (vague 2) : panneau en deux niveaux, préréglages, progression + annulation, résultat condensé, coûts en cache, distance par les chemins, seuil de temps des boucles (CPU ×4).
// usage : node tools/tests/itineraires-panneau.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');localStorage.setItem('champi-tour2','vu')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.evaluate(()=>ITIN.setSeed(20261123));await p.waitForTimeout(2500);
 await p.evaluate(()=>{document.getElementById('sec-itin').open=true});
 // 1) panneau : seuls type, points, plafond et Calculer sont visibles ; les réglages sont repliés
 const a=await p.evaluate(()=>{const $=i=>document.getElementById(i),inReg=i=>!!$(i).closest('#it-reg');
  return {reg:$('it-reg').open,shown:['it-mode','it-a','it-go','it-lm','it-w'].every(i=>!inReg(i)),hidden:['it-env','it-dur','it-max','it-dv','it-off','it-var'].every(inReg),pre:document.querySelectorAll('#sec-itin [data-pre]').length,resume:$('it-resume').textContent}});
 ok(!a.reg&&a.shown&&a.hidden,'panneau : réglages repliés, type / points / plafond / Calculer visibles ('+a.resume+')');ok(a.pre===3,'3 préréglages');
 // 2) préréglages : Balade facile = détour léger, ×1, max facile, D+ ≤ 200 m ; une modification manuelle désélectionne
 const c=await p.evaluate(()=>{const $=i=>document.getElementById(i),q=s=>document.querySelector('#sec-itin [data-pre="'+s+'"]');
  q('balade').click();const x={max:$('it-max').value,dv:$('it-dv').value,dvm:$('it-dvm').value,env:$('it-env').value,row:$('it-dvrow').hidden,res:$('it-resume').textContent,on:q('balade').getAttribute('aria-pressed')};
  $('it-max').value=3;$('it-max').dispatchEvent(new Event('input',{bubbles:true}));x.off=q('balade').getAttribute('aria-pressed');
  q('sportif').click();x.sp=[$('it-dur').value,$('it-max').value,$('it-dv').value];return x});
 ok(c.max==='1'&&c.dv==='up'&&c.dvm==='200'&&c.env==='1'&&!c.row&&c.on==='true','préréglage « Balade facile » appliqué ('+c.res+')');
 ok(c.off==='false','réglage modifié à la main : préréglage désélectionné');ok(c.sp.join()==='1,4,0','préréglage « Sportif » : rythme ×¾, difficulté libre, pas de limite de dénivelé');
 // 3) progression et annulation
 await p.evaluate(async()=>{const $=i=>document.getElementById(i);await ITIN.loadGraph();$('it-dv').value='0';$('it-max').value=4;$('it-env').value=0;
  const cx=meta.x0+meta.cols*meta.res/2,cy=meta.y1-meta.rows*meta.res/2,ll=L.Projection.SphericalMercator.unproject(L.point(cx,cy));ITIN.setPt('A',L.latLng(ll.lat,ll.lng));
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));$('it-lm').value='len';$('it-lm').dispatchEvent(new Event('change'));$('it-lt').value=8;$('it-lt').dispatchEvent(new Event('input'))});
 const d=await p.evaluate(async()=>{const $=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const pr=ITIN.compute();await sleep(60);const o={shown:!$('it-prog').hidden,txt:$('it-progt').textContent};
  $('it-cancel').click();await pr;await sleep(50);o.after={hid:$('it-prog').hidden,msg:$('it-msg').textContent,res:$('it-res').innerHTML.length,vars:$('it-vars').innerHTML.length};return o});
 ok(d.shown&&/Calcul/.test(d.txt),'indicateur de progression affiché pendant le calcul ("'+d.txt+'")');
 ok(d.after.hid&&d.after.msg==='Calcul annulé.'&&d.after.res===0&&d.after.vars===0,'bouton Annuler : calcul arrêté, rien n\'est affiché');
 // 4) résultat condensé et seuil de temps des boucles à CPU ×4
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const e=await p.evaluate(async()=>{const $=i=>document.getElementById(i);const t0=performance.now();await ITIN.compute();const ms=Math.round(performance.now()-t0);
  return {ms,n:$('it-vars').querySelectorAll('button').length,btn:($('it-vars').querySelector('button')||{}).textContent,line:!!document.querySelector('#it-res .it-line'),det:(document.querySelector('#it-res details.it-more')||{}).open,detTxt:(document.querySelector('#it-res details.it-more')||{textContent:''}).textContent,prog:$('it-prog').hidden,msg:$('it-msg').textContent.length}});
 ok(e.n>=1&&/forêt/.test(e.btn||'')&&/\+\d+ m/.test(e.btn||''),'variantes de boucle avec dénivelé et part de forêt : '+e.btn);
 ok(e.line&&e.det===false&&/Dénivelé/.test(e.detTxt),'résultat sur une ligne, détails repliés');ok(e.prog,'progression masquée à la fin');
 ok(e.ms<6000,'boucle 8 km à CPU ×4 en moins de 6 s ('+e.ms+' ms ; avant la vague 2 : 3 à 8 s)');
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 // 5) coûts en cache et distance par les chemins
 const f=await p.evaluate(async()=>{const g=ITIN.graph,A=ITIN.snap(L.latLng(g.lat0+g.SY[0]/g.ky,g.lon0+g.SX[0]/g.kx));
  const q1=ITIN.bonusQ(),q2=ITIN.bonusQ(),dn=ITIN.netDist(A,3000);let n=0,mx=0,bad=0;for(let u=0;u<g.nN;u++)if(dn[u]<Infinity){n++;mx=Math.max(mx,dn[u])}
  // deux noeuds voisins (distances définitives, ≤ 3 000 m) diffèrent d au plus la longueur de l arête
  for(let e=0;e<g.nE;e++){const x=dn[g.a[e]],y=dn[g.b[e]];if(x<=3000&&y<=3000&&Math.abs(x-y)>g.len[e]+1e-3)bad++}
  return {same:q1===q2,n,mx:Math.round(mx),bad}});
 ok(f.same,'bonus de cueillette gardé en mémoire (même tableau)');ok(f.n>1&&f.mx<=3000+2000&&f.bad===0,'distance par les chemins cohérente ('+f.n+' noeuds, ≤ '+f.mx+' m)');
 ok(errs.length===0,'aucune erreur JS '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fail?'ÉCHEC':'OK');process.exit(fail?1:0)})();
