#!/usr/bin/env python3
"""Graphe de chemins précalculé d'une région : <z>/graphe.json  (+ rapport de connectivité).

Entrées (déjà dans le dépôt) : <z>/routes.geojson (classes 1-5), <z>/sentiers.geojson (Wanderweg w / Bergwanderweg b /
Alpinwanderweg a), <z>/data.json (grille 25 m) et <z>/grid/c_i_j.json (altitude, pente, forêt).
usage : python3 tools/graphe.py [z ...]      (par défaut : les huit régions)   --stats : seulement le rapport

Construction :
 1. classe 1 (autoroutes, routes larges) : exclue du réseau ; les raccords entre lignes se font à 5 m (accrochage) ;
 2. les sentiers balisés qui suivent une route (≤ 6 m) marquent cette route (t) ; le reste devient un tronçon de classe 5 ;
 3. noeuds à toutes les intersections (shapely.node), arêtes = tronçons entre deux noeuds ;
 4. traversées de route de classe 1 : arête virtuelle (classe 1, ≤ 30 m) entre deux bouts de chemin situés de part
    et d'autre d'une route de classe 1 (jamais le long de la route) ;
 5. par arête : longueur, dénivelé + / −, pente maximale soutenue (≈ 100 m), part de pente ≥ 30° en forêt (zone difficile), part de forêt.

Format du fichier (JSON compact) :
 v=1, o=[x0,y0] origine en 1e-5° ; N=[x,y,...] noeuds (x,y relatifs à o) ;
 E=[a,b,cls,t,long_m,mont_m,desc_m,pente_max°,dur%,fo%, ...] (10 valeurs par arête, mont/desc dans le sens a→b) ;
 G={indice_arête:[dx,dy,...]} sommets intermédiaires en 1e-5°, delta depuis le précédent (le premier depuis le noeud a)."""
import sys,os,json,gzip,base64,math,collections,warnings
warnings.filterwarnings('ignore')
import numpy as np
import shapely,shapely.ops
from shapely.geometry import LineString,MultiLineString,Point
from shapely.strtree import STRtree
from pyproj import Transformer
from scipy.spatial import cKDTree

R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZS=[a for a in sys.argv[1:] if not a.startswith('--')] or ['ple','lsn','gdv','nyn','bro','vul','chb','pde']
STATS_ONLY='--stats' in sys.argv
T_LL_LV=Transformer.from_crs(4326,2056,always_xy=True); T_LV_LL=Transformer.from_crs(2056,4326,always_xy=True)
T_LV_WM=Transformer.from_crs(2056,3857,always_xy=True)
SNAP=5.0; STEP=25.0; XMAX=30.0

def read_lines(path,key):
    d=json.load(open(path)); out=[]
    for f in d['features']:
        g=f['geometry']; k=f['properties'][key]
        parts=g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
        for p in parts:
            if len(p)<2: continue
            a=np.array(p,float); x,y=T_LL_LV.transform(a[:,0],a[:,1]); out.append((k,np.c_[x,y]))
    return out

def load_grid(z):
    m=json.load(open(f'{R}/{z}/data.json'))['meta']; cs=m['grid']['cs']; rows,cols=int(m['rows']),int(m['cols'])
    L={k:np.zeros((rows,cols),np.int16 if k=='dem' else np.uint8) for k in ('dem','slope','fx')}
    for i,j in m['grid']['chunks']:
        t=json.load(open(f'{R}/{z}/grid/c_{i}_{j}.json')); buf=gzip.decompress(base64.b64decode(t['b64'])); n=t['w']*t['h']; off=0
        for l in t['layers']:
            isz={'int16':2,'uint16':2,'uint8':1,'int8':1}[l['t']]
            if l['k'] in L:
                if isz==1: a=np.frombuffer(buf,np.uint8,n,off).reshape(t['h'],t['w']).astype(np.int16)
                else:
                    lo=np.frombuffer(buf,np.uint8,n,off).astype(np.int32); hi=np.frombuffer(buf,np.uint8,n,off+n).astype(np.int32)
                    v=((lo|(hi<<8))<<16)>>16; a=v.reshape(t['h'],t['w'])
                    if l['delta']: a=np.cumsum(a,axis=1)
                r0,c0=j*cs,i*cs; L[l['k']][r0:r0+t['h'],c0:c0+t['w']]=a[:rows-r0,:cols-c0][:t['h'],:t['w']]
            off+=n*isz
    return m,L

def build(z):
    rd=lambda f:read_lines(f'{R}/{z}/{f}','c' if f.startswith('routes') else 't')
    roads=[(c,l) for c,l in rd('routes.geojson')]; sent=rd('sentiers.geojson')
    tcode={'w':1,'b':2,'a':3}
    r_nc=[(c,LineString(l)) for c,l in roads if c!=1]; r_1=[LineString(l) for c,l in roads if c==1]
    print(z,'lignes: routes 2-5',len(r_nc),'classe 1',len(r_1),'sentiers',len(sent),flush=True)
    rt=STRtree([g for _,g in r_nc]); s_geo=[LineString(l) for _,l in sent]; s_t=[tcode[t] for t,_ in sent]
    # sentiers hors réseau routier (reste après retrait d'un tampon de 6 m autour des routes proches)
    src=[(g,c,0) for c,g in r_nc]
    for g,t in zip(s_geo,s_t):
        idx=rt.query(g,predicate='dwithin',distance=8)
        if len(idx)==0: parts=[g]
        else:
            loc=shapely.union_all([shapely.buffer(r_nc[k][1],6) for k in idx]); rem=g.difference(loc)
            parts=[p for p in shapely.get_parts(rem) if p.length>=3] if not rem.is_empty else []
        for p in parts:
            if p.geom_type=='LineString': src.append((p,5,t))
    # accrochage : bout de ligne proche d'une autre ligne (≤ 5 m) mais sans la toucher -> raccord
    geos=[s[0] for s in src]; tree=STRtree(geos); links=[]
    for gi,(g,c,t) in enumerate(src):
        for e in (Point(g.coords[0]),Point(g.coords[-1])):
            idx=tree.query(e,predicate='dwithin',distance=SNAP); best=None
            ds=[(shapely.distance(e,geos[k]),k) for k in idx if k!=gi]
            if not ds: continue
            d,k=min(ds)
            if d<0.05 or any(dd<0.05 for dd,_ in ds): continue
            a,b=shapely.ops.nearest_points(e,geos[k]); links.append((LineString([(a.x,a.y),(b.x,b.y)]),c,t))
    src+=links
    print(z,'raccords',len(links),flush=True)
    noded=shapely.node(shapely.multilinestrings([g for g,_,_ in src])); pieces=[p for p in shapely.get_parts(noded) if p.length>0.01]
    # attributs : classe et type de la ligne source la plus proche du milieu du tronçon
    mids=shapely.line_interpolate_point(pieces,0.5,normalized=True); st=STRtree(geos)
    ii=st.query_nearest(mids,max_distance=1.0,all_matches=False); att={}
    for q,k in zip(ii[0],ii[1]): att[q]=k
    stree=STRtree(s_geo); nodes={}; NX=[]; NY=[]; edges=[]
    def nid(x,y):
        k=(round(x,2),round(y,2))
        if k not in nodes: nodes[k]=len(NX); NX.append(x); NY.append(y)
        return nodes[k]
    for qi,p in enumerate(pieces):
        k=att.get(qi)
        if k is None: continue
        _,c,t=src[k]
        if c!=5 or t==0:
            pass
        if t==0:   # route : un sentier balisé la suit-il ?
            idx=stree.query(mids[qi],predicate='dwithin',distance=6)
            if len(idx): t=max(s_t[j] for j in idx)
        co=np.array(p.coords); a=nid(*co[0]); b=nid(*co[-1])
        if a==b: continue
        edges.append((a,b,c,t,co))
    # traversées de route de classe 1
    deg=collections.Counter(); [deg.update([e[0],e[1]]) for e in edges]
    ends=[i for i,d in deg.items() if d==1]
    if r_1 and ends:
        r1=shapely.union_all(r_1); r1t=STRtree(r_1); ep=np.c_[np.array(NX)[ends],np.array(NY)[ends]]; kd=cKDTree(ep); done=set()
        pts=shapely.points(ep[:,0],ep[:,1]); near=shapely.distance(pts,r1)<=15
        for ia in np.nonzero(near)[0]:
            for ib in kd.query_ball_point(ep[ia],XMAX):
                if ib<=ia or (ia,ib) in done: continue
                seg=LineString([ep[ia],ep[ib]])
                if len(r1t.query(seg,predicate='intersects')):
                    done.add((ia,ib)); edges.append((ends[ia],ends[ib],1,0,np.array(seg.coords)))
        print(z,'traversées de classe 1',len(done),flush=True)
    return edges,np.array(NX),np.array(NY)

def finish(z,edges,NX,NY,m,L):
    cs_rows,cs_cols=L['dem'].shape; x0,y1,res=float(m['x0']),float(m['y1']),float(m['res'])
    def samp(co):
        d=np.r_[0,np.cumsum(np.hypot(*np.diff(co,axis=0).T))]; ln=d[-1]; n=max(1,int(math.ceil(ln/STEP))); s=np.linspace(0,ln,n+1)
        return ln,s,np.c_[np.interp(s,d,co[:,0]),np.interp(s,d,co[:,1])]
    all_pts=[]; meta=[]
    for a,b,c,t,co in edges:
        ln,s,p=samp(co); meta.append((ln,s,len(all_pts[-1]) if False else 0)); all_pts.append(p)
    P=np.vstack(all_pts); X,Y=T_LV_WM.transform(P[:,0],P[:,1]); fc=(np.array(X)-x0)/res-.5; fr=(y1-np.array(Y))/res-.5
    fc=np.clip(fc,0,cs_cols-1.001); fr=np.clip(fr,0,cs_rows-1.001); c0=fc.astype(int); r0=fr.astype(int); dc=fc-c0; dr=fr-r0
    dm=L['dem'].astype(float); Z=(dm[r0,c0]*(1-dc)*(1-dr)+dm[r0,c0+1]*dc*(1-dr)+dm[r0+1,c0]*(1-dc)*dr+dm[r0+1,c0+1]*dc*dr)
    rn=np.rint(fr).astype(int); cn=np.rint(fc).astype(int); FX=L['fx'][rn,cn]>0; SL=L['slope'][rn,cn]
    E=[]; G={}; k0=0; mx=0
    for i,((a,b,c,t,co),(ln,s,_)) in enumerate(zip(edges,meta)):
        n=len(s); z_=Z[k0:k0+n]; f=FX[k0:k0+n]; sl=SL[k0:k0+n]; k0+=n
        dz=np.diff(z_); up=float(dz[dz>0].sum()); dn=float(-dz[dz<0].sum())
        if len(dz):
            w=4; cum=np.r_[0,np.cumsum(dz)]; dist=s
            sm=0
            for u in range(n):
                v=min(n-1,u+w); dd=max(dist[v]-dist[u],25.0)
                if dist[v]-dist[u]>=min(50.0,ln*.9): sm=max(sm,abs(cum[v]-cum[u])/dd)
            smax=math.degrees(math.atan(sm))
        else: smax=0
        hard=float(np.mean(f&(sl>=30)))*100; fo=float(np.mean(f))*100
        E+= [a,b,c,t,int(round(ln)),int(round(up)),int(round(dn)),int(round(smax)),int(round(hard)),int(round(fo))]
    ox=int(math.floor(NX.min())) if False else None
    lon,lat=T_LV_LL.transform(NX,NY); lon=np.rint(np.array(lon)*1e5).astype(int); lat=np.rint(np.array(lat)*1e5).astype(int); o=[int(lon.min()),int(lat.min())]
    N=[]; [N.extend([int(x-o[0]),int(y-o[1])]) for x,y in zip(lon,lat)]
    for i,(a,b,c,t,co) in enumerate(edges):
        g=LineString(co); g=g.simplify(1.5) if len(co)>2 else g; cc=np.array(g.coords)[1:-1]
        if len(cc)==0: continue
        l_,la_=T_LV_LL.transform(cc[:,0],cc[:,1]); px,py=int(lon[a]),int(lat[a]); out=[]
        for x,y in zip(np.rint(np.array(l_)*1e5).astype(int),np.rint(np.array(la_)*1e5).astype(int)): out+=[int(x-px),int(y-py)]; px,py=int(x),int(y)
        G[i]=out
    return dict(v=1,id=z,o=o,N=N,E=E,G=G),Z,P

def stats(z,graph,L,m):
    E=np.array(graph['E']).reshape(-1,10); nn=len(graph['N'])//2; par=list(range(nn))
    def find(x):
        while par[x]!=x: par[x]=par[par[x]]; x=par[x]
        return x
    def comp(mask):
        for i in range(nn): par[i]=i
        for r in E[mask]:
            ra,rb=find(r[0]),find(r[1])
            if ra!=rb: par[ra]=rb
        cnt=collections.Counter(find(r[0]) for r in E[mask]); cnt.update(find(r[1]) for r in E[mask]); big=cnt.most_common(1)[0][0]
        return big,cnt
    res={}
    N=np.array(graph['N']).reshape(-1,2); o=graph['o']; lon=(N[:,0]+o[0])/1e5; lat=(N[:,1]+o[1])/1e5; x,y=T_LL_LV.transform(lon,lat); xy=np.c_[x,y]
    fx=L['fx']; rr,cc=np.nonzero(fx>0); X,Y=m['x0']+(cc+.5)*m['res'],m['y1']-(rr+.5)*m['res']
    lonf,latf=Transformer.from_crs(3857,2056,always_xy=True).transform(X,Y); fp=np.c_[lonf,latf]
    for name,mask in (('classes 3-5 + sentiers (sans classe 2)',E[:,2]>=3),('classes 2-5 + sentiers',E[:,2]>=2),('toutes (traversées de classe 1 comprises)',E[:,2]>=1)):
        big,cnt=comp(mask); inb=np.array([find(i)==big and cnt.get(find(i),0)>0 for i in range(nn)])
        used=np.zeros(nn,bool); [used.__setitem__(r[0],True) or used.__setitem__(r[1],True) for r in E[mask]]
        sel=inb&used; d,_=cKDTree(xy[sel]).query(fp)
        res[name]=dict(composantes=len(cnt),part_plus_grande=round(100*cnt[big]/sum(cnt.values()),1),foret_a_300m=round(100*float((d<=300).mean()),1),foret_a_150m=round(100*float((d<=150).mean()),1),km=round(float(E[mask,4].sum())/1000))
    return res

if __name__=='__main__':
    rep={}
    for z in ZS:
        m,L=load_grid(z)
        if STATS_ONLY:
            g=json.load(open(f'{R}/{z}/graphe.json'))
        else:
            edges,NX,NY=build(z); g,Z,P=finish(z,edges,NX,NY,m,L)
            json.dump(g,open(f'{R}/{z}/graphe.json','w'),separators=(',',':'))
        sz=os.path.getsize(f'{R}/{z}/graphe.json'); st=stats(z,g,L,m); rep[z]=dict(noeuds=len(g['N'])//2,aretes=len(g['E'])//10,mo=round(sz/1e6,2),conn=st)
        print(z,json.dumps(rep[z],ensure_ascii=False),flush=True)
    json.dump(rep,open(os.path.join(os.environ.get('GRAPHE_RAPPORT',R+'/docs'),'graphe-rapport.json'),'w'),ensure_ascii=False,indent=1)
