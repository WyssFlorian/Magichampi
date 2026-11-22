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
  return {e:g.SE[best],s:g.SS[best],d:Math.sqrt(bd),k:best};
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
function costs(envie,pen,qq){
  const g=GR,q=qq||(envie>0?bonusQ():null),mult=e=>{const k=g.cls[e],t=g.typ[e];
    let m=k===3?(t?TYPE_F[t]:FACT[3]):k===2?(t?3:FACT[2]):k===1?FACT[1]:TYPE_F[t];   // sentier balisé sur une route forestière : 0,7 ; sur une route de classe 2 : 3
    if(q&&k!==1)m*=1-Math.min(.6,.2*envie*q[e]);return m};
  const cf=new Float32Array(g.nE),cb=new Float32Array(g.nE);
  for(let e=0;e<g.nE;e++){const m=mult(e)*(pen?pen[e]:1);cf[e]=g.tf[e]*m+(g.cls[e]===1?120:0);cb[e]=g.tb[e]*m+(g.cls[e]===1?120:0)}
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
function loopOnce(A,ax,ay,th,r,envie,q,nq,cand){
  const g=GR,pickW=ang=>{   // meilleurs noeuds près de (r, ang)
    const tx=ax+r*Math.cos(ang),ty=ay+r*Math.sin(ang),L=[];
    for(const u of cand){const dx=(g.lon[u]-g.lon0)*g.kx-tx,dy=(g.lat[u]-g.lat0)*g.ky-ty,d=Math.hypot(dx,dy);if(d<r*.3)L.push([d/r-.6*nq[u],u])}
    return L.sort((a,b)=>a[0]-b[0]).slice(0,4).map(x=>x[1])};
  const C1=pickW(th),C2=pickW(th+Math.PI/3);
  for(const w1 of C1)for(const w2 of C2){if(w1===w2)continue;
    const pen=new Float32Array(g.nE).fill(1),seq=[];let ok=true,P=A;
    for(const w of [nodeSnap(w1),nodeSnap(w2),A]){
      const R=route(P,w,envie,pen,q);if(!R){ok=false;break}
      seq.push(...R.seq);for(const [e] of R.seq)pen[e]=6;P=w}
    if(ok)return {seq}}
  return null}
async function loopRoutes(A,pt,metric,target,envie){
  const g=GR,q=envie>0?bonusQ():null,nq=new Float32Array(g.nN),cand=[];
  if(q)for(let e=0;e<g.nE;e++){nq[g.a[e]]=Math.max(nq[g.a[e]],q[e]);nq[g.b[e]]=Math.max(nq[g.b[e]],q[e])}
  for(let u=0;u<g.nN;u++){for(let k=g.deg[u];k<g.deg[u+1];k++){const e=g.adj[k]>>1;if(g.cls[e]>=3){cand.push(u);break}}}
  const ax=(pt.lng-g.lon0)*g.kx,ay=(pt.lat-g.lat0)*g.ky,out=[];
  // secteurs : 12 directions, score = somme des meilleurs noeuds des deux fenêtres ; on garde 3 directions écartées d'au moins 90°
  const sc=[];for(let i=0;i<12;i++){const th=i*Math.PI/6;let v=0;for(const u of cand){const x=(g.lon[u]-g.lon0)*g.kx-ax,y=(g.lat[u]-g.lat0)*g.ky-ay,an=Math.atan2(y,x),d=Math.hypot(x,y);
      const da=Math.abs(((an-th-Math.PI/6+3*Math.PI)%(2*Math.PI))-Math.PI);if(da<Math.PI/4&&d>500&&d<8000)v+=nq[u]}sc.push([v,th])}
  sc.sort((a,b)=>b[0]-a[0]);const ths=[];for(const [,t] of sc){if(ths.every(u=>{const d=Math.abs(((t-u+3*Math.PI)%(2*Math.PI))-Math.PI);return d>=Math.PI/2}))ths.push(t);if(ths.length===3)break}
  while(ths.length<3)ths.push(ths.length*2*Math.PI/3);
  for(const th of ths){
    let r=Math.min(8000,metric==="len"?target/4:target/3600*4000/4),best=null;
    for(let it=0;it<9;it++){
      const R=loopOnce(A,ax,ay,th,r,envie,q,nq,cand);if(!R)break;
      const S=summarize(R),M=metric==="len"?S.len:S.sec,err=Math.abs(M-target)/target;
      if(!best||err<best.err)best={R,S,err};
      if(err<=.1)break;r=Math.min(8000,Math.max(300,r*Math.pow(target/M,it<4?.9:.6)*(1+(it>=4?(Math.random()-.5)*.15:0))))}
    if(best)out.push(best);
    await new Promise(r=>setTimeout(r,0))}
  const ok=out.filter(x=>x.err<=.35);return ok.length?ok:out}
function gpx(){
  if(!last||!last.ll)return;
  const t=new Date().toISOString(),pts_=last.ll.map(p=>`<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}"/>`).join("");
  const x=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Magichampi" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Itinéraire Magichampi</name><time>${t}</time></metadata><trk><name>Itinéraire Magichampi (proposition, sans garantie de sécurité)</name><trkseg>${pts_}</trkseg></trk></gpx>`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([x],{type:"application/gpx+xml"}));a.download="itineraire-magichampi.gpx";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}


/* ---------- tout-terrain (bêta) ---------- */
// Dijkstra sur la grille de 25 m (cellules d'environ 17 m de côté au sol) reliée au réseau de chemins : les chemins sont des arcs de cellule à cellule
// (coût du graphe), la forêt peut être traversée hors chemin (Tobler ×1,6) seulement près d'une zone « élevé » ou mieux, et jamais dans les cellules à
// pente ≥ 30° (25-30° ×3 plus lent), cours d'eau (tampon d'une cellule), marais, réserves et zones exclues (usable).
const OFFX=1.6,OFF_SLOPE=30,OFF_NEAR=100;let HZ=null,HZkey="";
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
async function routeOff(pA,pB,envie){
  const g=GR,W=meta.cols,H=meta.rows,res=meta.res,gs=res*Math.cos(pA.lat*Math.PI/180);
  if(typeof currentClass==="undefined"||!currentClass)return {error:"La carte n'affiche aucune zone : choisissez une espèce ou la forte concentration."};
  const cOf=(lat,lng)=>{const q=merc(lat,lng);return [Math.floor((q[0]-meta.x0)/res),Math.floor((meta.y1-q[1])/res)]},a=cOf(pA.lat,pA.lng),b=cOf(pB.lat,pB.lng);
  const ok=c=>c[0]>=0&&c[1]>=0&&c[0]<W&&c[1]<H;
  if(!ok(a)||!ok(b))return {error:"Départ ou arrivée hors de la zone chargée : centrez la carte sur le trajet puis recommencez."};
  const mg=Math.round(1500/gs),c0=Math.max(0,Math.min(a[0],b[0])-mg),c1=Math.min(W,Math.max(a[0],b[0])+mg+1),r0=Math.max(0,Math.min(a[1],b[1])-mg),r1=Math.min(H,Math.max(a[1],b[1])+mg+1),ww=c1-c0,hh=r1-r0,N=ww*hh;
  if(N>450000)return {error:"Tout-terrain limité à environ 10 km entre le départ et l'arrivée."};
  const hz=await hazards(),al=new Uint8Array(N),high=new Uint8Array(N);
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const gi=(r0+y)*W+c0+x,li=y*ww+x;if(currentClass[gi]!==255&&currentClass[gi]>=3)high[li]=1}
  const near=dilate(high,ww,hh,Math.ceil(OFF_NEAR/gs)*1);
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){const gi=(r0+y)*W+c0+x,li=y*ww+x;
    al[li]=near[li]&&usable(gi)&&G.fx[gi]>0&&G.slope[gi]<OFF_SLOPE&&!hz.water[gi]&&!hz.marsh[gi]?1:0}
  // arcs de chemin (échantillons consécutifs d'une même arête), dans la fenêtre
  const {cf,cb}=costs(envie,null,envie>0?bonusQ():null),cnt=new Int32Array(N+1),arcs=[];
  const lc=k=>{const X=g.SM[2*k],Y=g.SM[2*k+1],c=Math.floor((X-meta.x0)/res)-c0,r=Math.floor((meta.y1-Y)/res)-r0;return c>=0&&r>=0&&c<ww&&r<hh?r*ww+c:-1};
  for(let k=0;k+1<g.SE.length;k++){if(g.SE[k]!==g.SE[k+1])continue;const u=lc(k),v=lc(k+1);if(u<0||v<0||u===v)continue;const e=g.SE[k],f=(g.SS[k+1]-g.SS[k])/Math.max(g.len[e],1);
    arcs.push([u,v,cf[e]*f,k*2],[v,u,cb[e]*f,k*2+1]);cnt[u+1]++;cnt[v+1]++}
  for(let i=0;i<N;i++)cnt[i+1]+=cnt[i];const fill=cnt.slice(),aTo=new Int32Array(arcs.length),aC=new Float32Array(arcs.length),aId=new Int32Array(arcs.length);
  for(const [u,v,c,id] of arcs){const q=fill[u]++;aTo[q]=v;aC[q]=c;aId[q]=id}
  const onPath=i=>cnt[i+1]>cnt[i];
  // départ / arrivée : la cellule touchée si elle est utilisable, sinon le point de chemin le plus proche
  const pick=(p,c)=>{const li=(c[1]-r0)*ww+(c[0]-c0);if(al[li]||onPath(li))return li;const s=snap(L.latLng(p.lat,p.lng));if(!s)return -1;return lc(s.k)};
  const S0=pick(pA,a),T0=pick(pB,b);if(S0<0||T0<0)return {error:"Le départ ou l'arrivée est à plus de 300 m d'un chemin et hors zone utilisable."};
  // tas binaire typé
  let cap=1<<20,hk=new Float64Array(cap),hv=new Int32Array(cap),hn=0;
  const hpush=(k,v)=>{if(hn===cap){cap*=2;const a1=new Float64Array(cap),b1=new Int32Array(cap);a1.set(hk);b1.set(hv);hk=a1;hv=b1}let i=hn++;while(i>0){const p=(i-1)>>1;if(hk[p]<=k)break;hk[i]=hk[p];hv[i]=hv[p];i=p}hk[i]=k;hv[i]=v};
  const hpop=()=>{const v=hv[0],k0=hk[0],k=hk[--hn],w=hv[hn];let i=0;for(;;){let c=2*i+1;if(c>=hn)break;if(c+1<hn&&hk[c+1]<hk[c])c++;if(hk[c]>=k)break;hk[i]=hk[c];hv[i]=hv[c];i=c}hk[i]=k;hv[i]=w;popK=k0;return v};let popK=0;
  const dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),via=new Int32Array(N).fill(-1),dm=G.dem,sl=G.slope;
  dist[S0]=0;hpush(0,S0);
  const tob=(L_,g_)=>L_/(6000/3600*Math.exp(-3.5*Math.abs(g_+.05)));
  while(hn){const u=hpop(),d=popK;if(d>dist[u])continue;if(u===T0)break;
    for(let k=cnt[u];k<cnt[u+1];k++){const v=aTo[k],w=d+aC[k];if(w<dist[v]){dist[v]=w;prev[v]=u;via[v]=aId[k];hpush(w,v)}}
    const ux=u%ww,uy=(u/ww)|0,ug=(r0+uy)*W+c0+ux;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const x=ux+dx,y=uy+dy;if(x<0||y<0||x>=ww||y>=hh)continue;const v=y*ww+x;
      if(!al[v]&&!(onPath(v)&&(al[u]||onPath(u))))continue;
      if(!al[v]&&onPath(v)&&!onPath(u)&&!al[u])continue;
      const vg=(r0+y)*W+c0+x,L_=gs*(dx&&dy?1.4142:1),slp=(dm[vg]-dm[ug])/L_;
      let t=tob(L_,slp)*OFFX*(sl[vg]>=25?3:1);const cw=currentClass[vg];if(envie>0&&cw!==255&&cw<5)t*=1-Math.min(.6,.2*envie*WGW[cw]);
      const w=d+t;if(w<dist[v]){dist[v]=w;prev[v]=u;via[v]=-1;hpush(w,v)}}}
  if(!isFinite(dist[T0]))return {error:"Aucun passage trouvé en tout-terrain : essayez sans cette option ou changez de point."};
  // reconstruction
  const cells=[];for(let v=T0;v!==S0;v=prev[v])cells.push(v);cells.push(S0);cells.reverse();
  const ll=li=>{const x=c0+(li%ww)+.5,y=r0+((li/ww)|0)+.5,X=meta.x0+x*res,Y=meta.y1-y*res;return [(2*Math.atan(Math.exp(Y/R_E))-Math.PI/2)*180/Math.PI,X/R_E*180/Math.PI]};
  const seq=[],pl=[],off={len:0,up:0,dn:0,sec:0};let cur=null;
  const flush=()=>{if(cur&&cur.ll.length>1)pl.push(cur);cur=null};
  for(let i=1;i<cells.length;i++){const v=cells[i],u=cells[i-1],id=via[v];
    if(id>=0){const k=id>>1,fw=!(id&1),kk=fw?k:k+1,k2=fw?k+1:k,e=g.SE[k];
      const P=[g.lat0+g.SY[kk]/g.ky,g.lon0+g.SX[kk]/g.kx],Q=[g.lat0+g.SY[k2]/g.ky,g.lon0+g.SX[k2]/g.kx],kind=g.cls[e];
      if(!cur||cur.k!==kind){flush();cur={k:kind,ll:[P]}}cur.ll.push(Q);
      const last=seq[seq.length-1];if(last&&last[0]===e&&last[2]===g.SS[kk])last[2]=g.SS[k2];else seq.push([e,g.SS[kk],g.SS[k2]])}
    else{if(!cur||cur.k!=="o"){flush();cur={k:"o",ll:[ll(u)]}}cur.ll.push(ll(v));
      const ug=(r0+((u/ww)|0))*W+c0+(u%ww),vg=(r0+((v/ww)|0))*W+c0+(v%ww),dx=(v%ww)-(u%ww),dy=((v/ww)|0)-((u/ww)|0),L_=gs*(dx&&dy?1.4142:1),dz=dm[vg]-dm[ug];
      off.len+=L_;if(dz>0)off.up+=dz;else off.dn-=dz;off.sec+=tob(L_,dz/L_)*OFFX*(sl[vg]>=25?3:1)}}
  flush();
  return {seq,off,pl,cost:dist[T0]}}

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
  const OF=R.off||{len:0,up:0,dn:0,sec:0};len+=OF.len;up+=OF.up;dn+=OF.dn;sec+=OF.sec;
  const h=sec/3600,gain=up;
  // niveau « effort » (durée, dénivelé positif) et niveau « technique » (pente, type de chemin, zone difficile d'accès)
  const lt=h<=1?0:h<=2.5?1:h<=4.5?2:h<=7?3:4,lg=gain<=100?0:gain<=300?1:gain<=700?2:gain<=1200?3:4,effort=Math.max(lt,lg);
  const ls=smax<15?0:smax<25?1:smax<32?2:smax<38?3:4;
  let lty=0,why="";
  if(al>=30){lty=4;why="sentier alpin (balisage bleu-blanc) sur "+km(al)}
  else if(bm>=100){lty=3;why="sentier de montagne sur "+km(bm)}
  else if(hd>=100){lty=3;why="zone difficile d'accès (pente ≥ 30° en forêt) sur "+km(hd)}
  else if(un>=150){lty=2;why="sentier non balisé de "+km(un)}
  if(OF.len>=20){lty=Math.max(lty,3);why="tout-terrain : "+km(OF.len)+" hors chemin"}
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
  if(layer){map.removeLayer(layer);layer=null}last=null;$("it-res").innerHTML="";
  if(all){["A","B"].forEach(t=>{if(mk[t]){map.removeLayer(mk[t]);mk[t]=null}pts[t]=null});$("it-msg").textContent=""}
}
function draw(S,R){
  if(!map.getPane("itineraire")){const p=map.createPane("itineraire");p.style.zIndex=450}
  layer=L.layerGroup().addTo(map);const g=GR,pl=[];
  if(R.pl)R.pl.forEach(p=>pl.push(p));else for(const [e,s0,s1] of R.seq){if(s0===s1)continue;const k=g.cls[e],ll=sub(e,s0,s1);pl.push({ll,k})}
  pl.forEach(p=>L.polyline(p.ll,{pane:"itineraire",color:"#fff",weight:8,opacity:.9,lineCap:"round",interactive:false}).addTo(layer));
  pl.forEach(p=>L.polyline(p.ll,p.k==="o"?{pane:"itineraire",color:"#6a1b9a",weight:5,dashArray:"2 7",lineCap:"round",interactive:false}:p.k===1?{pane:"itineraire",color:"#c62828",weight:5,dashArray:"4 6",interactive:false}:p.k===2?{pane:"itineraire",color:"#e8731f",weight:5,dashArray:"10 6",interactive:false}:{pane:"itineraire",color:"#1565c0",weight:5,lineCap:"round",interactive:false}).addTo(layer));
  const all=pl.flatMap(p=>p.ll);S.ll=all;if(all.length)map.fitBounds(L.latLngBounds(all),{padding:[40,40],maxZoom:17});
}
function show(S){
  const d=DIFF[S.lvl],c=DCOL[S.lvl],w=[];
  if(S.c2>=20)w.push(`<b>Bord de route : attention à la circulation</b> sur ${km(S.c2)} (tracé orange tireté).`);
  if(S.off>=20)w.push(`<b>Tout-terrain (bêta)</b> : ${km(S.off)} hors chemin (tracé violet pointillé), en forêt près d'une zone favorable. Pas de balisage, terrain, ruisseaux non cartographiés et fossés possibles : vous êtes seul responsable du passage ; renoncez si le terrain vous semble dangereux.`);
  if(S.cross)w.push(`${S.cross} traversée${S.cross>1?"s":""} de route large (tracé rouge pointillé, ≤ 30 m) : traversez avec prudence, aux endroits sûrs.`);
  $("it-res").innerHTML=`<div class="it-card"><div class="it-big">${dur(S.sec)} <span class="it-sub">de marche · ${km(S.len)}</span></div>
   <div class="it-row">Dénivelé : <b>+${Math.round(S.up)} m / −${Math.round(S.dn)} m</b></div>
   <div class="it-row">Difficulté : <span class="pill" style="background:${c};color:#fff">${d}</span> <span class="it-sub">${esc(S.reason)}</span></div>
   ${w.map(x=>`<div class="it-warn">${x}</div>`).join("")}
   <div class="it-btns"><button type="button" class="btn" id="it-gpx">Exporter en GPX</button></div>
   <p class="it-note">Durée estimée à ±10 min, sur la base du dénivelé et du type de chemin (pas de l'état réel du sentier : boue, neige). Proposition issue de données : vérifiez chasse, propriétés privées, réserves et conditions sur place, et renoncez à tout passage qui vous semble dangereux.</p></div>`;
  $("it-gpx").onclick=gpx}
const isLoop=()=>$("it-mode").value==="loop";
function showVars(V,k){
  if(layer){map.removeLayer(layer);layer=null}
  const v=V[k];draw(v.S,v.R);show(v.S);last=v.S;
  $("it-vars").innerHTML=V.map((x,i)=>`<button type="button" class="btn${i===k?" primary":""}" data-k="${i}">Boucle ${i+1} · ${km(x.S.len)} · ${dur(x.S.sec)} · ${DIFF[x.S.lvl]}</button>`).join("");
  $("it-vars").querySelectorAll("button").forEach(b=>b.onclick=()=>showVars(V,+b.dataset.k))}
async function computeLoop(){
  const msg=$("it-msg");$("it-vars").innerHTML="";
  if(!pts.A){msg.textContent="Choisissez le départ de la boucle (A).";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  msg.textContent="Calcul des boucles…";
  try{await loadGraph()}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  const A=snap(pts.A);if(!A){msg.textContent="Le départ est à plus de 300 m d'un chemin de cette région : déplacez le marqueur.";clearRoute();return}
  const dm=$("it-lm").value==="len",v=+$("it-lt").value,target=dm?v*1000:v*60;
  const V=await loopRoutes(A,pts.A,dm?"len":"sec",target,+$("it-env").value);
  if(!V.length){clearRoute();msg.textContent="Aucune boucle trouvée depuis ce départ : le réseau y est trop morcelé ou trop court. Essayez un autre point de départ.";return}
  V.sort((a,b)=>a.err-b.err);V.forEach(x=>x.S=x.S);
  const W=V.map(x=>({S:x.S,R:x.R}));showVars(W,0);
  const off=V.filter(x=>x.err>.1).length;
  msg.textContent=off?off+" boucle(s) sur "+V.length+" s'écartent de plus de 10 % de la cible (réseau limité autour du départ).":V.length+" boucle(s) proposée(s), à ±10 % de la cible."}
async function compute(){
  if(isLoop()){clearRouteKeep();return computeLoop()}
  $("it-vars").innerHTML="";
  const msg=$("it-msg");msg.textContent="";
  if(!pts.A||!pts.B){msg.textContent="Choisissez le départ et l'arrivée.";return}
  if(typeof OV!=="undefined"&&OV){msg.textContent="Zoomez sur une région (zoom 12 ou plus) : le réseau de chemins n'existe pas pour la vue d'ensemble du canton.";return}
  msg.textContent="Calcul…";let g;
  try{g=await loadGraph()}catch(e){msg.textContent="Réseau de chemins indisponible : "+e.message;return}
  const A=snap(pts.A),B=snap(pts.B);
  if(!A||!B){msg.textContent=(!A?"Le départ":"L'arrivée")+" est à plus de 300 m d'un chemin de cette région (ou hors région) : déplacez le marqueur.";clearRoute();return}
  let R;
  if($("it-off").checked&&!isLoop()){
    if(!$("it-offok").checked){msg.textContent="Cochez « Je comprends » pour utiliser le tout-terrain.";return}
    R=await routeOff(pts.A,pts.B,+$("it-env").value);if(R&&R.error){msg.textContent=R.error;return}
  }else R=route(A,B,+$("it-env").value);
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
  const modeUI=()=>{const l=isLoop();$("it-b").hidden=l;$("it-swap").hidden=l;$("it-loopbox").hidden=!l;$("it-offrow").hidden=l;$("it-a").textContent=l?"Départ de la boucle":"Départ (A)";
    if(l&&mk.B){map.removeLayer(mk.B);mk.B=null;pts.B=null}clearRouteKeep();$("it-vars").innerHTML=""};
  $("it-mode").onchange=modeUI;$("it-off").onchange=()=>{$("it-offbox").hidden=!$("it-off").checked};$("it-offbox").hidden=true;
  const lmUI=()=>{const d=$("it-lm").value==="len",r=$("it-lt");r.min=d?2:30;r.max=d?20:360;r.step=d?1:15;r.value=d?8:120;r.oninput()};
  $("it-lm").onchange=lmUI;$("it-lt").oninput=()=>{const d=$("it-lm").value==="len",v=+$("it-lt").value;$("it-ltl").textContent=d?v+" km":dur(v*60)};
  lmUI();modeUI();
  $("it-go").onclick=compute;$("it-clr").onclick=()=>clearRoute(true);$("it-swap").onclick=()=>{if(!pts.A||!pts.B)return;const a=pts.A,b=pts.B;setPt("A",b);setPt("B",a);compute()};
  $("it-env").oninput=()=>{$("it-envl").textContent=["plus court","léger détour","détour","grand détour"][+$("it-env").value];if(pts.A&&pts.B&&last)compute()};
  $("it-env").oninput();
  window.ITIN={loadGraph,snap,route,routeOff,summarize,compute,setPt,loopRoutes,get graph(){return GR}};   // pour les tests
}
init();
})();
