#!/usr/bin/env python3
"""Garde-fou avant tout commit/publication : échoue si le dépôt contient des données brutes tierces
(rasters, GeoPackage, archives, morceaux .part) ou, avec --sans-wsl, une couche « wsl » dans les tuiles.
usage : python3 tools/verifier_depot_public.py [--sans-wsl]"""
import sys, os, json, subprocess
bad = []
files = subprocess.check_output(['git', 'ls-files'], text=True).split('\n')
for f in files:
    if f.lower().endswith(('.tif', '.tiff', '.gpkg', '.nc', '.zip', '.gz')) or '.part' in f or f.startswith(('data-wsl-essences/', 'raw/')):
        bad.append(f)
    if '--sans-wsl' in sys.argv and '/grid/' in f and f.endswith('.json') and os.path.exists(f):
        if any(l['k'] == 'wsl' for l in json.load(open(f))['layers']): bad.append(f + ' (couche wsl)')
print('\n'.join(bad[:50]) or 'OK : aucune donnée brute tierce suivie par git')
sys.exit(1 if bad else 0)
