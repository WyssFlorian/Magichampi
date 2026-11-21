#!/usr/bin/env python3
"""Fusionne TOUTES les observations de calibration en un seul fichier, sans double compte.
Sources (toutes facultatives sauf --gbif) :
  --gbif    valid_obs.json  : relevés précis GBIF/iNaturalist (clé « id » = identifiant GBIF) + fond « groupe cible »
  --inat    inat-coins.json : coins importés d'iNaturalist (id « inat<identifiant GBIF> »)
  --coins   coins de l'utilisateur / coins partagés déchiffrés (fichiers {"coins":[{id,lat,lng,sp,date}]}), répétable
CONTRÔLE ANTI-DOUBLE-COMPTE (règle du 20.11.2026, à garder) : une observation = une seule ligne.
  1. même identifiant (GBIF, avec le préfixe « inat » retiré) -> fusionnée ;
  2. même (espèce, position arrondie à 1e-4°, date) -> fusionnée (même observation sous deux identifiants) ;
  3. même (espèce, position à 1e-4°) sans date d'un côté -> fusionnée avec la ligne datée ;
  4. plus tard (facteurs.js / calibrer.py) : une cellule par espèce ne compte qu'une fois, et une observation à cheval sur deux régions (recouvrement de 1 km) une fois seulement.
Le rapport imprime combien de lignes chaque règle a retirées.
usage : observations.py --gbif valid_obs.json [--inat inat-coins.json] [--coins f.json ...] --out obs.json"""
import json, argparse, re, collections
ap = argparse.ArgumentParser()
ap.add_argument('--gbif', required=True); ap.add_argument('--inat'); ap.add_argument('--coins', action='append', default=[]); ap.add_argument('--out', required=True)
a = ap.parse_args()
V = json.load(open(a.gbif))
rows = []
for o in V['presences']:
    rows.append(dict(id=str(o['id']), sp=o['sp'], lat=o['lat'], lon=o['lon'], date=o.get('date'), src='gbif'))
def coins(path, src):
    for c in json.load(open(path))['coins']:
        if not c.get('sp'): continue
        i = str(c.get('id', '')); i = re.sub(r'^inat', '', i)
        rows.append(dict(id=i, sp=c['sp'], lat=c['lat'], lon=c['lng'], date=c.get('date'), src=src))
if a.inat: coins(a.inat, 'inat')
for p in a.coins: coins(p, 'coins')
rep = collections.Counter(); seen_id = {}; seen_pos = {}; seen_nodate = {}; out = []
rows.sort(key=lambda r: {'gbif': 0, 'inat': 1, 'coins': 2}[r['src']])   # on garde la ligne GBIF (identifiant sûr) de préférence
for r in rows:
    k = (r['sp'], round(r['lat'], 4), round(r['lon'], 4)); kd = k + (r['date'],)
    if r['id'] and r['id'] in seen_id: rep['même identifiant'] += 1; continue
    if kd in seen_pos: rep['même espèce + position + date'] += 1; continue
    if not r['date'] and any(kk[:3] == k for kk in seen_pos): rep['même espèce + position (sans date)'] += 1; continue
    if r['id']: seen_id[r['id']] = 1
    seen_pos[kd] = 1
    if not r['date']: seen_nodate[k] = 1
    out.append(r)
n = collections.Counter(r['src'] for r in out)
print('lignes lues', len(rows), '-> observations distinctes', len(out), dict(n)); print('retirées :', dict(rep))
json.dump({'presences': out, 'background': V['background'], 'rapport': {'lues': len(rows), 'retirees': dict(rep), 'par_source': dict(n)}}, open(a.out, 'w'))
