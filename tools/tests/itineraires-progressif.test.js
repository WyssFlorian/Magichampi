// Test Playwright : tout-terrain progressif, 5 des 10 meilleurs points, parcours différent à chaque « Calculer ». iPhone 13, sans réseau.
// usage : node tools/tests/itineraires-progressif.test.js [région]   (défaut : ple)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'ple';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/json'};
let fail=0;const ok=(c,m)=>{console.log((c?'  ok  ':'  KO  ')+m);if(!c)fail++};
(async()=>{
 const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1')}catch(e){}});
 const p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.stack||e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{
  const o={},g=await ITIN.loadGraph(),$=i=>document.getElementById(i),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const pairs=[];for(let q=0;q<40000&&pairs.length<10;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);
    if(inW(i)&&inW(j)&&g.cls[g.SE[i]]>=4&&g.cls[g.SE[j]]>=4&&d>1500&&d<3000)pairs.push([i,j])}
  const dd=ll=>{const x=(ll[1]-g.lon0)*g.kx,y=(ll[0]-g.lat0)*g.ky,cx=Math.floor(x/100),cy=Math.floor(y/100);let bd=1e18;for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const l=g.idx.get((cx+a)+","+(cy+c));if(l)for(const k of l){const d=(g.SX[k]-x)**2+(g.SY[k]-y)**2;if(d<bd)bd=d}}return Math.sqrt(bd)};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // 1) bande hors chemin selon (détour, difficulté) : très facile sans détour ≈ 10 m ; moyen + détour ≈ 30 m ; difficile + grand détour = règles de la difficulté
  const band=async(env,M)=>{const ds=[];let n=0,prog=-1;for(const [i,j] of pairs.slice(0,8)){ITIN.setSeed(5);const R=await ITIN.routeOff(mk(i),mk(j),env,M);if(R.error)continue;n++;prog=R.prog;
    for(const l of R.pl)if(l.k==='o')for(let t=1;t<l.ll.length;t++){const a=l.ll[t-1],c=l.ll[t],m=Math.max(1,Math.ceil(Math.hypot((c[1]-a[1])*g.kx,(c[0]-a[0])*g.ky)/8));for(let q=0;q<=m;q++)ds.push(dd([a[0]+(c[0]-a[0])*q/m,a[1]+(c[1]-a[1])*q/m]))}}
    ds.sort((x,y)=>x-y);return {n,prog,p90:ds.length?ds[Math.floor(.9*ds.length)]:0,max:ds.length?ds[ds.length-1]:0}};
  o.b00=await band(0,0);o.b22=await band(2,2);o.b33=await band(3,3);o.b34=await band(3,4);ITIN.setSeed(null);
  // 2) 5 des 10 meilleurs points : A→B réseau, grand détour, limites larges
  const set=(id,v)=>{$(id).value=v;$(id).dispatchEvent(new Event('input'))};
  const go=async()=>{$('it-go').click();for(let i=0;i<300;i++){await sleep(100);const m=$('it-msg').textContent;if(m&&!/^Calcul/.test(m)||$('it-res').innerHTML)break}await sleep(300)};
  const sig=()=>{const S=ITIN.last;return S&&S.ll?S.ll.length+':'+Math.round(S.ll.reduce((a,x)=>a+x[0]*1e5%977+x[1]*1e5%911,0)):''};
  let topSeen=0,topMax=0,capOk=true,nTop=0;
  $('it-mode').value='ab';$('it-mode').dispatchEvent(new Event('change'));$('it-lm').value='len';$('it-lm').dispatchEvent(new Event('change'));set('it-lt',12);set('it-max',4);set('it-env',3);
  for(const [i,j] of pairs.slice(0,6)){ITIN.setPt('A',mk(i));ITIN.setPt('B',mk(j));await go();const S=ITIN.last;if(!S)continue;nTop++;
    if(S.len>12000+1)capOk=false;const m=/Passe par (\d+) des (\d+)/.exec($('it-msg').textContent);if(m){topSeen++;topMax=Math.max(topMax,+m[1])}}
  o.ab={nTop,topSeen,topMax,capOk};
  // 3) parcours différent à chaque « Calculer » (boucle, plafond 6 km) : graines aléatoires → plusieurs tracés distincts, tous sous le plafond
  $('it-mode').value='loop';$('it-mode').dispatchEvent(new Event('change'));set('it-lt',6);set('it-env',2);set('it-max',4);
  const A=mk(pairs[0][0]);ITIN.setPt('A',A);const sigs=new Set(),lens=[];let overCap=0,topLoop=0;
  for(let t=0;t<5;t++){await go();const S=ITIN.last;if(!S)continue;sigs.add(sig());lens.push(Math.round(S.len));if(S.len>6000+1)overCap++;const m=/passe par (\d+) des (\d+)/.exec($('it-msg').textContent);if(m)topLoop=Math.max(topLoop,+m[1])}
  for(let k=1;k<5;k++){ITIN.setPt('A',mk(pairs[k][0]));for(let t=0;t<2;t++){await go();const S=ITIN.last;if(!S)continue;if(S.len>6000+1)overCap++;const m=/passe par (\d+) des (\d+)/.exec($('it-msg').textContent);if(m)topLoop=Math.max(topLoop,+m[1])}}
  o.loop={distinct:sigs.size,lens,overCap,topLoop};
  // 4) même graine = même tracé
  ITIN.setSeed(777);await go();const s1=sig();ITIN.setSeed(777);await go();const s2=sig();ITIN.setSeed(null);o.same=[s1,s2];
  return o});
 console.log(JSON.stringify(r));
 ok(r.b00.n>=4,'tout-terrain très facile sans détour : tracés trouvés ('+r.b00.n+')');
 ok(r.b00.prog===0&&r.b22.prog===4&&r.b33.prog===6,'indice de progression 0 / 4 / 6 (très facile+0, moyen+2, difficile+3)');
 ok(r.b00.p90<=15&&r.b00.max<=26,'très facile sans détour : hors chemin dans une bande de ≈ 10 m (p90 '+Math.round(r.b00.p90)+' m, max '+Math.round(r.b00.max)+' m)');
 ok(r.b22.p90<=40,'moyen + détour : allers-retours à ≈ 30 m du chemin (p90 '+Math.round(r.b22.p90)+' m)');
 ok(r.b33.max>=r.b00.max,'difficile + grand détour : au moins aussi large que très facile (max '+Math.round(r.b33.max)+' m)');
 ok(r.ab.nTop>=4,'A→B : tracés calculés ('+r.ab.nTop+'/6) et plafond de 12 km respecté : '+r.ab.capOk);
 ok(r.ab.topSeen>=2&&r.ab.topMax>=3,'A→B grand détour : passe par des meilleurs points (max '+r.ab.topMax+' sur 10, objectif 5)');
 ok(r.loop.distinct>=3,'boucle : parcours différent à chaque calcul ('+r.loop.distinct+' tracés distincts sur 5)');
 ok(r.loop.overCap===0,'boucle : jamais au-dessus du plafond de 6 km ('+r.loop.lens.join(', ')+' m)');
 ok(r.loop.topLoop>=3,'boucle : passe par des meilleurs points (max '+r.loop.topLoop+' sur 10, objectif 5)');
 ok(r.same[0]&&r.same[0]===r.same[1],'même graine = même tracé');
 ok(errs.length===0,'aucune erreur JS'+(errs.length?' : '+errs[0]:''));
 await b.close();console.log(fail?'ÉCHEC '+fail:'OK');process.exit(fail?1:0)})();
