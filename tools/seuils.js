// Seuils de classes (quantiles 60 / 85 / 96,25 % de l'aptitude des forêts de la carte, un sur deux) → ZONE.MAP_THR_V<n> de <zone>/zone.js.
// usage : node tools/seuils.js <dossier Magichampi> <zone>   (Playwright ; sert les fichiers par interception, imprime le JSON)
// Fonctionne aussi pour une région pas encore publiée (ok:0 dans zones.js : on la passe à ok:1 dans la copie servie).
const {chromium}=require('playwright');const path=require('path'),fs=require('fs');const [root,z]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.route('http://local/**',r=>{const u=new URL(r.request().url());
  if(u.pathname==='/zones.js'){let t=fs.readFileSync(path.join(root,'zones.js'),'utf8');t=t.replace(new RegExp('("id":"'+z+'"[^}]*?"ok":)0'),'$11');return r.fulfill({body:t,contentType:'application/javascript'})}
  const f=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({path:f})});
await p.route(/^https?:\/\/(?!local)/,r=>r.abort());
await p.goto(`http://local/index.html?r=${z}`);await p.waitForTimeout(8000);
const r=await p.evaluate(async()=>{try{
  state.yr=2;const full={cols:GR.cols,rows:GR.rows},V={};SPECIES.forEach(s=>V[s.id]=[]);const band=Math.max(64,Math.floor(7e5/full.cols));
  for(let r0=0;r0<full.rows;r0+=band){const R={c0:0,r0,cols:full.cols,rows:Math.min(band,full.rows-r0)};await loadRegion(R);const n=G.fx.length,Z0=new Float32Array(n);
    for(const sp of SPECIES){const a=V[sp.id];for(let i=0;i<n;i+=2)if(G.fx[i]>0)a.push(aptAt(i,sp,regionF(G.sq[i],sp.key)[0],Z0))}}
  const q=(a,f)=>a[Math.min(a.length-1,Math.floor(f*a.length))],out={};
  for(const id in V){const a=Float32Array.from(V[id]).sort();out[id]=[q(a,.6),q(a,.85),q(a,.9625)].map(x=>+x.toFixed(4))}
  return out}catch(e){return String(e.stack)}});
if(typeof r==='string'){console.error(r);process.exit(1)}console.log(JSON.stringify(r));console.error('errs',errs.slice(0,3));await b.close()})();
