/* Itinéraire A→B sur le réseau de chemins précalculé (<région>/graphe.json, voir tools/graphe.py).
   Coût d'une arête = temps de marche (Tobler, dénivelé + / − de l'arête) × facteur de réseau × (1 − bonus de cueillette) × (1 + 4 × part hors forêt de l'arête).
   Classe 5/4 : 1 · sentier balisé : 0,7 · classe 3 (route forestière) : 1,6 · classe 2 (4 m, bord de route) : 3,5 ·
   classe 1 : jamais, sauf traversée ≤ 30 m (arête virtuelle). Calcul entièrement dans le navigateur. */
(function(){
"use strict";
if(typeof L==="undefined")return;
const $=id=>document.getElementById(id);
const offRule=M=>M>=4?"sans limite de distance au chemin (pente < 30°)":"à ≤ "+OFF_DIST[M]+" m d'un chemin, pente < "+OFF_SLP[M]+"°";
const DIFF=["très facile","facile","moyen","difficile","très difficile"],DCOL=["#2e8b57","#7cb342","#e0a800","#e8731f","#c62828"];
const FACT={1:12,2:3.5,3:1.6,4:1,5:1},TYPE_F={0:1,1:.7,2:.8,3:1},TYPE_T={0:1,1:1,2:1.3,3:1.6};   // facteur de coût (réseau) · multiplicateur de temps (type de sentier)
const R_E=6378137,WGW=[0,0,.2,.6,1];                                                  // poids du bonus par classe d'affichage (très faible … très élevé) : rien sous « moyen », le détour ne vise que les zones moyen ou mieux
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
function techPen(M,k){const g=GR,p=new Float32Array(g.nE).fill(1);for(let e=0;e<g.nE;e++){const x=edgeTech(e)-M;if(x>0)p[e]=Math.pow(k,Math.min(x,2))}return p}

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
function bonusQ(){
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

/* ---------- plus court chemin (Dijkstra, tas binaire) ---------- */
function costs(envie,pen,qq,noDV){
  const g=GR,q=qq||(envie>0?bonusQ():null),mult=e=>{const k=g.cls[e],t=g.typ[e];
    let m=k===3?(t?TYPE_F[t]:FACT[3]):k===2?(t?2:FACT[2]):k===1?FACT[1]:TYPE_F[t];   // sentier balisé sur une route forestière : 0,7 ; sur une route de classe 2 : 2
    if(q&&k!==1)m*=1-Math.min(.6,.2*envie*q[e]);
    if(OFFP&&k!==1)m*=1+OFFP*(1-g.fo[e]/100);   // hors forêt : surcoût proportionnel à la part de l'arête hors forêt (graphe : fo, 0-100 %)
    return m};
  const cf=new Float32Array(g.nE),cb=new Float32Array(g.nE);
  for(let e=0;e<g.nE;e++){const m=mult(e)*(pen?pen[e]:1)*(BP?BP[e]:1);cf[e]=g.tf[e]*m+(g.cls[e]===1?120:0);cb[e]=g.tb[e]*m+(g.cls[e]===1?120:0);
    if(DV&&!noDV){cf[e]+=DV.lam*(g.up[e]+(DV.both?g.dn[e]:0));cb[e]+=DV.lam*(g.dn[e]+(DV.both?g.up[e]:0))}}
  return {cf,cb}}
function route(A,B,envie,pen,qq){
  const g=GR,{cf,cb}=costs(envie,pen,qq);
  const dist=new Float64Array(g.nN).fill(Infinity),prev=new Int32Array(g.nN).fill(-1),heap=[],push=(d,n)=>{heap.push([d,n]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}},
    pop=()=>{const t=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let i=0;for(;;){let m=i;const a=2*i+1,b=a+1;if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(b<heap.length&&heap[b][0]<heap[m][0])m=b;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return t};
  const fa=A.s/Math.max(g.len[A.e],1),fb=B.s/Math.max(g.len[B.e],1);
  // même arête : chemin direct
  let best=Infinity,bestEnd=null;
  if(A.e===B.e){const e=A.e,f=Math.abs(fb-fa);best=(fb>=fa?cf[e]:cb[e])*f;bestEnd={direct:true}}
  // départ : vers a (sens b→a) et vers b (sens a→b)
  const ea=g.a[A.e],eb=g.b[A.e];
  dist[ea]=cb[A.e]*fa;dist[eb]=Math.min(dist[eb],cf[A.e]*(1-fa));push(dist[ea],ea);if(eb!==ea)push(dist[eb],eb);
  const ta=g.a[B.e],tb=g.b[B.e],costA=cf[B.e]*fb,costB=cb[B.e]*(1-fb);   // ta→point : sens a→b ; tb→point : sens b→a
  while(heap.length){const [d,u]=pop();if(d>dist[u])continue;if(d>=best)break;
    if(u===ta&&d+costA<best){best=d+costA;bestEnd={node:ta,end:"a"}}
    if(u===tb&&d+costB<best){best=d+costB;bestEnd={node:tb,end:"b"}}
    for(let k=g.deg[u];k<g.deg[u+1];k++){const c=g.adj[k],e=c>>1,fw=!(c&1),v=fw?g.b[e]:g.a[e],w=d+(fw?cf[e]:cb[e]);if(w<dist[v]){dist[v]=w;prev[v]=c;push(w,v)}}}
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


/* ---------- balade en boucle ---------- */
// Triangle départ A → W1 → W2 → A (W1, W2 à distance r de A, 60° d'écart) ; les arêtes déjà utilisées coûtent ×6 pour ne pas repasser aux mêmes endroits.
// Les waypoints sont choisis dans les secteurs où le mode affiché est le meilleur ; r est ajusté jusqu'à ±10 % de la cible.
function nodeSnap(u){const g=GR,c=g.adj[g.deg[u]],e=c>>1;return {e,s:(c&1)?g.len[e]:0,d:0}}
// Un seul calcul à la fois : un nouveau calcul (ou « Effacer », ou un changement de mode) annule le précédent, qui s'arrête au prochain point de contrôle et n'affiche rien.
let RUN={c:false},RUNS=0;const CANCEL={cancel:true};
const AW=async(p,run)=>{const v=await p;if(run.c)throw CANCEL;return v};   // attend p puis abandonne si ce calcul a été annulé entre-temps
const cancelRun=()=>{RUN.c=true;RUN={c:false};BP=null;DV=null};
const stop=run=>{if(run.c)throw CANCEL};
// budget de recherche des boucles : au-delà, on garde les meilleures boucles déjà trouvées (une direction au moins) ; graine fixe : mêmes réglages = mêmes boucles
let BUDGET=3000;const SEED=20261123;
const rng=a=>()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
let LOOPERR="",LOOPQ=true;   // LOOPQ : qualité des boucles (forêt, allers-retours) ; false = ancien comportement (comparaisons de test)
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
  const forest=new Uint8Array(n),good=new Uint8Array(n),rep=new Uint8Array(n),cells=new Map();
  for(let i=0;i<n;i++){
    const q=merc(sm[i][0],sm[i][1]),c=Math.floor((q[0]-meta.x0)/meta.res),r=Math.floor((meta.y1-q[1])/meta.res);
    if(c>=0&&r>=0&&c<meta.cols&&r<meta.rows){const gi=r*meta.cols+c,v=curC()[gi],fo=G.fx[gi]>0;forest[i]=fo?1:0;good[i]=fo&&v!==255&&v>=2&&v<5?1:0}
    const kx=Math.floor((sm[i][1]-g.lon0)*g.kx/ST),ky=Math.floor((sm[i][0]-g.lat0)*g.ky/ST);
    for(let a=-1;a<=1&&!rep[i];a++)for(let b=-1;b<=1;b++){const l=cells.get((kx+a)+","+(ky+b));if(l&&l.some(j=>i-j>=4)){rep[i]=1;break}}
    const k=kx+","+ky;let l=cells.get(k);if(!l)cells.set(k,l=[]);l.push(i)}
  let nf_=0,ng=0,nr=0,nd=0;
  for(let i=0;i<n;i++){nf_+=forest[i];ng+=good[i];nr+=rep[i]}
  for(let i=0;i<n;){if(!rep[i]){i++;continue}let j=i,reach=false;while(j<n&&rep[j])j++;   // tronçon répété i…j-1 : atteint-il une zone favorable en forêt ?
    for(let k=Math.max(0,i-2);k<Math.min(n,j+2);k++)if(good[k]){reach=true;break}
    if(!reach&&j-i>=4)nd+=j-i;i=j}
  return {forest:nf_/n,good:ng/n,rep:nr/n,dead:nd/n,len:n*ST}}
// coût de sélection d'une boucle : écart à la cible, impasses lourdement, répétitions, moins de forêt / de zones favorables
let LFW=1;   // poids de la part en forêt dans le choix d'une boucle
const loopCost=(err,m)=>m?err+3*m.dead+.7*m.rep-.5*m.good-LFW*m.forest:err;
let nf=null;   // part de forêt (0-1) des noeuds, pour le choix des étapes
async function loopOnce(A,ax,ay,th,r,envie,q,nq,cand,off,pA,all){
  const run=RUN,g=GR,pickW=ang=>{   // meilleurs noeuds près de (r, ang) : on préfère les noeuds en forêt et dans les zones favorables
    const tx=ax+r*Math.cos(ang),ty=ay+r*Math.sin(ang),L=[];
    for(const u of cand){const dx=(g.lon[u]-g.lon0)*g.kx-tx,dy=(g.lat[u]-g.lat0)*g.ky-ty,d=Math.hypot(dx,dy);if(d<r*.3)L.push([d/r-.6*nq[u]-(LOOPQ?.5*nf[u]:0),u])}
    return L.sort((a,b)=>a[0]-b[0]).slice(0,4).map(x=>x[1])};
  const C1=pickW(th),C2=pickW(th+Math.PI/3),res=[],maxN=!all?1:off?4:12;
  for(const w1 of C1)for(const w2 of C2){if(w1===w2)continue;if(res.length>=maxN)break;
    if(off){   // tout-terrain : trois tronçons hors chemin autorisés (départ → W1 → W2 → départ) ; les cellules déjà empruntées coûtent ×4
      const ll=u=>({lat:g.lat[u],lng:g.lon[u]}),seq=[],pl=[],O={len:0,up:0,dn:0,sec:0,lvl:0};let ok=true,P=pA;const used=LOOPQ?new Set():null;
      for(const w of [ll(w1),ll(w2),pA]){
        stop(run);const R=await AW(routeOff(P,w,envie,undefined,used),run);if(!R||R.error){if(R&&R.error)LOOPERR=R.error;ok=false;break}
        seq.push(...R.seq);pl.push(...R.pl);for(const k of ["len","up","dn","sec"])O[k]+=R.off[k];O.lvl=Math.max(O.lvl,R.off.lvl||0);P=w;
        if(used)for(const gi of R.cellsG)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)used.add(gi+dy*meta.cols+dx)}
      if(ok){const o={seq,pl,off:O};if(!all)return o;res.push(o)}continue}
    const pen=new Float32Array(g.nE).fill(1),seq=[];let ok=true,P=A;
    for(const w of [nodeSnap(w1),nodeSnap(w2),A]){
      const R=route(P,w,envie,pen,q);if(!R){ok=false;break}
      seq.push(...R.seq);for(const [e] of R.seq)pen[e]=LOOPQ?12:6;P=w}
    if(ok){if(!all)return {seq};res.push({seq})}}
  return all?res:null}
async function loopRoutes(A,pt,metric,target,envie,off){
  const run=RUN,rnd=rng(SEED),dl=performance.now()+BUDGET,late=()=>performance.now()>dl,g=GR,q=envie>0?bonusQ():null,nq=new Float32Array(g.nN),cand=[];
  nf=new Float32Array(g.nN);let mxf=1;for(let e=0;e<g.nE;e++)if(g.fo[e]>mxf)mxf=g.fo[e];
  if(q)for(let e=0;e<g.nE;e++){nq[g.a[e]]=Math.max(nq[g.a[e]],q[e]);nq[g.b[e]]=Math.max(nq[g.b[e]],q[e])}
  for(let e=0;e<g.nE;e++){const f=g.fo[e]/mxf;nf[g.a[e]]=Math.max(nf[g.a[e]],f);nf[g.b[e]]=Math.max(nf[g.b[e]],f)}
  for(let u=0;u<g.nN;u++){for(let k=g.deg[u];k<g.deg[u+1];k++){const e=g.adj[k]>>1;if(g.cls[e]>=3){cand.push(u);break}}}
  const ax=(pt.lng-g.lon0)*g.kx,ay=(pt.lat-g.lat0)*g.ky,out=[];
  // secteurs : 12 directions, score = somme des meilleurs noeuds des deux fenêtres (zones favorables + forêt) ; on garde 3 directions écartées d'au moins 90°
  const NT=LOOPQ&&!off?5:3,sc=[];for(let i=0;i<12;i++){const th=i*Math.PI/6;let v=0;for(const u of cand){const x=(g.lon[u]-g.lon0)*g.kx-ax,y=(g.lat[u]-g.lat0)*g.ky-ay,an=Math.atan2(y,x),d=Math.hypot(x,y);
      const da=Math.abs(((an-th-Math.PI/6+3*Math.PI)%(2*Math.PI))-Math.PI);if(da<Math.PI/4&&d>500&&d<8000)v+=nq[u]+(LOOPQ?.5*nf[u]:0)}sc.push([v,th])}
  sc.sort((a,b)=>b[0]-a[0]);const ths=[];for(const [,t] of sc){if(ths.every(u=>{const d=Math.abs(((t-u+3*Math.PI)%(2*Math.PI))-Math.PI);return d>=Math.PI/2}))ths.push(t);if(ths.length===NT)break}
  while(ths.length<3)ths.push(ths.length*2*Math.PI/3);
  // plafond strict : `target` est un maximum ; on vise 93 % du plafond (marge de ±7 %) et toute boucle au-dessus du plafond est marquée `over` (err > 1)
  const aim=target*.93,MXv=+($("it-max")?$("it-max").value:4),mkC=R=>{const S=summarize(R),m=loopMetrics(R),mm=metric==="len"?S.len:S.sec,ov=mm>target,err=ov?1+(mm-target)/target:Math.abs(mm-aim)/aim;S.met=m;return {R,S,err,over:ov,M:m,cost:loopCost(err,m)+(S.lvl>MXv?1:0)}};
  for(const th of ths){
    let r=Math.min(8000,metric==="len"?aim/4:aim/3600*4000/4/durF()),best=null;
    for(let it=0;it<9;it++){
      const R=await AW(loopOnce(A,ax,ay,th,r,envie,q,nq,cand,off,pt),run);if(!R)break;
      const c=mkC(R),M=metric==="len"?c.S.len:c.S.sec;
      if(!best||c.err<best.err)best=c;
      if(c.err<=.1||(late()&&!best.over&&best.err<=.35))break;r=Math.min(8000,Math.max(300,r*Math.pow(aim/M,it<4?.9:.6)*(1+(it>=4?(rnd()-.5)*.15:0))))}
    // exploration : plusieurs couples d'étapes autour du rayon trouvé ; on garde la boucle de coût minimal (forêt, peu de répétitions, pas d'impasse) à ±15 % de la visée (93 % du plafond)
    if(LOOPQ&&best&&!late()){
      for(const k of off?[1,.93,1.07]:[1,.88,.94,1.06,1.12]){if(late()&&best.err<=.15)break;const L_=await AW(loopOnce(A,ax,ay,th,r*k,envie,q,nq,cand,off,pt,true),run);
        for(const R of L_){const c=mkC(R);if(c.err<=.15&&(c.cost<best.cost||best.err>.15))best=c}}}
    if(best)out.push(best);
    await AW(new Promise(r=>setTimeout(r,0)),run);
    if(late()&&out.some(x=>!x.over))break}
  const fe=out.filter(x=>!x.over),ok=fe.filter(x=>x.err<=.35),res=ok.length?ok:fe.length?fe:out;
  if(LOOPQ){const good=res.filter(x=>!x.M||x.M.dead<=.03);return (good.length?good:res).sort((a,b)=>a.cost-b.cost)}
  return res}
function lv95(lat,lng){const p=(lat*3600-169028.66)/10000,l=(lng*3600-26782.5)/10000;
  return [2600072.37+211455.93*l-10938.51*l*p-0.36*l*p*p-44.54*l*l*l,1200147.07+308807.95*p+3745.25*l*l+76.63*p*p-194.56*l*l*p+119.79*p*p*p]}
// KML (importable dans map.geo.admin.ch › Outils avancés › Importer un fichier ; partage iOS/Android vers l'app swisstopo si elle l'accepte)
function kml(){
  if(!last||!last.ll||!last.ll.length)return;
  const c=last.ll.map(p=>p[1].toFixed(6)+","+p[0].toFixed(6)+",0").join(" "),a=last.ll[0],b=last.ll[last.ll.length-1],pm=(n,p)=>`<Placemark><name>${n}</name><Point><coordinates>${p[1].toFixed(6)},${p[0].toFixed(6)},0</coordinates></Point></Placemark>`;
  const x=`<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Itinéraire Magichampi</name><Style id="l"><LineStyle><color>ffc0651f</color><width>4</width></LineStyle></Style><Placemark><name>Itinéraire Magichampi (proposition, sans garantie de sécurité)</name><styleUrl>#l</styleUrl><LineString><tessellate>1</tessellate><coordinates>${c}</coordinates></LineString></Placemark>${pm("Départ",a)}${(last.wps||[]).map((p,i)=>pm("Point de passage "+(i+1),p)).join("")}${pm("Arrivée",b)}</Document></kml>`;
  const f=new File([x],"itineraire-magichampi.kml",{type:"application/vnd.google-earth.kml+xml"});
  if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:"Itinéraire Magichampi"}).catch(()=>{});return}
  const u=document.createElement("a");u.href=URL.createObjectURL(f);u.download=f.name;document.body.appendChild(u);u.click();setTimeout(()=>{URL.revokeObjectURL(u.href);u.remove()},500)}
function geoLink(S){S=S||last;if(!S||!S.ll||!S.ll.length)return"#";const a=S.ll[0],q=lv95(a[0],a[1]);return`https://map.geo.admin.ch/#/map?lang=fr&center=${Math.round(q[0])},${Math.round(q[1])}&z=10&crosshair=marker,${Math.round(q[0])},${Math.round(q[1])}`}
function gpx(){
  if(!last||!last.ll)return;
  const t=new Date().toISOString(),pts_=last.ll.map(p=>`<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"/>`).join("");
  const x=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Magichampi" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Itinéraire Magichampi</name><time>${t}</time></metadata>${(last.wps||[]).map((p,i)=>`<wpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"><name>Point de passage ${i+1}</name></wpt>`).join("")}<trk><name>Itinéraire Magichampi (proposition, sans garantie de sécurité)</name><trkseg>${pts_}</trkseg></trk></gpx>`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([x],{type:"application/gpx+xml"}));a.download="itineraire-magichampi.gpx";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}


/* ---------- tout-terrain (bêta) ---------- */
// Dijkstra sur la grille de 25 m (cellules d'environ 17 m de côté au sol) reliée au réseau de chemins : les chemins sont des arcs de cellule à cellule
// (coût du graphe), la forêt peut être traversée hors chemin (Tobler ×1,6) seulement près d'une zone « élevé » ou mieux, et jamais dans les cellules à
// pente ≥ 30° (25-30° ×3 plus lent), cours d'eau (tampon d'une cellule), marais, réserves et zones exclues (usable).
// Règles du tout-terrain par difficulté maximale (0 très facile … 3 difficile ; 4 = aucune limite) : distance maximale à un chemin (m) et pente maximale (°) en terrain hors chemin.
const OFF_DIST=[25,50,100,200],OFF_SLP=[8,15,20,25],slvOf=s=>s<OFF_SLP[0]?0:s<OFF_SLP[1]?1:s<OFF_SLP[2]?2:s<OFF_SLP[3]?3:4;
const USED_K=4,REWK=.55,OFFX=1.6,OFF_SLOPE=30,OFF_NEAR=100,DETOUR_CAP=[1,1.3,1.8,2.6];   // plafond de durée par cran du curseur de détour
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
async function routeOff(pA,pB,envie,Mx,used){
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
  const qq=envie>0?bonusQ():null,cnt=new Int32Array(N+1),arcs=[];
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
  const cc=new Map(),solve=(str,S0,T0)=>{
    const e1=envie*str,{cf,cb}=cc.get(str)||(cc.set(str,costs(e1,null,e1>0?qq:null)),cc.get(str)),R0=cc.get(0)||(cc.set(0,costs(0,null,null,true)),cc.get(0)),
      dist=new Float64Array(N).fill(Infinity),rt=new Float64Array(N),prev=new Int32Array(N).fill(-1),via=new Int32Array(N).fill(-1);
    hn=0;dist[S0]=0;hpush(0,S0);
    // récompense hors chemin : bien plus forte que sur chemin (jusqu'à ×0,1 dans une cellule très élevée avec « grand détour »)
    const rew=cw=>cw!==255&&cw<5&&e1>0?1-Math.min(.97,REWK*e1*WGW[cw]):1;
    while(hn){const u=hpop(),d=popK;if(d>dist[u])continue;if(u===T0)break;
      for(let k=cnt[u];k<cnt[u+1];k++){const v=aTo[k],e=aE[k],w=d+(aD[k]?cb[e]:cf[e])*aF[k]*(usd&&usd.has(giOf(v))?USED_K:1);if(w<dist[v]){dist[v]=w;rt[v]=rt[u]+(aD[k]?R0.cb[e]:R0.cf[e])*aF[k];prev[v]=u;via[v]=aId[k];hpush(w,v)}}
      const ux=u%ww,uy=(u/ww)|0,ug=(r0+uy)*W+c0+ux;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=ux+dx,y=uy+dy;if(x<0||y<0||x>=ww||y>=hh)continue;const v=y*ww+x;
        if(ban[v]||ban[u])continue;   // dans la bande de 20 m le long d'une route de classe 2 : seulement par les arcs de la route (pas de pas hors chemin)
        if(!al[v]&&!(onPath(v)&&(al[u]||onPath(u))))continue;
        if(!al[v]&&onPath(v)&&!onPath(u)&&!al[u])continue;
        const vg=(r0+y)*W+c0+x,L_=gs*(dx&&dy?1.4142:1),slp=(dm[vg]-dm[ug])/L_,t0=tob(L_,slp)*OFFX*(sl[vg]>=25?3:1),t=t0*rew(curC()[vg])*(usd&&usd.has(vg)?USED_K:1)+(DV?DV.lam*(DV.both?Math.abs(dm[vg]-dm[ug]):Math.max(0,dm[vg]-dm[ug])):0);
        const w=d+t;if(w<dist[v]){dist[v]=w;rt[v]=rt[u]+t0;prev[v]=u;via[v]=-1;hpush(w,v)}}}
    return {dist,rt,prev,via}};
  // plafond de durée : la durée réelle ne dépasse pas CAP[envie] × celle du trajet le plus rapide ; sinon la récompense est réduite par paliers
  let sol=solve(1,S0,T0),detour=1,strF=1,bt=0,base=null,noGain=false;
  if(envie>0&&isFinite(sol.dist[T0])){base=solve(0,S0,T0);if(isFinite(base.dist[T0])){bt=base.rt[T0];const cap=bt*DETOUR_CAP[envie];
    for(const str of [1,.7,.45,.25,.1]){strF=str;if(str<1)sol=solve(str,S0,T0);if(sol.rt[T0]<=cap){break}}
    detour=bt>0?sol.rt[T0]/bt:1}}
  const {dist}=sol;
  if(!isFinite(dist[T0]))return {error:"Aucun passage trouvé en tout-terrain : essayez sans cette option ou changez de point."};
  const recon=(sl,s_,t_)=>{const c=[],vv=[];for(let v=t_;v!==s_;v=sl.prev[v]){c.push(v);vv.push(sl.via[v])}c.push(s_);vv.push(-1);return {cells:c.reverse(),vias:vv.reverse(),rt:sl.rt[t_],cost:sl.dist[t_]}};
  let legs=[recon(sol,S0,T0)];
  // zones fortes : le plus court chemin pondéré ne s'écarte pas de sa route ; on ajoute donc des étapes dans les grandes zones fortes accessibles, tant que la durée reste sous le plafond
  const maxWP=[0,1,3,6][envie]||0;
  if(maxWP&&bt>0){
    const cap=bt*DETOUR_CAP[envie],sa=new Uint8Array(N);for(let i=0;i<N;i++)sa[i]=high[i]&&al[i]?1:0;
    const lab=new Int32Array(N),blobs=[];let nl=0;
    for(let i0=0;i0<N;i0++){if(!sa[i0]||lab[i0])continue;const id=++nl,st=[i0],mem=[];lab[i0]=id;
      while(st.length){const u=st.pop();mem.push(u);const ux=u%ww,uy=(u/ww)|0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=ux+dx,y=uy+dy;if(x<0||y<0||x>=ww||y>=hh)continue;const v=y*ww+x;if(sa[v]&&!lab[v]){lab[v]=id;st.push(v)}}}
      if(mem.length>=25){let mx=0,my=0;for(const u of mem){mx+=u%ww;my+=(u/ww)|0}mx/=mem.length;my/=mem.length;let rep_=mem[0],bd=1e18;for(const u of mem){const d=(u%ww-mx)**2+(((u/ww)|0)-my)**2;if(d<bd){bd=d;rep_=u}}
        blobs.push({id,n:mem.length,rep:rep_,x:mx,y:my})}}
    const route0=legs[0].cells,seen=new Set(route0),cross=new Map();for(const u of route0)if(lab[u])cross.set(lab[u],(cross.get(lab[u])||0)+1);
    const smp=[];for(let i=0;i<route0.length;i+=4)smp.push(i);
    for(const bl of blobs){let bd=1e18,bi=0;for(const i of smp){const u=route0[i],d=(u%ww-bl.x)**2+(((u/ww)|0)-bl.y)**2;if(d<bd){bd=d;bi=i}}bl.d=Math.sqrt(bd)*gs;bl.pos=bi;bl.gain=bl.n-(cross.get(bl.id)||0)*3;bl.sc=bl.gain/(300+2*bl.d)}
    const cand=blobs.filter(b=>b.gain>=20).sort((a,b)=>b.sc-a.sc).slice(0,maxWP+4);
    const key=(a,b)=>a*(N+1)+b,lc_=new Map(),getLeg=(a,b)=>{const k=key(a,b);let l=lc_.get(k);if(!l){const sl=solve(strF,a,b);l=isFinite(sl.dist[b])?recon(sl,a,b):null;lc_.set(k,l||0)}return lc_.get(k)};
    let chosen=[],curLegs=legs;
    for(const bl of cand){if(chosen.length>=maxWP)break;
      const tryW=[...chosen,bl].sort((a,b)=>a.pos-b.pos),pts_=[S0,...tryW.map(w=>w.rep),T0],L2=[];let ok=true,tot=0;
      for(let i=0;i+1<pts_.length;i++){const l=getLeg(pts_[i],pts_[i+1]);if(!l){ok=false;break}L2.push(l);tot+=l.rt}
      if(ok&&tot<=cap){chosen=tryW;curLegs=L2}}
    legs=curLegs;
    let rtT=0;for(const l of legs)rtT+=l.rt;detour=rtT/bt}
  // détour sans gain : on garde le trajet le plus rapide s'il ne traverse pas au moins MIN_GAIN m de plus de zones « moyen » ou mieux
  if(envie>0&&base&&bt>0&&detour>1.02&&isFinite(base.dist[T0])){
    const gl=cs=>{let n=0;for(const u of cs){const gi=(r0+((u/ww)|0))*W+c0+(u%ww),c=curC()[gi];if(c!==255&&c>=2&&c<5)n++}return n*gs},bl=recon(base,S0,T0);
    const lc2=legs.flatMap(l=>l.cells);if(gl(lc2)-gl(bl.cells)<Math.max(MIN_GAIN,GAIN_RATIO*Math.max(0,lc2.length-bl.cells.length)*gs)){legs=[bl];detour=1;noGain=true}}
  const cells=[],vias=[];legs.forEach((l,k)=>{l.cells.forEach((c,i)=>{if(k>0&&i===0)return;cells.push(c);vias.push(i===0?-1:l.vias[i])})});
  const costT=legs.reduce((a,l)=>a+l.cost,0);
  // reconstruction (cells, vias construits ci-dessus)
  const ll=li=>{const x=c0+(li%ww)+.5,y=r0+((li/ww)|0)+.5,X=meta.x0+x*res,Y=meta.y1-y*res;return [(2*Math.atan(Math.exp(Y/R_E))-Math.PI/2)*180/Math.PI,X/R_E*180/Math.PI]};
  const seq=[],pl=[],off={len:0,up:0,dn:0,sec:0,lvl:0};let cur=null;
  const flush=()=>{if(cur&&cur.ll.length>1)pl.push(cur);cur=null};
  for(let i=1;i<cells.length;i++){const v=cells[i],u=cells[i-1],id=vias[i];
    if(id>=0){const k=id>>1,fw=!(id&1),kk=fw?k:k+1,k2=fw?k+1:k,e=g.SE[k];
      const P=[g.lat0+g.SY[kk]/g.ky,g.lon0+g.SX[kk]/g.kx],Q=[g.lat0+g.SY[k2]/g.ky,g.lon0+g.SX[k2]/g.kx],kind=g.cls[e];
      if(!cur||cur.k!==kind){flush();cur={k:kind,ll:[P]}}cur.ll.push(Q);
      const last=seq[seq.length-1];if(last&&last[0]===e&&last[2]===g.SS[kk])last[2]=g.SS[k2];else seq.push([e,g.SS[kk],g.SS[k2]])}
    else{if(!cur||cur.k!=="o"){flush();cur={k:"o",ll:[ll(u)]}}cur.ll.push(ll(v));
      const ug=(r0+((u/ww)|0))*W+c0+(u%ww),vg=(r0+((v/ww)|0))*W+c0+(v%ww),dx=(v%ww)-(u%ww),dy=((v/ww)|0)-((u/ww)|0),L_=gs*(dx&&dy?1.4142:1),dz=dm[vg]-dm[ug];
      if(!onPath(v))off.lvl=Math.max(off.lvl,dl[v],slvOf(sl[vg]));off.len+=L_;if(dz>0)off.up+=dz;else off.dn-=dz;off.sec+=tob(L_,dz/L_)*OFFX*(sl[vg]>=25?3:1)}}
  flush();
  return {seq,off,pl,cost:costT,detour,noGain,cellsG:cells.map(giOf)}}


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
  if(R.pl)R.pl.forEach(p=>pl.push(p));else for(const [e,s0,s1] of R.seq){if(s0===s1)continue;const k=g.cls[e],ll=sub(e,s0,s1);pl.push({ll,k})}
  pl.forEach(p=>L.polyline(p.ll,{pane:"itineraire",color:"#fff",weight:8,opacity:.9,lineCap:"round",interactive:false}).addTo(layer));
  pl.forEach(p=>L.polyline(p.ll,p.k==="o"?{pane:"itineraire",color:"#6a1b9a",weight:5,dashArray:"2 7",lineCap:"round",interactive:false}:p.k===1?{pane:"itineraire",color:"#c62828",weight:5,dashArray:"4 6",interactive:false}:p.k===2?{pane:"itineraire",color:"#e8731f",weight:5,dashArray:"10 6",interactive:false}:{pane:"itineraire",color:"#1565c0",weight:5,lineCap:"round",interactive:false}).addTo(layer));
  RPL=pl;const all=pl.flatMap(p=>p.ll);S.ll=all;if(all.length&&!noFit)map.fitBounds(L.latLngBounds(all),{padding:[40,40],maxZoom:17});
}
function dvMsg(S){const l=dvLim();return l&&!dvOk(S)?"Aucun trajet respectant la limite de dénivelé ("+dvTxt(l)+") trouvé : voici le moins pentu (+"+Math.round(S.up)+" m / −"+Math.round(S.dn)+" m). ":""}
function show(S){
  const d=DIFF[S.lvl],c=DCOL[S.lvl],w=[];
  if(S.c2>=20)w.push(`<b>Bord de route : attention à la circulation</b> sur ${km(S.c2)} (tracé orange tireté).`);
  if(S.off>=20)w.push(`<b>Tout-terrain (bêta)</b> : ${km(S.off)} hors chemin (tracé violet pointillé), en forêt près d'une zone favorable, ${offRule(+$("it-max").value)}. Pas de balisage, terrain, ruisseaux non cartographiés et fossés possibles : vous êtes seul responsable du passage ; renoncez si le terrain vous semble dangereux.`);
  wxWarn(S).forEach(x=>w.push(x));
  if(S.cross)w.push(`${S.cross} traversée${S.cross>1?"s":""} de route large (tracé rouge pointillé, ≤ 30 m) : traversez avec prudence, aux endroits sûrs.`);
  $("it-res").innerHTML=`<div class="it-card"><div class="it-big">${dur(S.sec)} <span class="it-sub">de marche · ${km(S.len)}</span></div>
   <div class="it-row">Dénivelé : <b>+${Math.round(S.up)} m / −${Math.round(S.dn)} m</b>${dvLim()?` <span class="it-sub">${dvOk(S)?"✓ sous":"⚠ au-dessus de"} la limite (${dvTxt(dvLim())})</span>`:""}</div>
   <div class="it-row">Difficulté : <span class="pill" style="background:${c};color:#fff">${d}</span> <span class="it-sub">${esc(S.reason)}</span></div>
   ${S.met?`<div class="it-row">En forêt : <b>${Math.round(S.met.forest*100)} %</b> du tracé · tronçons parcourus deux fois : <b>${Math.round(S.met.rep*100)} %</b></div>`:""}
   ${S.legs&&S.legs.length>1?`<div class="it-row">Étapes :<ol class="it-legs">${S.legs.map(l=>`<li>${l.from} → ${l.to} : <b>${dur(l.sec)}</b> · ${km(l.len)} · ${DIFF[l.lvl]}</li>`).join("")}</ol></div>`:""}
   ${w.map(x=>`<div class="it-warn">${x}</div>`).join("")}
   <div class="it-btns"><button type="button" class="btn" id="it-gpx">Exporter en GPX</button><button type="button" class="btn" id="it-kml">Export swisstopo (KML)</button><a class="btn" id="it-geo" target="_blank" rel="noopener">Ouvrir map.geo.admin.ch</a></div>
   <p class="it-note">Durée estimée à ±10 min, sur la base du dénivelé et du type de chemin (pas de l'état réel du sentier : boue, neige). Proposition issue de données : vérifiez chasse, propriétés privées, réserves et conditions sur place, et renoncez à tout passage qui vous semble dangereux. <a href="#" id="it-decl">Déclaration de responsabilité</a></p></div>`;
  $("it-decl").onclick=e=>{e.preventDefault();declare(false)};
  $("it-gpx").onclick=gpx;$("it-kml").onclick=kml;$("it-geo").href=geoLink(S)}
const isLoop=()=>$("it-mode").value==="loop";
function showVars(V,k){
  if(layer){map.removeLayer(layer);layer=null}
  const v=V[k];draw(v.S,v.R);show(v.S);last=v.S;
  $("it-vars").innerHTML=V.map((x,i)=>`<button type="button" class="btn${i===k?" primary":""}" data-k="${i}">Boucle ${i+1} · ${km(x.S.len)} · ${dur(x.S.sec)} · ${DIFF[x.S.lvl]}</button>`).join("");
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
  const dm=$("it-lm").value==="len",v=+$("it-lt").value,target0=dm?v*1000:v*60,M=+$("it-max").value,tt=$("it-off").checked;
  if(tt){$("it-offbox").hidden=false;if(!$("it-offok").checked){clearRoute();msg.textContent="Tout-terrain : cochez « Je comprends » ci-dessous, puis touchez Calculer.";return}}
  let V=[],note="",shr=1;LOOPERR="";
  // difficulté maximale : pénalité sur les tronçons trop techniques (×6 puis ×40), puis cible réduite (×0,75, ×0,55) si c'est l'effort (durée, dénivelé) qui dépasse
  const DL=dvLim();
  // échelle de contraintes de plus en plus fortes (cible réduite × pénalité technique × pénalité de dénivelé) ; on cherche par dichotomie le premier cran qui respecte les réglages
  // (≤ 6 recherches au lieu de 30), avec un budget total de 3 × BUDGET : ensuite on garde la meilleure boucle trouvée
  const ladder=[];for(const s of M<4||DL?[1,.75,.55]:[1])for(const k of M<4?[6,40]:[0])for(const lam of DL?DV_LAM:[0])ladder.push([s,k,lam]);
  let best=null,lastV=[],lastS=1,lo=0,hi=ladder.length-1,j=0,tries=0;const T0=performance.now();
  try{while(lo<=hi){
    j=tries===0?0:(lo+hi)>>1;tries++;const [s,k,lam]=ladder[j];
    BP=M<4?techPen(M,k):null;setDV(lam);
    const v=await AW(loopRoutes(A,pts.A,dm?"len":"sec",target0*s,+$("it-env").value,tt),run),okV=v.filter(x=>!x.over&&x.S.lvl<=M&&dvOk(x.S));
    if(v.length){lastV=v;lastS=s}
    if(okV.length){best={V:okV,s};hi=j-1}else lo=j+1;
    if(best&&lo>hi)break;
    if(performance.now()-T0>3*BUDGET&&(best||lastV.length))break}
  }finally{if(RUN===run){BP=null;DV=null}}
  if(best){V=best.V;shr=best.s}else{V=lastV;shr=lastS}
  if(!V.length){clearRoute();msg.textContent=LOOPERR||"Aucune boucle trouvée depuis ce départ : le réseau y est trop morcelé ou trop court. Essayez un autre point de départ.";return}
  {const fe=V.filter(x=>!x.over);   // plafond strict : aucune boucle au-dessus du plafond n'est affichée
    if(!fe.length){clearRoute();const c=capOf(),sh=V.reduce((a,x)=>capVal(x.S,c)<capVal(a.S,c)?x:a);msg.textContent=capMsg(sh.S,c);return}
    V=fe}
  V.sort((a,b)=>LOOPQ?a.cost-b.cost:a.err-b.err);
  const over=V.every(x=>x.S.lvl>M);
  if((M<4||DL)&&!over&&shr<1)note=` Cible réduite à ${dm?km(target0*shr):dur(target0*shr*60)} pour respecter ${M<4&&DL?"la difficulté maximale ("+DIFF[M]+") et la limite de dénivelé":M<4?"la difficulté maximale ("+DIFF[M]+")":"la limite de dénivelé"}. `;
  if(M<4&&over)note=` Aucune boucle « ${DIFF[M]} » ou plus facile trouvée ici : voici la plus facile (${DIFF[Math.min(...V.map(x=>x.S.lvl))]}). `;
  const W=V.map(x=>({S:x.S,R:x.R}));showVars(W,0);
  if(DL&&V.every(x=>!dvOk(x.S)))note+=` Aucune boucle sous la limite de dénivelé (${dvTxt(DL)}) trouvée ici : voici la moins pentue (+${Math.round(Math.min(...V.map(x=>x.S.up)))} m). `;
  if(LOOPQ&&last.met&&last.met.dead>.03)note+=" Une partie du tracé est un aller-retour qui n'atteint aucune forêt : le réseau de chemins autour du départ n'offre pas mieux à cette distance. ";
  const offN=V.filter(x=>x.err>.15&&shr===1).length;
  msg.textContent=note+(VAR?" Optimisé pour : "+VAR.sps.map(x=>x.fr).join(", ")+"."+varReport(last)+" ":"")+(offN?offN+" boucle(s) sur "+V.length+" sont nettement plus courtes que le plafond (réseau limité autour du départ), toutes sous "+capTxt(capOf())+".":V.length+" boucle(s) proposée(s), toutes sous le plafond de "+capTxt(capOf())+".")}
async function compute(){
  cancelRun();const run=RUN;RUNS++;
  try{await computeAny()}catch(e){if(e!==CANCEL)throw e}
  finally{if(RUN===run){BP=null;DV=null}}}
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
  let R,S0=null;const M=+$("it-max").value,tt=$("it-off").checked;
  if(tt){
    $("it-offbox").hidden=false;
    if(!$("it-offok").checked){clearRoute();msg.textContent="Tout-terrain : cochez « Je comprends » ci-dessous, puis touchez Calculer. (Le tracé affiché plus haut, s'il y en avait un, n'était pas en tout-terrain.)";return}}
  const CAP=capOf(),env0=+$("it-env").value;let evUsed=env0;
  for(const ev of CAP&&env0>0?[env0,0]:[env0]){   // plafond strict : si le détour dépasse le plafond, on réessaie sans détour (trajet le plus court)
    evUsed=ev;
    try{outer:for(const k of M<4?[6,40]:[0])for(const lam of dvLim()?DV_LAM:[0]){BP=M<4?techPen(M,k):null;setDV(lam);
      if(tt){R=await AW(routeOff(pts.A,pts.B,ev),run);if(R&&R.error){clearRoute();msg.textContent=R.error;return}}else R=routeGD(A,B,ev);
      if(!R)break outer;S0=summarize(R);if(S0.lvl<=M&&dvOk(S0))break outer}}finally{if(RUN===run){BP=null;DV=null}}
    if(!R||!capOver(S0,CAP))break}
  if(R&&capOver(S0,CAP)){clearRoute();msg.textContent=capMsg(S0,CAP);return}
  if(!R){clearRoute();msg.textContent="Aucun chemin trouvé entre ces deux points sur le réseau (sans route de classe 1 ni autoroute) : ils sont dans deux parties non reliées. Essayez un point voisin.";return}
  if(layer){map.removeLayer(layer);layer=null}
  const S=S0||summarize(R);draw(S,R);show(S);last=S;
  msg.textContent=(CAP&&evUsed!==env0?"Détour retiré pour rester sous le plafond de "+capTxt(CAP)+". ":"")+(VAR?"Optimisé pour : "+VAR.sps.map(x=>x.fr).join(", ")+"."+varReport(S)+" ":"")+(S.lvl>M?"Aucun trajet « "+DIFF[M]+" » ou plus facile trouvé : voici le plus facile ("+DIFF[S.lvl]+", "+S.reason+"). ":"")+dvMsg(S)+(R.noGain?"Pas de détour : aucune zone « moyen » ou mieux à atteindre en plus, trajet le plus court gardé. ":"")+((A.d>30||B.d>30)?"Les marqueurs sont à "+Math.round(Math.max(A.d,B.d))+" m du chemin le plus proche : l'itinéraire part du chemin.":"");
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
  return {seq:legs.flatMap(l=>l.seq),off,pl:legs.flatMap((l,i)=>(l.pl||l.seq.filter(s=>s[1]!==s[2]).map(([e,s0,s1])=>({ll:sub(e,s0,s1),k:GR.cls[e]}))).map(p=>({...p,lg:i})))}}
async function computeWp(){
  const run=RUN,msg=$("it-msg"),loop=isLoop();$("it-vars").innerHTML="";
  if(!pts.A||(!loop&&!pts.B)){msg.textContent=loop?"Choisissez le départ de la boucle (A).":"Choisissez le départ et l'arrivée.";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  if(!await AW(declare(true),run)){msg.textContent="Déclaration non acceptée : l'itinéraire n'est pas calculé.";return}
  msg.textContent="Calcul…";
  try{await AW(loadGraph(),run)}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  {const ve=prepVar();if(ve){msg.textContent=ve;return}}
  const M=+$("it-max").value,tt=$("it-off").checked,env0=+$("it-env").value,CAP=capOf();let envie=env0;
  if(tt){$("it-offbox").hidden=false;if(!$("it-offok").checked){clearRoute();msg.textContent="Tout-terrain : cochez « Je comprends » ci-dessous, puis touchez Calculer.";return}}
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
      const l=tt?await AW(routeOff(P[i],P[i+1],envie),run):routeGD(sn[i],sn[i+1],envie);
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
  msg.textContent=(loop?"Boucle A → "+WP.map((_,i)=>i+1).join(" → ")+" → A, définie par vos points de passage. ":"")+(CAP?"Plafond de "+capTxt(CAP)+" respecté"+(envie!==env0?" (détour retiré)":"")+". ":"")+
    (hard.length?"Point de passage inaccessible sous « "+DIFF[M]+" » : "+hard.map(l=>"l'étape "+l.from+" → "+l.to+" reste « "+DIFF[l.lvl]+" » ("+l.reason+")").join(" ; ")+". Le tracé affiché passe quand même par vos points : choisissez une difficulté plus élevée ou déplacez-les. ":"")+
    (VAR?"Optimisé pour : "+VAR.sps.map(x=>x.fr).join(", ")+"."+varReport(S0)+" ":"")+
    (S0.lvl>M&&!hard.length?"Aucun trajet « "+DIFF[M]+" » ou plus facile trouvé : voici le plus facile ("+DIFF[S0.lvl]+", "+S0.reason+"). ":"")+dvMsg(S0)+
    (WP.length+" point"+(WP.length>1?"s":"")+" de passage."+($("it-wopt").checked&&WP.length>1?" Ordre optimisé.":""))}


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

/* ---------- déclaration de responsabilité (acceptation mémorisée en local) ---------- */
const DECL_KEY="itin-decl-v1";
function declOk(){try{return localStorage.getItem(DECL_KEY)==="1"}catch(e){return false}}
function declare(need){   // retourne une promesse : true si accepté
  return new Promise(res=>{const m=$("it-decl-modal");if(need&&declOk())return res(true);
    m.hidden=false;const done=v=>{m.hidden=true;if(v){try{localStorage.setItem(DECL_KEY,"1")}catch(e){}}res(v)};
    $("it-decl-ok").onclick=()=>done(true);$("it-decl-no").onclick=()=>done(false)})}

/* ---------- interface ---------- */
function banner(t){let b=$("it-banner");if(!t){if(b)b.hidden=true;return}
  if(!b){b=document.createElement("div");b.id="it-banner";b.className="it-banner";b.innerHTML='<span id="it-bt"></span> <button type="button" class="btn" id="it-bx">Annuler</button>';document.body.appendChild(b);$("it-bx").onclick=()=>{arm=null;banner(null)}}
  $("it-bt").textContent=t;b.hidden=false}
function start(t){arm=t;if(typeof openMenu==="function")openMenu(false);banner("Touchez la carte pour placer "+(t==="A"?"le départ (A)":t==="W"?"le point de passage "+(WP.length+1):"l'arrivée (B)"))}
function init(){
  if(typeof map==="undefined"||!map||!$("it-go")){return setTimeout(init,300)}
  map.getContainer().addEventListener("click",e=>{
    if(!arm)return;e.stopPropagation();e.preventDefault();
    const dg=map.dragging&&map.dragging._draggable&&map.dragging._draggable._moved;if(dg)return;
    const ll=map.mouseEventToLatLng(e),t=arm;arm=null;banner(null);if(t==="W")wpAdd(ll);else setPt(t,ll);
    {const d=$("sec-itin");if(d){d.open=true;setTimeout(()=>d.scrollIntoView({behavior:"smooth",block:"nearest"}),50)}}
    if(t==="W"){if(pts.A&&(isLoop()?last:pts.B))compute();else $("it-msg").textContent="Point de passage "+WP.length+" placé."+(pts.A&&(isLoop()||pts.B)?" Touchez Calculer.":" Placez le départ"+(isLoop()?"":" et l'arrivée")+" si ce n'est pas fait.")}
    else if(pts.A&&pts.B)compute();else $("it-msg").textContent=t==="A"?"Départ placé. Choisissez maintenant l'arrivée.":"Arrivée placée. Choisissez maintenant le départ."},true);
  edInit();
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
  $("it-mode").onchange=modeUI;$("it-off").onchange=()=>{$("it-offbox").hidden=!$("it-off").checked};$("it-offbox").hidden=true;
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
  $("it-dv").onchange=()=>dvUp(true);$("it-dvm").oninput=()=>dvUp();$("it-dvm").onchange=()=>dvUp(true);dvUp();
  $("it-max").oninput=()=>{$("it-maxl").textContent=+$("it-max").value>=4?"aucune limite (jusqu'à très difficile)":DIFF[+$("it-max").value]+" ou plus facile"};$("it-max").onchange=()=>{if(pts.A&&(isLoop()||pts.B)&&last)compute()};$("it-max").oninput();
  window.ITIN={get last(){return last},capOf,capOver,prepVar,varList,varReport,get VAR(){return VAR},kml,lv95,geoLink,techPen,edgeTech,durF,routeGD,bonusQ,goodLen,wxOn,wx,wxWarn,declare,loadGraph,snap,route,routeOff,summarize,compute,setPt,wpAdd,get WP(){return WP},loopRoutes,get graph(){return GR},draw,hazards,loopMetrics,setLoopQ:v=>{LOOPQ=v},setOffP:v=>{OFFP=v},setLFW:v=>{LFW=v},setBudget:v=>{BUDGET=v},get runs(){return RUNS},cancelRun};   // pour les tests
}
init();
})();
