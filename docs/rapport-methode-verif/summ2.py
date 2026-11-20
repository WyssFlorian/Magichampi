import json,sys

E=sys.argv[1]  # dossier contenant res_<zone>_now.json et res_<zone>_inv.json (sorties de rerun.js)
def spearman(x,y):
    def rk(v):
        o=sorted(range(len(v)),key=lambda i:v[i]);r=[0]*len(v)
        for k,i in enumerate(o):r[i]=k
        return r
    a,b=rk(x),rk(y);n=len(a);ma=sum(a)/n;mb=sum(b)/n
    cov=sum((p-ma)*(q-mb) for p,q in zip(a,b));va=sum((p-ma)**2 for p in a);vb=sum((q-mb)**2 for q in b)
    return cov/(va*vb)**.5 if va and vb else float('nan')
def boyce(p,w=.2,step=.05):
    xs,ys=[],[];s=0
    while s+w<=1.0001:
        f=sum(1 for v in p if s<=v<s+w)/len(p);xs.append(s+w/2);ys.append(f/w);s+=step
    return spearman(xs,ys)
def st(O):
    p=[o['pct'] for o in O];q=[o['pctBg'] for o in O]
    return dict(n=len(O),pct=round(sum(p)/len(p),3),pctBg=round(sum(q)/len(q),3),boyce=round(boyce(p),2),high=round(sum(1 for o in O if (o['cls'] or 0)>=3)/len(O),3))
for mode in ['now','inv']:
    R={z:json.load(open(f'{E}/res_{z}_{mode}.json')) for z in ['ple','lsn','gdv']}
    ALL=[o for z in R for o in R[z]['obs']]
    print(mode,'total',st(ALL),'obs distinctes',len({o['id'] for o in ALL}))
    for z in R:print(' ',z,st(R[z]['obs']))
    # tiers
    for t in (1,2,3):print('  palier',t,st([o for o in ALL if o['tier']==t]))
    json.dump(ALL,open(f'{E}/all_{mode}.json','w'))
