/* Itinéraire A→B sur le réseau de chemins précalculé (<région>/graphe.json, voir tools/graphe.py).
   Coût d'une arête = temps de marche (Tobler, dénivelé + / − de l'arête) × facteur de réseau × (1 − bonus de cueillette).
   Classe 5/4 : 1 · sentier balisé : 0,7 · classe 3 (route forestière) : 3,5 · classe 2 (4 m, bord de route) : 6 ·
   classe 1 : jamais, sauf traversée ≤ 30 m (arête virtuelle). Calcul entièrement dans le navigateur. */
(function(){
"use strict";
if(typeof L==="undefined")return;
const $=id=>document.getElementById(id);
const DIFF=["très facile","facile","moyen","difficile","très difficile"],DCOL=["#2e8b57","#7cb342","#e0a800","#e8731f","#c62828"];
const FACT={1:12,2:6,3:3.5,4:1,5:1},TYPE_F={0:1,1:.7,2:.8,3:1},TYPE_T={0:1,1:1,2:1.3,3:1.6};   // facteur de coût (réseau) · multiplicateur de temps (type de sentier)
const R_E=6378137,WGW=[0,.05,.2,.6,1];                                                  // poids du bonus par classe d'affichage (très faible … très élevé)
let GR=null,GRZ=null,loading=null,map0=null,mk={A:null,B:null},pts={A:null,B:null},arm=null,layer=null,last=null;

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
  return {e:g.SE[best],s:g.SS[best],d:Math.sqrt(bd)};
}
function sub(e,s0,s1){   // sous-ligne de l'arête e entre les abscisses s0 et s1 (m), en [lat,lng]
  const g=GR,pl=g.poly[e],c=g.cum[e],n=c.length,flip=s0>s1,A=Math.min(s0,s1),B=Math.max(s0,s1),out=[];
  const at=d=>{let k=0;while(k<n-2&&c[k+1]<d)k++;const t=c[k+1]>c[k]?(d-c[k])/(c[k+1]-c[k]):0;return [pl[2*k+1]+t*(pl[2*k+3]-pl[2*k+1]),pl[2*k]+t*(pl[2*k+2]-pl[2*k])]};
  out.push(at(A));for(let k=1;k<n-1;k++)if(c[k]>A&&c[k]<B)out.push([pl[2*k+1],pl[2*k]]);out.push(at(B));
  return flip?out.reverse():out}

/* ---------- bonus de cueillette (classes affichées) ---------- */
function bonusQ(){
  const g=GR,q=new Float32Array(g.nE),cnt=new Uint16Array(g.nE);
  if(typeof currentClass==="undefined"||!currentClass||typeof meta==="undefined")return q;
  const x0=meta.x0,y1=meta.y1,res=meta.res,cols=meta.cols,rows=meta.rows;
  for(let i=0;i<g.SE.length;i++){const X=g.SM[2*i],Y=g.SM[2*i+1],c=Math.floor((X-x0)/res),r=Math.floor((y1-Y)/res),e=g.SE[i];cnt[e]++;
    if(c>=0&&r>=0&&c<cols&&r<rows){const v=currentClass[r*cols+c];if(v!==255&&v<5)q[e]+=WGW[v]}}
  for(let e=0;e<g.nE;e++)if(cnt[e])q[e]/=cnt[e];
  return q}

/* ---------- plus court chemin (Dijkstra, tas binaire) ---------- */
function route(A,B,envie){
  const g=GR,q=envie>0?bonusQ():null,mult=e=>{const k=g.cls[e],t=g.typ[e];
    let m=k===3?(t?TYPE_F[t]:FACT[3]):k===2?(t?3:FACT[2]):k===1?FACT[1]:TYPE_F[t];   // sentier balisé sur une route forestière : 0,7 ; sur une route de classe 2 : 3
    if(q&&k!==1)m*=1-Math.min(.6,.2*envie*q[e]);return m};
  const cf=new Float32Array(g.nE),cb=new Float32Array(g.nE);
  for(let e=0;e<g.nE;e++){const m=mult(e);cf[e]=g.tf[e]*m+(g.cls[e]===1?120:0);cb[e]=g.tb[e]*m+(g.cls[e]===1?120:0)}
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
  const h=sec/3600,gain=up;
  // niveau « effort » (durée, dénivelé positif) et niveau « technique » (pente, type de chemin, zone difficile d'accès)
  const lt=h<=1?0:h<=2.5?1:h<=4.5?2:h<=7?3:4,lg=gain<=100?0:gain<=300?1:gain<=700?2:gain<=1200?3:4,effort=Math.max(lt,lg);
  const ls=smax<15?0:smax<25?1:smax<32?2:smax<38?3:4;
  let lty=0,why="";
  if(al>=30){lty=4;why="sentier alpin (balisage bleu-blanc) sur "+km(al)}
  else if(bm>=100){lty=3;why="sentier de montagne sur "+km(bm)}
  else if(hd>=100){lty=3;why="zone difficile d'accès (pente ≥ 30° en forêt) sur "+km(hd)}
  else if(un>=150){lty=2;why="sentier non balisé de "+km(un)}
  const tech=Math.max(ls,lty),lvl=Math.max(effort,tech);
  let reason;
  if(tech>=effort&&tech>0){reason=ls>=lty?"pente de "+smax+"° soutenue sur ≈ 100 m":why}
  else reason=lt>=lg?"durée de marche d'environ "+dur(sec):"dénivelé positif de "+Math.round(gain)+" m";
  if(lvl===0)reason="peu de montée, chemins faciles";
  return {len,up,dn,sec,c2,cross,lvl,reason,lines,smax}
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
function clearRoute(all){
  if(layer){map.removeLayer(layer);layer=null}last=null;$("it-res").innerHTML="";
  if(all){["A","B"].forEach(t=>{if(mk[t]){map.removeLayer(mk[t]);mk[t]=null}pts[t]=null});$("it-msg").textContent=""}
}
function draw(S,R){
  if(!map.getPane("itineraire")){const p=map.createPane("itineraire");p.style.zIndex=450}
  layer=L.layerGroup().addTo(map);const g=GR,pl=[];
  for(const [e,s0,s1] of R.seq){if(s0===s1)continue;const k=g.cls[e],ll=sub(e,s0,s1);pl.push({ll,k})}
  pl.forEach(p=>L.polyline(p.ll,{pane:"itineraire",color:"#fff",weight:8,opacity:.9,lineCap:"round",interactive:false}).addTo(layer));
  pl.forEach(p=>L.polyline(p.ll,p.k===1?{pane:"itineraire",color:"#c62828",weight:5,dashArray:"4 6",interactive:false}:p.k===2?{pane:"itineraire",color:"#e8731f",weight:5,dashArray:"10 6",interactive:false}:{pane:"itineraire",color:"#1565c0",weight:5,lineCap:"round",interactive:false}).addTo(layer));
  const all=pl.flatMap(p=>p.ll);if(all.length)map.fitBounds(L.latLngBounds(all),{padding:[40,40],maxZoom:17});
}
function show(S){
  const d=DIFF[S.lvl],c=DCOL[S.lvl],w=[];
  if(S.c2>=20)w.push(`<b>Bord de route : attention à la circulation</b> sur ${km(S.c2)} (tracé orange tireté).`);
  if(S.cross)w.push(`${S.cross} traversée${S.cross>1?"s":""} de route large (tracé rouge pointillé, ≤ 30 m) : traversez avec prudence, aux endroits sûrs.`);
  $("it-res").innerHTML=`<div class="it-card"><div class="it-big">${dur(S.sec)} <span class="it-sub">de marche · ${km(S.len)}</span></div>
   <div class="it-row">Dénivelé : <b>+${Math.round(S.up)} m / −${Math.round(S.dn)} m</b></div>
   <div class="it-row">Difficulté : <span class="pill" style="background:${c};color:#fff">${d}</span> <span class="it-sub">${esc(S.reason)}</span></div>
   ${w.map(x=>`<div class="it-warn">${x}</div>`).join("")}
   <p class="it-note">Durée estimée à ±10 min, sur la base du dénivelé et du type de chemin (pas de l'état réel du sentier : boue, neige). Proposition issue de données : vérifiez chasse, propriétés privées, réserves et conditions sur place, et renoncez à tout passage qui vous semble dangereux.</p></div>`;
}
async function compute(){
  const msg=$("it-msg");msg.textContent="";
  if(!pts.A||!pts.B){msg.textContent="Choisissez le départ et l'arrivée.";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  msg.textContent="Calcul…";let g;
  try{g=await loadGraph()}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  const A=snap(pts.A),B=snap(pts.B);
  if(!A||!B){msg.textContent=(!A?"Le départ":"L'arrivée")+" est à plus de 300 m d'un chemin de cette région (ou hors région) : déplacez le marqueur.";clearRoute();return}
  const R=route(A,B,+$("it-env").value);
  if(!R){clearRoute();msg.textContent="Aucun chemin trouvé entre ces deux points sur le réseau (sans route de classe 1 ni autoroute) : ils sont dans deux parties non reliées. Essayez un point voisin.";return}
  if(layer){map.removeLayer(layer);layer=null}
  const S=summarize(R);draw(S,R);show(S);last=S;
  msg.textContent=(A.d>30||B.d>30)?"Les marqueurs sont à "+Math.round(Math.max(A.d,B.d))+" m du chemin le plus proche : l'itinéraire part du chemin.":"";
}

/* ---------- interface ---------- */
function banner(t){let b=$("it-banner");if(!t){if(b)b.hidden=true;return}
  if(!b){b=document.createElement("div");b.id="it-banner";b.className="it-banner";b.innerHTML='<span id="it-bt"></span> <button type="button" class="btn" id="it-bx">Annuler</button>';document.body.appendChild(b);$("it-bx").onclick=()=>{arm=null;banner(null)}}
  $("it-bt").textContent=t;b.hidden=false}
function start(t){arm=t;if(typeof openMenu==="function")openMenu(false);banner("Touchez la carte pour placer "+(t==="A"?"le départ (A)":"l'arrivée (B)"))}
function init(){
  if(typeof map==="undefined"||!map||!$("it-go")){return setTimeout(init,300)}
  map.getContainer().addEventListener("click",e=>{
    if(!arm)return;e.stopPropagation();e.preventDefault();
    const dg=map.dragging&&map.dragging._draggable&&map.dragging._draggable._moved;if(dg)return;
    const ll=map.mouseEventToLatLng(e),t=arm;arm=null;banner(null);setPt(t,ll);
    if(typeof openMenu==="function")openMenu(true,"menu-it");
    if(pts.A&&pts.B)compute();else $("it-msg").textContent=t==="A"?"Départ placé. Choisissez maintenant l'arrivée.":"Arrivée placée. Choisissez maintenant le départ."},true);
  $("it-a").onclick=()=>start("A");$("it-b").onclick=()=>start("B");
  $("it-loc").onclick=()=>{
    const use=ll=>{setPt("A",L.latLng(ll[0],ll[1]));if(pts.B)compute();else $("it-msg").textContent="Départ = ma position. Choisissez l'arrivée."};
    if(typeof LOC!=="undefined"&&LOC.ll){use(LOC.ll);return}
    if(!navigator.geolocation){$("it-msg").textContent="Position GPS indisponible ici : choisissez le départ sur la carte.";return}
    navigator.geolocation.getCurrentPosition(p=>use([p.coords.latitude,p.coords.longitude]),()=>{$("it-msg").textContent="Position refusée ou introuvable : choisissez le départ sur la carte."},{enableHighAccuracy:true,timeout:15000})};
  $("it-go").onclick=compute;$("it-clr").onclick=()=>clearRoute(true);$("it-swap").onclick=()=>{if(!pts.A||!pts.B)return;const a=pts.A,b=pts.B;setPt("A",b);setPt("B",a);compute()};
  $("it-env").oninput=()=>{$("it-envl").textContent=["plus court","léger détour","détour","grand détour"][+$("it-env").value];if(pts.A&&pts.B&&last)compute()};
  $("it-env").oninput();
  window.ITIN={loadGraph,snap,route,summarize,compute,setPt,get graph(){return GR}};   // pour les tests
}
init();
})();
