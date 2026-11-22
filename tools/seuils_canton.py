#!/usr/bin/env python3
"""Niveaux de couleur absolus sur tout le canton (voir tools/seuils_canton.js).
usage : python3 tools/seuils_canton.py seuils h_ple.json h_lsn.json …   → ZONE.MAP_THR_V6 + ZONE.MAP_AMAX identiques dans les 8 zone.js
        python3 tools/seuils_canton.py multi  m_ple.json m_lsn.json …   → ZONE.MULTI_REF identique dans les 8 zone.js"""
import sys, re, json, glob
mode, files = sys.argv[1], sys.argv[2:]
Q = [.6, .85, .9625]

def put(var, val):
    line = f'ZONE.{var}=' + json.dumps(val, separators=(',', ':')) + ';'
    for p in sorted(glob.glob('*/zone.js')):
        t = open(p).read()
        pat = re.compile(r'^ZONE\.' + var + r'=.*;$', re.M)
        t = pat.sub(lambda m: line, t) if pat.search(t) else t.rstrip('\n') + '\n' + line + '\n'
        open(p, 'w').write(t)
    print(var, len(line), 'octets x', len(glob.glob('*/zone.js')), 'fichiers')

if mode == 'seuils':
    tot, BW = {}, None
    for f in files:
        d = json.load(open(f)); BW = d['BW']
        for sp, h in d['h'].items():
            t = tot.setdefault(sp, {})
            for k, c in h.items(): t[int(k)] = t.get(int(k), 0) + c
    thr, amax = {}, {}
    for sp, h in tot.items():
        ks = sorted(h); n = sum(h.values()); cum = 0; res = []; qi = 0
        for k in ks:
            cum += h[k]
            while qi < 3 and cum > Q[qi] * n:  # première valeur dont le rang dépasse le quantile
                res.append(round((k + .5) * BW, 4)); qi += 1
        thr[sp] = res; amax[sp] = round((ks[-1] + .5) * BW, 4)
    put('MAP_THR_V6', thr); put('MAP_AMAX', amax)
else:
    tot, ns = {}, {}
    for f in files:
        d = json.load(open(f))
        for c, h in d['h'].items():
            t = tot.setdefault(c, {})
            for k, v in h.items(): t[int(k)] = t.get(int(k), 0) + v
        ns = d['n']
    ref = {}
    for c, h in tot.items():
        n = sum(h.values()); out = []
        for q in [.6, .85, .96]:
            cum = 0
            for v in range(max(h) + 2):
                cum += h.get(v, 0)
                if cum >= q * n: out.append(v + 1); break
        ref[c] = out
    ref['_n'] = {c: None for c in []}
    del ref['_n']
    put('MULTI_REF', ref)
    print(ref)
