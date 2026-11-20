#!/usr/bin/env python3
"""Bloc PUB_OBS de index.html : bonus iNaturalist du score PUBLIC, sous forme agrégée.
Entrée : fichier de coins (inat-coins.json : id, lat, lng, sp, date). Aucun point brut n'est publié : chaque observation est ramenée au
centre de sa case de 0,005° × 0,0075° (≈ 556 m × 574 m, la même case que le flou du partage chiffré). Une case ne compte qu'une fois par espèce.
CONTRÔLE ANTI-DOUBLE-COMPTE (à garder pour tout ajout futur) :
  1. une observation = un identifiant (id iNat/GBIF) ; deux entrées de même id sont fusionnées ;
  2. deux entrées de même (espèce, position arrondie à 1e-4°, date) sont fusionnées (même observation importée sous deux identifiants) ;
  3. après agrégation, une case par espèce n'est écrite qu'une fois (plusieurs observations dans la case = un seul point, pas un bonus de plus) ;
  4. dans l'application le bonus est un MAXIMUM (jamais une somme) entre les coins de l'utilisateur et ces points : un même lieu présent dans les deux
     n'est pas compté deux fois ;
  5. ces points ne servent JAMAIS à la calibration ni à la validation (aptAt reçoit un bonus nul) : le fichier des relevés de validation
     (GBIF) contient les mêmes observations iNat, les compter dans le score et les valider avec lui serait une fuite.
usage : python3 tools/inat_bonus_public.py <inat-coins.json> [index.html]"""
import sys, json, re, math
src = sys.argv[1]; html = sys.argv[2] if len(sys.argv) > 2 else 'index.html'
coins = json.load(open(src))['coins']
seen_id, seen_key, cells, drop = set(), set(), {}, {'sans_espece': 0, 'meme_id': 0, 'meme_position_date': 0, 'meme_case': 0}
for c in coins:
    if not c.get('sp'): drop['sans_espece'] += 1; continue
    if c['id'] in seen_id: drop['meme_id'] += 1; continue
    seen_id.add(c['id'])
    k = (c['sp'], round(c['lat'], 4), round(c['lng'], 4), c.get('date'))
    if k in seen_key: drop['meme_position_date'] += 1; continue
    seen_key.add(k)
    i, j = math.floor(c['lat'] / 0.005), math.floor(c['lng'] / 0.0075)
    s = cells.setdefault(c['sp'], set())
    if (i, j) in s: drop['meme_case'] += 1; continue
    s.add((i, j))
obj = {sp: sorted([round((i + .5) * 0.005, 5), round((j + .5) * 0.0075, 5)] for i, j in v) for sp, v in sorted(cells.items())}
block = '/*PUB_OBS_BEGIN*/const PUB_OBS=' + json.dumps(obj, separators=(',', ':')) + ';/*PUB_OBS_END*/'
t = open(html).read()
t2, n = re.subn(r'/\*PUB_OBS_BEGIN\*/.*?/\*PUB_OBS_END\*/', lambda m: block, t, flags=re.S)
assert n == 1, 'marqueurs PUB_OBS absents de ' + html
open(html, 'w').write(t2)
print('cases publiées :', sum(len(v) for v in obj.values()), 'pour', len(obj), 'espèces ; fusionnées/ignorées :', drop)
