# Mise à jour hebdomadaire de la météo d'une ou plusieurs cartes (data.json).
#  1. ajoute les jours mesurés publiés depuis la dernière mise à jour (grilles MétéoSuisse 1 km, ogd-surface-derived-grid)
#  2. remplace les prévisions par le dernier run des prévisions locales (ogd-local-forecasting), comme refresh_fc.py
#  3. garde au plus HIST jours de mesures (la carte en utilise 16 avant la date choisie)
# Les jours entre la dernière mesure et la première prévision gardent l'ancienne valeur (« estimation »).
# usage : python3 meteo_update.py <dossier_cache> <site/ple/data.json> [<autre data.json> ...]
import sys, os, json, datetime, re, requests, numpy as np, pandas as pd, xarray as xr
CACHE=sys.argv[1]; FILES=sys.argv[2:]; HIST=45
os.makedirs(CACHE,exist_ok=True)
STAC='https://data.geo.admin.ch/api/stac/v1/collections'
S=requests.Session()
def dl(url):
    fn=os.path.join(CACHE,url.split('/')[-1])
    if not os.path.exists(fn):
        r=S.get(url,timeout=300); r.raise_for_status(); open(fn+'.part','wb').write(r.content); os.replace(fn+'.part',fn)
    return fn
def item(coll,iid):
    r=S.get(f'{STAC}/{coll}/items/{iid}',timeout=60)
    return r.json() if r.status_code==200 else None

# ---------- prévisions : dernier run complet ----------
today=datetime.date.today()
run=None
for k in range(0,3):
    it=item('ch.meteoschweiz.ogd-local-forecasting',(today-datetime.timedelta(days=k)).strftime('%Y%m%d')+'-ch')
    if not it: continue
    runs={}
    for name,a in it['assets'].items():
        m=re.match(r'vnut12\.lssw\.(\d{12})\.(\w+)\.csv',name)
        if m: runs.setdefault(m.group(1),{})[m.group(2)]=a['href']
    ok=[r for r,p in runs.items() if all(x in p for x in ('rka150p0','tre200pn','tre200h0'))]
    if ok: RUN=max(ok); run=(RUN,runs[RUN]); break
assert run, 'aucun run de prévision trouvé'
RUN,HREF=run
meta_pt=dl('https://data.geo.admin.ch/ch.meteoschweiz.ogd-local-forecasting/ogd-local-forecasting_meta_point.csv')
P0=pd.read_csv(meta_pt,sep=';',encoding='latin1')
FC={p:pd.read_csv(dl(HREF[p]),sep=';') for p in ('rka150p0','tre200pn','tre200h0')}

def fc_daily(pts,p,how):
    d=FC[p]; d=d[d.point_id.isin(pts.point_id)].copy()
    t=pd.to_datetime(d.Date.astype(str),format='%Y%m%d%H%M')
    if how=='direct': d['day']=t.dt.strftime('%Y-%m-%d'); return d.pivot_table(index='point_id',columns='day',values=p)
    d['day']=(t+pd.Timedelta(hours=1)).dt.strftime('%Y-%m-%d')
    g=d.groupby(['point_id','day'])[p]; m=g.mean().unstack(); n=g.count().unstack()
    return m.where(n>=20)

# ---------- mesures : grilles quotidiennes ----------
GV=[('rprelimd','ch01h'),('tabsd','ch01r'),('tmind','ch01r'),('sreld','ch01r')]
grid_cache={}
def measured(day):
    """{var: DataArray 2D} pour un jour, ou None si pas encore publié"""
    if day in grid_cache: return grid_cache[day]
    d=day.replace('-',''); it=item('ch.meteoschweiz.ogd-surface-derived-grid',d+'-ch'); out=None
    if it:
        A=it['assets']; out={}
        for v,s in GV:
            nm=f'ogd-surface-derived-grid.{v}_{s}.swiss.lv95_{d}000000_{d}000000.nc'
            if nm not in A: out=None; break
            ds=xr.open_dataset(dl(A[nm]['href'])); var=[x for x in ds.data_vars if x!='swiss_lv95_coordinates'][0]
            out[v]=ds[var].isel(time=0).load(); ds.close()
    grid_cache[day]=out; return out

for fn in FILES:
    D=json.load(open(fn)); me=D['meteo']; nobs=me['nobs']; dates=me['dates']; ncell=me['nN']*me['nE']
    VARS=['rprelimd','tabsd','tmind','sreld']
    live=[m for m in range(ncell) if me['tabsd'][m] is not None]
    old={d:k for k,d in enumerate(dates)}
    # 1. nouveaux jours mesurés (consécutifs)
    new_obs=[]; day=datetime.date.fromisoformat(dates[nobs-1])+datetime.timedelta(days=1)
    while day<today:
        g=measured(day.isoformat())
        if not g: break
        new_obs.append((day.isoformat(),g)); day+=datetime.timedelta(days=1)
    mE=np.array(me['E']); mN=np.array(me['N'])
    obs_vals={}
    for ds_,g in new_obs:
        for v in VARS:
            a=g[v].sel(E=xr.DataArray(mE[[m%me['nE'] for m in live]]),N=xr.DataArray(mN[[m//me['nE'] for m in live]]),method='nearest').values
            obs_vals[(ds_,v)]=dict(zip(live,a))
    # 2. prévisions
    lo,hi=min(me['E'])-8000,max(me['E'])+8000; lo2,hi2=min(me['N'])-8000,max(me['N'])+8000
    pts=P0[P0.point_coordinates_lv95_east.between(lo,hi)&P0.point_coordinates_lv95_north.between(lo2,hi2)&P0.point_type_id.isin([1,2])].drop_duplicates('point_id')  # un point_id peut figurer 2x (types 1 et 2) : sinon poids (n+1) ≠ valeurs (n)
    R=fc_daily(pts,'rka150p0','direct'); TN=fc_daily(pts,'tre200pn','direct'); TM=fc_daily(pts,'tre200h0','mean')
    last_obs=new_obs[-1][0] if new_obs else dates[nobs-1]
    fdays=[d for d in sorted(R.columns) if d>last_obs and d in TN.columns and d in TM.columns and TM[d].notna().mean()>0.9][:8]
    ids=list(R.index.intersection(TN.index).intersection(TM.index)); pp=pts.set_index('point_id')
    PE=pp.point_coordinates_lv95_east[ids].values; PN=pp.point_coordinates_lv95_north[ids].values; PH=pp.point_height_masl[ids].values
    # 3. nouvelle série de dates
    obs_dates=dates[:nobs]+[d for d,_ in new_obs]
    est=[]; day=datetime.date.fromisoformat(obs_dates[-1])+datetime.timedelta(days=1)
    while fdays and day.isoformat()<fdays[0]: est.append(day.isoformat()); day+=datetime.timedelta(days=1)
    new_dates=obs_dates+est+fdays
    cut=max(0,len(obs_dates)-HIST)
    for m in range(ncell):
        if me['tabsd'][m] is None: continue
        e=me['E'][m%me['nE']]; nn=me['N'][m//me['nE']]; h=me['dem'][m]
        dd=np.hypot(PE-e,PN-nn); w=1/np.maximum(dd,500)**2; w[dd>8000]=0
        if w.sum()==0: w=1/np.maximum(dd,500)**2
        w/=w.sum(); dz=(h if h is not None else 800)-PH
        for v in VARS:
            s=me[v][m]
            if s is None: continue
            row=list(s[:nobs])
            for d,_ in new_obs:
                x=obs_vals[(d,v)][m]; row.append(None if x is None or np.isnan(x) else round(float(x),1))
            for d in est: row.append(s[old[d]] if d in old and old[d]<len(s) else None)
            if v=='sreld': row+=[None]*len(fdays)
            else:
                src={'rprelimd':R,'tabsd':TM,'tmind':TN}[v]; vals=src.loc[ids,fdays].values
                if v!='rprelimd': vals=vals+(-0.0055*dz)[:,None]
                row+=[round(float(np.nansum(w[:,None]*vals,axis=0)[k]),1) for k in range(len(fdays))]
            me[v][m]=row[cut:]
    for v in VARS:
        for m in range(ncell):
            if me[v][m] is not None and m not in live: me[v][m]=me[v][m][cut:]
    me['dates']=new_dates[cut:]; me['nobs']=len(obs_dates)-cut
    me['fc_run']=f'{RUN[:4]}-{RUN[4:6]}-{RUN[6:8]} {RUN[8:10]}:{RUN[10:]} UTC'
    json.dump(D,open(fn,'w'),ensure_ascii=False,separators=(',',':'))
    print(fn,'mesures jusqu\'au',obs_dates[-1],f'(+{len(new_obs)})','estimations',est,'prévisions',fdays[:1],'→',fdays[-1:],'run',me['fc_run'],'jours gardés',len(me['dates']))
