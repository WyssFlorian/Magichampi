#!/usr/bin/env python3
"""Découpage du canton de Vaud en régions + bande de recouvrement de 1 km -> zones.js
usage : python3 tools/zones_vaud.py [--check]   (depuis la racine du dépôt)
Chaque région NOUVELLE a une emprise « nominale » (le découpage) et une emprise de données = nominale + 1 km de chaque côté.
Les 3 premières régions (ple, lsn, gdv) gardent leur emprise publiée ; les emprises nominales voisines les recouvrent déjà de ~1,5 km,
donc la bande de 1 km des nouvelles régions déborde au-delà (≥ 2,5 km de recouvrement au total).
"""
import json,math,sys
BAND_M=1000
# (id, nom, (ouest,sud,est,nord) nominal, mb, ok = données publiées)
EXIST=[("ple","Riviera-Chablais",(6.74,46.35,7.06,46.62),"≈ 125 Mo"),("lsn","Région lausannoise",(6.45,46.45,6.75,46.63),"≈ 45 Mo"),("gdv","Gros-de-Vaud",(6.26,46.53,6.70,46.86),"≈ 125 Mo")]
NEW=[("nyn","La Côte, Nyon et Jura vaudois",(6.06,46.28,6.52,46.70)),
     ("bro","Broye (Moudon, Payerne)",(6.68,46.60,7.00,46.99)),
     ("vul","Vully et Avenches",(6.98,46.78,7.26,46.99)),
     ("chb","Chablais alpin (Bex, Ormonts)",(6.74,46.18,7.26,46.37)),
     ("pde","Pays-d'Enhaut et Diablerets",(7.04,46.35,7.26,46.62))]
def band(b):
    w,s,e,n=b; la=(s+n)/2; dl=BAND_M/111320; do=BAND_M/(111320*math.cos(math.radians(la)))
    return (round(w-do,4),round(s-dl,4),round(e+do,4),round(n+dl,4))
def zones(ready=()):
    out=[dict(id=i,nom=n,bbox=[b[1],b[0],b[3],b[2]],mb=mb,ok=1) for i,n,b,mb in EXIST]
    for i,n,b in NEW:
        w,s,e,nn=band(b); out.append(dict(id=i,nom=n,nominal=[b[1],b[0],b[3],b[2]],bbox=[s,w,nn,e],mb="",ok=1 if i in ready else 0))
    return out
if __name__=="__main__":
    ready=set(a for a in sys.argv[1:] if not a.startswith("--"))
    import os
    old=os.path.join(os.path.dirname(__file__),"..","zones.js")
    if os.path.exists(old) and not ready:   # conserve l'état « données publiées » et les tailles
        t=open(old).read(); j=json.loads(t[t.index("var ZONES=")+10:t.rindex(";")]); ready={z["id"] for z in j if z.get("ok") and z["id"] in {i for i,_,_ in NEW}}; mbs={z["id"]:z["mb"] for z in j}
    else: mbs={}
    z=zones(ready)
    for q in z:
        if mbs.get(q["id"]): q["mb"]=mbs[q["id"]]
    open("zones.js","w").write("// Régions du canton de Vaud (généré par tools/zones_vaud.py). bbox = [sud, ouest, nord, est] des données (bande de 1 km comprise) ; ok=1 : données publiées dans <id>/\nvar ZONES="+json.dumps(z,ensure_ascii=False,separators=(",",":"))+";\n")
    if "--check" in sys.argv:
        from shapely.geometry import shape,box; from shapely.ops import unary_union
        vd=unary_union([shape(f["geometry"]) for f in json.load(open("limites/canton.geojson"))["features"]])
        u=unary_union([box(q["bbox"][1],q["bbox"][0],q["bbox"][3],q["bbox"][2]) for q in z]); r=vd.difference(u)
        print("canton non couvert : %.1f km²"%(r.area*71*111))
