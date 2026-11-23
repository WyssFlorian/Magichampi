#!/usr/bin/env python3
"""Liste des champignons « les plus courants » par catégorie (Stars / Bons / Intéressants).

Règle : relevés SwissFungi dans le canton de Vaud, tous les relevés (somme des 12 mois de
`months`, un relevé = un enregistrement SwissFungi, sans double comptage : chaque relevé est
rangé sous une seule espèce). Une espèce est « la plus courante » de sa catégorie si elle
totalise au moins SEUIL (4 %) des relevés de toutes les espèces de la catégorie.
Usage : python3 tools/plus_courants.py        -> imprime la ligne `const COMMON_SP=...`
        python3 tools/plus_courants.py --write -> la remplace dans index.html
Affichage seulement : ne sert ni à la calibration ni au score."""
import json, re, sys, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SEUIL = 0.04
h = open(R + "/index.html", encoding="utf-8").read()
E = json.loads(re.search(r'const EXTRA_FUNGI=(\{.*?\});\n', h, re.S).group(1))
F = {**E, **json.load(open(R + "/vd/data.json"))["fungi"]}
sp = re.findall(r'\{id:"(\w+)",tier:(\d),fr:"[^"]*",la:"([^"]*)"', h)
out = {}
for t in "123":
    L = [(sum(F[la]["months"]) if la in F else 0, i) for i, tt, la in sp if tt == t]
    tot = sum(n for n, _ in L)
    out[t] = {"tot": tot, "sp": [[i, n] for n, i in sorted(L, reverse=True) if n >= SEUIL * tot]}
line = "const COMMON_SP=" + json.dumps(out, separators=(",", ":")) + ";"
if "--write" in sys.argv:
    h = re.sub(r'const COMMON_SP=.*?;\n', lambda m: line + "\n", h, 1) if "const COMMON_SP=" in h else h.replace("const TIER_NAMES=", line + "\nconst TIER_NAMES=", 1)
    open(R + "/index.html", "w", encoding="utf-8").write(h)
print(line)
