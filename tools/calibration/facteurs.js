// Facteurs EFFECTIFS du score (exposants actuels compris : un multiplicateur de 1 = le modèle tel qu'il est) pour chaque observation et chaque cellule du fond « groupe cible ».
// Neuf facteurs : hab, host, wsl, alt, stand, slope, moist, soil, region (SwissFungi). AUCUN bonus local d'observation n'existe plus dans le score.
// S : un échantillon régulier de cellules de forêt (1 sur 997), pour le rang « parmi les forêts » (pct).
// usage : node facteurs.js <dossier Magichampi> <zone> <obs.json (observations.py)> <sortie.json>
const {chromium}=require('playwright');const path=require('path'),fs=require('fs');const [root,z,obsf,outf]=process.argv.slice(2);
const VO=JSON.parse(fs.readFileSync(obsf,'utf8'));
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.route('http://local/**',r=>{const u=new URL(r.request().url());let f=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
  if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({path:f})});
await p.route(/^https?:\/\/(?!local)/,r=>r.abort());
await p.goto(`http://local/index.html?r=${z}`);await p.waitForTimeout(8000);
const r=await p.evaluate(async VO=>{try{
  state.yr=2;const full={cols:GR.cols,rows:GR.rows},byId={};SPECIES.forEach(s=>byId[s.id]=s);
  const cell=(lat,lon)=>{const pt=L.CRS.EPSG3857.project(L.latLng(lat,lon));return {c:Math.floor((pt.x-GR.x0)/GR.res),r:Math.floor((GR.y1-pt.y)/GR.res),bk:Math.floor(pt.x/5000)+"_"+Math.floor(pt.y/5000)}};
  const pres=VO.presences.filter(o=>byId[o.sp]).map((o,k)=>Object.assign({k,id:o.id,sp:o.sp},cell(o.lat,o.lon)));
  const seen=new Set(),bg=[];VO.background.forEach(([la,lo],k)=>{const q=cell(la,lo);const key=q.r*full.cols+q.c;if(q.r<0||q.c<0||q.r>=full.rows||q.c>=full.cols||seen.has(key))return;seen.add(key);bg.push(Object.assign({k},q))});
  const F=(i,sp)=>{const c=G.conif[i]===255?NaN:G.conif[i]/100;
    return [habF(i,sp),hostW(c,sp.host,!LITE&&G.hab&&G.hab[i]>0),wslF(i,sp),altW(G.dem[i],sp.alt),standF(G.vhm[i]/5,G.edge[i]*2,sp.stand,sp.id),slopeF(G.slope[i]),moistF(G.mi[i],sp.moist),soilF(G.ca[i],sp),regionF(G.sq[i],sp.key)[0]].map(v=>+v.toFixed(4))};
  const P=[],B=[],S=[];const band=Math.max(64,Math.floor(7e5/full.cols));
  for(let r0=0;r0<full.rows;r0+=band){const R={c0:0,r0,cols:full.cols,rows:Math.min(band,full.rows-r0)};await loadRegion(R);
    const inb=o=>o.r>=r0&&o.r<r0+R.rows&&o.c>=0&&o.c<full.cols;
    for(const o of pres)if(inb(o)){const i=(o.r-r0)*full.cols+o.c;if(G.fx[i]>0)P.push({k:o.k,id:o.id,sp:o.sp,cell:o.r*full.cols+o.c,blk:o.bk,f:F(i,byId[o.sp])})}
    for(let q=0;q<G.fx.length;q++)if(G.fx[q]>0&&((r0*full.cols+q)%997===0))S.push({f:Object.fromEntries(SPECIES.map(s=>[s.id,F(q,s)]))});
    for(const o of bg)if(inb(o)){const i=(o.r-r0)*full.cols+o.c;if(G.fx[i]>0)B.push({k:o.k,cell:o.r*full.cols+o.c,blk:o.bk,f:Object.fromEntries(SPECIES.map(s=>[s.id,F(i,s)]))})}}
  return {P,B,S,grp:Object.fromEntries(SPECIES.map(s=>[s.id,WSL_GRP[s.id]||0]))}}catch(e){return String(e.stack)}},VO);
if(typeof r==='string'){console.log(r);process.exit(1)}
r.zone=z;fs.writeFileSync(outf,JSON.stringify(r));console.log(z,'obs',r.P.length,'fond',r.B.length,'forêt',r.S.length,errs.slice(0,2));await b.close()})();
