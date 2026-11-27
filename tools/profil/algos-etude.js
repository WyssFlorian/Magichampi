// Étude des algorithmes de tracé (docs/etude-algorithmes-itineraires.md) : banc d'essai hors navigateur sur <région>/graphe.json.
// usage : node tools/profil/algos-etude.js ple gdv
// Coût d'arête = modèle de itineraire.js sans grille de classes (temps de Tobler × facteur de réseau × pénalité hors forêt, traversée de classe 1 +120 s).
// E1 plus court chemin : Dijkstra (référence, comme route()) · A* (distance à vol d'oiseau) · Dijkstra bidirectionnel · ALT (A* + 8 repères)
// E2 limite de dénivelé positif : échelle actuelle (λ = 0, 10, 40, 160, 640) · LARAC (λ ajusté) · étiquettes exactes (dominance coût / D+, bornes)
// E3 matrice de distances pour une boucle de type « orienteering » : K Dijkstra bornés depuis les meilleurs points candidats
"use strict";
const path=require("path"),ROOT=path.resolve(__dirname,"../..");
const ZS=process.argv.slice(2).length?process.argv.slice(2):["ple"];
let seed=12345;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const now=()=>Number(process.hrtime.bigint())/1e6;

function load(z){
  const j=require(path.join(ROOT,z,"graphe.json")),nN=j.N.length/2,nE=j.E.length/10,o=j.o;
  const lon=new Float64Array(nN),lat=new Float64Array(nN);for(let i=0;i<nN;i++){lon[i]=(j.N[2*i]+o[0])/1e5;lat[i]=(j.N[2*i+1]+o[1])/1e5}
  const la0=lat.reduce((a,b)=>a+b,0)/nN,kx=Math.cos(la0*Math.PI/180)*111320,ky=110574,X=new Float64Array(nN),Y=new Float64Array(nN);
  for(let i=0;i<nN;i++){X[i]=(lon[i]-lon[0])*kx;Y[i]=(lat[i]-lat[0])*ky}
  const a=new Int32Array(nE),b=new Int32Array(nE),cls=new Uint8Array(nE),typ=new Uint8Array(nE),len=new Float32Array(nE),up=new Float32Array(nE),dn=new Float32Array(nE),fo=new Uint8Array(nE);
  for(let e=0;e<nE;e++){const q=e*10,E=j.E;a[e]=E[q];b[e]=E[q+1];cls[e]=E[q+2];typ[e]=E[q+3];len[e]=E[q+4];up[e]=E[q+5];dn[e]=E[q+6];fo[e]=E[q+9]}
  const deg=new Int32Array(nN+1);for(let e=0;e<nE;e++){deg[a[e]+1]++;deg[b[e]+1]++}for(let i=0;i<nN;i++)deg[i+1]+=deg[i];
  const fill=deg.slice(),adj=new Int32Array(2*nE);for(let e=0;e<nE;e++){adj[fill[a[e]]++]=e*2;adj[fill[b[e]]++]=e*2+1}
  const tob=(L,g)=>L/(6000/3600*Math.exp(-3.5*Math.abs(g+.05))),TT={0:1,1:1,2:1.3,3:1.6},FACT={1:12,2:3.5,3:1.6,4:1,5:1},TF={0:1,1:.7,2:.8,3:1};
  const cf=new Float64Array(nE),cb=new Float64Array(nE);
  for(let e=0;e<nE;e++){const L=Math.max(len[e],1),u=up[e],d=dn[e],t=u+d,gr=t>0?t/L:0,Lu=t>0?L*u/t:L/2,Ld=L-Lu,m=TT[typ[e]];
    let tf,tb;if(cls[e]===1){tf=tb=L/1.4}else{tf=m*(t>0?tob(Lu,gr)+tob(Ld,-gr):tob(L,0));tb=m*(t>0?tob(Ld,gr)+tob(Lu,-gr):tob(L,0))}
    const k=cls[e],ty=typ[e];let mu=k===3?(ty?TF[ty]:FACT[3]):k===2?(ty?2:FACT[2]):k===1?FACT[1]:TF[ty];if(k!==1)mu*=1+4*(1-fo[e]/100);
    const x=k===1?120:0;cf[e]=tf*mu+x;cb[e]=tb*mu+x}
  // composante principale (les requêtes y sont tirées)
  const comp=new Int32Array(nN).fill(-1);let best=-1,bs=0;
  for(let s=0;s<nN;s++){if(comp[s]>=0)continue;const st=[s];comp[s]=s;let n=0;while(st.length){const u=st.pop();n++;for(let k=deg[u];k<deg[u+1];k++){const c=adj[k],e=c>>1,v=(c&1)?a[e]:b[e];if(comp[v]<0){comp[v]=s;st.push(v)}}}if(n>bs){bs=n;best=s}}
  const main=[];for(let i=0;i<nN;i++)if(comp[i]===best)main.push(i);
  return {z,nN,nE,X,Y,a,b,len,up,dn,cls,deg,adj,cf,cb,main};
}
// tas binaire
class Heap{constructor(){this.k=new Float64Array(1<<16);this.v=new Int32Array(1<<16);this.n=0}
  push(k,v){if(this.n===this.k.length){const a=new Float64Array(this.n*2),b=new Int32Array(this.n*2);a.set(this.k);b.set(this.v);this.k=a;this.v=b}let i=this.n++;const K=this.k,V=this.v;while(i>0){const p=(i-1)>>1;if(K[p]<=k)break;K[i]=K[p];V[i]=V[p];i=p}K[i]=k;V[i]=v}
  pop(){const K=this.k,V=this.v,v=V[0];this.top=K[0];const k=K[--this.n],w=V[this.n];let i=0;for(;;){let c=2*i+1;if(c>=this.n)break;if(c+1<this.n&&K[c+1]<K[c])c++;if(K[c]>=k)break;K[i]=K[c];V[i]=V[c];i=c}K[i]=k;V[i]=w;return v}}
const H=new Heap();
// coût d'un pas (arête c = e*2 + sens) : w(c) ; rev : graphe inversé (pour les recherches arrière)
function sp(g,s,t,W,h,opt){   // A* générique (h = 0 : Dijkstra) ; retourne {d, pops, prev}
  opt=opt||{};const d=opt.d||new Float64Array(g.nN),prev=opt.prev||new Int32Array(g.nN);d.fill(Infinity);prev.fill(-1);H.n=0;d[s]=0;H.push(h?h(s):0,s);let pops=0;
  while(H.n){const u=H.pop(),f=H.top,du=d[u];if(f>du+(h?h(u):0)+1e-9)continue;pops++;if(u===t)break;if(opt.maxD&&du>opt.maxD)break;
    for(let k=g.deg[u];k<g.deg[u+1];k++){const c=g.adj[k],e=c>>1,fw=!(c&1),v=fw?g.b[e]:g.a[e],w=du+W(c);if(w<d[v]){d[v]=w;prev[v]=c;H.push(w+(h?h(v):0),v)}}}
  return {d,pops,prev}}
const Wc=g=>c=>(c&1)?g.cb[c>>1]:g.cf[c>>1];         // coût, sens de la marche
const WcR=g=>c=>(c&1)?g.cf[c>>1]:g.cb[c>>1];        // coût, sens inverse (recherche depuis l'arrivée)
const Wu=g=>c=>(c&1)?g.dn[c>>1]:g.up[c>>1];         // dénivelé positif, sens de la marche
const WuR=g=>c=>(c&1)?g.up[c>>1]:g.dn[c>>1];
function pathOf(g,prev,t){const P=[];for(let v=t;prev[v]>=0;){const c=prev[v];P.push(c);const e=c>>1;v=(c&1)?g.b[e]:g.a[e]}return P.reverse()}
const sumW=(P,W)=>P.reduce((x,c)=>x+W(c),0);
function bidir(g,s,t,W,WR){   // Dijkstra bidirectionnel
  const df=new Float64Array(g.nN).fill(Infinity),db=new Float64Array(g.nN).fill(Infinity),Hf=new Heap(),Hb=new Heap(),sf=new Uint8Array(g.nN),sb=new Uint8Array(g.nN);
  df[s]=0;db[t]=0;Hf.push(0,s);Hb.push(0,t);let mu=Infinity,pops=0;
  while(Hf.n&&Hb.n){if(Hf.k[0]+Hb.k[0]>=mu)break;const fwd=Hf.k[0]<=Hb.k[0],Hh=fwd?Hf:Hb,D=fwd?df:db,O=fwd?db:df,S=fwd?sf:sb,Wx=fwd?W:WR;
    const u=Hh.pop();if(S[u])continue;S[u]=1;pops++;
    for(let k=g.deg[u];k<g.deg[u+1];k++){const c=g.adj[k],e=c>>1,v=(c&1)?g.a[e]:g.b[e],w=D[u]+Wx(c);if(w<D[v]){D[v]=w;Hh.push(w,v)}if(D[v]+O[v]<mu)mu=D[v]+O[v]}}
  return {cost:mu,pops}}
function landmarks(g,K){   // repères les plus éloignés (distance de coût), distances aller et retour
  const L=[],DF=[],DB=[];let s=g.main[0];const mind=new Float64Array(g.nN).fill(Infinity);
  for(let i=0;i<K;i++){const f=sp(g,s,-1,Wc(g)).d.slice(),r=sp(g,s,-1,WcR(g)).d.slice();L.push(s);DF.push(f);DB.push(r);
    let bv=-1,bi=s;for(const u of g.main){const m=Math.min(mind[u],f[u]);mind[u]=m;if(isFinite(m)&&m>bv){bv=m;bi=u}}s=bi}
  return {L,DF,DB}}
function altH(LM,t){   // borne inférieure de dist(v,t) par l'inégalité triangulaire
  const K=LM.L.length,ft=LM.DF.map(D=>D[t]),bt=LM.DB.map(D=>D[t]);
  return v=>{let h=0;for(let i=0;i<K;i++){const a=ft[i]-LM.DF[i][v],b=LM.DB[i][v]-bt[i];if(a>h)h=a;if(b>h)h=b}return h}}

function pairs(g,n,dmin,dmax){const out=[];for(let q=0;q<200000&&out.length<n;q++){const i=g.main[Math.floor(rnd()*g.main.length)],j=g.main[Math.floor(rnd()*g.main.length)],d=Math.hypot(g.X[i]-g.X[j],g.Y[i]-g.Y[j]);if(d>=dmin&&d<=dmax)out.push([i,j,d])}return out}
const med=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:NaN},p90=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(.9*a.length))]:NaN};
const r1=x=>Math.round(x*10)/10;

function E1(g){
  const P=pairs(g,150,1500,6000);let cmin=Infinity;for(let e=0;e<g.nE;e++){const L=Math.max(g.len[e],1);cmin=Math.min(cmin,g.cf[e]/L,g.cb[e]/L)}
  const t0=now(),LM=landmarks(g,8),tLM=now()-t0;
  const R={dij:[],ast:[],bid:[],alt:[]},T={dij:0,ast:0,bid:0,alt:0};let bad=0;
  for(const [s,t] of P){
    let a=now();const D=sp(g,s,t,Wc(g));T.dij+=now()-a;R.dij.push(D.pops);const ref=D.d[t];
    a=now();const A=sp(g,s,t,Wc(g),v=>Math.hypot(g.X[v]-g.X[t],g.Y[v]-g.Y[t])*cmin);T.ast+=now()-a;R.ast.push(A.pops);
    a=now();const B=bidir(g,s,t,Wc(g),WcR(g));T.bid+=now()-a;R.bid.push(B.pops);
    a=now();const C=sp(g,s,t,Wc(g),altH(LM,t));T.alt+=now()-a;R.alt.push(C.pops);
    if(Math.abs(A.d[t]-ref)>1e-6*ref||Math.abs(B.cost-ref)>1e-6*ref||Math.abs(C.d[t]-ref)>1e-6*ref)bad++}
  const n=P.length,o={n,cmin_s_par_m:+cmin.toFixed(3),landmarks_ms:Math.round(tLM),landmarks_Mo:+(8*2*g.nN*4/1e6).toFixed(2),ecarts_optimum:bad};
  for(const k in R)o[k]={noeuds_med:Math.round(med(R[k])),noeuds_p90:Math.round(p90(R[k])),ms_moy:+(T[k]/n).toFixed(2)};
  return o}

function E2(g){
  const P=pairs(g,400,2000,7000),out={ladder:{ok:0,gap:[],n:[],ms:0},larac:{ok:0,gap:[],n:[],ms:0},exact:{ok:0,n:[],ms:0,lab:[],timeout:0}};let N=0;
  const W=Wc(g),U=Wu(g);
  for(const [s,t] of P){if(N>=60)break;
    const c0=sp(g,s,t,W),p0=pathOf(g,c0.prev,t),U0=sumW(p0,U),C0=c0.d[t];
    const u0=sp(g,s,t,U),pu=pathOf(g,u0.prev,t),Umin=sumW(pu,U);
    if(U0-Umin<60)continue;N++;const lim=Umin+.3*(U0-Umin);
    // exact (étiquettes) d'abord pour la référence
    let a=now();const ex=rcsp(g,s,t,lim,W,U);out.exact.ms+=now()-a;if(ex.timeout)out.exact.timeout++;if(isFinite(ex.cost))out.exact.ok++;out.exact.lab.push(ex.labels);
    // échelle actuelle
    a=now();let k=0,LC=null;for(const lam of [0,10,40,160,640]){k++;const r=sp(g,s,t,c=>W(c)+lam*U(c)),p=pathOf(g,r.prev,t);if(sumW(p,U)<=lim+.5){LC=sumW(p,W);break}}
    out.ladder.ms+=now()-a;out.ladder.n.push(k);if(LC!=null){out.ladder.ok++;if(isFinite(ex.cost))out.ladder.gap.push(LC/ex.cost-1)}
    // LARAC
    a=now();const la=larac(g,s,t,lim,W,U);out.larac.ms+=now()-a;out.larac.n.push(la.n);if(la.cost!=null){out.larac.ok++;if(isFinite(ex.cost))out.larac.gap.push(la.cost/ex.cost-1)}}
  const f=x=>({faisable:x.ok+"/"+N,ecart_cout_med_pct:x.gap?r1(100*med(x.gap)):undefined,ecart_cout_p90_pct:x.gap?r1(100*p90(x.gap)):undefined,ecart_cout_max_pct:x.gap&&x.gap.length?r1(100*Math.max(...x.gap)):undefined,dijkstra_med:x.n.length?med(x.n):undefined,ms_moy:+(x.ms/N).toFixed(1),etiquettes_med:x.lab?med(x.lab):undefined,hors_temps:x.timeout});
  return {n:N,limite:"D+min + 30 % de l'écart au D+ du plus court",echelle_actuelle:f(out.ladder),larac:f(out.larac),exact:f(out.exact)}}
function larac(g,s,t,lim,W,U){
  let n=0;const run=lam=>{n++;const r=sp(g,s,t,c=>W(c)+lam*U(c)),p=pathOf(g,r.prev,t);return {c:sumW(p,W),u:sumW(p,U)}};
  let pc=run(0);if(pc.u<=lim)return {cost:pc.c,n};
  let pd=run(1e4);if(pd.u>lim)return {cost:null,n};
  for(let it=0;it<12;it++){const lam=(pd.c-pc.c)/(pc.u-pd.u);if(!(lam>0))break;const r=run(lam);
    if(Math.abs((r.c+lam*r.u)-(pc.c+lam*pc.u))<1e-6*(pc.c+1))break;if(r.u<=lim)pd=r;else pc=r}
  return {cost:pd.c,n}}
function rcsp(g,s,t,lim,W,U){   // étiquettes (coût, D+) avec dominance, bornes inférieures par recherches arrière, borne supérieure LARAC
  const hc=sp(g,t,-1,WcR(g)).d.slice(),hu=sp(g,t,-1,WuR(g)).d.slice(),ub0=larac(g,s,t,lim,W,U).cost;let UB=ub0==null?Infinity:ub0+1e-6;
  const lab=new Array(g.nN);const Hh=new Heap(),LC=[],LU=[],LV=[];let nl=0,t0=now();
  const add=(v,c,u)=>{let L=lab[v];if(!L)L=lab[v]=[];for(const i of L)if(LC[i]<=c&&LU[i]<=u)return;LC.push(c);LU.push(u);LV.push(v);L.push(nl);Hh.push(c+hc[v],nl);nl++};
  add(s,0,0);let best=Infinity;
  while(Hh.n){const i=Hh.pop();if(Hh.top>=Math.min(UB,best))break;if(now()-t0>2000)return {cost:best<Infinity?best:(ub0??Infinity),labels:nl,timeout:true};
    const v=LV[i],c=LC[i],u=LU[i];if(v===t){best=Math.min(best,c);continue}
    for(let k=g.deg[v];k<g.deg[v+1];k++){const cc=g.adj[k],e=cc>>1,w=(cc&1)?g.a[e]:g.b[e],c2=c+W(cc),u2=u+U(cc);if(u2+hu[w]>lim+.5||c2+hc[w]>=Math.min(UB,best))continue;add(w,c2,u2)}}
  return {cost:Math.min(best,UB),labels:nl}}

function E3(g,K){   // matrice K×K de coûts entre points candidats à ≤ 4 km du départ (base d'une boucle « orienteering »)
  const s=g.main[Math.floor(rnd()*g.main.length)],C=[];for(const u of g.main){const d=Math.hypot(g.X[u]-g.X[s],g.Y[u]-g.Y[s]);if(d>500&&d<4000)C.push(u)}
  const pts=[s];while(pts.length<K&&C.length)pts.push(C.splice(Math.floor(rnd()*C.length),1)[0]);
  const a=now();let fin=0;for(const p of pts){const r=sp(g,p,-1,Wc(g),null,{maxD:3*3600});for(const q of pts)if(isFinite(r.d[q]))fin++}
  return {K:pts.length,ms_total:Math.round(now()-a),paires_reliees:fin+"/"+pts.length*pts.length}}

for(const z of ZS){const g=load(z);
  console.log(z,"graphe",JSON.stringify({noeuds:g.nN,aretes:g.nE,composante_principale:g.main.length}));
  console.log(z,"E1",JSON.stringify(E1(g)));
  console.log(z,"E2",JSON.stringify(E2(g)));
  console.log(z,"E3",JSON.stringify([E3(g,20),E3(g,40)]))}
