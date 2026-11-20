#!/usr/bin/env python3
"""Fusionne ple/lsn/gdv index.html en une seule page (index.html) + <z>/zone.js.
Base = ple/index.html (version la plus récente). À n'exécuter qu'une fois (migration)."""
import re,json,os,sys
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd=lambda p:open(os.path.join(R,p),encoding="utf-8").read()
Z={"ple":"Riviera-Chablais","lsn":"Région Lausannoise","gdv":"du Gros-de-Vaud"}
NAMES=["SORT_SRC","SORT_P","MAP_THR_EXTRA","MAP_THR_V4","SHOOT_Z","HUNT_FREE"]
src={z:rd(f"{z}/index.html") for z in Z}
def const(t,n):
    m=re.search(r"^const "+n+r"=(.*?);(?:[ ]*//.*)?$",t,re.M); assert m,n; return m.group(1)
for z,t in src.items():
    title=re.search(r"<h1>(.*?)</h1>",t).group(1); sub=re.search(r'<p class="sub">(.*?)</p>',t).group(1)
    files=json.load(open(os.path.join(R,z,"files.json")))
    mb=sum(os.path.getsize(os.path.join(R,z,f)) for f in files)/1e6
    out=["/* Paramètres propres à la région (générés lors de la fusion des trois cartes) */","var ZONE={};",
         f"ZONE.id={json.dumps(z)};ZONE.title={json.dumps(title,ensure_ascii=False)};ZONE.sub={json.dumps(sub,ensure_ascii=False)};ZONE.mb={json.dumps('≈ %d Mo'%(round(mb/5)*5))};"]
    out+= [f"ZONE.{n}={const(t,n)};" for n in NAMES]
    open(os.path.join(R,z,"zone.js"),"w",encoding="utf-8").write("\n".join(out)+"\n")
b=src["ple"]
def sub1(pat,rep,cnt=1,flags=0):
    global b
    b,n=re.subn(pat,rep,b,flags=flags)
    assert n==cnt,(pat,n)
for n in NAMES: sub1(r"^const "+n+r"=.*;(?:[ ]*//.*)?$","const "+n+"=ZONE."+n+";",1,re.M)
sub1(r'href="\.\./manifest\.webmanifest"','href="manifest.webmanifest"')
sub1(r'href="\.\./icon\.svg"','href="icon.svg"')
sub1(r'<link rel="apple-touch-icon" href="\.\./icon-180\.png">','')
sub1(r'<script src="\.\./leaflet\.js"></script>',
 '<script src="leaflet.js"></script>\n<script>\n// Région : ?r=ple|lsn|gdv, sinon la dernière utilisée, sinon Riviera-Chablais\n'
 'var ZID=(new URLSearchParams(location.search).get("r"))||"";if(!/^(ple|lsn|gdv)$/.test(ZID)){try{ZID=localStorage.getItem("champi-zone")||""}catch(e){ZID=""}}\n'
 'if(!/^(ple|lsn|gdv)$/.test(ZID))ZID="ple";try{localStorage.setItem("champi-zone",ZID)}catch(e){}\n'
 'var ZD=ZID+"/";document.write(\'<script src="\'+ZD+\'zone.js"><\\/script>\');\n</script>\n'
 '<script>document.title=ZONE.title;document.querySelector("h1").textContent=ZONE.title;document.querySelector(".sub").textContent=ZONE.sub;\n'
 'document.querySelectorAll(".region-link").forEach(function(a){if(a.dataset.z===ZID){a.setAttribute("aria-current","page");a.style.cssText="font-weight:700;outline:2px solid var(--accent)"}});\n'
 'document.querySelectorAll(".mb").forEach(function(e){e.textContent=ZONE.mb})</script>')
# menu Région
sub1(r'<a class="btn region-link" href="\.\./ple/".*?<a href="\.\./">Page d\'accueil des cartes</a></p>',
 '<a class="btn region-link" data-z="ple" href="?r=ple">Riviera-Chablais</a><a class="btn region-link" data-z="lsn" href="?r=lsn">Région lausannoise</a><a class="btn region-link" data-z="gdv" href="?r=gdv">Gros-de-Vaud</a></div><p class="small" style="margin:6px 0 0">Chaque région se télécharge séparément pour l\'utiliser hors ligne (menu « Météo et outils »).</p>',1,re.S)
# ressources de la région
for f in ["data.json","routes.geojson","cours_eau.geojson","reserves.geojson","acces.geojson","sentiers.geojson","tiles_index.json","places.json","files.json"]:
    n=len(re.findall(r'fetch\("'+re.escape(f)+'"',b)); assert n>=1,f
    b=b.replace('fetch("'+f+'"','fetch(ZD+"'+f+'"')
sub1(r"fetch\(`grid/c_","fetch(ZD+`grid/c_")
sub1(r"im\.src=`tiles/","im.src=ZD+`tiles/")
sub1(r'<img src="\$\{esc\(o\.ph\)\}"','<img src="${ZD}${esc(o.ph)}"')
# service worker et hors ligne
sub1(r'register\("\.\./sw\.js",\{scope:"\.\./"\}\)','register("sw.js",{scope:"./"})')
sub1(r'var zone=location\.pathname[^;]*;','var zone=ZID;')
sub1(r'var MB="≈ 125 Mo";','var MB=ZONE.mb;')
sub1(r'fetch\(f,\{cache:"no-cache"\}\)','fetch(ZD+f,{cache:"no-cache"})')
sub1(r'new URL\(f,location\.href\)\.href','new URL(ZD+f,location.href).href')
b,n=re.subn(r"≈ 125 Mo","<span class='mb'></span>",b); print("125 Mo ->",n)
open(os.path.join(R,"index.html"),"w",encoding="utf-8").write(b)
for z in Z:
    open(os.path.join(R,z,"index.html"),"w",encoding="utf-8").write(
     f'<!doctype html><meta charset="utf-8"><title>Champignons</title><meta http-equiv="refresh" content="0;url=../?r={z}"><script>location.replace("../?r={z}")</script><a href="../?r={z}">Ouvrir la carte</a>\n')
