#!/usr/bin/env python3
"""Écrit (ou remplace) la ligne ZONE.MAP_THR_V6=...; de <zone>/zone.js à partir du JSON imprimé par tools/seuils.js.
usage : python3 tools/ecrire_seuils.py <zone> <seuils.json>"""
import sys, re, json
z, f = sys.argv[1:3]
thr = json.dumps(json.load(open(f)), separators=(',', ':'))
p = f'{z}/zone.js'; t = open(p).read()
line = f'ZONE.MAP_THR_V6={thr};'
if re.search(r'^ZONE\.MAP_THR_V6=.*;$', t, re.M): t = re.sub(r'^ZONE\.MAP_THR_V6=.*;$', lambda m: line, t, flags=re.M)
else: t = t.rstrip('\n') + '\n' + line + '\n'
open(p, 'w').write(t); print(p, 'MAP_THR_V6', len(thr), 'octets')
