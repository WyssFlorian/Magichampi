// Test Playwright (vague 3) : qualité des tracés. Plafond de détour A→B, repassage spatial des boucles (couloir + forme à 4 étapes), tout-terrain plafonné et lissé.
// usage : node tools/tests/itineraires-trace.test.js [région]   (défaut : pde)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'pde';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');localStorage.setItem('champi-tour2','vu')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  const len=R=>R.seq.reduce((a,[,s0,s1])=>a+Math.abs(s1-s0),0);
  // 1) plafond de détour A→B : 40 trajets de 1,5 à 6 km (graine fixe), longueur ≤ 1,35 × (1,6 en grand détour) le plus court sans pénalité
  let s=12345;const rnd=()=>(s=(s*16807)%2147483647)/2147483647,rt={e0:[],e3:[]};
  for(let q=0,n=0;q<3000&&n<40;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d<1500||d>6000)continue;
   const A=ITIN.snap(mk(i)),B=ITIN.snap(mk(j));if(!A||!B)continue;ITIN.setOffP(0);const R0=ITIN.route(A,B,0);ITIN.setOffP(4);const Rc=ITIN.routeCap(A,B,0),R3=ITIN.routeCap(A,B,3);if(!R0||!Rc||!R3)continue;n++;rt.e0.push(len(Rc)/len(R0));rt.e3.push(len(R3)/len(R0))}
  o.rt={n:rt.e0.length,max0:Math.max(...rt.e0),max3:Math.max(...rt.e3)};
  // plafond désactivé : comportement d'avant (un trajet dépasse en général 1,35 sur 40 trajets ; sinon le test ne prouverait rien, on ne l'exige pas)
  // 2) boucles : repassage spatial. Mêmes départs avec et sans couloir (graine fixe) ; on garde la part de tronçons répétés (loopMetrics)
  const cx=meta.x0+meta.cols*meta.res/2,cy=meta.y1-meta.rows*meta.res/2,ll=L.Projection.SphericalMercator.unproject(L.point(cx,cy));
  const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))},sel=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('change'))};
  sel('it-mode','loop');sel('it-lm','len');set('it-lt',8);sel('it-dv','0');set('it-max',4);set('it-env',0);ITIN.setPt('A',L.latLng(ll.lat,ll.lng));
  const loop=async(pc,sq)=>{ITIN.setCorridor(pc,sq);await ITIN.compute();const S=ITIN.last;return S&&S.met?{len:Math.round(S.len),rep:+S.met.rep.toFixed(3),fo:+S.met.forest.toFixed(2),n:$('it-vars').querySelectorAll('button').length}:null};
  o.loopOld=await loop(1,0);o.loopNew=await loop(8,1);ITIN.setCorridor(8,1);
  // 3) tout-terrain : part hors chemin plafonnée (détour 2 : 70 %) et tracé lissé (pas de pas de 25 m en escalier : segments longs)
  sel('it-mode','ab');set('it-env',2);
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const off=[];for(let q=0;q<400&&off.length<4;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);if(d<800||d>3000||!inW(i)||!inW(j))continue;
   const R=await ITIN.routeOff(mk(i),mk(j),2,4);if(R.error)continue;const S=ITIN.summarize(R);let pts=0,seg=0;for(const l of R.pl)if(l.k==='o'){pts+=l.ll.length;seg++}
   off.push({share:+(S.off/S.len).toFixed(2),len:Math.round(S.len),offlen:Math.round(S.off),pts,seg})}
  o.off=off;return o});
 console.log(JSON.stringify(r));
 ok(r.rt.n>=20,'plafond de détour : '+r.rt.n+' trajets A→B mesurés');
 ok(r.rt.max0<=1.35+1e-6,'A→B sans détour : longueur ≤ 1,35 × le plus court (max '+r.rt.max0.toFixed(2)+')');
 ok(r.rt.max3<=1.6+1e-6,'A→B « grand détour » : longueur ≤ 1,6 × le plus court (max '+r.rt.max3.toFixed(2)+')');
 ok(!!r.loopNew&&r.loopNew.len>0&&r.loopNew.len<=8000,'boucle avec couloir : tracée et sous le plafond ('+JSON.stringify(r.loopNew)+')');
 ok(!!r.loopOld&&!!r.loopNew&&r.loopNew.rep<=r.loopOld.rep+.02,'boucle : répétitions avec couloir ('+(r.loopNew&&r.loopNew.rep)+') pas plus nombreuses que sans ('+(r.loopOld&&r.loopOld.rep)+')');
 ok(!!r.loopNew&&r.loopNew.rep<=.10,'boucle : tronçons répétés ≤ 10 % ('+(r.loopNew&&r.loopNew.rep)+')');
 ok(r.off.length>=1,'tout-terrain : '+r.off.length+' trajets mesurés');
 ok(r.off.every(x=>x.offlen<=.7*x.len+30),'tout-terrain : part hors chemin ≤ 70 % en détour 2 ('+r.off.map(x=>x.share).join(', ')+')');
 ok(r.off.every(x=>!x.seg||x.pts/x.seg<=Math.max(12,x.offlen/60)),'tout-terrain : tracé lissé (points par segment hors chemin : '+r.off.map(x=>x.seg?(x.pts/x.seg).toFixed(0):'-').join(', ')+')');
 ok(!errs.length,'aucune erreur de page'+(errs.length?' : '+errs[0].slice(0,200):''));
 await b.close();console.log(fail?fail+' échec(s)':'tout passe');process.exit(fail?1:0)})();
