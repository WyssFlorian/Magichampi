// Part des forêts par classe (moyenne sur les espèces) avec les seuils V6 publiés : cellules affichées (fx=1) contre toutes les forêts (fx>0, base des seuils).
// usage : node shares.js <dossier Magichampi> <zone> <sortie.json>
const {chromium}=require('playwright');const path=require('path'),fs=require('fs');const [root,z,outf]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.route('http://local/**',r=>{const u=new URL(r.request().url());let f=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({path:f})});
await p.route(/^https?:\/\/(?!local)/,r=>r.abort());
await p.goto(`http://local/index.html?r=${z}`);await p.waitForTimeout(8000);
const r=await p.evaluate(async()=>{try{
  state.yr=2;const full={cols:GR.cols,rows:GR.rows};const acc={all:[0,0,0,0,0],shown:[0,0,0,0,0]};let nAll=0,nShown=0;
  const band=Math.max(64,Math.floor(7e5/full.cols));const per={};
  for(let r0=0;r0<full.rows;r0+=band){const R={c0:0,r0,cols:full.cols,rows:Math.min(band,full.rows-r0)};await loadRegion(R);const n=G.fx.length,Z0=new Float32Array(n);
    for(const sp of SPECIES){const t=THR[sp.id];const c=per[sp.id]||(per[sp.id]={all:[0,0,0,0,0],shown:[0,0,0,0,0],na:0,ns:0});
      for(let i=0;i<n;i+=2){const f=G.fx[i];if(f<=0)continue;const a=aptAt(i,sp,regionF(G.sq[i],sp.key)[0]);const k=t[2]!=null&&a>=t[2]?4:a>=t[1]?3:a>=t[0]?2:1;c.all[k]++;c.na++;if(f===1){c.shown[k]++;c.ns++}}}}
  const sum=(key,nk)=>{const o=[0,0,0,0,0];let m=0;for(const id in per){const c=per[id];if(!c[nk])continue;m++;for(let k=1;k<5;k++)o[k]+=c[key][k]/c[nk]}return o.map(v=>+(100*v/m).toFixed(1))};
  return {all:sum('all','na'),shown:sum('shown','ns')}}catch(e){return String(e.stack)}});
if(typeof r==='string'){console.log(r);process.exit(1)}
r.zone=z;fs.writeFileSync(outf,JSON.stringify(r));console.log(z,JSON.stringify(r));await b.close()})();
