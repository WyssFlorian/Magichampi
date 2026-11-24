// Test Playwright : plafond strict de distance / durée (jamais dépassé) pour boucle, A→B et points de passage. iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-plafond.test.js [région]   (défaut : pde)
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
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const cand=[];for(let i=0;i<g.SX.length;i+=Math.floor(g.SX.length/4000)||1)if(inW(i)&&g.cls[g.SE[i]]>=4)cand.push(i);
  const A=cand[Math.floor(cand.length/2)],d=(i,j)=>Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);
  const near=(r1,r2,not)=>{for(const i of cand)if(i!==not&&d(i,A)>r1&&d(i,A)<r2)return i;return -1};
  const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))},sel=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('change'))};
  const go=async()=>{$('it-res').innerHTML='';$('it-msg').textContent='';$('it-go').click();for(let i=0;i<300;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  const res=()=>({last:!!ITIN.last,len:ITIN.last?ITIN.last.len:0,sec:ITIN.last?ITIN.last.sec:0,msg:$('it-msg').textContent,card:!!$('it-res').innerHTML});
  // départs aléatoires (graine fixe) jusqu'à obtenir une boucle ; chaque réglage est essayé sur plusieurs départs
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647,starts=Array.from({length:10},()=>cand[Math.floor(rnd()*cand.length)]);
  const tryLoop=async()=>{let n=0,fails=0,r;for(const k of starts){ITIN.setPt('A',mk(k));await go();r=res();n++;if(r.last){r.vars=[];for(const bt of [...$('it-vars').querySelectorAll('button')]){bt.click();await sleep(300);r.vars.push([ITIN.last.len,ITIN.last.sec])}r.tries=n;return r}if(!/Plafond/.test(r.msg)&&!/Aucune boucle/.test(r.msg))break;fails++}r.tries=n;r.vars=[];return r};
  sel('it-mode','loop');sel('it-lm','len');set('it-lt',6);o.noneLoop=$('it-lm').querySelector('[value=none]').disabled;
  o.loop=await tryLoop();
  sel('it-lm','dur');set('it-lt',120);set('it-dur',3);o.loopDur=await tryLoop();set('it-dur',2);
  sel('it-lm','len');set('it-lt',2);o.loopTiny=await tryLoop();
  // plafond impossible (2 km) : si aucune boucle, le message le dit et rien n'est tracé
  ITIN.setPt('A',mk(A));
  // 4) A→B
  sel('it-mode','ab');const B=near(1500,2500,A);ITIN.setPt('A',mk(A));ITIN.setPt('B',mk(B));
  sel('it-lm','none');await go();o.abFree=res();
  sel('it-lm','len');set('it-lt',2);set('it-env',0);await go();o.abOk=res();   // plafond 2 km sur 1,5-2,5 km à vol d'oiseau
  sel('it-lm','dur');set('it-lt',30);set('it-dur',0);await go();o.abJog=res();   // 30 min, jogging ×½ : passe
  set('it-dur',5);await go();o.abX3=res();set('it-dur',2);   // 30 min, ×3 : doit échouer ou rester ≤ 30 min
  sel('it-lm','len');set('it-lt',2);o.minAB=o.abFree.len;
  // 5) A→B avec détour : plafond juste au-dessus du trajet direct
  sel('it-lm','none');set('it-env',0);await go();const base=ITIN.last?ITIN.last.len:0;
  sel('it-lm','len');set('it-lt',Math.max(2,Math.ceil(base/1000)));set('it-env',3);await go();o.abDetour=res();o.abBase=base;
  // 6) points de passage : plafond trop bas
  set('it-env',0);sel('it-lm','none');await go();
  const W=near(300,900,A);if(W>=0){ITIN.wpAdd(mk(W))}
  sel('it-lm','len');set('it-lt',2);await go();o.wp=res();
  sel('it-lm','dur');set('it-lt',30);await go();o.wpDur=res();
  return o});
 console.log('  ',JSON.stringify(r));
 ok(r.noneLoop,'boucle : « aucun plafond » indisponible');
 ok(r.loop.last&&r.loop.vars.every(v=>v[0]<=6000),'boucle 6 km : toutes les variantes ≤ 6 km ('+r.loop.vars.map(v=>Math.round(v[0]))+', départ n°'+r.loop.tries+')');
 ok(r.loopDur.last&&r.loopDur.vars.every(v=>v[1]<=7200),'boucle 2 h ×1,5 : variantes ≤ 2 h ('+r.loopDur.vars.map(v=>Math.round(v[1]/60))+' min, départ n°'+r.loopDur.tries+')');
 ok(!r.loopTiny.last||r.loopTiny.vars.every(v=>v[0]<=2000),'boucle 2 km : jamais plus de 2 km ('+(r.loopTiny.last?r.loopTiny.vars.map(v=>Math.round(v[0])):r.loopTiny.msg.slice(0,90))+')');
 ok(r.abFree.last,'A→B sans plafond : '+Math.round(r.abFree.len)+' m');
 ok(r.abOk.last?r.abOk.len<=2000:/Plafond/.test(r.abOk.msg),'A→B ≤ 2 km : '+Math.round(r.abOk.len)+' m');
 ok(r.abJog.last?r.abJog.sec<=1800:/Plafond/.test(r.abJog.msg),'A→B 30 min jogging : '+Math.round(r.abJog.sec/60)+' min');
 ok(r.abX3.last?r.abX3.sec<=1800:/Plafond/.test(r.abX3.msg)&&!r.abX3.card,'A→B 30 min ×3 : '+(r.abX3.last?Math.round(r.abX3.sec/60)+' min':'refusé, aucun tracé'));
 ok(!r.abDetour.last||r.abDetour.len<=Math.max(2,Math.ceil(r.abBase/1000))*1000,'A→B détour sous plafond : '+Math.round(r.abDetour.len)+' m (base '+Math.round(r.abBase)+')');
 ok(r.wp.last?r.wp.len<=2000:/Plafond/.test(r.wp.msg)&&!r.wp.card,'points de passage 2 km : '+(r.wp.last?Math.round(r.wp.len)+' m':r.wp.msg.slice(0,100)));
 ok(r.wpDur.last?r.wpDur.sec<=1800:/Plafond/.test(r.wpDur.msg)&&!r.wpDur.card,'points de passage 30 min : '+(r.wpDur.last?Math.round(r.wpDur.sec/60)+' min':'refusé'));
 ok(errs.length===0,'aucune erreur de script'+(errs.length?' : '+errs[0]:''));
 await b.close();console.log(fail?'ÉCHEC':'OK');process.exit(fail?1:0)})();
