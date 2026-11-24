// Largeur de la bande hors chemin du tout-terrain progressif : distance (m) des points hors chemin au chemin le plus proche, par (envie, difficulté). usage : node tools/profil/tt-bande.js ple
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),Z=process.argv[2]||'ple';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1')}catch(e){}});
 const p=await ctx.newPage();p.on('pageerror',e=>console.log(e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{const out=[],g=await ITIN.loadGraph(),mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx);
  let s=4242;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>150&&r>150&&c<meta.cols-150&&r<meta.rows-150};
  const pairs=[];for(let q=0;q<20000&&pairs.length<8;q++){const i=Math.floor(rnd()*g.SX.length),j=Math.floor(rnd()*g.SX.length),d=Math.hypot(g.SX[i]-g.SX[j],g.SY[i]-g.SY[j]);
    if(!inW(i)||!inW(j)||g.cls[g.SE[i]]<4||g.cls[g.SE[j]]<4||d<1500||d>3000)continue;pairs.push([i,j])}
  const dd=ll=>{const x=(ll[1]-g.lon0)*g.kx,y=(ll[0]-g.lat0)*g.ky,cx=Math.floor(x/100),cy=Math.floor(y/100);let bd=1e18;for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){const l=g.idx.get((cx+a)+","+(cy+c));if(l)for(const k of l){const d=(g.SX[k]-x)**2+(g.SY[k]-y)**2;if(d<bd)bd=d}}return Math.sqrt(bd)};
  for(const [env,M] of [[0,0],[1,1],[2,2],[3,2],[3,3],[0,3],[3,4]]){const ds=[];let off=0,len=0,st=0,n=0;
   for(const [i,j] of pairs){ITIN.setSeed(5);const R=await ITIN.routeOff(mk(i),mk(j),env,M);if(R.error)continue;n++;const S=ITIN.summarize(R);off+=S.off||0;len+=S.len;st+=R.stops||0;
    for(const l of R.pl)if(l.k==='o')for(let t=1;t<l.ll.length;t++){const a=l.ll[t-1],c=l.ll[t],m=Math.max(1,Math.ceil(Math.hypot((c[1]-a[1])*g.kx,(c[0]-a[0])*g.ky)/8));for(let q=0;q<=m;q++)ds.push(dd([a[0]+(c[0]-a[0])*q/m,a[1]+(c[1]-a[1])*q/m]))}}
   ds.sort((x,y)=>x-y);const P=q=>ds.length?Math.round(ds[Math.min(ds.length-1,Math.floor(q*ds.length))]):0;
   out.push(`env=${env} diff=${M} (${n} tracés) hors chemin ${Math.round(off/n)} m sur ${Math.round(len/n)} m · distance au chemin p50 ${P(.5)} p90 ${P(.9)} max ${P(1)} m · arrêts ${(st/n).toFixed(1)}`)}
  return out});
 for(const x of r)console.log(x);await b.close()})();
