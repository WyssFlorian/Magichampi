// Niveaux de couleur ABSOLUS sur tout le canton (8 régions réunies).
// 1) node tools/seuils_canton.js <dossier> hist <zone>            → histogramme de l'aptitude de chaque espèce (forêts, une cellule sur deux, relevés « tous »)
// 2) python3 tools/seuils_canton.py seuils h_*.json                → fusionne, calcule les quantiles 60/85/96,25 % du canton → ZONE.MAP_THR_V6, ZONE.MAP_AMAX dans les 8 zone.js
// 3) node tools/seuils_canton.js <dossier> multi <zone>            → (après 2) histogramme des points « forte concentration » par combinaison de catégories, avec les seuils du canton
// 4) python3 tools/seuils_canton.py multi m_*.json                 → quantiles 60/85/96 % → ZONE.MULTI_REF dans les 8 zone.js
const {chromium}=require('playwright');const path=require('path'),fs=require('fs');const [root,mode,z]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.route('http://local/**',r=>{const u=new URL(r.request().url());
  if(u.pathname==='/zones.js'){let t=fs.readFileSync(path.join(root,'zones.js'),'utf8');return r.fulfill({body:t,contentType:'application/javascript'})}
  const f=path.join(root,decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!fs.existsSync(f))return r.fulfill({status:404,body:''});r.fulfill({path:f})});
await p.route(/^https?:\/\/(?!local)/,r=>r.abort());
await p.goto(`http://local/index.html?r=${z}`);await p.waitForTimeout(8000);
const r=await p.evaluate(async(mode)=>{try{
  state.yr=2;
  if(mode==="hist"){const BW=.0005,out={};SPECIES.forEach(s=>{out[s.id]={}});
    const band=Math.max(64,Math.floor(7e5/GR.cols));
    for(let r0=0;r0<GR.rows;r0+=band){await loadRegion({c0:0,r0,cols:GR.cols,rows:Math.min(band,GR.rows-r0)});const n=G.fx.length;
      for(const sp of SPECIES){const h=out[sp.id];for(let i=0;i<n;i+=2)if(G.fx[i]>0){const k=Math.floor(aptAt(i,sp,regionF(G.sq[i],sp.key)[0])/BW);h[k]=(h[k]||0)+1}}}
    return {BW,h:out}}
  // multi : région entière, réglages par défaut de la carte (vue par zones, exclusions, accès, cueillette responsable), toutes les espèces des catégories
  state.view="zone";state.excl=true;state.acc=true;state.resp=true;state.seasonOnly=false;state.hide=[];
  await loadRegion({c0:0,r0:0,cols:GR.cols,rows:GR.rows});const n=meta.rows*meta.cols;
  const sps=SPECIES.filter(s=>!protHidden(s)),combos=["1","2","3","12","13","23","123"],H={};combos.forEach(c=>H[c]={});
  const pts={};combos.forEach(c=>pts[c]=new Uint16Array(n));const has=new Uint8Array(n);
  for(const sp of sps){const C=classesFor(sp).C;staticCache.clear();
    for(let i=0;i<n;i++){const k=C[i];if(k===255)continue;has[i]=1;if(k>=MULTI_MIN){const v=MULTI_PTS[k];for(const c of combos)if(c.includes(String(sp.tier)))pts[c][i]+=v}}}
  for(const c of combos){const h=H[c];for(let i=0;i<n;i++)if(has[i])h[pts[c][i]]=(h[pts[c][i]]||0)+1}
  return {n:sps.length,h:H}
}catch(e){return {err:String(e.stack)}}},mode);
if(r.err){console.error(r.err);process.exit(1)}console.log(JSON.stringify(r));console.error('errs',errs.slice(0,3));await b.close()})();
