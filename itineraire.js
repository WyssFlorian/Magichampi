/* Itinéraire A→B sur le réseau de chemins précalculé (<région>/graphe.json, voir tools/graphe.py).
   Coût d'une arête = temps de marche (Tobler, dénivelé + / − de l'arête) × facteur de réseau × (1 − bonus de cueillette) × (1 + 4 × part hors forêt de l'arête).
   Classe 5/4 : 1 · sentier balisé : 0,7 · classe 3 (route forestière) : 1,6 · classe 2 (4 m, bord de route) : 3,5 ·
   classe 1 : jamais, sauf traversée ≤ 30 m (arête virtuelle). Calcul entièrement dans le navigateur. */
(function(){
"use strict";
if(typeof L==="undefined")return;
const $=id=>document.getElementById(id);
const offRule=(M,envie)=>{const P=offProg(M,envie||0),d=Math.min(M>=4?1e9:OFF_DIST[M],P.dist),sl=Math.min(M>=4?30:OFF_SLP[M],P.slope);return d>=1e8?"sans limite de distance au chemin (pente < "+sl+"°)":"à ≤ "+d+" m d'un chemin, pente < "+sl+"°"};
const DIFF=["très facile","facile","moyen","difficile","très difficile"],DCOL=["#2e8b57","#7cb342","#e0a800","#e8731f","#c62828"];
const FACT={1:12,2:3.5,3:1.6,4:1,5:1},TYPE_F={0:1,1:.7,2:.8,3:1},TYPE_T={0:1,1:1,2:1.3,3:1.6};   // facteur de coût (réseau) · multiplicateur de temps (type de sentier)
const R_E=6378137,WGW=[0,0,.2,.6,1];                                                  // poids du bonus par classe d'affichage (très faible … très élevé) : rien sous « moyen », le détour ne vise que les zones moyen ou mieux
let DETCAP=true;   // plafond de détour A→B actif (false = comparaisons de test)
let OFFP=4;   // pénalité hors forêt : une arête entièrement hors forêt coûte (1+OFFP) fois plus ; 0 = ancien comportement (comparaisons de test)
const MIN_GAIN=100,GAIN_RATIO=.2,OFF_ROAD=20;   // détour accepté seulement s'il gagne ≥ 100 m (et ≥ 20 % de la distance ajoutée) dans des zones « moyen » ou mieux · bande de 20 m le long des routes de classe 2 où le hors-chemin est interdit
/* ---------- limite de dénivelé (positif seul, ou positif et négatif) ---------- */
// Pénalité additive (s par mètre de dénivelé) ajoutée au coût des arêtes / pas hors chemin ; on la renforce (DV_LAM) jusqu'à respecter la limite.
const DV_LAM=[0,10,40,160,640];let DV=null;
function dvLim(){const el=$("it-dv"),m=el?el.value:"0";return m==="0"?null:{both:m==="both",m:+$("it-dvm").value}}
const dvOk=S=>{const l=dvLim();return !l||(S.up<=l.m+.5&&(!l.both||S.dn<=l.m+.5))};
const setDV=lam=>{const l=dvLim();DV=l&&lam>0?{lam,both:l.both}:null};
const dvTxt=l=>l.both?"+ et − ≤ "+l.m+" m":"+ ≤ "+l.m+" m";
let BP=null,GR=null,GRZ=null,loading=null,map0=null,mk={A:null,B:null},pts={A:null,B:null},arm=null,layer=null,last=null,RPL=[],noFit=false;

/* ---------- facteur de durée et difficulté maximale ---------- */
const DUR_V=[.5,.75,1,1.5,2,3],DUR_L=["jogging (temps ×½)","marche rapide (×¾)","marche normale (×1)","cueillette (×1,5)","cueillette lente (×2)","fouille complète (temps ×3)"];
const durF=()=>{const el=document.getElementById("it-dur");return el?DUR_V[+el.value]||1:1};
/* plafond strict : la distance (m) ou la durée affichée (s, rythme compris) choisie n'est JAMAIS dépassée, quel que soit le type d'itinéraire (A→B, boucle, points de passage, tout-terrain, variétés, détour, glisser). Sans plafond choisi (A→B seulement) : null. */
function capOf(){const lm=$("it-lm"),lt=$("it-lt");if(!lm||!lt||lm.value==="none")return null;const v=+lt.value;return lm.value==="len"?{m:"len",lim:v*1000}:{m:"dur",lim:v*60}}
const capVal=(S,c)=>c.m==="len"?S.len:S.sec;
const capOver=(S,c)=>!!c&&capVal(S,c)>c.lim+1e-6;
const capTxt=c=>c.m==="len"?km(c.lim):dur(c.lim);
const capFound=(S,c)=>c.m==="len"?km(S.len):dur(S.sec);
const capMsg=(S,c)=>"Plafond de "+(c.m==="len"?"distance":"durée")+" ("+capTxt(c)+") impossible à respecter ici : le trajet le plus court trouvé fait "+capFound(S,c)+" (non affiché). Augmentez le plafond, rapprochez les points ou changez le rythme. ";
// niveau technique d'une arête (même échelle que summarize) ; les arêtes au-dessus du maximum reçoivent une pénalité de coût (×k par niveau de trop)
function edgeTech(e){const g=GR,L_=g.len[e];let t=0;
  if(L_>=40){const s=g.smax[e];t=s<15?0:s<25?1:s<32?2:s<38?3:4}
  if(g.typ[e]===3)t=Math.max(t,4);else if(g.typ[e]===2)t=Math.max(t,3);
  if(g.hard[e]>=50&&L_>=100)t=Math.max(t,3);
  if(g.cls[e]===5&&!g.typ[e]&&L_>=150)t=Math.max(t,2);
  return t}
let TPG=null;const TPM=new Map();   // pénalités techniques gardées par (réseau, niveau, force) : même tableau = même jeu de coûts en cache
function techPen(M,k){const g=GR;if(TPG!==g){TPM.clear();TPG=g}const key=M+"|"+k;let p=TPM.get(key);if(p)return p;p=new Float32Array(g.nE).fill(1);for(let e=0;e<g.nE;e++){const x=edgeTech(e)-M;if(x>0)p[e]=Math.pow(k,Math.min(x,2))}TPM.set(key,p);return p}

/* ---------- graphe ---------- */
const merc=(lat,lng)=>[R_E*lng*Math.PI/180,R_E*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
function decode(j){
  const nN=j.N.length/2,nE=j.E.length/10,o=j.o,lon=new Float64Array(nN),lat=new Float64Array(nN);
  for(let i=0;i<nN;i++){lon[i]=(j.N[2*i]+o[0])/1e5;lat[i]=(j.N[2*i+1]+o[1])/1e5}
  const la0=lat.reduce((a,b)=>a+b,0)/nN,kx=Math.cos(la0*Math.PI/180)*111320,ky=110574;
  const a=new Int32Array(nE),b=new Int32Array(nE),cls=new Uint8Array(nE),typ=new Uint8Array(nE),len=new Float32Array(nE),up=new Float32Array(nE),dn=new Float32Array(nE),smax=new Uint8Array(nE),hard=new Uint8Array(nE),fo=new Uint8Array(nE);
  for(let e=0;e<nE;e++){const q=e*10,E=j.E;a[e]=E[q];b[e]=E[q+1];cls[e]=E[q+2];typ[e]=E[q+3];len[e]=E[q+4];up[e]=E[q+5];dn[e]=E[q+6];smax[e]=E[q+7];hard[e]=E[q+8];fo[e]=E[q+9]}
  // polylines (lon/lat) et échantillons tous les ≈ 25 m (accrochage, bonus de cueillette)
  const poly=new Array(nE),cum=new Array(nE),SX=[],SY=[],SE=[],SS=[],SM=[],px=[],py=[];
  for(let e=0;e<nE;e++){
    const g=j.G[e],pl=[lon[a[e]],lat[a[e]]];
    if(g){let x=Math.round(lon[a[e]]*1e5),y=Math.round(lat[a[e]]*1e5);for(let k=0;k<g.length;k+=2){x+=g[k];y+=g[k+1];pl.push(x/1e5,y/1e5)}}
    pl.push(lon[b[e]],lat[b[e]]);poly[e]=pl;
    const n=pl.length/2,c=new Float32Array(n);let acc=0;
    for(let k=1;k<n;k++){acc+=Math.hypot((pl[2*k]-pl[2*k-2])*kx,(pl[2*k+1]-pl[2*k-1])*ky);c[k]=acc}
    cum[e]=c;const tot=acc||1,ns=Math.max(1,Math.ceil(tot/25));let k=0;
    for(let s=0;s<=ns;s++){const d=tot*s/ns;while(k<n-2&&c[k+1]<d)k++;const t=c[k+1]>c[k]?(d-c[k])/(c[k+1]-c[k]):0,lo=pl[2*k]+t*(pl[2*k+2]-pl[2*k]),la=pl[2*k+1]+t*(pl[2*k+3]-pl[2*k+1]);
      SX.push((lo-lon[0])*kx);SY.push((la-lat[0])*ky);SE.push(e);SS.push(d);const m=merc(la,lo);SM.push(m[0],m[1])}
  }
  // grille de recherche de 100 m
  const idx=new Map();for(let i=0;i<SX.length;i++){const k=Math.floor(SX[i]/100)+","+Math.floor(SY[i]/100);let l=idx.get(k);if(!l)idx.set(k,l=[]);l.push(i)}
  // adjacence
  const deg=new Int32Array(nN+1);for(let e=0;e<nE;e++){deg[a[e]+1]++;deg[b[e]+1]++}
  for(let i=0;i<nN;i++)deg[i+1]+=deg[i];const fill=deg.slice(),adj=new Int32Array(2*nE);
  for(let e=0;e<nE;e++){adj[fill[a[e]]++]=e*2;adj[fill[b[e]]++]=e*2+1}   // e*2 : on part de a (a→b) ; e*2+1 : on part de b (b→a)
  // temps de marche (Tobler, dénivelé brut réparti sur la longueur) dans les deux sens
  const tf=new Float32Array(nE),tb=new Float32Array(nE);
  const tob=(L_,g)=>L_/(6000/3600*Math.exp(-3.5*Math.abs(g+.05)));      // L_ en m, g = pente (tan) → secondes
  for(let e=0;e<nE;e++){
    const L_=Math.max(len[e],1),u=up[e],d=dn[e],tot=u+d,gr=tot>0?tot/L_:0,Lu=tot>0?L_*u/tot:L_/2,Ld=L_-Lu,m=TYPE_T[typ[e]];
    if(cls[e]===1){tf[e]=tb[e]=L_/1.4;continue}
    tf[e]=m*(tot>0?tob(Lu,gr)+tob(Ld,-gr):tob(L_,0))}
  // (dans le sens b→a la montée devient descente : on échange Lu et Ld)
  for(let e=0;e<nE;e++){if(cls[e]===1)continue;const L_=Math.max(len[e],1),u=up[e],d=dn[e],tot=u+d,gr=tot>0?tot/L_:0,Lu=tot>0?L_*u/tot:L_/2,Ld=L_-Lu,m=TYPE_T[typ[e]];
    tb[e]=m*(tot>0?tob(Ld,gr)+tob(Lu,-gr):tob(L_,0))}
  return {nN,nE,lon,lat,la0,kx,ky,a,b,cls,typ,len,up,dn,smax,hard,fo,poly,cum,SX,SY,SE,SS,SM,idx,adj,deg,tf,tb,lon0:lon[0],lat0:lat[0]};
}
async function loadGraph(){
  const z=ZD;if(GR&&GRZ===z)return GR;if(loading&&loading.z===z)return loading.p;
  const p=fetch(z+"graphe.json").then(r=>{if(!r.ok)throw new Error("graphe indisponible ("+r.status+")");return r.json()}).then(j=>{GR=decode(j);GRZ=z;return GR});
  loading={z,p};p.finally(()=>{loading=null});return p}

/* ---------- accrochage ---------- */
function snap(ll){
  const g=GR,x=(ll.lng-g.lon0)*g.kx,y=(ll.lat-g.lat0)*g.ky,cx=Math.floor(x/100),cy=Math.floor(y/100);let best=-1,bd=1e18;
  for(let r=0;r<=3&&best<0;r++){for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++){if(Math.max(Math.abs(i),Math.abs(j))!==r)continue;const l=g.idx.get((cx+i)+","+(cy+j));if(!l)continue;
    for(const k of l){const d=(g.SX[k]-x)**2+(g.SY[k]-y)**2;if(d<bd){bd=d;best=k}}}}
  if(best<0||bd>300*300)return null;
  return {e:g.SE[best],s:g.SS[best],d:Math.sqrt(bd),k:best};
}
function sub(e,s0,s1){   // sous-ligne de l'arête e entre les abscisses s0 et s1 (m), en [lat,lng]
  const g=GR,pl=g.poly[e],c=g.cum[e],n=c.length,flip=s0>s1,A=Math.min(s0,s1),B=Math.max(s0,s1),out=[];
  const at=d=>{let k=0;while(k<n-2&&c[k+1]<d)k++;const t=c[k+1]>c[k]?(d-c[k])/(c[k+1]-c[k]):0;return [pl[2*k+1]+t*(pl[2*k+3]-pl[2*k+1]),pl[2*k]+t*(pl[2*k+2]-pl[2*k])]};
  out.push(at(A));for(let k=1;k<n-1;k++)if(c[k]>A&&c[k]<B)out.push([pl[2*k+1],pl[2*k]]);out.push(at(B));
  return flip?out.reverse():out}

/* ---------- bonus de cueillette (classes affichées) ---------- */

/* ---------- optimiser par variété : grille de classes calculée sur les espèces cochées (remplace celle de la carte) ---------- */
// Score d'une cellule = somme des poids (WGW) des classes des espèces cochées, plafonné ; classes 0-4 comme la carte, donc tout le reste du calcul (détour, boucle, tout-terrain) en profite.
const VAR_KEY="itin-var-v1";
let VC=null,VAR=null;   // VC : grille de classes « variété » (ou null = grille de la carte) · VAR : {sps, per, key}
const curC=()=>VC||(typeof currentClass!=="undefined"?currentClass:null);
const varOn=()=>!!$("it-var")&&$("it-var").checked;
function varSel(){return [...document.querySelectorAll("#it-varlist [data-sp]")].filter(c=>c.checked).map(c=>c.dataset.sp)}
function varSave(){try{localStorage.setItem(VAR_KEY,JSON.stringify(varSel()))}catch(e){}}
function varLoad(){try{const a=JSON.parse(localStorage.getItem(VAR_KEY)||"null");return Array.isArray(a)?a:null}catch(e){return null}}
function varList(){   // liste des espèces à cocher (ordre alphabétique, hors saison grisées)
  const box=$("it-varlist");if(!box||typeof SPECIES==="undefined")return;
  const keep=box.children.length?varSel():(varLoad()||(typeof state!=="undefined"&&state.sp&&state.sp!=="multi"?[state.sp]:[]));
  const L=spAlpha(SPECIES.filter(sp=>!protHidden(sp)));
  box.innerHTML=L.map(sp=>{const so=inSeason(sp);return `<label${so?"":' class="it-off"'}><input type="checkbox" data-sp="${sp.id}"${keep.includes(sp.id)?" checked":""}><span>${esc(sp.fr)}${so?"":" <i>(hors saison)</i>"}</span></label>`}).join("");
  box.querySelectorAll("[data-sp]").forEach(c=>c.onchange=()=>{varSave();varCount();if(last&&varOn())compute()});varCount()}
function varCount(){const n=varSel().length;if($("it-varn"))$("it-varn").textContent=n+" variété"+(n>1?"s":"")+" cochée"+(n>1?"s":"")}
// prépare VC avant un calcul ; retourne un message d'erreur ou ""
function prepVar(){
  VC=null;VAR=null;if(!varOn())return "";
  if(typeof classesFor==="undefined"||typeof meta==="undefined")return "";
  const all=varSel().map(id=>SPECIES.find(s=>s.id===id)).filter(Boolean);
  if(!all.length)return "Optimiser par variété : cochez au moins une variété.";
  const sps=all.filter(sp=>!(state.seasonOnly&&!inSeason(sp))&&!blockReason(sp.id));
  if(!sps.length)return "Aucune des variétés cochées n'est de saison ("+(typeof quarterOn==="function"&&quarterOn()?"période visée : "+perLabel():"filtre « de saison » de la carte")+") : cochez-en d'autres ou changez la période.";
  const key=[sps.map(s=>s.id).join(","),state.mode,state.d,state.view,state.excl,state.acc,state.resp,state.yr,state.seasonOnly,state.q,meta.x0,meta.cols,meta.rows].join("|");
  if(!VAR||VAR.key!==key){
    const n=meta.rows*meta.cols,S=new Float32Array(n),has=new Uint8Array(n),per={};
    for(const sp of sps){const C=classesFor(sp).C;per[sp.id]=C;for(let i=0;i<n;i++){const k=C[i];if(k===255||k>4)continue;has[i]=1;S[i]+=WGW[k]}}
    const out=new Uint8Array(n).fill(255),den=sps.length===1?1:1.5;
    for(let i=0;i<n;i++)if(has[i]){const e=Math.min(1,S[i]/den);out[i]=e>=.95?4:e>=.55?3:e>=.18?2:S[i]>0?1:0}
    VAR={sps,per,key,C:out}}
  VC=VAR.C;return ""}
// longueur (m) du tracé en zone « élevé » ou mieux, par variété cochée
function varReport(S){
  if(!VAR||!S||!S.ll||S.ll.length<2||typeof meta==="undefined")return "";
  const {x0,y1,res,cols,rows}=meta,m=S.ll.map(p=>merc(p[0],p[1])),tot={};let dist=0;
  for(let i=1;i<m.length;i++){const dx=m[i][0]-m[i-1][0],dy=m[i][1]-m[i-1][1],d=Math.hypot(dx,dy);if(!d)continue;dist+=d;
    const c=Math.floor(((m[i][0]+m[i-1][0])/2-x0)/res),r=Math.floor((y1-(m[i][1]+m[i-1][1])/2)/res);if(c<0||r<0||c>=cols||r>=rows)continue;
    for(const sp of VAR.sps){const k=VAR.per[sp.id][r*cols+c];if(k!==255&&k>=3)tot[sp.id]=(tot[sp.id]||0)+d*Math.cos(S.ll[i][0]*Math.PI/180)}}
  const L=VAR.sps.map(sp=>[sp,tot[sp.id]||0]).sort((a,b)=>b[1]-a[1]);
  return " Sur le tracé, en zone élevée ou mieux : "+L.map(([sp,v])=>sp.fr+" "+(v>=50?km(v):"aucune")).join(", ")+"."}
// bonus de cueillette par arête : calculé une fois par grille de classes (gardé tant que la carte, les espèces et le réseau ne changent pas)
let BQ=null;
function bonusQ(){
  const C=curC(),k=typeof meta==="undefined"?"":meta.x0+"|"+meta.y1+"|"+meta.res+"|"+meta.cols+"|"+meta.rows;
  if(BQ&&BQ.g===GR&&BQ.C===C&&BQ.k===k)return BQ.q;
  const q=bonusQ0();BQ={g:GR,C,k,q};return q}
function bonusQ0(){
  const g=GR,q=new Float32Array(g.nE),cnt=new Uint16Array(g.nE),gd=new Uint16Array(g.nE);q.gd=gd;   // gd[e] : échantillons de l'arête en zone « moyen » ou mieux
  if(!curC()||typeof meta==="undefined")return q;
  const x0=meta.x0,y1=meta.y1,res=meta.res,cols=meta.cols,rows=meta.rows;
  for(let i=0;i<g.SE.length;i++){const X=g.SM[2*i],Y=g.SM[2*i+1],c=Math.floor((X-x0)/res),r=Math.floor((y1-Y)/res),e=g.SE[i];cnt[e]++;
    if(c>=0&&r>=0&&c<cols&&r<rows){const v=curC()[r*cols+c];if(v!==255&&v<5){q[e]+=WGW[v];if(v>=2)gd[e]++}}}
  q.cnt=cnt;for(let e=0;e<g.nE;e++)if(cnt[e])q[e]/=cnt[e];
  return q}
// longueur (m) d'un tracé du graphe qui traverse des zones « moyen » ou mieux
const seqLen=R=>R.seq.reduce((a,[,s0,s1])=>a+Math.abs(s1-s0),0);
function goodLen(R,q){let t=0;for(const [e,s0,s1] of R.seq)if(q.cnt[e])t+=Math.abs(s1-s0)*q.gd[e]/q.cnt[e];return t}
// A→B avec envie de détour : le détour n'est gardé que s'il apporte au moins MIN_GAIN m de zones « moyen » ou mieux ; sinon trajet le plus court
function routeGD(A,B,envie){
  const R=route(A,B,envie);if(!R||!(envie>0))return R;
  const R0=route(A,B,0);if(!R0)return R;const q=bonusQ();
  const ex=seqLen(R)-seqLen(R0);if(ex<=seqLen(R0)*.02||goodLen(R,q)-goodLen(R0,q)>=Math.max(MIN_GAIN,GAIN_RATIO*ex))return R;
  R0.noGain=true;return R0}

// Plafond de détour A→B : la longueur ne dépasse pas DET_CAP (×1,35 ; ×1,6 en « grand détour ») fois celle du plus court chemin sous les mêmes limites (difficulté, dénivelé) mais sans détour ni pénalité hors forêt.
// Au-delà, on relâche par paliers (pénalité hors forêt et envie de détour réduites), jusqu'au plus court chemin. Le plafond strict distance / durée, la difficulté et le dénivelé restent prioritaires.
const DET_CAP=[1.35,1.35,1.35,1.6];
function routeCap(A,B,envie){
  const R=routeGD(A,B,envie);if(!R||!DETCAP)return R;
  const o=OFFP,nz=NZ;let R0;try{OFFP=0;NZ=null;R0=route(A,B,0)}finally{OFFP=o;NZ=nz}
  if(!R0)return R;const L0=seqLen(R0),cap=DET_CAP[Math.min(3,envie)]*L0;
  if(seqLen(R)<=cap+1e-6)return R;
  try{for(const [ev,op] of [[envie,o/2],[Math.min(envie,1),o/4],[0,0]]){OFFP=op;const X=ev===0&&op===0?R0:routeGD(A,B,ev);if(X&&seqLen(X)<=cap+1e-6){X.capped=Math.round((seqLen(R)/L0-1)*100);return X}}}
  finally{OFFP=o}
  R0.capped=Math.round((seqLen(R)/L0-1)*100);return R0}

/* ---------- plus court chemin (Dijkstra, tas binaire) ---------- */
// Coûts de base d'une arête dans chaque sens : cf0/cb0 = temps × facteur de réseau × bonus × hors-forêt × pénalité technique (BP) ; af/ab = parties additives (traversée de classe 1, dénivelé).
// Le tout ne dépend que des réglages (détour, hors-forêt, BP, dénivelé, grille de classes) : calculé une fois et gardé (8 jeux). La pénalité de repassage (pen, boucles) se applique à la volée : coût = cf0×pen + af.
let CCK=null;const CCM=new Map(),IDS=new WeakMap();let IDN=0;const idOf=o=>o?(IDS.get(o)||(IDS.set(o,++IDN),IDN)):0;
function costBase(envie,qq,noDV){
  const g=GR,q=qq||(envie>0?bonusQ():null);
  if(CCK!==g){CCM.clear();CCK=g}
  const key=[envie,OFFP,idOf(q),idOf(BP),noDV?"-":DV?DV.lam+(DV.both?"b":"u"):"0"].join("|");let B=CCM.get(key);if(B)return B;
  const mult=e=>{const k=g.cls[e],t=g.typ[e];
    let m=k===3?(t?TYPE_F[t]:FACT[3]):k===2?(t?2:FACT[2]):k===1?FACT[1]:TYPE_F[t];   // sentier balisé sur une route forestière : 0,7 ; sur une route de classe 2 : 2
    if(q&&k!==1)m*=1-Math.min(.6,.2*envie*q[e]);
    if(OFFP&&k!==1)m*=1+OFFP*(1-g.fo[e]/100);   // hors forêt : surcoût proportionnel à la part de l'arête hors forêt (graphe : fo, 0-100 %)
    return m};
  const cf=new Float32Array(g.nE),cb=new Float32Array(g.nE),af=new Float32Array(g.nE),ab=new Float32Array(g.nE);
  for(let e=0;e<g.nE;e++){const m=mult(e)*(BP?BP[e]:1),x=g.cls[e]===1?120:0;cf[e]=g.tf[e]*m;cb[e]=g.tb[e]*m;af[e]=ab[e]=x;
    if(DV&&!noDV){af[e]+=DV.lam*(g.up[e]+(DV.both?g.dn[e]:0));ab[e]+=DV.lam*(g.dn[e]+(DV.both?g.up[e]:0))}}
  B={cf,cb,af,ab,full:null};if(CCM.size>=8)CCM.delete(CCM.keys().next().value);CCM.set(key,B);return B}
function costs(envie,pen,qq,noDV){
  const B=costBase(envie,qq,noDV),g=GR;
  if(!pen){if(!B.full){const cf=new Float32Array(g.nE),cb=new Float32Array(g.nE);for(let e=0;e<g.nE;e++){cf[e]=B.cf[e]+B.af[e];cb[e]=B.cb[e]+B.ab[e]}B.full={cf,cb}}return B.full}
  const cf=new Float32Array(g.nE),cb=new Float32Array(g.nE);for(let e=0;e<g.nE;e++){cf[e]=B.cf[e]*pen[e]+B.af[e];cb[e]=B.cb[e]*pen[e]+B.ab[e]}return {cf,cb}}
// tas binaire typé partagé (route et netDist ne sont jamais imbriquées)
let HK=new Float64Array(1<<16),HV=new Int32Array(1<<16),HN=0,HPK=0;
function hpush(k,v){if(HN===HK.length){const a=new Float64Array(HN*2),b=new Int32Array(HN*2);a.set(HK);b.set(HV);HK=a;HV=b}let i=HN++;while(i>0){const p=(i-1)>>1;if(HK[p]<=k)break;HK[i]=HK[p];HV[i]=HV[p];i=p}HK[i]=k;HV[i]=v}
function hpop(){const v=HV[0];HPK=HK[0];const k=HK[--HN],w=HV[HN];let i=0;for(;;){let c=2*i+1;if(c>=HN)break;if(c+1<HN&&HK[c+1]<HK[c])c++;if(HK[c]>=k)break;HK[i]=HK[c];HV[i]=HV[c];i=c}HK[i]=k;HV[i]=w;return v}
let RT=null,ONES=null;const ones=()=>(ONES&&ONES.length===GR.nE&&ONES.g===GR)?ONES:(ONES=new Float32Array(GR.nE).fill(1),ONES.g=GR,ONES);
function route(A,B,envie,pen,qq){
  const g=GR,Bs=costBase(envie,qq),cf0=Bs.cf,cb0=Bs.cb,af=Bs.af,ab=Bs.ab,P=pen||ones();
  if(!RT||RT.n!==g.nN)RT={n:g.nN,d:new Float64Array(g.nN),p:new Int32Array(g.nN)};const dist=RT.d.fill(Infinity),prev=RT.p.fill(-1);HN=0;   // tableaux réutilisés d'un appel à l'autre
  const Z=NZ||ones(),cf=e=>cf0[e]*P[e]*Z[e]+af[e],cb=e=>cb0[e]*P[e]*Z[e]+ab[e];
  const fa=A.s/Math.max(g.len[A.e],1),fb=B.s/Math.max(g.len[B.e],1);
  // même arête : chemin direct
  let best=Infinity,bestEnd=null;
  if(A.e===B.e){const e=A.e,f=Math.abs(fb-fa);best=(fb>=fa?cf(e):cb(e))*f;bestEnd={direct:true}}
  // départ : vers a (sens b→a) et vers b (sens a→b)
  const ea=g.a[A.e],eb=g.b[A.e];
  dist[ea]=cb(A.e)*fa;dist[eb]=Math.min(dist[eb],cf(A.e)*(1-fa));hpush(dist[ea],ea);if(eb!==ea)hpush(dist[eb],eb);
  const ta=g.a[B.e],tb=g.b[B.e],costA=cf(B.e)*fb,costB=cb(B.e)*(1-fb);   // ta→point : sens a→b ; tb→point : sens b→a
  while(HN){const u=hpop(),d=HPK;if(d>dist[u])continue;if(d>=best)break;
    if(u===ta&&d+costA<best){best=d+costA;bestEnd={node:ta,end:"a"}}
    if(u===tb&&d+costB<best){best=d+costB;bestEnd={node:tb,end:"b"}}
    for(let k=g.deg[u];k<g.deg[u+1];k++){const c=g.adj[k],e=c>>1,fw=!(c&1),v=fw?g.b[e]:g.a[e],w=d+(fw?cf(e):cb(e));if(w<dist[v]){dist[v]=w;prev[v]=c;hpush(w,v)}}}
  if(!bestEnd)return null;
  const seq=[];   // tronçons : [arête, de s0 à s1 (abscisses m), sens]
  if(bestEnd.direct){seq.push([A.e,A.s,B.s])}
  else{
    let n=bestEnd.node;const mid=[];
    while(prev[n]>=0){const c=prev[n],e=c>>1,fw=!(c&1);mid.push([e,fw?0:g.len[e],fw?g.len[e]:0]);n=fw?g.a[e]:g.b[e]}
    mid.reverse();
    // premier tronçon : de A vers le noeud de départ
    const first=n===g.a[A.e]?[A.e,A.s,0]:[A.e,A.s,g.len[A.e]];
    seq.push(first,...mid,bestEnd.end==="a"?[B.e,0,B.s]:[B.e,g.len[B.e],B.s]);
  }
  return {seq,cost:best}
}
// distance sur le réseau (m, longueur des arêtes) depuis le départ A vers tous les noeuds, bornée à maxD : un seul Dijkstra qui sert à choisir les étapes d'une boucle à la bonne distance par les chemins (Infinity au-delà)
function netDist(A,maxD){
  const g=GR,dn=new Float64Array(g.nN).fill(Infinity);HN=0;
  const ea=g.a[A.e],eb=g.b[A.e];dn[ea]=A.s;dn[eb]=Math.min(dn[eb],g.len[A.e]-A.s);hpush(dn[ea],ea);if(eb!==ea)hpush(dn[eb],eb);
  while(HN){const u=hpop(),d=HPK;if(d>dn[u])continue;if(d>maxD)break;
    for(let k=g.deg[u];k<g.deg[u+1];k++){const c=g.adj[k],e=c>>1,v=(c&1)?g.a[e]:g.b[e],w=d+g.len[e];if(w<dn[v]){dn[v]=w;hpush(w,v)}}}
  return dn}


/* ---------- les meilleurs points : 5 des 10 meilleurs points accessibles ---------- */
// Pics de score le long du réseau (somme des poids WGW sur ≈ 300 m de chemin, espacés d'au moins 200 m), calculés une fois par grille de classes.
// Pour un trajet donné : on ne garde que les pics atteignables dans les limites (détour, plafond, difficulté), on prend les 10 meilleurs, et on essaie d'en insérer 5 (tirés au hasard avec la graine du calcul)
// dans le tracé, un par un, en refusant toute insertion qui dépasse le plafond, la difficulté maximale ou la limite de dénivelé.
const TOP_N=10,TOP_WANT=5,FB=[1.1,1.4,1.8,2.4];   // FB : longueur maximale (× le plus court chemin) selon l'envie de détour
let PKC=null,LASTTOP=null;
function peaks(){
  const g=GR,C=curC();if(!C||typeof meta==="undefined")return [];
  const key=meta.x0+"|"+meta.y1+"|"+meta.res+"|"+meta.cols+"|"+meta.rows;if(PKC&&PKC.g===g&&PKC.C===C&&PKC.k===key)return PKC.l;
  const n=g.SE.length,val=new Float32Array(n);
  for(let i=0;i<n;i++){const c=Math.floor((g.SM[2*i]-meta.x0)/meta.res),r=Math.floor((meta.y1-g.SM[2*i+1])/meta.res);
    if(c>=0&&r>=0&&c<meta.cols&&r<meta.rows&&g.cls[g.SE[i]]!==1){const v=C[r*meta.cols+c];if(v!==255&&v>=2&&v<5)val[i]=WGW[v]}}
  const sm=new Float32Array(n);
  for(let i=0;i<n;i++){let t=0;for(let j=Math.max(0,i-6);j<=Math.min(n-1,i+6);j++)if(g.SE[j]===g.SE[i])t+=val[j];sm[i]=t}
  const ord=[];for(let i=0;i<n;i++)if(sm[i]>0)ord.push(i);ord.sort((a,b)=>sm[b]-sm[a]);
  const SP=200,grid=new Map(),l=[];
  for(const i of ord){if(l.length>=1500)break;const x=g.SX[i],y=g.SY[i],cx=Math.floor(x/SP),cy=Math.floor(y/SP);let near=false;
    for(let a=-1;a<=1&&!near;a++)for(let b=-1;b<=1&&!near;b++){const m=grid.get((cx+a)+","+(cy+b));if(m)for(const p of m)if((p.x-x)**2+(p.y-y)**2<SP*SP){near=true;break}}
    if(near)continue;const p={k:i,v:sm[i],e:g.SE[i],s:g.SS[i],x,y},kk=cx+","+cy;(grid.get(kk)||grid.set(kk,[]).get(kk)).push(p);l.push(p)}
  PKC={g,C,k:key,l};return l}
// les 10 meilleurs pics à portée : dA + dB ≤ Lmax (A→B) ou dA ≤ reach (boucle) par le réseau, arête praticable sous la difficulté maximale
function topReach(A,B,M,Lmax,loop){
  const pk=peaks();if(!pk.length)return [];const g=GR,DA=netDist(A,Lmax),DB=loop?DA:netDist(B,Lmax),out=[];
  const dd=(D,p)=>{const e=p.e;return Math.min(D[g.a[e]]+p.s,D[g.b[e]]+g.len[e]-p.s)};
  for(const p of pk){const da=dd(DA,p),db=dd(DB,p);if(!isFinite(da)||!isFinite(db))continue;
    if(loop?da>Lmax:da+db>Lmax)continue;if(M<4&&edgeTech(p.e)>M)continue;out.push(p);if(out.length>=TOP_N*3)break}
  return out.sort((a,b)=>b.v-a.v).slice(0,TOP_N)}
function covers(R,p,tol){const g=GR,E=cellIdx(g),t2=(tol||40)**2;
  for(const [e,s0,s1] of R.seq){const lo=Math.min(s0,s1),hi=Math.max(s0,s1);
    for(let k=E.s[e];k<E.s[e+1];k++){const s=g.SS[k];if(s<lo-25||s>hi+25)continue;if((g.SX[k]-p.x)**2+(g.SY[k]-p.y)**2<=t2)return true}}
  return false}
function shuffle(a,rnd){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
async function enrich(R,A,B,envie,M,CAP,o){
  o=o||{};const g=GR,loop=!!o.loop,t0=performance.now(),dl=t0+(o.ms||1500),rnd=RND;
  if(!curC())return null;
  let Lmax,L0=0;
  if(loop)Lmax=o.reach;
  else{const nz=NZ,of=OFFP;let R0;try{NZ=null;OFFP=0;R0=route(A,B,0)}finally{NZ=nz;OFFP=of}if(!R0)return null;L0=seqLen(R0);Lmax=L0*FB[Math.min(3,envie)]}
  const top=topReach(A,B,M,Lmax,loop);if(!top.length)return LASTTOP={R,n:0,tot:0};
  const on=[],off=[];for(const p of top)(covers(R,p)?on:off).push(p);
  let cur=R,S=summarize(R),n=on.length,tries=0;
  const q=envie>0?bonusQ():undefined,okS=(S2,len)=>(!CAP||!capOver(S2,CAP))&&(M>=4||S2.lvl<=Math.max(M,S.lvl))&&(dvOk(S2)||!dvOk(S))&&(loop||len<=Lmax+1e-6);
  const jx=r=>{const out=[],n_=r.seq.length;
    const at=(e,s)=>{const a=g.a[e],b=g.b[e],f=Math.min(1,Math.max(0,s/Math.max(g.len[e],1)));return [(g.lon[a]+(g.lon[b]-g.lon[a])*f-g.lon0)*g.kx,(g.lat[a]+(g.lat[b]-g.lat[a])*f-g.lat0)*g.ky]};
    for(let i=0;i<n_;i++)out.push({e:r.seq[i][0],s:r.seq[i][1],d:0,xy:at(r.seq[i][0],r.seq[i][1])});
    const L_=r.seq[n_-1];out.push({e:L_[0],s:L_[2],d:0,xy:at(L_[0],L_[2])});return out};
  for(const p of shuffle(off,rnd)){
    if(n>=TOP_WANT||tries>=TOP_N||performance.now()>dl)break;tries++;stop(RUN);
    const J=jx(cur),nJ=J.length-1;if(nJ<1)break;
    let m=0,bd=1e18;for(let i=0;i<=nJ;i++){const d=(J[i].xy[0]-p.x)**2+(J[i].xy[1]-p.y)**2;if(d<bd){bd=d;m=i}}
    const P={e:p.e,s:p.s,d:0},legs=new Map(),leg=(a,b)=>{const k=a+">"+b;if(!legs.has(k)){const x=a==="P"?P:J[a],y=b==="P"?P:J[b];legs.set(k,route(x,y,envie,undefined,q))}return legs.get(k)};
    let best=null;
    for(const [i0,i1] of [[m-1,m+1],[m-1,m],[m,m+1],[m-2,m],[m,m+2]]){
      if(i0<0||i1>nJ||i0>=i1)continue;
      const r1=leg(i0,"P"),r2=leg("P",i1);if(!r1||!r2)continue;
      const seq=[...cur.seq.slice(0,i0),...r1.seq,...r2.seq,...cur.seq.slice(i1)],R2={seq},len=seqLen(R2),S2=summarize(R2);
      if(!okS(S2,len))continue;if(!best||len<best.len)best={R:R2,len,S:S2}}
    if(best){cur=best.R;S=best.S;n++}
    await new Promise(r=>setTimeout(r,0));stop(RUN)}
  return LASTTOP={R:cur,n,tot:top.length}}

/* ---------- balade en boucle ---------- */
// Triangle départ A → W1 → W2 → A (W1, W2 à distance r de A, 60° d'écart) ; les arêtes déjà utilisées coûtent ×6 pour ne pas repasser aux mêmes endroits.
// Les waypoints sont choisis dans les secteurs où le mode affiché est le meilleur ; r est ajusté jusqu'à ±10 % de la cible.
function nodeSnap(u){const g=GR,c=g.adj[g.deg[u]],e=c>>1;return {e,s:(c&1)?g.len[e]:0,d:0}}
// Un seul calcul à la fois : un nouveau calcul (ou « Effacer », ou un changement de mode) annule le précédent, qui s'arrête au prochain point de contrôle et n'affiche rien.
let RUN={c:false},RUNS=0;const CANCEL={cancel:true};
const AW=async(p,run)=>{const v=await p;if(run.c)throw CANCEL;return v};   // attend p puis abandonne si ce calcul a été annulé entre-temps
const cancelRun=()=>{RUN.c=true;RUN={c:false};BP=null;DV=null;NZ=null;progOff()};
// progression (« Calcul… 2/5 » + Annuler) et résultat condensé : une phrase visible, les remarques dans « Détails »
const prog=t=>{const b=$("it-prog");if(!b)return;$("it-progt").textContent=t;b.hidden=false},progOff=()=>{const b=$("it-prog");if(b)b.hidden=true};
function setMsg(head,rest){
  const m=$("it-msg");head=(head||"").trim();rest=(rest||"").trim();
  if(OFFREF)rest=(rest+" "+OFFREF.replace("Tout-terrain déconseillé","Hors-chemin désactivé")+" Le tracé suit les chemins uniquement.").trim();
  if(!head&&rest){const t=rest,i=t.search(/[.!?](\s|$)/);   // pas de résumé : la première phrase fait office de résumé
    if(t.length<=170||i<0){m.textContent=t;return}head=t.slice(0,i+1);rest=t.slice(i+1).trim()}
  if(!rest){m.textContent=head;return}
  m.innerHTML=esc(head)+`<details class="it-more"><summary>Détails</summary>${esc(rest)}</details>`}
const stop=run=>{if(run.c)throw CANCEL};
// budget de recherche des boucles : au-delà, on garde les meilleures boucles déjà trouvées (une direction au moins) ; graine fixe : mêmes réglages = mêmes boucles
let BUDGET=3000;const SEED=20261123;
const rng=a=>()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
// graine : tirée au hasard à chaque appui sur « Calculer » (parcours différent à chaque fois, toujours sous les mêmes contraintes) ; fixée par ITIN.setSeed(n) (tests, comparaisons)
let ALEA=true;   // false = ancien comportement déterministe (comparaisons de test) : ni bruit de coût ni insertion des meilleurs points
let SEEDV=SEED,SEEDFIX=null,RND=rng(SEED),NZ=null,NZA=0,LNZ=1,LRETRY=false;   // LNZ : part d'aléa des boucles (0 = relance sans aléa quand rien n'est trouvé)
function newSeed(){SEEDV=SEEDFIX!=null?SEEDFIX:((Math.random()*2147483647)|0)+1;RND=rng(SEEDV);NZ=null;LNZ=1;LRETRY=false}
// bruit spatial de coût (champ aléatoire lissé sur ≈ 150 m et ≈ 450 m) : écarte légèrement le plus court chemin vers une variante voisine ; seuls les contrôles de plafond / difficulté / dénivelé décident ensuite
const hz2=(a,b,c)=>{let h=(Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(c,1274126177))|0;h=Math.imul(h^h>>>13,1274126177);return(((h^h>>>16)>>>0)/4294967296)*2-1};
const nzf=(x,y,sz,o,seed)=>{const ix=Math.floor(x/sz),iy=Math.floor(y/sz),fx=x/sz-ix,fy=y/sz-iy,sm=t=>t*t*(3-2*t),a=hz2(ix,iy,seed+o),b=hz2(ix+1,iy,seed+o),c=hz2(ix,iy+1,seed+o),d=hz2(ix+1,iy+1,seed+o),u=a+(b-a)*sm(fx);return u+((c+(d-c)*sm(fx))-u)*sm(fy)};
const nzField=(x,y,seed)=>.6*nzf(x,y,150,1,seed)+.4*nzf(x,y,450,2,seed);   // champ lisse dans [-1 ; 1] (mètres)
function mkNoise(amp,seed){const g=GR,z=new Float32Array(g.nE);
  for(let e=0;e<g.nE;e++){const x=((g.lon[g.a[e]]+g.lon[g.b[e]])/2-g.lon0)*g.kx,y=((g.lat[g.a[e]]+g.lat[g.b[e]])/2-g.lat0)*g.ky;z[e]=Math.max(.5,1+amp*nzField(x,y,seed))}
  return z}
const NZAMP=[.12,.2,.3,.4];
let LOOPERR="",LOOPQ=true,LOOPENR=true;const ENRSH=.84;   // LOOPQ : qualité des boucles (forêt, allers-retours) ; false = ancien comportement (comparaisons de test)
/* qualité d'une boucle : part en forêt, part de tronçons parcourus deux fois, impasses (aller-retour qui n'atteint aucune zone « moyen » ou mieux en forêt) */
function loopMetrics(R){
  const g=GR;if(!curC()||typeof meta==="undefined")return null;
  const pls=R.pl?R.pl.map(p=>p.ll):R.seq.filter(([,s0,s1])=>s0!==s1).map(([e,s0,s1])=>sub(e,s0,s1)),pts=[];
  for(const l of pls)for(const p of l)pts.push(p);
  const ST=20,sm=[];let acc=0,nxt=0;   // échantillons tous les 20 m
  for(let i=0;i<pts.length;i++){
    if(!i){sm.push(pts[0]);nxt=ST;continue}
    const dx=(pts[i][1]-pts[i-1][1])*g.kx,dy=(pts[i][0]-pts[i-1][0])*g.ky,d=Math.hypot(dx,dy);
    while(d>0&&acc+d>=nxt){const t=(nxt-acc)/d;sm.push([pts[i-1][0]+t*(pts[i][0]-pts[i-1][0]),pts[i-1][1]+t*(pts[i][1]-pts[i-1][1])]);nxt+=ST}
    acc+=d}
  const n=sm.length;if(n<4)return null;
  const forest=new Uint8Array(n),good=new Uint8Array(n),rep=new Uint8Array(n),cells=new Map();   // cells : maille de 20 m → premier échantillon qui la touche (indices croissants : « repassé » = un voisin déjà touché 4 échantillons plus tôt)
  for(let i=0;i<n;i++){
    const q=merc(sm[i][0],sm[i][1]),c=Math.floor((q[0]-meta.x0)/meta.res),r=Math.floor((meta.y1-q[1])/meta.res);
    if(c>=0&&r>=0&&c<meta.cols&&r<meta.rows){const gi=r*meta.cols+c,v=curC()[gi],fo=G.fx[gi]>0;forest[i]=fo?1:0;good[i]=fo&&v!==255&&v>=2&&v<5?1:0}
    const kx=Math.floor((sm[i][1]-g.lon0)*g.kx/ST)+32768,ky=Math.floor((sm[i][0]-g.lat0)*g.ky/ST)+32768;
    for(let a=-1;a<=1&&!rep[i];a++)for(let b=-1;b<=1;b++){const j=cells.get((kx+a)*65536+ky+b);if(j!==undefined&&i-j>=4){rep[i]=1;break}}
    const k=kx*65536+ky;if(!cells.has(k))cells.set(k,i)}
  let nf_=0,ng=0,nr=0,nd=0;
  for(let i=0;i<n;i++){nf_+=forest[i];ng+=good[i];nr+=rep[i]}
  for(let i=0;i<n;){if(!rep[i]){i++;continue}let j=i,reach=false;while(j<n&&rep[j])j++;   // tronçon répété i…j-1 : atteint-il une zone favorable en forêt ?
    for(let k=Math.max(0,i-2);k<Math.min(n,j+2);k++)if(good[k]){reach=true;break}
    if(!reach&&j-i>=4)nd+=j-i;i=j}
  return {forest:nf_/n,good:ng/n,rep:nr/n,dead:nd/n,len:n*ST}}
// coût de sélection d'une boucle : écart à la cible, impasses lourdement, répétitions, moins de forêt / de zones favorables
let LFW=1;   // poids de la part en forêt dans le choix d'une boucle
const loopCost=(err,m)=>m?err+3*m.dead+2*m.rep-.5*m.good-LFW*m.forest:err;
// repassage SPATIAL : un chemin et une route parallèles à 10 m comptent comme le même tracé. Les arêtes dont un échantillon (25 m) tombe dans une maille de 20 m voisine d'une arête déjà prise (couloir d'environ 30 m) coûtent ×PCOR ;
// les 60 premiers et derniers mètres de chaque tronçon sont exemptés (on part de l'étape, on y arrive : on ne peut pas faire autrement).
const COR_C=20,COR_END=60;let PCOR=8,SQ=1,DLN=0;   // SQ : nombre maximal de formes à 4 étapes essayées par exploration (0 = triangle seul)
function cellIdx(g){
  if(g.CI)return g.CI;const s=new Int32Array(g.nE+1).fill(-1),m=new Map(),n=g.SE.length;
  for(let k=0;k<n;k++){const e=g.SE[k];if(s[e]<0)s[e]=k;const key=(Math.floor(g.SX[k]/COR_C)+32768)*65536+Math.floor(g.SY[k]/COR_C)+32768;let l=m.get(key);if(!l)m.set(key,l=[]);if(l[l.length-1]!==e)l.push(e)}
  s[g.nE]=n;for(let e=g.nE-1;e>=0;e--)if(s[e]<0)s[e]=s[e+1];
  return g.CI={s,m}}
function corridor(R,pen,done){   // marque les arêtes du couloir de R (mailles voisines des échantillons de R) ; done : mailles déjà traitées
  const g=GR,E=cellIdx(g),tot=seqLen(R);let acc=0;
  for(const [e,s0,s1] of R.seq){const lo=Math.min(s0,s1),hi=Math.max(s0,s1);
    for(let k=E.s[e];k<E.s[e+1];k++){const s=g.SS[k];if(s<lo||s>hi)continue;const pos=acc+(s1>=s0?s-lo:hi-s);if(pos<COR_END||tot-pos<COR_END)continue;
      const cx=Math.floor(g.SX[k]/COR_C)+32768,cy=Math.floor(g.SY[k]/COR_C)+32768;
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const key=(cx+a)*65536+cy+b;if(done.has(key))continue;done.add(key);const l=E.m.get(key);if(l)for(const f of l)if(pen[f]<PCOR)pen[f]=PCOR}}
    acc+=hi-lo}}
let nf=null,DN=null,NEAR=null,PGT=0;   // part de forêt (0-1) des noeuds, pour le choix des étapes · DN : distance par les chemins depuis le départ
async function loopOnce(A,ax,ay,th,r0_,envie,q,nq,cand,off,pA,all){
  const r=r0_,run=RUN,g=GR,pickW=(ang,r=r0_)=>{   // meilleurs noeuds dans la direction ang, à la distance r PAR LES CHEMINS (DN : un seul Dijkstra depuis le départ) : on préfère les noeuds en forêt et dans les zones favorables
    const L=[],N_=NEAR;
    for(let i=0;i<N_.u.length;i++){const dn=N_.dn[i];if(dn<r*.75||dn>r*1.3)continue;const da=Math.abs(((N_.an[i]-ang+3*Math.PI)%(2*Math.PI))-Math.PI),u=N_.u[i];
      if(da<Math.PI/4)L.push([2*Math.abs(dn-r)/r+Math.abs(N_.rho[i]-r/1.5)/r+da/(Math.PI/6)-.6*nq[u]-(LOOPQ?.5*nf[u]:0)+.45*LNZ*hz2(u,3,SEEDV),u])}
    return L.sort((a,b)=>a[0]-b[0]).slice(0,4).map(x=>x[1])};
  const C1=pickW(th),C2=pickW(th+Math.PI/3),res=[],maxN=!all?1:off?4:12,L1=new Map();
  for(const w1 of C1)for(const w2 of C2){if(w1===w2)continue;if(res.length>=maxN)break;
    if(off){   // tout-terrain : trois tronçons hors chemin autorisés (départ → W1 → W2 → départ) ; les cellules déjà empruntées coûtent ×4
      const ll=u=>({lat:g.lat[u],lng:g.lon[u]}),seq=[],pl=[],O={len:0,up:0,dn:0,sec:0,lvl:0};let ok=true,P=pA;const used=LOOPQ?new Set():null;
      for(const w of [ll(w1),ll(w2),pA]){
        stop(run);const R=await AW(routeOff(P,w,envie,undefined,used,{maxStops:2,ms:1500}),run);if(!R||R.error){if(R&&R.error)LOOPERR=R.error;ok=false;break}
        seq.push(...R.seq);pl.push(...R.pl);for(const k of ["len","up","dn","sec"])O[k]+=R.off[k];O.lvl=Math.max(O.lvl,R.off.lvl||0);P=w;
        if(used)for(const gi of R.cellsG)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)used.add(gi+dy*meta.cols+dx)}
      if(ok){const o={seq,pl,off:O};if(!all)return o;res.push(o)}continue}
    res.push(...legsOnce([w1,w2],A,envie,q,L1,all,true));if(!all&&res.length)return res[0];if(all&&LOOPQ&&PCOR>1&&performance.now()<DLN)res.push(...legsOnce([w1,w2],A,envie,q,L1,all,false))}   // à l'exploration, avec et sans couloir : le coût de sélection choisit
  // forme à 4 étapes (A → W1 → W2 → W3 → A, W2 plus loin que W1 et W3) : testée en plus du triangle, à l'exploration seulement
  if(all&&!off&&LOOPQ&&SQ>0&&performance.now()<DLN){const C1b=pickW(th),C2b=pickW(th+Math.PI/4,r*1.25),C3b=pickW(th+Math.PI/2);let nsq=0;
    for(const w1 of C1b.slice(0,2))for(const w2 of C2b.slice(0,2))for(const w3 of C3b.slice(0,2)){if(nsq>=SQ||w1===w2||w2===w3||w1===w3)continue;
      const o=legsOnce([w1,w2,w3],A,envie,q,L1,true,true);if(o.length){nsq++;res.push(...o)}}}
  return all?res:null}
function legsOnce(ws,A,envie,q,L1,all,cor){   // parcours A → étapes → A sur le réseau ; les arêtes déjà prises et leur couloir coûtent plus cher
  const g=GR,pen=new Float32Array(g.nE).fill(1),seq=[],cs=LOOPQ&&cor&&PCOR>1?new Set():null;let P=A;
  for(const w of [...ws.map(nodeSnap),A]){
    let R;
    if(P===A&&seq.length===0){const w1=ws[0];R=L1.has(w1)?L1.get(w1):(L1.set(w1,route(P,w,envie,pen,q)),L1.get(w1))}   // 1re étape (départ → W1) : ne dépend que de W1
    else R=route(P,w,envie,pen,q);
    if(!R)return [];
    seq.push(...R.seq);for(const [e] of R.seq)pen[e]=LOOPQ?12:6;if(cs)corridor(R,pen,cs);P=w}
  return [{seq,sq:ws.length>2}]}
function mkLoopC(R,metric,target,MXv,hard){const aim=target*.93,S=summarize(R),m=loopMetrics(R),mm=metric==="len"?S.len:S.sec,ov=mm>(hard||target),err=mm>target?1+(mm-target)/target:Math.abs(mm-aim)/aim;S.met=m;return {R,S,err,over:ov,M:m,cost:loopCost(err,m)+(S.lvl>MXv?1:0)}}
async function loopRoutes(A,pt,metric,target,envie,off,hard){
  const run=RUN,rnd=RND,dl=performance.now()+BUDGET,late=()=>performance.now()>dl,_d=(DLN=dl),g=GR,q=envie>0?bonusQ():null,nq=new Float32Array(g.nN);
  if(!g.LX){   // part de forêt des noeuds et noeuds candidats : propres au réseau, calculés une fois
    const nf0=new Float32Array(g.nN),c0=[];let mxf=1;for(let e=0;e<g.nE;e++)if(g.fo[e]>mxf)mxf=g.fo[e];
    for(let e=0;e<g.nE;e++){const f=g.fo[e]/mxf;nf0[g.a[e]]=Math.max(nf0[g.a[e]],f);nf0[g.b[e]]=Math.max(nf0[g.b[e]],f)}
    for(let u=0;u<g.nN;u++){for(let k=g.deg[u];k<g.deg[u+1];k++){const e=g.adj[k]>>1;if(g.cls[e]>=3){c0.push(u);break}}}
    g.LX={nf:nf0,cand:c0}}
  nf=g.LX.nf;const cand=g.LX.cand;
  if(q)for(let e=0;e<g.nE;e++){nq[g.a[e]]=Math.max(nq[g.a[e]],q[e]);nq[g.b[e]]=Math.max(nq[g.b[e]],q[e])}
  const ax=(pt.lng-g.lon0)*g.kx,ay=(pt.lat-g.lat0)*g.ky,out=[];
  // distance visée en mètres de chemin : longueur de la boucle (ou durée marchée à 4 km/h ÷ rythme) ; la boucle fait environ 3,5 fois la distance d'une étape
  const Lm=metric==="len"?target*.93:target*.93/3600*4000/durF();DN=netDist(A,Math.min(15000,Lm*.8));
  {const us=[],dns=[],ans=[],rhos=[];   // noeuds candidats atteints par les chemins : distance par les chemins, direction et distance à vol d'oiseau, calculées une fois
    for(const u of cand){if(DN[u]===Infinity)continue;const x=(g.lon[u]-g.lon0)*g.kx-ax,y=(g.lat[u]-g.lat0)*g.ky-ay;us.push(u);dns.push(DN[u]);ans.push(Math.atan2(y,x));rhos.push(Math.hypot(x,y))}
    NEAR={u:us,dn:dns,an:ans,rho:rhos}}
  // secteurs : 12 directions, score = somme des meilleurs noeuds des deux fenêtres (zones favorables + forêt) ; on garde 3 directions écartées d'au moins 90°
  const NT=LOOPQ&&!off?5:3,sc=[];for(let i=0;i<12;i++){const th=i*Math.PI/6;let v=0;for(const u of cand){const x=(g.lon[u]-g.lon0)*g.kx-ax,y=(g.lat[u]-g.lat0)*g.ky-ay,an=Math.atan2(y,x),d=Math.hypot(x,y);
      const da=Math.abs(((an-th-Math.PI/6+3*Math.PI)%(2*Math.PI))-Math.PI);if(da<Math.PI/4&&d>500&&d<8000)v+=nq[u]+(LOOPQ?.5*nf[u]:0)}sc.push([v*(1+.8*LNZ*hz2(i,7,SEEDV)),th])}
  sc.sort((a,b)=>b[0]-a[0]);const ths=[];for(const [,t] of sc){if(ths.every(u=>{const d=Math.abs(((t-u+3*Math.PI)%(2*Math.PI))-Math.PI);return d>=Math.PI/2}))ths.push(t);if(ths.length===NT)break}
  while(ths.length<3)ths.push(ths.length*2*Math.PI/3);
  // plafond strict : `target` est un maximum ; on vise 93 % du plafond (marge de ±7 %) et toute boucle au-dessus du plafond est marquée `over` (err > 1)
  const aim=target*.93,MXv=+($("it-max")?$("it-max").value:4),mkC=R=>mkLoopC(R,metric,target,MXv,hard);
  let ti=0;
  for(const th of ths){
    prog("Calcul des boucles… direction "+(++ti)+"/"+ths.length+(PGT?" (essai "+PGT+")":""));
    let r=Math.min(12000,Lm/(off?3:3.5)),best=null;   // hors chemin les étapes se rejoignent presque en ligne droite : on part d'une distance plus grande
    let lo=null,hi=null,pM=null,stall=0;   // encadrement de la distance d'étape : plus grande valeur donnant une boucle sous la cible, plus petite au-dessus (le choix des noeuds saute par paliers : on resserre l'intervalle au lieu de tâtonner)
    for(let it=0;it<9;it++){
      const R=await AW(loopOnce(A,ax,ay,th,r,envie,q,nq,cand,off,pt),run);if(!R)break;
      const c=mkC(R),M=metric==="len"?c.S.len:c.S.sec;
      if(!best||c.err<best.err)best=c;
      if(c.err<=.1||(late()&&!best.over&&best.err<=.35))break;
      if(pM!==null&&Math.abs(pM-M)<1&&++stall>=2)break;pM=M;   // la boucle ne change plus avec la distance d'étape : inutile d'insister
      if(M<aim){if(!lo||r>lo.r)lo={r,M}}else if(!hi||r<hi.r)hi={r,M}
      let nr=r*Math.pow(aim/M,it<4?.9:.6)*(1+(it>=4?(rnd()-.5)*.15:0));
      if(lo&&hi&&hi.r>lo.r){if(hi.r-lo.r<.03*lo.r)break;const t=(aim-lo.M)/(hi.M-lo.M);nr=lo.r+(hi.r-lo.r)*Math.min(.85,Math.max(.15,isFinite(t)?t:.5))}
      r=Math.min(12000,Math.max(300,nr))}
    // exploration : plusieurs couples d'étapes autour du rayon trouvé ; on garde la boucle de coût minimal (forêt, peu de répétitions, pas d'impasse) à ±15 % de la visée (93 % du plafond)
    if(LOOPQ&&best&&!late()){
      for(const k of off?[1,.93,1.07]:[1,.92,1.08]){if(late()&&best.err<=.15)break;const L_=await AW(loopOnce(A,ax,ay,th,r*k,envie,q,nq,cand,off,pt,true),run);
        for(const R of L_){const c=mkC(R);if(c.err<=.15&&(c.cost<best.cost||best.err>.15))best=c}}}
    if(best)out.push(best);
    await AW(new Promise(r=>setTimeout(r,0)),run);
    if(late()&&out.some(x=>!x.over))break}
  const fe=out.filter(x=>!x.over),ok=fe.filter(x=>x.err<=.35),res=ok.length?ok:fe.length?fe:out;
  if(LOOPQ){const good=res.filter(x=>!x.M||x.M.dead<=.03);return (good.length?good:res).sort((a,b)=>a.cost-b.cost)}
  return res}
function lv95(lat,lng){const p=(lat*3600-169028.66)/10000,l=(lng*3600-26782.5)/10000;
  return [2600072.37+211455.93*l-10938.51*l*p-0.36*l*p*p-44.54*l*l*l,1200147.07+308807.95*p+3745.25*l*l+76.63*p*p-194.56*l*l*p+119.79*p*p*p]}
function geoLink(S){S=S||last;if(!S||!S.ll||!S.ll.length)return"#";const a=S.ll[0],q=lv95(a[0],a[1]);return`https://map.geo.admin.ch/#/map?lang=fr&center=${Math.round(q[0])},${Math.round(q[1])}&z=10&crosshair=marker,${Math.round(q[0])},${Math.round(q[1])}`}
// GPX seul (fichier « itineraire-….gpx », type MIME application/gpx+xml) : sur téléphone, la feuille de partage s'ouvre (choisir l'app swisstopo) ; sinon téléchargement.
const xe=t=>String(t).replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
function gpxText(ll,wps,name){
  const nm=xe(name||"Itinéraire Magichampi"),pts_=ll.map(p=>`<trkpt lat="${(+p[0]).toFixed(6)}" lon="${(+p[1]).toFixed(6)}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Magichampi" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${nm}</name><time>${new Date().toISOString()}</time></metadata>${(wps||[]).map((p,i)=>`<wpt lat="${(+p[0]).toFixed(6)}" lon="${(+p[1]).toFixed(6)}"><name>Point de passage ${i+1}</name></wpt>`).join("")}<trk><name>${nm} (proposition, sans garantie de sécurité)</name><type>hiking</type><trkseg>${pts_}</trkseg></trk></gpx>`}
function gpxFile(ll,wps,name){
  const fn=(String(name||"itineraire-magichampi").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,"").toLowerCase()||"itineraire-magichampi")+".gpx";
  return new File([gpxText(ll,wps,name)],fn,{type:"application/gpx+xml"})}
function gpxOut(f,share){
  if(share&&navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:f.name}).catch(()=>{});return}
  const a=document.createElement("a");a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function gpx(){
  if(!last||!last.ll)return;
  gpxOut(gpxFile(last.ll,last.wps,"Itinéraire Magichampi"),true)}

/* ---------- tout-terrain (bêta) ---------- */
// Dijkstra sur la grille de 25 m (cellules d'environ 17 m de côté au sol) reliée au réseau de chemins : les chemins sont des arcs de cellule à cellule
// (coût du graphe), la forêt peut être traversée hors chemin (Tobler ×1,6) seulement près d'une zone « élevé » ou mieux, et jamais dans les cellules à
// pente ≥ 30° (25-30° ×3 plus lent), cours d'eau (tampon d'une cellule), marais, réserves et zones exclues (usable).
// Règles du tout-terrain par difficulté maximale (0 très facile … 3 difficile ; 4 = aucune limite) : distance maximale à un chemin (m) et pente maximale (°) en terrain hors chemin.
const OFF_DIST=[25,50,100,200],OFF_SLP=[8,15,20,25],slvOf=s=>s<OFF_SLP[0]?0:s<OFF_SLP[1]?1:s<OFF_SLP[2]?2:s<OFF_SLP[3]?3:4;
const PATHK=3,USED_K=4,REWK=.55,OFFX=1.6,OFF_SLOPE=30,OFF_NEAR=100,DETOUR_CAP=[1,1.3,1.8,2.6],OFF_SHARE=[.5,.6,.7,.8],OFFK=[1.5,2.2,3.2,5];   // DETOUR_CAP : plafond de durée par cran du curseur de détour
// Tout-terrain PROGRESSIF : s = min(difficulté,3) + envie de détour (0 à 6). Le hors-chemin est d'abord limité à une bande étroite le long des chemins, qui s'élargit avec s :
//  s = 0 (très facile, sans détour) : bande de 10 m (≈ 1 cellule), pente < 8° · s = 4 (moyen + détour) : ≈ 30 m, pente < 12°, avec allers-retours vers les zones à bon score · s = 6 (difficile + grand détour) : règles de la difficulté, comme avant.
// La limite de la difficulté choisie (OFF_DIST / OFF_SLP) reste toujours valable en plus.
const PROG_D=[10,15,20,25,30,60,1e9],PROG_S=[8,9,10,11,12,18,99],OFF_LIGHT=.6,OFF_LCAP=1.1,FARK=4;   // OFF_LIGHT : récompense légère sans détour (on longe les bords) · OFF_LCAP : durée max. × 1,1 sans détour
const offProg=(M,envie)=>{const s=Math.min(M,3)+envie;return {s,dist:PROG_D[s],slope:PROG_S[s]}};
let HZ=null,HZkey="";
async function hazards(){
  const key=ZD+"|"+meta.x0+"|"+meta.y1+"|"+meta.cols+"|"+meta.rows;if(HZ&&HZkey===key)return HZ;
  const W=meta.cols,H=meta.rows,water=new Uint8Array(W*H),marsh=new Uint8Array(W*H);
  const J=u=>fetch(ZD+u).then(r=>r.ok?r.json():null).catch(()=>null),[ce,rs]=await Promise.all([J("cours_eau.geojson"),J("reserves.geojson")]);
  const cl=(lng,lat)=>{const q=merc(lat,lng);return [(q[0]-meta.x0)/meta.res,(meta.y1-q[1])/meta.res]},mark=(x,y)=>{for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const c=Math.floor(x)+dx,r=Math.floor(y)+dy;if(c>=0&&r>=0&&c<W&&r<H)water[r*W+c]=1}};
  if(ce)for(const f of ce.features){const gm=f.geometry,ls=gm.type==="LineString"?[gm.coordinates]:gm.type==="MultiLineString"?gm.coordinates:[];
    for(const l of ls)for(let i=1;i<l.length;i++){const a=cl(l[i-1][0],l[i-1][1]),b=cl(l[i][0],l[i][1]),n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2));
      if(Math.max(a[0],b[0])<0||Math.max(a[1],b[1])<0||Math.min(a[0],b[0])>W||Math.min(a[1],b[1])>H)continue;
      for(let k=0;k<=n;k++)mark(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n)}}
  if(rs){const cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");x.fillStyle="#000";
    const ring=r=>{r.forEach(([lo,la],k)=>{const q=cl(lo,la);k?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});x.closePath()};
    rs.features.forEach(f=>{if(!/marais/i.test(f.properties.src||""))return;const gm=f.geometry,P=gm.type==="Polygon"?[gm.coordinates]:gm.coordinates;P.forEach(poly=>{x.beginPath();poly.forEach(ring);x.fill("evenodd")})});
    const d=x.getImageData(0,0,W,H).data;for(let i=0;i<W*H;i++)marsh[i]=d[i*4+3]>127?1:0}
  HZ={water,marsh};HZkey=key;return HZ}
function dilate(m,W,H,r){   // dilatation carrée de rayon r (cellules), séparable
  const t=new Uint8Array(W*H),o=new Uint8Array(W*H);
  for(let y=0;y<H;y++){let last=-1e9;for(let x=0;x<W;x++){if(m[y*W+x])last=x;if(x-last<=r)t[y*W+x]=1}last=1e9;for(let x=W-1;x>=0;x--){if(m[y*W+x])last=x;if(last-x<=r)t[y*W+x]=1}}
  for(let x=0;x<W;x++){let last=-1e9;for(let y=0;y<H;y++){if(t[y*W+x])last=y;if(y-last<=r)o[y*W+x]=1}last=1e9;for(let y=H-1;y>=0;y--){if(t[y*W+x])last=y;if(last-y<=r)o[y*W+x]=1}}
  return o}
async function routeOff(pA,pB,envie,Mx,used,opts){
  opts=opts||{};
  const MX=Mx!=null?Mx:+($("it-max")?$("it-max").value:4);
  const g=GR,W=meta.cols,H=meta.rows,res=meta.res,gs=res*Math.cos(pA.lat*Math.PI/180);
  if(!curC())return {error:"La carte n'affiche aucune zone : choisissez une espèce ou la forte concentration."};
  const cOf=(lat,lng)=>{const q=merc(lat,lng);return [Math.floor((q[0]-meta.x0)/res),Math.floor((meta.y1-q[1])/res)]},a=cOf(pA.lat,pA.lng),b=cOf(pB.lat,pB.lng);
  const ok=c=>c[0]>=0&&c[1]>=0&&c[0]<W&&c[1]<H;
  if(!ok(a)||!ok(b))return {error:"Départ ou arrivée hors de la zone chargée : centrez la carte sur le trajet puis recommencez."};
  const mg=Math.round(1500/gs),c0=Math.max(0,Math.min(a[0],b[0])-mg),c1=Math.min(W,Math.max(a[0],b[0])+mg+1),r0=Math.max(0,Math.min(a[1],b[1])-mg),r1=Math.min(H,Math.max(a[1],b[1])+mg+1),ww=c1-c0,hh=r1-r0,N=ww*hh;
  if(N>450000)return {error:"Tout-terrain limité à environ 10 km entre le départ et l'arrivée."};
  const w0=wxOn()?wx(pA.lat,pA.lng):null,ref=wxRefuse(w0);if(ref)return {error:ref};
  const wet=wxWet(w0)||wxCold(w0),slopeMax=wet?25:OFF_SLOPE,hz0=await hazards(),hz=wet?{water:dilate(hz0.water,W,H,1),marsh:hz0.marsh}:hz0,al=new Uint8Array(N),high=new Uint8Array(N);
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const gi=(r0+y)*W+c0+x,li=y*ww+x;if(curC()[gi]!==255&&curC()[gi]>=3)high[li]=1}
  const near=dilate(high,ww,hh,Math.ceil(OFF_NEAR/gs)*1);
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const gi=(r0+y)*W+c0+x,li=y*ww+x;
    al[li]=near[li]&&usable(gi)&&G.fx[gi]>0&&G.slope[gi]<slopeMax&&!hz.water[gi]&&!hz.marsh[gi]?1:0}
  // arcs de chemin (échantillons consécutifs d'une même arête), dans la fenêtre
  const qq=bonusQ(),cnt=new Int32Array(N+1),arcs=[];
  const lc=k=>{const X=g.SM[2*k],Y=g.SM[2*k+1],c=Math.floor((X-meta.x0)/res)-c0,r=Math.floor((meta.y1-Y)/res)-r0;return c>=0&&r>=0&&c<ww&&r<hh?r*ww+c:-1};
  for(let k=0;k+1<g.SE.length;k++){if(g.SE[k]!==g.SE[k+1])continue;const u=lc(k),v=lc(k+1);if(u<0||v<0||u===v)continue;const e=g.SE[k],f=(g.SS[k+1]-g.SS[k])/Math.max(g.len[e],1);
    arcs.push([u,v,e,f,0,k*2],[v,u,e,f,1,k*2+1]);cnt[u+1]++;cnt[v+1]++}
  for(let i=0;i<N;i++)cnt[i+1]+=cnt[i];const fill=cnt.slice(),aTo=new Int32Array(arcs.length),aE=new Int32Array(arcs.length),aF=new Float32Array(arcs.length),aD=new Uint8Array(arcs.length),aId=new Int32Array(arcs.length);
  for(const [u,v,e,f,d,id] of arcs){const q=fill[u]++;aTo[q]=v;aE[q]=e;aF[q]=f;aD[q]=d;aId[q]=id}
  const onPath=i=>cnt[i+1]>cnt[i];
  // difficulté maximale : hors chemin seulement à ≤ OFF_DIST[M] m d'un chemin du réseau et sous la pente OFF_SLP[M] ; dl = niveau de distance de chaque cellule (0-3, 4 au-delà de 200 m)
  const pm=new Uint8Array(N),dl=new Uint8Array(N).fill(4);for(let i=0;i<N;i++)pm[i]=onPath(i)?1:0;
  for(let lv=3;lv>=0;lv--){const dd=dilate(pm,ww,hh,Math.max(1,Math.round(OFF_DIST[lv]/gs)));for(let i=0;i<N;i++)if(dd[i])dl[i]=lv}
  if(MX<4)for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const li=y*ww+x;if(al[li]&&(dl[li]>MX||slvOf(G.slope[(r0+y)*W+c0+x])>MX))al[li]=0}
  const PR=offProg(MX,envie),prog=PR.s<6;   // bande et pente progressives selon difficulté + détour
  const fz=new Uint8Array(N);   // fz : cellule praticable mais hors de la bande progressive (liaison seulement : coût × FARK, jamais une zone visitée)
  if(prog){const dd=dilate(pm,ww,hh,Math.max(1,Math.round(PR.dist/gs)));for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const li=y*ww+x;if(al[li]&&(!dd[li]||G.slope[(r0+y)*W+c0+x]>=PR.slope))fz[li]=1}}
  const hardP=!prog&&envie>=3;   // difficulté et détour au maximum : suivre un chemin DANS une zone colorée coûte ×PATHK (chemin = accès seulement), on traverse la zone hors chemin
  const eff=envie>0?envie:OFF_LIGHT,capF=envie>0?DETOUR_CAP[envie]:OFF_LCAP;
  // bande de OFF_ROAD m le long des routes de classe 2 : pas de hors-chemin en forêt (on suit la route) ; les cellules de chemin restent praticables
  const ban=new Uint8Array(N);
  for(let k=0;k+1<g.SE.length;k++){if(g.SE[k]!==g.SE[k+1]||g.cls[g.SE[k]]!==2)continue;
    const x0=(g.SM[2*k]-meta.x0)/res-c0,y0=(meta.y1-g.SM[2*k+1])/res-r0,x1=(g.SM[2*k+2]-meta.x0)/res-c0,y1=(meta.y1-g.SM[2*k+3])/res-r0;
    if(Math.max(x0,x1)<-3||Math.min(x0,x1)>ww+3||Math.max(y0,y1)<-3||Math.min(y0,y1)>hh+3)continue;
    const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)*gs/5)),R_=Math.ceil(OFF_ROAD/gs);
    for(let j=0;j<=n;j++){const x=x0+(x1-x0)*j/n,y=y0+(y1-y0)*j/n;
      for(let dy=-R_;dy<=R_;dy++)for(let dx=-R_;dx<=R_;dx++){const c=Math.floor(x)+dx,r=Math.floor(y)+dy;if(c<0||r<0||c>=ww||r>=hh)continue;
        if(Math.hypot((c+.5-x)*gs,(r+.5-y)*gs)<=OFF_ROAD){al[r*ww+c]=0;ban[r*ww+c]=1}}}}
  // départ / arrivée : la cellule touchée si elle est utilisable, sinon le point de chemin le plus proche
  const pick=(p,c)=>{const li=(c[1]-r0)*ww+(c[0]-c0);if(al[li]||onPath(li))return li;const s=snap(L.latLng(p.lat,p.lng));if(!s)return -1;return lc(s.k)};
  const S0=pick(pA,a),T0=pick(pB,b);if(S0<0||T0<0)return {error:"Le départ ou l'arrivée est à plus de 300 m d'un chemin et hors zone utilisable."};
  // tas binaire typé
  let cap=1<<20,hk=new Float64Array(cap),hv=new Int32Array(cap),hn=0;
  const hpush=(k,v)=>{if(hn===cap){cap*=2;const a1=new Float64Array(cap),b1=new Int32Array(cap);a1.set(hk);b1.set(hv);hk=a1;hv=b1}let i=hn++;while(i>0){const p=(i-1)>>1;if(hk[p]<=k)break;hk[i]=hk[p];hv[i]=hv[p];i=p}hk[i]=k;hv[i]=v};
  const hpop=()=>{const v=hv[0],k0=hk[0],k=hk[--hn],w=hv[hn];let i=0;for(;;){let c=2*i+1;if(c>=hn)break;if(c+1<hn&&hk[c+1]<hk[c])c++;if(hk[c]>=k)break;hk[i]=hk[c];hv[i]=hv[c];i=c}hk[i]=k;hv[i]=w;popK=k0;return v};let popK=0;
  const dm=G.dem,sl=G.slope,tob=(L_,g_)=>L_/(6000/3600*Math.exp(-3.5*Math.abs(g_+.05)));
  // Dijkstra à force de récompense str (0 = plus rapide ; 1 = envie choisie) ; rt = durée réelle (s) sans récompense.
  const usd=used&&used.size?used:null,giOf=li=>(r0+((li/ww)|0))*W+c0+(li%ww);   // cellules déjà empruntées (boucle) : coût ×USED_K, pour ne pas repasser au même endroit
  const nzc=NZ?new Float32Array(N):null;if(nzc)for(let i=0;i<N;i++){nzc[i]=1+NZA*nzField(meta.x0+(c0+(i%ww)+.5)*res,meta.y1-(r0+((i/ww)|0)+.5)*res,SEEDV)}   // aléa : surcoût spatial lisse des pas hors chemin
  let offK=1;   // surcoût des pas hors chemin (relevé par paliers quand la part hors chemin dépasse OFF_SHARE)
  const cc=new Map(),solve=(str,S0,T0)=>{
    const pkS=1+(PATHK-1)*str,e1=eff*str,{cf,cb}=cc.get(str)||(cc.set(str,costs(e1,null,e1>0?qq:null)),cc.get(str)),R0=cc.get("rt")||(cc.set("rt",(()=>{const bp=BP;BP=null;try{return costs(0,null,null,true)}finally{BP=bp}})()),cc.get("rt")),   // R0 : durée réelle, sans la pénalité de difficulté (sinon le plafond de détour devient démesuré)
      dist=new Float64Array(N).fill(Infinity),rt=new Float64Array(N),prev=new Int32Array(N).fill(-1),via=new Int32Array(N).fill(-1);
    hn=0;dist[S0]=0;hpush(0,S0);
    // récompense hors chemin : bien plus forte que sur chemin (jusqu'à ×0,1 dans une cellule très élevée avec « grand détour »)
    const rew=cw=>cw!==255&&cw<5&&e1>0?1-Math.min(.97,REWK*e1*WGW[cw]):1;
    while(hn){const u=hpop(),d=popK;if(d>dist[u])continue;if(u===T0)break;
      for(let k=cnt[u];k<cnt[u+1];k++){const v=aTo[k],e=aE[k],w=d+(aD[k]?cb[e]:cf[e])*aF[k]*(NZ?NZ[e]:1)*(usd&&usd.has(giOf(v))?USED_K:1)*(hardP&&high[v]?pkS:1);if(w<dist[v]){dist[v]=w;rt[v]=rt[u]+(aD[k]?R0.cb[e]:R0.cf[e])*aF[k];prev[v]=u;via[v]=aId[k];hpush(w,v)}}
      const ux=u%ww,uy=(u/ww)|0,ug=(r0+uy)*W+c0+ux;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=ux+dx,y=uy+dy;if(x<0||y<0||x>=ww||y>=hh)continue;const v=y*ww+x;
        if(ban[v]||ban[u])continue;   // dans la bande de 20 m le long d'une route de classe 2 : seulement par les arcs de la route (pas de pas hors chemin)
        if(!al[v]&&!(onPath(v)&&(al[u]||onPath(u))))continue;
        if(!al[v]&&onPath(v)&&!onPath(u)&&!al[u])continue;
        const vg=(r0+y)*W+c0+x,L_=gs*(dx&&dy?1.4142:1),slp=(dm[vg]-dm[ug])/L_,t0=tob(L_,slp)*OFFX*(sl[vg]>=25?3:1),t=t0*rew(curC()[vg])*(nzc?nzc[v]:1)*(fz[v]?FARK:1)*(usd&&usd.has(vg)?USED_K:1)*offK+(DV?DV.lam*(DV.both?Math.abs(dm[vg]-dm[ug]):Math.max(0,dm[vg]-dm[ug])):0);
        const w=d+t;if(w<dist[v]){dist[v]=w;rt[v]=rt[u]+t0;prev[v]=u;via[v]=-1;hpush(w,v)}}}
    return {dist,rt,prev,via}};
  // plafond de durée : la durée réelle ne dépasse pas CAP[envie] × celle du trajet le plus rapide ; sinon la récompense est réduite par paliers
  let sol=solve(1,S0,T0),detour=1,strF=1,bt=0,base=null,noGain=false;
  if(isFinite(sol.dist[T0])){base=solve(0,S0,T0);if(isFinite(base.dist[T0])){bt=base.rt[T0];const cap=bt*capF;
    for(const str of [1,.7,.45,.25,.1]){strF=str;if(str<1)sol=solve(str,S0,T0);if(sol.rt[T0]<=cap){break}}
    detour=bt>0?sol.rt[T0]/bt:1}}
  // part hors chemin plafonnée selon le détour choisi : sinon on renchérit les pas hors chemin par paliers (sans dépasser 1,3 × le plus rapide, ou le plafond de durée si plus large)
  if(isFinite(sol.dist[T0])){
    const share=sl=>{let o=0,t=0;for(let v=T0;v!==S0;v=sl.prev[v]){const u=sl.prev[v],id=sl.via[v];if(id>=0){const k=id>>1;t+=Math.abs(g.SS[k+1]-g.SS[k])}else{const dx=(v%ww)-(u%ww),dy=((v/ww)|0)-((u/ww)|0),l=gs*(dx&&dy?1.4142:1);o+=l;t+=l}}return t?o/t:0},lim=hardP?.97:(OFF_SHARE[envie]||OFF_SHARE[0]);
    if(share(sol)>lim){const bt1=bt>0?bt:sol.rt[T0],dcap=bt1*Math.max(capF,1.3);
      for(const K of OFFK){offK=K;const s2=solve(strF,S0,T0);if(!isFinite(s2.dist[T0]))break;if(s2.rt[T0]>dcap&&share(sol)>lim)break;sol=s2;if(share(sol)<=lim)break}
      if(bt>0)detour=sol.rt[T0]/bt}}
  const {dist}=sol;
  if(!isFinite(dist[T0]))return {error:"Aucun passage trouvé en tout-terrain : essayez sans cette option ou changez de point."};
  const recon=(sl,s_,t_)=>{const c=[],vv=[];for(let v=t_;v!==s_;v=sl.prev[v]){c.push(v);vv.push(sl.via[v])}c.push(s_);vv.push(-1);return {cells:c.reverse(),vias:vv.reverse(),rt:sl.rt[t_],cost:sl.dist[t_]}};
  let legs=[recon(sol,S0,T0)];
  // zones fortes : le plus court chemin pondéré ne s'écarte pas de sa route ; on ajoute donc des étapes dans les grandes zones fortes accessibles, tant que la durée reste sous le plafond
  // 5 des 10 meilleures zones accessibles : tirées au hasard (graine du calcul) parmi les 10 de meilleur score, gardées tant que la durée reste sous le plafond de détour ; en mode progressif les zones sont des bandes étroites (allers-retours depuis le chemin)
  const maxWP=Math.min([0,TOP_WANT,TOP_WANT,6][envie]||0,opts.maxStops!=null?opts.maxStops:99),dlOff=performance.now()+(opts.ms||5000);
  let nStops=0,nCand=0;
  if(maxWP&&bt>0){
    const cap=bt*capF,sa=new Uint8Array(N);for(let i=0;i<N;i++)sa[i]=high[i]&&al[i]&&!fz[i]?1:0;
    const lab=new Int32Array(N),blobs=[];let nl=0;
    for(let i0=0;i0<N;i0++){if(!sa[i0]||lab[i0])continue;const id=++nl,st=[i0],mem=[];lab[i0]=id;
      while(st.length){const u=st.pop();mem.push(u);const ux=u%ww,uy=(u/ww)|0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=ux+dx,y=uy+dy;if(x<0||y<0||x>=ww||y>=hh)continue;const v=y*ww+x;if(sa[v]&&!lab[v]){lab[v]=id;st.push(v)}}}
      if(mem.length>=(prog?6:25)){let q_=0;for(const u of mem){const c=curC()[giOf(u)];if(c!==255&&c<5)q_+=WGW[c]}let mx=0,my=0;for(const u of mem){mx+=u%ww;my+=(u/ww)|0}mx/=mem.length;my/=mem.length;let rep_=mem[0],bd=1e18;for(const u of mem){const d=(u%ww-mx)**2+(((u/ww)|0)-my)**2;if(d<bd){bd=d;rep_=u}}
        blobs.push({id,n:mem.length,rep:rep_,x:mx,y:my,q:q_})}}
    const route0=legs[0].cells,seen=new Set(route0),cross=new Map();for(const u of route0)if(lab[u])cross.set(lab[u],(cross.get(lab[u])||0)+1);
    const smp=[];for(let i=0;i<route0.length;i+=4)smp.push(i);
    for(const bl of blobs){let bd=1e18,bi=0;for(const i of smp){const u=route0[i],d=(u%ww-bl.x)**2+(((u/ww)|0)-bl.y)**2;if(d<bd){bd=d;bi=i}}bl.d=Math.sqrt(bd)*gs;bl.pos=bi;bl.gain=bl.n-(cross.get(bl.id)||0)*3;bl.sc=bl.gain/(300+2*bl.d)}
    const cand=shuffle(blobs.filter(b=>b.gain>=(prog?6:20)).sort((a,b)=>b.q-a.q).slice(0,TOP_N),RND);
    const key=(a,b)=>a*(N+1)+b,lc_=new Map(),getLeg=(a,b)=>{const k=key(a,b);let l=lc_.get(k);if(!l){const sl=solve(strF,a,b);l=isFinite(sl.dist[b])?recon(sl,a,b):null;lc_.set(k,l||0)}return lc_.get(k)};
    let chosen=[],curLegs=legs;
    for(const bl of cand){if(chosen.length>=maxWP||performance.now()>dlOff)break;
      const tryW=[...chosen,bl].sort((a,b)=>a.pos-b.pos),pts_=[S0,...tryW.map(w=>w.rep),T0],L2=[];let ok=true,tot=0;
      for(let i=0;i+1<pts_.length;i++){const l=getLeg(pts_[i],pts_[i+1]);if(!l){ok=false;break}L2.push(l);tot+=l.rt}
      if(ok&&tot<=cap){chosen=tryW;curLegs=L2}}
    legs=curLegs;nStops=chosen.length;nCand=cand.length;
    let rtT=0;for(const l of legs)rtT+=l.rt;detour=rtT/bt}
  // détour sans gain : on garde le trajet le plus rapide s'il ne traverse pas au moins MIN_GAIN m de plus de zones « moyen » ou mieux
  if(base&&bt>0&&detour>1.02&&isFinite(base.dist[T0])){
    const gl=cs=>{let n=0;for(const u of cs){const gi=(r0+((u/ww)|0))*W+c0+(u%ww),c=curC()[gi];if(c!==255&&c>=2&&c<5)n++}return n*gs},bl=recon(base,S0,T0);
    const lc2=legs.flatMap(l=>l.cells);if(gl(lc2)-gl(bl.cells)<Math.max(prog?30:MIN_GAIN,GAIN_RATIO*Math.max(0,lc2.length-bl.cells.length)*gs)){legs=[bl];detour=1;noGain=true}}
  const cells=[],vias=[];legs.forEach((l,k)=>{l.cells.forEach((c,i)=>{if(k>0&&i===0)return;cells.push(c);vias.push(i===0?-1:l.vias[i])})});
  const costT=legs.reduce((a,l)=>a+l.cost,0);
  // reconstruction (cells, vias construits ci-dessus)
  const smoothRun=run=>{
    const sight=(a,b)=>{const ax=a%ww+.5,ay=((a/ww)|0)+.5,bx=b%ww+.5,by=((b/ww)|0)+.5,n=Math.ceil(Math.hypot(bx-ax,by-ay)*3);
      for(let t=1;t<n;t++){const x=Math.floor(ax+(bx-ax)*t/n),y=Math.floor(ay+(by-ay)*t/n),li=y*ww+x;if(ban[li]||!(al[li]||onPath(li)))return false}return true};
    const keep=[0];let i=0;while(i<run.length-1){let j=run.length-1;while(j>i+1&&!sight(run[i],run[j]))j--;keep.push(j);i=j}
    return keep};
  const ll=li=>{const x=c0+(li%ww)+.5,y=r0+((li/ww)|0)+.5,X=meta.x0+x*res,Y=meta.y1-y*res;return [(2*Math.atan(Math.exp(Y/R_E))-Math.PI/2)*180/Math.PI,X/R_E*180/Math.PI]};
  const seq=[],pl=[],off={len:0,up:0,dn:0,sec:0,lvl:0};let cur=null;
  const flush=()=>{if(cur&&cur.ll.length>1)pl.push(cur);cur=null};
  for(let i=1;i<cells.length;i++){const v=cells[i],u=cells[i-1],id=vias[i];
    if(id>=0){const k=id>>1,fw=!(id&1),kk=fw?k:k+1,k2=fw?k+1:k,e=g.SE[k];
      const P=[g.lat0+g.SY[kk]/g.ky,g.lon0+g.SX[kk]/g.kx],Q=[g.lat0+g.SY[k2]/g.ky,g.lon0+g.SX[k2]/g.kx],kind=g.cls[e];
      if(!cur||cur.k!==kind){flush();cur={k:kind,ll:[P]}}cur.ll.push(Q);
      const last=seq[seq.length-1];if(last&&last[0]===e&&last[2]===g.SS[kk])last[2]=g.SS[k2];else seq.push([e,g.SS[kk],g.SS[k2]])}
    else{   // tronçon hors chemin : le pas de 25 m (escalier) est lissé par visibilité directe sur les cellules praticables ; dénivelé et durée comptés sur les pas d'origine (durée ramenée à la longueur lissée)
      let j=i;while(j+1<cells.length&&vias[j+1]<0)j++;
      const run=cells.slice(i-1,j+1),keep=smoothRun(run);
      if(!cur||cur.k!=="o"){flush();cur={k:"o",ll:[ll(run[0])]}}
      let ol=0,osec=0;
      for(let t=1;t<run.length;t++){const u=run[t-1],v=run[t],ug=(r0+((u/ww)|0))*W+c0+(u%ww),vg=(r0+((v/ww)|0))*W+c0+(v%ww),dx=(v%ww)-(u%ww),dy=((v/ww)|0)-((u/ww)|0),L_=gs*(dx&&dy?1.4142:1),dz=dm[vg]-dm[ug];
        if(!onPath(v))off.lvl=Math.max(off.lvl,dl[v],slvOf(sl[vg]));ol+=L_;if(dz>0)off.up+=dz;else off.dn-=dz;osec+=tob(L_,dz/L_)*OFFX*(sl[vg]>=25?3:1)}
      let sm=0;for(let t=1;t<keep.length;t++){const a=run[keep[t-1]],b=run[keep[t]];sm+=Math.hypot(((b%ww)-(a%ww))*gs,(((b/ww)|0)-((a/ww)|0))*gs);cur.ll.push(ll(b))}
      sm=Math.min(sm,ol);off.len+=sm;off.sec+=ol>0?osec*sm/ol:0;i=j}}
  flush();
  return {seq,off,pl,cost:costT,detour,noGain,cellsG:cells.map(giOf),stops:noGain?0:nStops,cand:nCand,prog:prog?PR.s:6}}


/* ---------- météo des 7 jours : avertissements et durcissement du tout-terrain ---------- */
// Données déjà dans la page (meteo.rprelimd, tmind, tabsd, maille G.midx). Seuils estimés, à caler : sol détrempé = ≥ 30 mm en 3 jours ou ≥ 60 mm en 7 jours.
function wx(lat,lng){
  if(typeof meteo==="undefined"||typeof G==="undefined"||!G||!G.midx||typeof todayIdx!=="function")return null;
  const q=merc(lat,lng),c=Math.floor((q[0]-meta.x0)/meta.res),r=Math.floor((meta.y1-q[1])/meta.res);
  if(c<0||r<0||c>=meta.cols||r>=meta.rows)return null;
  const m=G.midx[r*meta.cols+c],P=meteo.rprelimd[m],Tn=meteo.tmind[m],Ta=meteo.tabsd[m];if(!P)return null;
  const t=todayIdx();if(t<0||t>=meteo.dates.length)return {stale:true};
  const sum=(a,b)=>{let x=0;for(let k=Math.max(0,a);k<=Math.min(P.length-1,b);k++)x+=P[k]||0;return x};
  let tmin=99,tmean=99;for(let k=Math.max(0,t-1);k<=Math.min(P.length-1,t+2);k++){if(Tn&&Tn[k]!=null)tmin=Math.min(tmin,Tn[k]);if(Ta&&Ta[k]!=null)tmean=Math.min(tmean,Ta[k])}
  return {r3:sum(t-2,t),r7:sum(t-6,t),f48:sum(t+1,t+2),tmin,tmean,dem:meteo.dem[m]}}
const wxOn=()=>typeof state!=="undefined"&&!!state&&state.mode==="now";   // la météo ne compte que en mode « Conditions du moment »
const WX_SITE_NOTE=" <i>Mode Aptitude du lieu : cet itinéraire ne tient pas compte de la météo ; vérifiez les conditions avant de partir.</i>";
const wxWet=w=>!!w&&!w.stale&&(w.r3>=30||w.r7>=60),wxCold=w=>!!w&&!w.stale&&w.tmean<=1;   // gel ou neige possibles : tout-terrain durci, pas refusé
function wxRefuse(w){   // pas de tout-terrain si la météo est défavorable
  if(!w)return "";if(w.stale)return "La météo de la carte n'est pas à jour : actualisez-la (Menu › Météo et outils) avant d'utiliser le tout-terrain.";
  if(w.r3>=50)return "Tout-terrain déconseillé : "+Math.round(w.r3)+" mm de pluie en 3 jours (sol saturé, ruisseaux gonflés).";
  if(w.f48>=40)return "Tout-terrain déconseillé : "+Math.round(w.f48)+" mm de pluie annoncés dans les 48 h.";
  return ""}
// Tout-terrain AUTOMATIQUE (plus de case à cocher) : bande étroite le long des chemins qui s'élargit avec la difficulté et le détour. Coupé (tracé sur chemins) seulement si la météo est défavorable.
// L'avertissement avec case « Je comprends » ne s'affiche qu'à partir de « difficile » ou si les conditions du moment sont difficiles (sol détrempé, gel/neige, météo défavorable).
let OFFREF="";
let TTF=null;   // tests : setTT(false) force le tracé sur chemins seulement
function ttOn(p){if((TTF!=null?TTF:!window.__TTOFF)===false){OFFREF="";return false}const w=p&&wxOn()?wx(p.lat,p.lng):null;OFFREF=wxRefuse(w);return !OFFREF}
function offHard(M,p){const w=p&&wxOn()?wx(p.lat,p.lng):null;return M>=3||wxWet(w)||wxCold(w)}
function offBoxUpd(){const b=$("it-offbox");if(b)b.hidden=!offHard(+$("it-max").value,pts.A)}
function offGate(M,p,tt,msg,clr){   // false : l'utilisateur doit d'abord cocher « Je comprends »
  const h=tt&&offHard(M,p);$("it-offbox").hidden=!h;
  if(h&&!$("it-offok").checked){openReg();clr();msg.textContent="Parcours exigeant (difficulté élevée ou conditions difficiles) : cochez « Je comprends » ci-dessous, puis touchez Calculer.";return false}
  return true}
function wxWarn(S){
  const out=[],on=wxOn();   // hors « Conditions du moment » : avertir seulement en cas de danger, sans rien modifier au tracé
  if(typeof G==="undefined"||!G||!S.ll||!S.ll.length)return out;
  const mid=S.ll[S.ll.length>>1],w=wx(mid[0],mid[1]);
  if(!on&&(!w||w.stale))return out;
  if(!w){out.push("Météo non disponible pour ce secteur : consultez la prévision (MétéoSuisse) avant de partir.");return out}
  if(w.stale){out.push("La météo de la carte n'est pas à jour : actualisez-la (Menu › Météo et outils) et consultez la prévision.");return out}
  let maxAlt=0;for(let i=0;i<S.ll.length;i+=5){const q=merc(S.ll[i][0],S.ll[i][1]),c=Math.floor((q[0]-meta.x0)/meta.res),r=Math.floor((meta.y1-q[1])/meta.res);
    if(c>=0&&r>=0&&c<meta.cols&&r<meta.rows)maxAlt=Math.max(maxAlt,G.dem[r*meta.cols+c])}
  const tAlt=w.tmin-.0055*(maxAlt-(w.dem||maxAlt));
  if(wxCold(w)&&!wxWet(w))out.push(`<b>Gel ou neige possibles</b> dans les 2 jours : ${on?"le tout-terrain a été durci (pente ≤ 25°, marges élargies autour des cours d'eau) ; ":""}sol glissant, neige possible en altitude.`);
  if(wxWet(w))out.push(`<b>Sol détrempé</b> (${Math.round(w.r3)} mm en 3 jours, ${Math.round(w.r7)} mm en 7 jours) : pentes glissantes, ruisseaux gonflés, boue. Prévoyez plus de temps et de bonnes chaussures${on&&S.off>=20?" ; le tout-terrain a été durci (pente ≤ 25°, marges élargies autour des cours d'eau)":""}.`);
  if(w.f48>=15)out.push(`Pluie annoncée : ≈ ${Math.round(w.f48)} mm dans les 48 h. Consultez la prévision avant de partir.`);
  if(tAlt<=0&&maxAlt>=900)out.push(`<b>Gel possible en altitude</b> (≈ ${Math.round(tAlt)} °C vers ${Math.round(maxAlt)} m) : sentiers verglacés, neige possible au-dessus de ≈ 1 500 m.`);
  if(!on){if(out.length)out.push(WX_SITE_NOTE);return out}
  if(!out.length)out.push("Pas d'alerte météo dans les données de la carte (pluie, gel). Consultez toujours la prévision officielle avant de partir.");
  return out}

/* ---------- statistiques et difficulté ---------- */
function summarize(R){
  const g=GR;let len=0,up=0,dn=0,sec=0,c2=0,cross=0,un=0,bm=0,al=0,hd=0,smax=0,smaxE=-1;const lines=[];
  for(const [e,s0,s1] of R.seq){
    const full=Math.max(g.len[e],1),f=Math.abs(s1-s0)/full,fw=s1>=s0;if(f<=0)continue;
    len+=full*f;const u=fw?g.up[e]:g.dn[e],d=fw?g.dn[e]:g.up[e];up+=u*f;dn+=d*f;sec+=(fw?g.tf[e]:g.tb[e])*f;
    const L_=full*f,k=g.cls[e];
    if(k===2){c2+=L_;}
    else if(k===1)cross++;
    if(k===5&&!g.typ[e])un+=L_;if(g.typ[e]===2)bm+=L_;if(g.typ[e]===3)al+=L_;
    if(g.hard[e]>=50)hd+=L_;
    if(g.smax[e]>smax&&L_>=40){smax=g.smax[e];smaxE=e}
    lines.push({e,s0,s1,k});
  }
  const OF=R.off||{len:0,up:0,dn:0,sec:0,lvl:0};len+=OF.len;up+=OF.up;dn+=OF.dn;sec+=OF.sec;
  const secRaw=sec,fD=durF();sec=secRaw*fD;const h=secRaw*Math.max(1,fD)/3600,gain=up;   // durée affichée = marche × facteur ; niveau d'effort : jamais sous la durée de marche normale
  // niveau « effort » (durée, dénivelé positif) et niveau « technique » (pente, type de chemin, zone difficile d'accès)
  const lt=h<=1?0:h<=2.5?1:h<=4.5?2:h<=7?3:4,lg=gain<=100?0:gain<=300?1:gain<=700?2:gain<=1200?3:4,effort=Math.max(lt,lg);
  const ls=smax<15?0:smax<25?1:smax<32?2:smax<38?3:4;
  let lty=0,why="";
  if(al>=30){lty=4;why="sentier alpin (balisage bleu-blanc) sur "+km(al)}
  else if(bm>=100){lty=3;why="sentier de montagne sur "+km(bm)}
  else if(hd>=100){lty=3;why="zone difficile d'accès (pente ≥ 30° en forêt) sur "+km(hd)}
  else if(un>=150){lty=2;why="sentier non balisé de "+km(un)}
  if(OF.len>=20){lty=Math.max(lty,OF.lvl);why="tout-terrain : "+km(OF.len)+" hors chemin"}
  const tech=Math.max(ls,lty),lvl=Math.max(effort,tech);
  let reason;
  if(tech>=effort&&tech>0){reason=ls>=lty?"pente de "+smax+"° soutenue sur ≈ 100 m":why}
  else reason=lt>=lg?"durée de marche d'environ "+dur(sec):"dénivelé positif de "+Math.round(gain)+" m";
  if(lvl===0)reason="peu de montée, chemins faciles";
  return {len,up,dn,sec,c2,cross,lvl,reason,lines,smax,off:OF.len}
}
const km=m=>m>=950?(m/1000).toFixed(1).replace(".",",")+" km":Math.round(m/10)*10+" m";
function dur(s){const m=Math.round(s/300)*5,h=Math.floor(m/60),r=m%60;return h?h+" h"+(r?" "+String(r).padStart(2,"0"):""):r+" min"}

/* ---------- carte ---------- */
function icon(t){return L.divIcon({className:"",html:`<div style="width:26px;height:26px;border-radius:50%;background:${t==="A"?"#2f5d3a":"#b71c1c"};color:#fff;font:700 14px/26px system-ui;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)">${t}</div>`,iconSize:[26,26],iconAnchor:[13,13]})}
function setPt(t,ll){
  pts[t]=ll;
  if(mk[t])mk[t].setLatLng(ll);
  else{mk[t]=L.marker(ll,{icon:icon(t),draggable:true,zIndexOffset:900,keyboard:false}).addTo(map);
    mk[t].on("dragend",()=>{pts[t]=mk[t].getLatLng();compute()})}
}
function clearRouteKeep(){if(layer){map.removeLayer(layer);layer=null}last=null;$("it-res").innerHTML=""}
function clearRoute(all){
  if(all)cancelRun();
  if(layer){map.removeLayer(layer);layer=null}last=null;$("it-res").innerHTML="";
  if(all){["A","B"].forEach(t=>{if(mk[t]){map.removeLayer(mk[t]);mk[t]=null}pts[t]=null});wpClear();$("it-msg").textContent=""}
}
function draw(S,R){
  if(!map.getPane("itineraire")){const p=map.createPane("itineraire");p.style.zIndex=450}
  layer=L.layerGroup().addTo(map);const g=GR,pl=[];
  if(R.pl)R.pl.forEach(p=>pl.push(p));else {const MX=+$("it-max").value;for(const [e,s0,s1] of R.seq){if(s0===s1)continue;const k=g.cls[e],ll=sub(e,s0,s1);pl.push({ll,k,hard:MX<4&&edgeTech(e)>MX})}}
  pl.forEach(p=>L.polyline(p.ll,{pane:"itineraire",color:"#fff",weight:8,opacity:.9,lineCap:"round",interactive:false}).addTo(layer));
  pl.forEach(p=>L.polyline(p.ll,p.k==="o"?{pane:"itineraire",color:"#6a1b9a",weight:5,dashArray:"2 7",lineCap:"round",interactive:false}:p.k===1?{pane:"itineraire",color:"#c62828",weight:5,dashArray:"4 6",interactive:false}:p.k===2?{pane:"itineraire",color:"#e8731f",weight:5,dashArray:"10 6",interactive:false}:{pane:"itineraire",color:"#1565c0",weight:5,lineCap:"round",interactive:false}).addTo(layer));
  pl.filter(p=>p.hard).forEach(p=>L.polyline(p.ll,{pane:"itineraire",color:"#111",weight:5,dashArray:"2 7",lineCap:"butt",interactive:false}).addTo(layer));   // au-dessus de la difficulté maximale : noir pointillé
  RPL=pl;const all=pl.flatMap(p=>p.ll);S.ll=all;if(all.length&&!noFit)map.fitBounds(L.latLngBounds(all),{padding:[40,40],maxZoom:17});
}
function dvMsg(S){const l=dvLim();return l&&!dvOk(S)?"Aucun trajet respectant la limite de dénivelé ("+dvTxt(l)+") trouvé : voici le moins pentu (+"+Math.round(S.up)+" m / −"+Math.round(S.dn)+" m). ":""}
function show(S){
  const d=DIFF[S.lvl],c=DCOL[S.lvl],w=[];
  if(S.c2>=20)w.push(`<b>Bord de route : attention à la circulation</b> sur ${km(S.c2)} (tracé orange tireté).`);
  if(S.off>=20)w.push(`<b>Hors chemin</b> : ${km(S.off)} hors chemin (tracé violet pointillé), en forêt près d'une zone favorable, ${offRule(+$("it-max").value,+$("it-env").value)}. Pas de balisage, terrain, ruisseaux non cartographiés et fossés possibles : vous êtes seul responsable du passage ; renoncez si le terrain vous semble dangereux.`);
  wxWarn(S).forEach(x=>w.push(x));
  if(S.cross)w.push(`${S.cross} traversée${S.cross>1?"s":""} de route large (tracé rouge pointillé, ≤ 30 m) : traversez avec prudence, aux endroits sûrs.`);
  {const MX=+$("it-max").value,hl=MX<4?S.lines.filter(l=>edgeTech(l.e)>MX).reduce((a,l)=>a+Math.abs(l.s1-l.s0),0):0;
    if(hl>=20)w.push(`<b>Difficulté maximale dépassée</b> sur ${km(hl)} (tracé noir pointillé) : aucun passage plus facile n'a été trouvé ici.`)}
  const fo=S.met?` · forêt ${Math.round(S.met.forest*100)} %`:"";
  $("it-res").innerHTML=`<div class="it-card"><div class="it-big">${dur(S.sec)} <span class="it-sub">de marche · ${km(S.len)}</span></div>
   <div class="it-line">+${Math.round(S.up)} m · <span class="pill" style="background:${c};color:#fff">${d}</span>${fo}</div>
   <details class="it-more"><summary>Détails</summary>
   <div class="it-row">Dénivelé : <b>+${Math.round(S.up)} m / −${Math.round(S.dn)} m</b>${dvLim()?` <span class="it-sub">${dvOk(S)?"✓ sous":"⚠ au-dessus de"} la limite (${dvTxt(dvLim())})</span>`:""}</div>
   <div class="it-row">Difficulté : <b>${d}</b> <span class="it-sub">${esc(S.reason)}</span></div>
   ${S.met?`<div class="it-row">En forêt : <b>${Math.round(S.met.forest*100)} %</b> du tracé · tronçons parcourus deux fois : <b>${Math.round(S.met.rep*100)} %</b></div>`:""}
   ${S.legs&&S.legs.length>1?`<div class="it-row">Étapes :<ol class="it-legs">${S.legs.map(l=>`<li>${l.from} → ${l.to} : <b>${dur(l.sec)}</b> · ${km(l.len)} · ${DIFF[l.lvl]}</li>`).join("")}</ol></div>`:""}</details>
   ${w.map(x=>`<div class="it-warn">${x}</div>`).join("")}
   <div class="it-btns"><button type="button" class="btn" id="it-gpx">Exporter en GPX</button><a class="btn" id="it-geo" target="_blank" rel="noopener">Ouvrir map.geo.admin.ch</a></div>
   <p class="it-note">Ouvrez le fichier GPX avec l'<b>app swisstopo</b> (feuille de partage › swisstopo). Évitez SchweizMobil : il refuse souvent les tracés tout-terrain.</p>
   <div class="it-btns"><input type="text" id="it-sname" class="coin-sel" maxlength="40" placeholder="Nom du parcours" aria-label="Nom du parcours" value="${xe(svName(S))}"><button type="button" class="btn" id="it-save">💾 Enregistrer</button></div>
   <p class="it-note">Durée estimée à ±10 min, sur la base du dénivelé et du type de chemin (pas de l'état réel du sentier : boue, neige). Proposition issue de données : vérifiez chasse, propriétés privées, réserves et conditions sur place, et renoncez à tout passage qui vous semble dangereux. <a href="#" id="it-decl">Déclaration de responsabilité</a></p></div>`;
  $("it-decl").onclick=e=>{e.preventDefault();declare(false)};
  $("it-gpx").onclick=gpx;$("it-save").onclick=()=>{const r=svSave($("it-sname").value);$("it-msg").textContent=r.msg};$("it-geo").href=geoLink(S)}
const isLoop=()=>$("it-mode").value==="loop";
const openReg=()=>{const d=$("it-reg");if(d)d.open=true};
function showVars(V,k){
  if(layer){map.removeLayer(layer);layer=null}
  const v=V[k];draw(v.S,v.R);show(v.S);last=v.S;
  $("it-vars").innerHTML=V.map((x,i)=>`<button type="button" class="btn${i===k?" primary":""}" data-k="${i}">Boucle ${i+1} · ${km(x.S.len)} · ${dur(x.S.sec)} · +${Math.round(x.S.up)} m · ${DIFF[x.S.lvl]}${x.S.met?" · forêt "+Math.round(x.S.met.forest*100)+" %":""}</button>`).join("");
  $("it-vars").querySelectorAll("button").forEach(b=>b.onclick=()=>showVars(V,+b.dataset.k))}
async function computeLoop(){
  const run=RUN,msg=$("it-msg");$("it-vars").innerHTML="";
  if(!pts.A){msg.textContent="Choisissez le départ de la boucle (A).";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  if(!await AW(declare(true),run)){msg.textContent="Déclaration non acceptée : l'itinéraire n'est pas calculé.";return}
  msg.textContent="Calcul des boucles…";
  try{await AW(loadGraph(),run)}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  {const ve=prepVar();if(ve){msg.textContent=ve;return}}
  const A=snap(pts.A);if(!A){msg.textContent="Le départ est à plus de 300 m d'un chemin de cette région : déplacez le marqueur.";clearRoute();return}
  const dm=$("it-lm").value==="len",v=+$("it-lt").value,target0=dm?v*1000:v*60,M=+$("it-max").value,tt=ttOn(pts.A);
  if(!offGate(M,pts.A,tt,msg,clearRoute))return;
  let V=[],note="",shr=1;LOOPERR="";
  // difficulté maximale : pénalité sur les tronçons trop techniques (×6 puis ×40), puis cible réduite (×0,75, ×0,55) si c'est l'effort (durée, dénivelé) qui dépasse
  const DL=dvLim();
  // échelle de contraintes de plus en plus fortes (cible réduite × pénalité technique × pénalité de dénivelé) ; on cherche par dichotomie le premier cran qui respecte les réglages
  // (≤ 6 recherches au lieu de 30), avec un budget total de 3 × BUDGET : ensuite on garde la meilleure boucle trouvée
  const ladder=[];for(const s of M<4||DL?[1,.75,.55]:[1])for(const k of M<4?[6,40]:[0])for(const lam of DL?DV_LAM:[0])ladder.push([s,k,lam]);
  NZA=(NZAMP[+$("it-env").value]||.12)*.8;NZ=LRETRY||!ALEA?null:mkNoise(NZA,SEEDV);
  const ENR=ALEA&&LOOPENR&&!LRETRY&&!tt&&!!curC(),SH=ENR?ENRSH:1;   // avec insertion des meilleurs points : on génère la boucle plus courte, la place libre sert aux points
  let best=null,lastV=[],lastS=1,lo=0,hi=ladder.length-1,j=0,tries=0;const T0=performance.now();
  try{while(lo<=hi){
    j=tries===0?0:(lo+hi)>>1;tries++;PGT=ladder.length>1?tries:0;const [s,k,lam]=ladder[j];
    BP=M<4?techPen(M,k):null;setDV(lam);
    const v=await AW(loopRoutes(A,pts.A,dm?"len":"sec",target0*s*SH,+$("it-env").value,tt,target0*s),run),okV=v.filter(x=>!x.over&&x.S.lvl<=M&&dvOk(x.S));
    if(v.length){lastV=v;lastS=s}
    if(okV.length){best={V:okV,s,k,lam};hi=j-1}else lo=j+1;
    if(best&&lo>hi)break;
    if(performance.now()-T0>3*BUDGET&&(best||lastV.length))break}
  }finally{if(RUN===run){BP=null;DV=null;PGT=0}}
  if(best){V=best.V;shr=best.s}else{V=lastV;shr=lastS}
  if(!V.length&&!LRETRY){LRETRY=true;LNZ=0;return computeLoop()}   // rien trouvé avec l'aléa : on relance sans aléa ni insertion de points (comme avant)
  if(!V.length){clearRoute();msg.textContent=LOOPERR||"Aucune boucle trouvée depuis ce départ : le réseau y est trop morcelé ou trop court. Essayez un autre point de départ.";return}
  {const fe=V.filter(x=>!x.over);   // plafond strict : aucune boucle au-dessus du plafond n'est affichée
    if(!fe.length&&!LRETRY){LRETRY=true;LNZ=0;return computeLoop()}
    if(!fe.length){clearRoute();const c=capOf(),sh=V.reduce((a,x)=>capVal(x.S,c)<capVal(a.S,c)?x:a);msg.textContent=capMsg(sh.S,c);return}
    V=fe}
  V.sort((a,b)=>LOOPQ?a.cost-b.cost:a.err-b.err);
  let topN=null;
  if(ENR&&best){   // 5 des 10 meilleurs points accessibles : insérés dans les 3 meilleures boucles, sous le plafond (réduit si besoin), la difficulté et le dénivelé
    const tg=target0*shr,cp={m:dm?"len":"dur",lim:tg},Lm=dm?tg*.93:tg*.93/3600*4000/durF(),env=+$("it-env").value;
    try{BP=M<4?techPen(M,best.k):null;setDV(best.lam);prog("Meilleurs points…");
      for(let i=0;i<Math.min(3,V.length);i++){const x=V[i],X=await AW(enrich(x.R,A,A,env,M,cp,{loop:true,reach:Lm*.45,ms:1300}),run);if(!X)continue;
        const c=X.R!==x.R?mkLoopC(X.R,dm?"len":"sec",tg,M):x;if(X.R!==x.R&&!c.over&&c.S.lvl<=Math.max(M,x.S.lvl)&&(dvOk(c.S)||!dvOk(x.S)))V[i]=c;V[i].top=X.n;V[i].topTot=X.tot}
    }finally{if(RUN===run){BP=null;DV=null}}
    for(const x of V)if(x.top==null)x.top=0;
    V.sort((a,b)=>(b.top||0)-(a.top||0)||a.cost-b.cost);topN=V[0].topTot?V[0]:null}
  const over=V.every(x=>x.S.lvl>M);
  if((M<4||DL)&&!over&&shr<1)note=` Cible réduite à ${dm?km(target0*shr):dur(target0*shr*60)} pour respecter ${M<4&&DL?"la difficulté maximale ("+DIFF[M]+") et la limite de dénivelé":M<4?"la difficulté maximale ("+DIFF[M]+")":"la limite de dénivelé"}. `;
  if(M<4&&over)note=` Aucune boucle « ${DIFF[M]} » ou plus facile trouvée ici : voici la plus facile (${DIFF[Math.min(...V.map(x=>x.S.lvl))]}). `;
  const W=V.map(x=>({S:x.S,R:x.R}));showVars(W,0);
  if(DL&&V.every(x=>!dvOk(x.S)))note+=` Aucune boucle sous la limite de dénivelé (${dvTxt(DL)}) trouvée ici : voici la moins pentue (+${Math.round(Math.min(...V.map(x=>x.S.up)))} m). `;
  if(LOOPQ&&last.met&&last.met.dead>.03)note+=" Une partie du tracé est un aller-retour qui n'atteint aucune forêt : le réseau de chemins autour du départ n'offre pas mieux à cette distance. ";
  const offN=V.filter(x=>x.err>.15&&shr===1).length;
  setMsg((offN?offN+" boucle(s) sur "+V.length+" sont nettement plus courtes que le plafond (réseau limité autour du départ), toutes sous "+capTxt(capOf())+".":V.length+" boucle(s) proposée(s), toutes sous le plafond de "+capTxt(capOf())+"."),note+(topN?"La boucle affichée passe par "+topN.top+" des "+topN.topTot+" meilleurs points accessibles (objectif : "+TOP_WANT+"). ":"")+(VAR?" Optimisé pour : "+VAR.sps.map(x=>x.fr).join(", ")+"."+varReport(last)+" ":""))}
async function compute(){
  cancelRun();const run=RUN;RUNS++;newSeed();
  if(typeof regUpd==="function")regUpd();
  prog("Calcul…");
  try{await computeAny()}catch(e){if(e!==CANCEL)throw e}
  finally{if(RUN===run){BP=null;DV=null;NZ=null;progOff()}}}
async function computeAny(){
  const run=RUN;
  if(WP.length){clearRouteKeep();return computeWp()}
  if(isLoop()){clearRouteKeep();return computeLoop()}
  $("it-vars").innerHTML="";
  const msg=$("it-msg");msg.textContent="";
  if(!pts.A||!pts.B){msg.textContent="Choisissez le départ et l'arrivée.";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  if(!await AW(declare(true),run)){msg.textContent="Déclaration non acceptée : l'itinéraire n'est pas calculé.";return}
  msg.textContent="Calcul…";let g;
  try{g=await AW(loadGraph(),run)}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  {const ve=prepVar();if(ve){msg.textContent=ve;return}}
  const A=snap(pts.A),B=snap(pts.B);
  if(!A||!B){msg.textContent=(!A?"Le départ":"L'arrivée")+" est à plus de 300 m d'un chemin de cette région (ou hors région) : déplacez le marqueur.";clearRoute();return}
  let R,S0=null;const M=+$("it-max").value,tt=ttOn(pts.A);
  if(!offGate(M,pts.A,tt,msg,clearRoute))return;
  const CAP=capOf(),env0=+$("it-env").value;let evUsed=env0,nTop=0,topTot=0,kU=0,lU=0;
  NZ=ALEA?mkNoise(NZAMP[env0]||.12,SEEDV):null;NZA=NZAMP[env0]||.12;
  for(const nzOn of NZ?[NZ,null]:[null]){   // parcours aléatoire d'abord ; s'il ne respecte pas tous les réglages, le calcul sans aléa
  NZ=nzOn;evUsed=env0;R=null;S0=null;
  for(const ev of CAP&&env0>0?[env0,0]:[env0]){   // plafond strict : si le détour dépasse le plafond, on réessaie sans détour (trajet le plus court)
    evUsed=ev;
    try{outer:for(const k of M<4?[6,40]:[0])for(const lam of dvLim()?DV_LAM:[0]){BP=M<4?techPen(M,k):null;setDV(lam);kU=k;lU=lam;
      if(tt){R=await AW(routeOff(pts.A,pts.B,ev),run);if(R&&R.error){clearRoute();msg.textContent=R.error;return}}else R=routeCap(A,B,ev);
      if(!R)break outer;S0=summarize(R);if(S0.lvl<=M&&dvOk(S0))break outer}}finally{if(RUN===run){BP=null;DV=null}}
    if(!R||!capOver(S0,CAP))break}
  if(R&&!capOver(S0,CAP)&&S0.lvl<=M&&dvOk(S0))break}
  if(ALEA&&!tt&&R&&!capOver(S0,CAP)){   // les 5 des 10 meilleurs points accessibles : insérés tant que plafond, difficulté et dénivelé restent respectés
    try{BP=M<4?techPen(M,kU):null;setDV(lU);const X=await AW(enrich(R,A,B,evUsed,M,CAP),run);if(X){if(X.R!==R){R=X.R;S0=summarize(R)}nTop=X.n;topTot=X.tot}}finally{if(RUN===run){BP=null;DV=null}}}
  if(R&&capOver(S0,CAP)){clearRoute();msg.textContent=capMsg(S0,CAP);return}
  if(!R){clearRoute();msg.textContent="Aucun chemin trouvé entre ces deux points sur le réseau (sans route de classe 1 ni autoroute) : ils sont dans deux parties non reliées. Essayez un point voisin.";return}
  if(layer){map.removeLayer(layer);layer=null}
  const S=S0||summarize(R);draw(S,R);show(S);last=S;
  setMsg("",(CAP&&evUsed!==env0?"Détour retiré pour rester sous le plafond de "+capTxt(CAP)+". ":"")+(VAR?"Optimisé pour : "+VAR.sps.map(x=>x.fr).join(", ")+"."+varReport(S)+" ":"")+(S.lvl>M?"Aucun trajet « "+DIFF[M]+" » ou plus facile trouvé : voici le plus facile ("+DIFF[S.lvl]+", "+S.reason+"). ":"")+dvMsg(S)+(R.capped?"Détour limité à +"+Math.round((DET_CAP[Math.min(3,evUsed)]-1)*100)+" % du plus court chemin (le tracé idéal faisait +"+R.capped+" %). ":"")+(R.noGain?"Pas de détour : aucune zone « moyen » ou mieux à atteindre en plus, trajet le plus court gardé. ":"")+(topTot?"Passe par "+nTop+" des "+topTot+" meilleurs points accessibles (objectif : "+TOP_WANT+"). ":"")+(tt&&R.cand?(R.stops?R.stops+" aller-retour(s) / détour(s) vers les meilleures zones accessibles ("+R.cand+" candidates, objectif : "+TOP_WANT+"). ":"Aucune des "+R.cand+" meilleures zones n'est accessible sans dépasser le plafond de détour. "):"")+((A.d>30||B.d>30)?"Les marqueurs sont à "+Math.round(Math.max(A.d,B.d))+" m du chemin le plus proche : l'itinéraire part du chemin.":""));
}


/* ---------- points de passage obligatoires ---------- */
// Étapes enchaînées dans l'ordre donné (ou réordonnées par la plus courte ligne droite si la case est cochée) : A → 1 → 2 … → B (ou retour en A pour une boucle).
// Chaque étape est calculée avec les mêmes règles que A→B (difficulté, tout-terrain, détour, variétés) puis les tracés sont mis bout à bout.
const WP=[],WP_MAX=8;
const wIcon=n=>L.divIcon({className:"",html:`<div style="width:26px;height:26px;border-radius:50%;background:#e8731f;color:#fff;font:700 14px/26px system-ui;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)">${n}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
function wpReady(){return pts.A&&(isLoop()||pts.B)}
function wpAdd(ll){
  const w={ll,mk:null};w.mk=L.marker(ll,{icon:wIcon(WP.length+1),draggable:true,zIndexOffset:850,keyboard:false}).addTo(map);
  w.mk.on("dragend",()=>{w.ll=w.mk.getLatLng();if(wpReady()&&last)compute()});WP.push(w);wpRefresh()}
function wpClear(){WP.forEach(w=>map.removeLayer(w.mk));WP.length=0;wpRefresh()}
function wpRefresh(){
  WP.forEach((w,i)=>w.mk.setIcon(wIcon(i+1)));
  const bx=$("it-wbox");if(!bx)return;bx.hidden=!WP.length;
  $("it-wlist").innerHTML=WP.map((w,i)=>`<div class="it-wp"><b>${i+1}</b><span>${w.ll.lat.toFixed(4)}, ${w.ll.lng.toFixed(4)}</span><button type="button" class="btn" data-a="up" data-i="${i}" ${i?"":"disabled"} aria-label="Monter">↑</button><button type="button" class="btn" data-a="dn" data-i="${i}" ${i<WP.length-1?"":"disabled"} aria-label="Descendre">↓</button><button type="button" class="btn" data-a="x" data-i="${i}" aria-label="Retirer">✕</button></div>`).join("");
  $("it-wlist").querySelectorAll("button").forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i,a=b.dataset.a;
    if(a==="x"){map.removeLayer(WP[i].mk);WP.splice(i,1)}else{const j=a==="up"?i-1:i+1;[WP[i],WP[j]]=[WP[j],WP[i]]}
    wpRefresh();if(wpReady()&&last)compute();else if(!WP.length)clearRouteKeep()})}
function wpOrder(){   // ordre le plus court en ligne droite (force brute jusqu'à 7 étapes, sinon plus proche voisin)
  const loop=isLoop(),a=merc(pts.A.lat,pts.A.lng),z=loop?a:merc(pts.B.lat,pts.B.lng),P=WP.map(w=>merc(w.ll.lat,w.ll.lng)),n=P.length,d=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  if(n<2)return;let best=null,bl=Infinity;
  const tot=o=>{let t=0,c=a;for(const i of o){t+=d(c,P[i]);c=P[i]}return t+d(c,z)};
  if(n<=7){const rec=(o,rest)=>{if(!rest.length){const t=tot(o);if(t<bl){bl=t;best=o}return}rest.forEach((x,k)=>rec([...o,x],rest.filter((_,j)=>j!==k)))};rec([],[...Array(n).keys()])}
  else{const rest=[...Array(n).keys()],o=[];let c=a;while(rest.length){let bi=0;rest.forEach((x,k)=>{if(d(c,P[x])<d(c,P[rest[bi]]))bi=k});const x=rest.splice(bi,1)[0];o.push(x);c=P[x]}best=o}
  const old=WP.slice();best.forEach((i,k)=>{WP[k]=old[i]});wpRefresh()}
function wpCat(legs){
  const off=legs.some(l=>l.off)?legs.reduce((o,l)=>{const f=l.off||{len:0,up:0,dn:0,sec:0,lvl:0};return {len:o.len+f.len,up:o.up+f.up,dn:o.dn+f.dn,sec:o.sec+f.sec,lvl:Math.max(o.lvl,f.lvl)}},{len:0,up:0,dn:0,sec:0,lvl:0}):undefined;
  return {seq:legs.flatMap(l=>l.seq),off,pl:legs.flatMap((l,i)=>(l.pl||l.seq.filter(s=>s[1]!==s[2]).map(([e,s0,s1])=>({ll:sub(e,s0,s1),k:GR.cls[e],hard:+$("it-max").value<4&&edgeTech(e)>+$("it-max").value}))).map(p=>({...p,lg:i})))}}
async function computeWp(){
  const run=RUN,msg=$("it-msg"),loop=isLoop();$("it-vars").innerHTML="";
  if(!pts.A||(!loop&&!pts.B)){msg.textContent=loop?"Choisissez le départ de la boucle (A).":"Choisissez le départ et l'arrivée.";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  if(!await AW(declare(true),run)){msg.textContent="Déclaration non acceptée : l'itinéraire n'est pas calculé.";return}
  msg.textContent="Calcul…";
  try{await AW(loadGraph(),run)}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  {const ve=prepVar();if(ve){msg.textContent=ve;return}}
  const M=+$("it-max").value,tt=ttOn(pts.A),env0=+$("it-env").value,CAP=capOf();let envie=env0;
  if(!offGate(M,pts.A,tt,msg,clearRoute))return;
  if($("it-wopt").checked)wpOrder();
  const P=[pts.A,...WP.map(w=>w.ll),loop?pts.A:pts.B],nm=P.map((_,i)=>i===0?"A":i===P.length-1?(loop?"A":"B"):String(i));
  if(P.some(p=>!p))return;   // marqueur retiré ou mode changé pendant le calcul
  const sn=P.map(p=>snap(p));
  for(let i=0;i<P.length;i++)if(!sn[i]){clearRoute();msg.textContent=(i===0?"Le départ":i===P.length-1?"L'arrivée":"Le point de passage "+i)+" est à plus de 300 m d'un chemin de cette région (ou hors région) : déplacez le marqueur.";return}
  let legs=[],S0=null,R=null,bad=null;
  for(const ev of CAP&&env0>0?[env0,0]:[env0]){   // plafond strict : si le détour dépasse le plafond, on réessaie sans détour
  envie=ev;
  try{outer:for(const k of M<4?[6,40]:[0])for(const lam of dvLim()?DV_LAM:[0]){BP=M<4?techPen(M,k):null;setDV(lam);legs=[];bad=null;
    for(let i=0;i<P.length-1;i++){
      const l=tt?await AW(routeOff(P[i],P[i+1],envie),run):routeCap(sn[i],sn[i+1],envie);
      if(!l||l.error){bad=i;msg.textContent="Étape "+nm[i]+" → "+nm[i+1]+" : "+(l&&l.error?l.error:"aucun chemin trouvé entre ces deux points sur le réseau (parties non reliées). Déplacez "+(nm[i+1]==="B"||nm[i+1]==="A"?"le marqueur "+nm[i+1]:"le point de passage "+nm[i+1])+".");break}
      legs.push(l)}
    if(bad!==null)break outer;
    R=wpCat(legs);S0=summarize(R);if(S0.lvl<=M&&dvOk(S0))break outer}}finally{if(RUN===run){BP=null;DV=null}}
  if(bad!==null||!capOver(S0,CAP))break}
  if(bad!==null){clearRoute();return}
  if(capOver(S0,CAP)){clearRoute();msg.textContent=capMsg(S0,CAP)+"(Avec "+WP.length+" point"+(WP.length>1?"s":"")+" de passage.)";return}
  const LS=legs.map((l,i)=>{const s=summarize(l);return {from:nm[i],to:nm[i+1],len:s.len,sec:s.sec,lvl:s.lvl,reason:s.reason}});
  S0.legs=LS;S0.wps=WP.map(w=>[w.ll.lat,w.ll.lng]);
  if(layer){map.removeLayer(layer);layer=null}
  draw(S0,R);show(S0);last=S0;
  const hard=M<4?LS.filter(l=>l.lvl>M):[];
  setMsg("",(loop?"Boucle A → "+WP.map((_,i)=>i+1).join(" → ")+" → A, définie par vos points de passage. ":"")+(CAP?"Plafond de "+capTxt(CAP)+" respecté"+(envie!==env0?" (détour retiré)":"")+". ":"")+
    (hard.length?"Point de passage inaccessible sous « "+DIFF[M]+" » : "+hard.map(l=>"l'étape "+l.from+" → "+l.to+" reste « "+DIFF[l.lvl]+" » ("+l.reason+")").join(" ; ")+". Le tracé affiché passe quand même par vos points : choisissez une difficulté plus élevée ou déplacez-les. ":"")+
    (VAR?"Optimisé pour : "+VAR.sps.map(x=>x.fr).join(", ")+"."+varReport(S0)+" ":"")+
    (S0.lvl>M&&!hard.length?"Aucun trajet « "+DIFF[M]+" » ou plus facile trouvé : voici le plus facile ("+DIFF[S0.lvl]+", "+S0.reason+"). ":"")+dvMsg(S0)+
    (WP.length+" point"+(WP.length>1?"s":"")+" de passage."+($("it-wopt").checked&&WP.length>1?" Ordre optimisé.":"")))}


/* ---------- édition du tracé par clic-glisse (souris et doigt) ---------- */
// Saisir le tracé et le glisser ajoute un point de passage à l'endroit lâché, inséré dans l'étape touchée ; le tout est recalculé comme d'habitude.
const ED={on:false,x0:0,y0:0,lg:0,moved:false,ghost:null,band:null,touch:false,swallow:0};
function edOk(){return !arm&&last&&layer&&RPL.length&&pts.A&&(isLoop()||pts.B)}
function edHit(cp,tol){   // étape la plus proche du point d'écran cp, ou null
  let best=null,bd=tol;
  for(const p of RPL){const q=p.ll.map(l=>map.latLngToContainerPoint(l));
    for(let i=1;i<q.length;i++){const d=L.LineUtil.pointToSegmentDistance(cp,q[i-1],q[i]);if(d<bd){bd=d;best=p.lg||0}}}
  return best}
function edEnds(lg){const loop=isLoop();return [lg===0?pts.A:WP[lg-1].ll,lg===WP.length?(loop?pts.A:pts.B):WP[lg].ll]}
function edPt(e){const r=map.getContainer().getBoundingClientRect(),t=e.touches&&e.touches[0]||e.changedTouches&&e.changedTouches[0]||e;return L.point(t.clientX-r.left,t.clientY-r.top)}
function edStart(e){
  if(ED.on||!edOk()||e.target.closest&&e.target.closest(".leaflet-marker-icon,.leaflet-control,.leaflet-popup,.menu-btn,button"))return;
  if(e.touches&&e.touches.length!==1)return;
  const touch=!!e.touches,cp=edPt(e),lg=edHit(cp,touch?20:9);if(lg===null)return;
  ED.on=true;ED.touch=touch;ED.x0=cp.x;ED.y0=cp.y;ED.lg=lg;ED.moved=false;
  e.stopPropagation()}   // la carte ne se déplace pas : le glissement appartient au tracé
function edMove(e){
  if(!ED.on)return;if(e.touches&&e.touches.length!==1){edCancel();return}
  const cp=edPt(e);
  if(!ED.moved){if(Math.hypot(cp.x-ED.x0,cp.y-ED.y0)<6)return;ED.moved=true;
    if(WP.length>=WP_MAX){$("it-msg").textContent="Maximum "+WP_MAX+" points de passage : retirez-en un avant d'en ajouter.";edCancel(true);return}
    ED.ghost=L.marker(map.containerPointToLatLng(cp),{icon:wIcon("+"),interactive:false,zIndexOffset:900}).addTo(map);
    if(!(isLoop()&&!WP.length)){const [a,b]=edEnds(ED.lg);ED.band=L.polyline([a,map.containerPointToLatLng(cp),b],{color:"#e8731f",weight:3,dashArray:"5 6",interactive:false}).addTo(map)}}
  const ll=map.containerPointToLatLng(cp);ED.ghost.setLatLng(ll);
  if(ED.band){const [a,b]=edEnds(ED.lg);ED.band.setLatLngs([a,ll,b])}
  if(e.cancelable)e.preventDefault()}
function edCancel(keepSwallow){
  if(ED.ghost){map.removeLayer(ED.ghost);ED.ghost=null}if(ED.band){map.removeLayer(ED.band);ED.band=null}
  ED.on=false;ED.moved=false}
async function edEnd(e){
  if(!ED.on)return;
  if(!ED.moved){edCancel();return}   // simple appui : laisse passer le clic
  const ll=ED.ghost.getLatLng(),lg=ED.lg;edCancel();ED.swallow=Date.now();
  await wpInsert(lg,ll)}
async function wpInsert(lg,ll){
  const msg=$("it-msg");
  if($("it-wopt").checked){$("it-wopt").checked=false}   // l'ordre optimisé déplacerait le point : on garde votre ordre
  const w={ll,mk:null};w.mk=L.marker(ll,{icon:wIcon(lg+1),draggable:true,zIndexOffset:850,keyboard:false}).addTo(map);
  w.mk.on("dragend",()=>{w.ll=w.mk.getLatLng();if(wpReady()&&last)compute()});WP.splice(lg,0,w);wpRefresh();
  noFit=true;let err="";
  try{await compute();if(!last){err=msg.textContent;map.removeLayer(w.mk);WP.splice(WP.indexOf(w),1);wpRefresh();if(pts.A&&(isLoop()||pts.B))await compute();
      msg.textContent="Point non ajouté : "+err+(last?" Tracé précédent rétabli.":"")}
    else msg.textContent="Point de passage "+(lg+1)+" ajouté par glissement. "+msg.textContent}
  finally{noFit=false}}
function edInit(){
  const c=map.getContainer();
  c.addEventListener("mousedown",e=>{if(e.button===0)edStart(e)},true);
  c.addEventListener("touchstart",edStart,{capture:true,passive:true});
  document.addEventListener("mousemove",e=>{if(ED.on)edMove(e);else if(!e.buttons&&!ED.hoverBusy){ED.hoverBusy=true;requestAnimationFrame(()=>{ED.hoverBusy=false;
      c.style.cursor=edOk()&&e.target&&c.contains(e.target)&&!(e.target.closest&&e.target.closest(".leaflet-marker-icon,.leaflet-control,.leaflet-popup"))&&edHit(edPt(e),9)!==null?"crosshair":""})}});
  c.addEventListener("touchmove",e=>{if(ED.on)edMove(e)},{capture:true,passive:false});
  document.addEventListener("mouseup",e=>{if(ED.on)edEnd(e)});
  c.addEventListener("touchend",e=>{if(ED.on)edEnd(e)},true);c.addEventListener("touchcancel",()=>edCancel(),true);
  c.addEventListener("click",e=>{if(ED.swallow&&Date.now()-ED.swallow<400){e.stopPropagation();e.preventDefault()}ED.swallow=0},true)}

/* ---------- parcours enregistrés (localStorage, inclus dans la sauvegarde manuelle des coins) ---------- */
const SV_KEY="itin-saved-v1",SV_MAX=30,r5=n=>Math.round(n*1e5)/1e5;
function svRead(){try{const a=JSON.parse(localStorage.getItem(SV_KEY)||"[]");return Array.isArray(a)?a.filter(x=>x&&x.id&&Array.isArray(x.pl)):[]}catch(e){return[]}}
function svWrite(a){try{localStorage.setItem(SV_KEY,JSON.stringify(a));try{localStorage.setItem("champi-coins-mod",String(Date.now()))}catch(e){}try{if(typeof bkInfo==="function")bkInfo()}catch(e){}return true}catch(e){return false}}
const svName=S=>"Parcours du "+new Date().toLocaleDateString("fr-CH")+" · "+km(S.len);
const svSig=x=>{const p=x.pl[0]&&x.pl[0].ll[0]||[0,0];return [x.sum&&Math.round(x.sum.len),p[0],p[1],x.pl.length].join("|")};
function svSave(name){
  if(!last||!last.ll||!last.ll.length||!RPL.length)return{ok:false,msg:"Aucun parcours à enregistrer."};
  const pl=RPL.map(p=>({k:p.k===undefined?0:p.k,ll:p.ll.map(l=>l&&l.lat!==undefined?[r5(l.lat),r5(l.lng)]:[r5(l[0]),r5(l[1])])}));
  const S=last,sum={len:S.len,up:S.up,dn:S.dn,sec:S.sec,c2:S.c2||0,cross:S.cross||0,lvl:S.lvl,reason:S.reason||"",off:S.off||0,met:S.met||null};
  const ll=(a)=>a?[r5(a.lat),r5(a.lng)]:null;
  const e={id:"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:String(name||svName(S)).trim().slice(0,40)||svName(S),t:Date.now(),loop:isLoop(),A:ll(pts.A),B:isLoop()?null:ll(pts.B),wps:(S.wps||[]).map(p=>[r5(p[0]),r5(p[1])]),pl,sum};
  const a=svRead();a.unshift(e);a.length=Math.min(a.length,SV_MAX);
  if(!svWrite(a))return{ok:false,msg:"Enregistrement impossible (stockage du navigateur plein ou bloqué) : exportez en GPX."};
  svRender();return{ok:true,msg:"Parcours « "+e.name+" » enregistré dans ce navigateur (liste « Parcours enregistrés »)."}}
function svLoad(id){
  const e=svRead().find(x=>x.id===id);if(!e)return false;
  cancelRun();clearRoute(true);$("it-mode").value=e.loop?"loop":"ab";$("it-mode").onchange();
  if(e.A)setPt("A",L.latLng(e.A[0],e.A[1]));if(!e.loop&&e.B)setPt("B",L.latLng(e.B[0],e.B[1]));
  (e.wps||[]).forEach(p=>wpAdd(L.latLng(p[0],p[1])));
  const S=Object.assign({lines:[],wps:e.wps||[]},e.sum),R={pl:e.pl.map(p=>({k:p.k,ll:p.ll}))};
  draw(S,R);last=S;show(S);$("it-msg").textContent="Parcours « "+e.name+" » rechargé tel qu'enregistré (non recalculé : touchez Calculer pour le recalculer avec les réglages actuels).";
  const d=$("sec-itin");if(d)d.open=true;return true}
function svDel(id){const a=svRead().filter(x=>x.id!==id);svWrite(a);svRender()}
function svShare(id){const e=svRead().find(x=>x.id===id);if(!e)return;gpxOut(gpxFile(e.pl.flatMap(p=>p.ll),e.wps,e.name),true)}
function svMerge(arr){   // fusion depuis une sauvegarde : sans doublon (même id ou même signature), anciens fichiers sans parcours acceptés
  let add=0,dup=0;if(!Array.isArray(arr))return{add,dup};
  const a=svRead(),sigs=new Set(a.map(svSig));
  for(const x of arr){
    if(!x||!Array.isArray(x.pl)||!x.pl.length||!x.pl.every(p=>p&&Array.isArray(p.ll)&&p.ll.every(q=>Array.isArray(q)&&isFinite(q[0])&&isFinite(q[1]))))continue;
    const sig=svSig(x);
    if((x.id&&a.some(y=>y.id===x.id))||sigs.has(sig)){dup++;continue}
    const e={id:String(x.id||"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,5)),name:String(x.name||"Parcours").slice(0,40),t:+x.t||Date.now(),loop:!!x.loop,A:x.A||null,B:x.B||null,wps:Array.isArray(x.wps)?x.wps:[],pl:x.pl.map(p=>({k:p.k||0,ll:p.ll.map(q=>[+q[0],+q[1]])})),sum:x.sum||{len:0,up:0,dn:0,sec:0,lvl:0,reason:""}};
    a.push(e);sigs.add(sig);add++}
  a.sort((p,q)=>q.t-p.t);a.length=Math.min(a.length,SV_MAX);
  if(add)svWrite(a);svRender();return{add,dup}}
function svRender(){
  const box=$("it-slist");if(!box)return;const a=svRead();
  box.innerHTML=a.length?a.map(e=>`<div class="it-wp" data-id="${xe(e.id)}"><span><b style="all:unset">${xe(e.name)}</b><br>${new Date(e.t).toLocaleDateString("fr-CH")} · ${km(e.sum.len)} · ${dur(e.sum.sec)}${e.loop?" · boucle":""}</span><button type="button" class="btn" data-a="load">Charger</button><button type="button" class="btn" data-a="gpx" title="Exporter en GPX / partager">GPX</button><button type="button" class="btn" data-a="del" aria-label="Supprimer">✕</button></div>`).join(""):'<p class="it-note">Aucun parcours enregistré.</p>';
  box.querySelectorAll("button").forEach(b=>b.onclick=()=>{const id=b.closest(".it-wp").dataset.id,k=b.dataset.a;
    if(k==="load")svLoad(id);else if(k==="gpx")svShare(id);
    else if(b.dataset.arm){svDel(id)}else{b.dataset.arm="1";b.textContent="Sûr ?";setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent="✕"}},3000)}})}

/* ---------- mode dessin : un appui ajoute un point (ou appui long, toujours actif) ---------- */
let DRAWM=false;
const drawMode=()=>DRAWM;
function drawBanner(){banner(DRAWM?"Mode dessin : touchez la carte pour "+(pts.A?"ajouter un point de passage (sur le tracé pour l'insérer)":"placer le départ (A)")+".":null);const b=$("it-bx");if(b&&DRAWM)b.textContent="Terminer"}
function setDraw(on){
  DRAWM=!!on;const c=$("it-draw");if(c)c.checked=DRAWM;
  if(DRAWM){arm="W";if(typeof openMenu==="function")openMenu(false);drawBanner()}else{if(arm==="W")arm=null;banner(null)}}
async function placeWp(ll){
  const msg=$("it-msg");
  try{if(navigator.vibrate)navigator.vibrate(25)}catch(e){}
  if(!pts.A){setPt("A",ll);msg.textContent="Départ placé."+(isLoop()?" Ajoutez des points de passage ou touchez Calculer.":" Ajoutez des points de passage, puis placez l'arrivée (B).");if(DRAWM)drawBanner();return}
  if(WP.length>=WP_MAX){msg.textContent="Maximum "+WP_MAX+" points de passage : retirez-en un avant d'en ajouter.";return}
  const lg=edOk()?edHit(map.latLngToContainerPoint(ll),24):null;
  if(lg!==null){await wpInsert(lg,ll);return}
  wpAdd(ll);
  if(wpReady()&&(isLoop()?last:pts.B))compute();else msg.textContent="Point de passage "+WP.length+" placé."+(wpReady()?" Touchez Calculer.":" Placez "+(pts.A?"l'arrivée (B)":"le départ (A)")+".")}
function lpInit(){
  const c=map.getContainer();let T=null,x0=0,y0=0,t0=0;
  const stop=()=>{if(T){clearTimeout(T);T=null}};
  c.addEventListener("touchstart",e=>{stop();t0=Date.now();
    if(e.touches.length!==1||ED.on||arm||e.target.closest&&e.target.closest(".leaflet-marker-icon,.leaflet-control,.leaflet-popup,.menu-btn,button"))return;
    const p=e.touches[0];x0=p.clientX;y0=p.clientY;
    T=setTimeout(()=>{T=null;if(ED.on&&ED.moved)return;ED.swallow=Date.now();const r=c.getBoundingClientRect();placeWp(map.containerPointToLatLng(L.point(x0-r.left,y0-r.top)))},650)},{capture:true,passive:true});
  c.addEventListener("touchmove",e=>{if(T){const p=e.touches[0];if(Math.hypot(p.clientX-x0,p.clientY-y0)>10)stop()}},{capture:true,passive:true});
  c.addEventListener("touchend",stop,true);c.addEventListener("touchcancel",stop,true);
  c.addEventListener("contextmenu",e=>{   // clic droit à la souris (sur téléphone, l'appui long est déjà traité ci-dessus)
    if(e.target.closest&&e.target.closest(".leaflet-marker-icon,.leaflet-control,.leaflet-popup"))return;
    e.preventDefault();if(Date.now()-t0<1500)return;placeWp(map.mouseEventToLatLng(e))})}

/* ---------- déclaration de responsabilité (acceptation mémorisée en local) ---------- */
const DECL_KEY="itin-decl-v1";
function declOk(){try{return localStorage.getItem(DECL_KEY)==="1"}catch(e){return false}}
function declare(need){   // retourne une promesse : true si accepté
  return new Promise(res=>{const m=$("it-decl-modal");if(need&&declOk())return res(true);
    m.hidden=false;const done=v=>{m.hidden=true;if(v){try{localStorage.setItem(DECL_KEY,"1")}catch(e){}}res(v)};
    $("it-decl-ok").onclick=()=>done(true);$("it-decl-no").onclick=()=>done(false)})}

/* ---------- interface ---------- */
function banner(t){let b=$("it-banner");if(!t){if(b)b.hidden=true;return}
  if(!b){b=document.createElement("div");b.id="it-banner";b.className="it-banner";b.innerHTML='<span id="it-bt"></span> <button type="button" class="btn" id="it-bx">Annuler</button>';document.body.appendChild(b);$("it-bx").onclick=()=>{arm=null;if(DRAWM)setDraw(false);banner(null)}}
  $("it-bt").textContent=t;b.hidden=false}
function start(t){if(DRAWM){DRAWM=false;const c=$("it-draw");if(c)c.checked=false}arm=t;if(typeof openMenu==="function")openMenu(false);banner("Touchez la carte pour placer "+(t==="A"?"le départ (A)":t==="W"?"le point de passage "+(WP.length+1):"l'arrivée (B)"))}
// préréglages et résumé des réglages (le panneau ne montre que le type, les points, le plafond et Calculer ; le reste est dans « Réglages »)
const PRE={balade:{env:1,dur:2,max:1,dv:"up",dvm:200},cueillette:{env:2,dur:3,max:2,dv:"0",dvm:300},sportif:{env:1,dur:1,max:4,dv:"0",dvm:300}};
const ENV_L=["plus court","léger détour","détour","grand détour"],DUR_S=["×½","×¾","×1","×1,5","×2","×3"];let DVUP=null;
function regUpd(){
  const r=$("it-resume");if(!r)return;
  const x={env:+$("it-env").value,dur:+$("it-dur").value,max:+$("it-max").value,dv:$("it-dv").value,dvm:+$("it-dvm").value,off:false},p=[ENV_L[x.env],DUR_S[x.dur],x.max>=4?"difficulté libre":"max "+DIFF[x.max]];
  if(x.dv!=="0")p.push("D"+(x.dv==="both"?"±":"+")+" ≤ "+x.dvm+" m");if(x.off)p.push("tout-terrain");if(varOn())p.push("variétés");
  r.textContent="· "+p.join(" · ");
  document.querySelectorAll("#sec-itin [data-pre]").forEach(b=>{const q=PRE[b.dataset.pre];b.setAttribute("aria-pressed",String(q.env===x.env&&q.dur===x.dur&&q.max===x.max&&q.dv===x.dv&&(x.dv==="0"||q.dvm===x.dvm)&&!x.off))})}
function applyPre(k){
  const P=PRE[k];if(!P)return;
  $("it-env").value=P.env;$("it-dur").value=P.dur;$("it-max").value=P.max;$("it-dv").value=P.dv;$("it-dvm").value=P.dvm;offBoxUpd();
  ["it-env","it-dur","it-max","it-dvm"].forEach(i=>$(i).oninput&&$(i).oninput());if(DVUP)DVUP();regUpd();
  if(pts.A&&(isLoop()||pts.B)&&last)compute()}
function init(){
  if(typeof map==="undefined"||!map||!$("it-go")){return setTimeout(init,300)}
  map.getContainer().addEventListener("click",e=>{
    if(!arm)return;e.stopPropagation();e.preventDefault();
    const dg=map.dragging&&map.dragging._draggable&&map.dragging._draggable._moved;if(dg)return;
    const ll=map.mouseEventToLatLng(e),t=arm;if(DRAWM&&t==="W"){placeWp(ll);return}arm=null;banner(null);if(t==="W")wpAdd(ll);else setPt(t,ll);
    {const d=$("sec-itin");if(d){d.open=true;setTimeout(()=>d.scrollIntoView({behavior:"smooth",block:"nearest"}),50)}}
    if(t==="W"){if(pts.A&&(isLoop()?last:pts.B))compute();else $("it-msg").textContent="Point de passage "+WP.length+" placé."+(pts.A&&(isLoop()||pts.B)?" Touchez Calculer.":" Placez le départ"+(isLoop()?"":" et l'arrivée")+" si ce n'est pas fait.")}
    else if(pts.A&&pts.B)compute();else $("it-msg").textContent=t==="A"?"Départ placé. Choisissez maintenant l'arrivée.":"Arrivée placée. Choisissez maintenant le départ."},true);
  edInit();lpInit();$("it-draw").onchange=e=>setDraw(e.target.checked);svRender();
  $("it-a").onclick=()=>start("A");$("it-b").onclick=()=>start("B");
  $("it-w").onclick=()=>{if(WP.length>=WP_MAX){$("it-msg").textContent="Maximum "+WP_MAX+" points de passage.";return}start("W")};
  $("it-wopt").onchange=()=>{if(pts.A&&(isLoop()||pts.B)&&last)compute()};
  $("it-loc").onclick=()=>{
    const use=ll=>{setPt("A",L.latLng(ll[0],ll[1]));if(pts.B)compute();else $("it-msg").textContent="Départ = ma position. Choisissez l'arrivée."};
    if(typeof LOC!=="undefined"&&LOC.ll){use(LOC.ll);return}
    if(!navigator.geolocation){$("it-msg").textContent="Position GPS indisponible ici : choisissez le départ sur la carte.";return}
    navigator.geolocation.getCurrentPosition(p=>use([p.coords.latitude,p.coords.longitude]),()=>{$("it-msg").textContent="Position refusée ou introuvable : choisissez le départ sur la carte."},{enableHighAccuracy:true,timeout:15000})};
  const modeUI=()=>{cancelRun();const l=isLoop();$("it-b").hidden=l;$("it-swap").hidden=l;const nn=$("it-lm").querySelector('[value="none"]');nn.disabled=nn.hidden=l;if(l&&$("it-lm").value==="none"){$("it-lm").value="len";lmUI()}   // pas de boucle sans plafond
    $("it-a").textContent=l?"Départ de la boucle":"Départ (A)";
    if(l&&mk.B){map.removeLayer(mk.B);mk.B=null;pts.B=null}clearRouteKeep();$("it-vars").innerHTML=""};
  $("it-mode").onchange=modeUI;$("it-max").addEventListener("change",offBoxUpd);offBoxUpd();
  function lmUI(){const no=$("it-lm").value==="none",d=$("it-lm").value==="len",r=$("it-lt");$("it-ltl").hidden=r.hidden=no;if(no){$("it-ltl").textContent="";return}r.min=d?2:30;r.max=d?20:360;r.step=d?1:15;r.value=d?8:120;r.oninput()}
  $("it-lm").onchange=lmUI;$("it-lt").oninput=()=>{const d=$("it-lm").value==="len",v=+$("it-lt").value;$("it-ltl").textContent=d?v+" km":dur(v*60)};
  $("it-lm").value="none";lmUI();modeUI();
  $("it-go").onclick=compute;$("it-clr").onclick=()=>clearRoute(true);$("it-swap").onclick=()=>{if(!pts.A||!pts.B)return;const a=pts.A,b=pts.B;setPt("A",b);setPt("B",a);WP.reverse();wpRefresh();compute()};
  $("it-env").oninput=()=>{$("it-envl").textContent=["plus court","léger détour","détour","grand détour"][+$("it-env").value]};$("it-env").onchange=()=>{if(pts.A&&(isLoop()||pts.B)&&last)compute()};
  $("it-env").oninput();
  $("it-var").onchange=()=>{$("it-varbox").hidden=!$("it-var").checked;
    if($("it-var").checked){varList();if(+$("it-env").value===0){$("it-env").value=2;$("it-env").oninput()}   // sans envie de détour, le choix des variétés ne change rien
      if(last)compute()}else{VC=null;VAR=null;if(last)compute()}};
  $("it-varseason").onclick=()=>{$("it-varlist").querySelectorAll("[data-sp]").forEach(c=>{const sp=SPECIES.find(x=>x.id===c.dataset.sp);c.checked=!!sp&&inSeason(sp)});varSave();varCount();if(last&&varOn())compute()};
  $("it-varnone").onclick=()=>{$("it-varlist").querySelectorAll("[data-sp]").forEach(c=>c.checked=false);varSave();varCount()};
  $("it-varbox").hidden=true;
  $("it-dur").oninput=()=>{$("it-durl").textContent=DUR_L[+$("it-dur").value]};$("it-dur").onchange=()=>{if(pts.A&&(isLoop()||pts.B)&&last)compute()};$("it-dur").oninput();
  const dvUp=c=>{const on=$("it-dv").value!=="0";$("it-dvrow").hidden=!on;$("it-dvl").textContent=$("it-dvm").value+" m";if(c===true&&on&&pts.A&&(isLoop()||pts.B)&&last)compute()};
  $("it-dv").onchange=()=>dvUp(true);$("it-dvm").oninput=()=>dvUp();$("it-dvm").onchange=()=>dvUp(true);dvUp();DVUP=dvUp;
  $("it-max").oninput=()=>{$("it-maxl").textContent=+$("it-max").value>=4?"aucune limite (jusqu'à très difficile)":DIFF[+$("it-max").value]+" ou plus facile"};$("it-max").onchange=()=>{if(pts.A&&(isLoop()||pts.B)&&last)compute()};$("it-max").oninput();
  document.querySelectorAll("#sec-itin [data-pre]").forEach(b=>b.onclick=()=>applyPre(b.dataset.pre));
  {const rg=$("it-reg");if(rg){rg.addEventListener("input",regUpd);rg.addEventListener("change",regUpd)}}
  $("it-cancel").onclick=()=>{cancelRun();$("it-msg").textContent="Calcul annulé."};regUpd();
  window.ITIN_SAVED={list:()=>svRead(),merge:svMerge};
  window.ITIN={get last(){return last},routeCap,setDetCap:v=>{DETCAP=!!v},capOf,capOver,prepVar,varList,varReport,get VAR(){return VAR},gpx,gpxText,savedList:()=>svRead(),svSave,svLoad,svDel,placeWp,drawMode,lv95,geoLink,techPen,edgeTech,durF,routeGD,bonusQ,goodLen,wxOn,wx,wxWarn,declare,loadGraph,snap,route,routeOff,summarize,compute,setPt,wpAdd,get WP(){return WP},loopRoutes,netDist,get graph(){return GR},draw,hazards,loopMetrics,setLoopQ:v=>{LOOPQ=v},setCorridor:(p,sq)=>{PCOR=p;SQ=sq},setOffP:v=>{OFFP=v},setLFW:v=>{LFW=v},setBudget:v=>{BUDGET=v},setAlea:v=>{ALEA=!!v},setLoopEnr:v=>{LOOPENR=!!v},setSeed:v=>{SEEDFIX=v==null?null:+v;SEEDV=SEEDFIX!=null?SEEDFIX:SEED;RND=rng(SEEDV)},setTT:v=>{TTF=v==null?null:!!v},peaks,topReach,enrich,mkNoise,get lastTop(){return LASTTOP},get runs(){return RUNS},cancelRun};   // pour les tests
}
init();
})();
