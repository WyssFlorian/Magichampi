# Intervalles de confiance par blocs de 5 km, relevés distincts et « sans coprin » à partir des sorties de rerun.js (res_<zone>_now.json).
# usage : python3 boot.py <dossier>   (graine 1, 2 000 tirages ; les bornes varient d'environ ±0,003 avec la graine)
import json,random,sys
E=sys.argv[1];Z=['ple','lsn','gdv']
A=[]
for z in Z:
    for o in json.load(open(f'{E}/res_{z}_now.json'))['obs']:o['blk']=z+o['blk'];A.append(o)   # le bloc n'est unique qu'avec la région
d={};[d.setdefault(o['id'],o) for o in A];D=list(d.values())
m=lambda L,k:round(sum(o[k] for o in L)/len(L),3)
def ci(L,k):
    random.seed(1);B={}
    [B.setdefault(o['blk'],[]).append(o) for o in L];ks=list(B);r=[]
    for _ in range(2000):
        s=[o for _ in ks for o in B[random.choice(ks)]];r.append(sum(o[k] for o in s)/len(s))
    r.sort();return len(ks),round(r[50],3),round(r[1949],3)
print('paires',len(A),m(A,'pct'),m(A,'pctBg'),'IC pct',ci(A,'pct'),'IC pctBg',ci(A,'pctBg'))
print('distincts',len(D),m(D,'pct'),m(D,'pctBg'),'IC pct',ci(D,'pct'),'IC pctBg',ci(D,'pctBg'))
N=[o for o in D if o['sp']!='comatus'];print('distincts sans coprin',len(N),m(N,'pct'),m(N,'pctBg'))
