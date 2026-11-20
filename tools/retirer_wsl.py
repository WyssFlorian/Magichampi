#!/usr/bin/env python3
"""Fabrique une copie du site SANS la couche « wsl » (essence dominante de la carte WSL 10 m) dans les tuiles <zone>/grid/.
Le modèle fonctionne sans elle (wslF renvoie 1 si G.wsl est absent) : seules les espèces à hôte précis perdent le facteur « essence ».
usage : python3 -I retirer_wsl.py <dossier Magichampi> <dossier de sortie>   (ne modifie jamais la source)"""
import sys, os, json, gzip, base64, shutil
src, out = sys.argv[1], sys.argv[2]
SIZE = {'uint8': 1, 'int8': 1, 'int16': 2, 'uint16': 2, 'int32': 4, 'uint32': 4, 'float32': 4}
n = 0
for z in ('ple', 'lsn', 'gdv'):
    os.makedirs(f'{out}/{z}/grid', exist_ok=True)
    for fn in sorted(os.listdir(f'{src}/{z}/grid')):
        d = json.load(open(f'{src}/{z}/grid/{fn}'))
        ks = [l['k'] for l in d['layers']]
        if 'wsl' in ks:
            assert ks[-1] == 'wsl', 'wsl doit être la dernière couche'
            raw = gzip.decompress(base64.b64decode(d['b64']))
            cut = d['w'] * d['h'] * SIZE[d['layers'][-1]['t']]
            d['layers'].pop(); raw = raw[:-cut]
            d['b64'] = base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode(); n += 1
        json.dump(d, open(f'{out}/{z}/grid/{fn}', 'w'), separators=(',', ':'))
print(n, 'tuiles sans couche wsl')
