// Rejoue la validation (rang des relevés précis dans l'aptitude statique) sur le code ACTUEL de index.html.
// usage : node rerun.js <dossier Magichampi> <zone> <valid_obs.json> <sortie.json> [inv]
//   inv : contre-factuel « ancienne couche conif » (part de feuillus non convertie), pour mesurer l'effet de la correction du 20.11.2026.
const {chromium}=require('playwright');const path=require('path'),fs=require('fs');const [root,z,obsf,outf,mode]=process.argv.slice(2);
const VO=JSON.parse(fs.readFileSync(obsf,'utf8'));
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.route('http://local/**',r=>{const u=new URL(r.request().url());let f=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({path:f})});
await p.route(/^https?:\/\/(?!local)/,r=>r.abort());
await p.goto(`http://local/index.html?r=${z}`);await p.waitForTimeout(8000);
const r=await p.evaluate(async ([VO,mode])=>{try{
  state.yr=2;if(mode&&mode.startsWith('host:'))W_HOST=+mode.slice(5);const full={cols:GR.cols,rows:GR.rows},V={},byId={};SPECIES.forEach(s=>{V[s.id]=[];byId[s.id]=s});
  const cell=(lat,lon)=>{const pt=L.CRS.EPSG3857.project(L.latLng(lat,lon));return {c:Math.floor((pt.x-GR.x0)/GR.res),r:Math.floor((GR.y1-pt.y)/GR.res)}};
  const pres=VO.presences.filter(o=>byId[o.sp]).map(o=>Object.assign({},o,cell(o.lat,o.lon)));
  const seen=new Set(),bg=[];VO.background.forEach(([la,lo])=>{const q=cell(la,lo);const k=q.r*full.cols+q.c;if(q.r<0||q.c<0||q.r>=full.rows||q.c>=full.cols||seen.has(k))return;seen.add(k);bg.push(q)});
  const P=[],BGA={};SPECIES.forEach(s=>BGA[s.id]=[]);let nbg=0;
  const band=Math.max(64,Math.floor(7e5/full.cols));
  for(let r0=0;r0<full.rows;r0+=band){const R={c0:0,r0,cols:full.cols,rows:Math.min(band,full.rows-r0)};await loadRegion(R);const n=G.fx.length,Z0=new Float32Array(n);
    if(mode==="inv"&&G.conif)for(let q=0;q<n;q++)if(G.conif[q]<=100)G.conif[q]=100-G.conif[q];
    const apt=(i,sp)=>aptAt(i,sp,regionF(G.sq[i],sp.key)[0],Z0);
    for(const sp of SPECIES){const a=V[sp.id];for(let i=0;i<n;i+=2)if(G.fx[i]>0)a.push(apt(i,sp))}
    const inb=o=>o.r>=r0&&o.r<r0+R.rows&&o.c>=0&&o.c<full.cols;
    for(const o of pres)if(inb(o)){const i=(o.r-r0)*full.cols+o.c;if(G.fx[i]>0)P.push({id:o.id,sp:o.sp,a:apt(i,byId[o.sp]),cell:o.r*full.cols+o.c,blk:Math.floor(o.r*GR.res/5000)+"_"+Math.floor(o.c*GR.res/5000),date:o.date})}
    for(const o of bg)if(inb(o)){const i=(o.r-r0)*full.cols+o.c;if(G.fx[i]>0){nbg++;for(const sp of SPECIES)BGA[sp.id].push(apt(i,sp))}}}
  const srt=a=>Float32Array.from(a).sort();const rank=(v,a)=>{let lo=0,hi=v.length;while(lo<hi){const m=(lo+hi)>>1;if(v[m]<a)lo=m+1;else hi=m}return v.length?lo/v.length:NaN};
  const out=[];const dup=new Set();
  for(const o of P){const k=o.sp+"|"+o.cell;if(dup.has(k))continue;dup.add(k);
    const S=srt(V[o.sp]),B=srt(BGA[o.sp]),t=THR[o.sp];
    out.push({id:o.id,sp:o.sp,tier:byId[o.sp].tier,pct:+rank(S,o.a).toFixed(4),pctBg:+rank(B,o.a).toFixed(4),cls:t?(t[2]!=null&&o.a>=t[2]?4:o.a>=t[1]?3:o.a>=t[0]?2:1):null,blk:o.blk,date:o.date})}
  return {nForest:V.edulis.length*2,nBg:nbg,obs:out}}catch(e){return String(e.stack)}},[VO,mode||""]);
if(typeof r==='string'){console.log(r);process.exit(1)}
r.zone=z;r.mode=mode||"actuel";fs.writeFileSync(outf,JSON.stringify(r));console.log(z,r.mode,'obs',r.obs.length,'bg',r.nBg,errs.slice(0,2));await b.close()})();
