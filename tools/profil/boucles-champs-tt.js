const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');
// Tout-terrain : part des pas hors chemin qui est hors forêt (fx=0) ou à plus de 100 m d'une zone « élevé »+ (classe ≥ 3). Boucles de 3 h autour de départs au hasard (+ Semsales).
// usage : node tools/profil/boucles-champs-tt.js ple [départs]
const ROOT=path.resolve(__dirname,'../..'),args=process.argv.slice(2),N=+args.find(a=>/^\d+$/.test(a))||6,Z=args.find(a=>!/^\d+$/.test(a))||'ple';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml','.webmanifest':'application/json'};
(async()=>{const b=await chromium.launch(),ctx=await b.newContext({...devices['iPhone 13'],serviceWorkers:'block'});await ctx.addInitScript(()=>{try{localStorage.setItem('itin-decl-v1','1');document.addEventListener('DOMContentLoaded',()=>{const c=document.getElementById('it-offok');if(c)c.checked=true})}catch(e){}});
 const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
 await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='loc.test')return r.abort();const f=path.join(ROOT,decodeURIComponent(u.pathname));if(!fs.existsSync(f)||fs.statSync(f).isDirectory())return r.fulfill({status:404,body:''});r.fulfill({status:200,contentType:MIME[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)})});
 await p.goto('https://loc.test/index.html?r='+Z);await p.waitForFunction(()=>window.ITIN&&typeof currentClass!=='undefined'&&currentClass,null,{timeout:90000});await p.waitForTimeout(2500);
 const r=await p.evaluate(async({N,Z})=>{const g=await ITIN.loadGraph(),$=id=>document.getElementById(id);let s=777;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  const inW=k=>{const c=(g.SM[2*k]-meta.x0)/meta.res,r=(meta.y1-g.SM[2*k+1])/meta.res;return c>250&&r>250&&c<meta.cols-250&&r<meta.rows-250};
  const mk=k=>L.latLng(g.lat0+g.SY[k]/g.ky,g.lon0+g.SX[k]/g.kx),st=[];if(Z==='ple')st.push(L.latLng(46.57469,6.93109));
  for(let q=0;q<4000&&st.length<N;q++){const i=Math.floor(rnd()*g.SX.length);if(inW(i))st.push(mk(i))}
  const C=currentClass,W=meta.cols,H=meta.rows,res=meta.res,rad=Math.ceil(100/res),hi=(c,r)=>{for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){const x=c+dx,y=r+dy;if(x>=0&&y>=0&&x<W&&y<H){const v=C[y*W+x];if(v!==255&&v>=3)return true}}return false};
  const BK=new Map(),bk=(x,y)=>Math.floor(x/30)+','+Math.floor(y/30);for(let i=0;i<g.SX.length;i++){const k=bk(g.SM[2*i],g.SM[2*i+1]);if(!BK.has(k))BK.set(k,[]);BK.get(k).push(i)}
  const nearNet=(x,y)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=BK.get(bk(x+a*30,y+b*30));if(l)for(const i of l)if((g.SM[2*i]-x)**2+(g.SM[2*i+1]-y)**2<900)return true}return false};
  const out=[];
  for(const A of st){ITIN.cancelRun();$("it-mode").value="loop";$("it-mode").onchange();$("it-max").value=2;$("it-env").value=1;$("it-lm").value="dur";$("it-lm").dispatchEvent(new Event('change'));$("it-lt").value=180;$("it-lt").dispatchEvent(new Event('input'));$("it-dur").value=3;$("it-dur").dispatchEvent(new Event('input'));ITIN.setTT(true);$("it-offok").checked=true;ITIN.setSeed(7);ITIN.setPt("A",A);
   await ITIN.compute();const S=ITIN.last;const PL=ITIN.RPL;if(!S||!PL||!PL.length){out.push({fail:1});continue}
   let tot=0,nofo=0,far=0,real=0,rnofo=0,rfar=0;
   for(const l of PL){if(l.k!=='o')continue;for(let i=1;i<l.ll.length;i++){const a=l.ll[i-1],b=l.ll[i],d=Math.hypot((b[1]-a[1])*g.kx,(b[0]-a[0])*g.ky),pp=L.Projection.SphericalMercator.project(L.latLng((a[0]+b[0])/2,(a[1]+b[1])/2)),q=[pp.x,pp.y],c=Math.floor((q[0]-meta.x0)/res),r=Math.floor((meta.y1-q[1])/res);if(c<0||r<0||c>=W||r>=H)continue;tot+=d;const nf=!(G.fx[r*W+c]>0),fr=!hi(c,r);if(nf)nofo+=d;if(fr)far+=d;if(!nearNet(q[0],q[1])){real+=d;if(nf)rnofo+=d;if(fr)rfar+=d}}}
   out.push({kinds:PL.map(l=>l.k+':'+l.ll.length).join(' ').slice(0,80),len:Math.round(S.len),off:Math.round(tot),nofo:Math.round(nofo),far:Math.round(far),real:Math.round(real),rnofo:Math.round(rnofo),rfar:Math.round(rfar)})}
  return out},{N,Z});
 for(const w of r)console.log(Z,JSON.stringify(w));
 const ok=r.filter(w=>!w.fail),sm=k=>ok.reduce((a,w)=>a+w[k],0);console.log(Z,'TOTAL len',sm('len'),'pas hors chemin',sm('off'),'dont >30 m du réseau (vrai hors-chemin)',sm('real'),'dont hors forêt',sm('rnofo'),'dont >100 m d\'une zone élevée',sm('rfar'));
 await b.close()})();
