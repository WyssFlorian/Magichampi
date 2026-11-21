#!/usr/bin/env python3
"""Calibration GLOBALE du score à partir des observations (iNaturalist/GBIF, coins), sans aucun effet local.
Les observations ne relèvent plus la note du lieu où elles ont été faites ; elles servent ici seulement à régler
neuf multiplicateurs globaux (un par facteur du score : hab, host, wsl, alt, stand, slope, moist, soil, region = SwissFungi).
Multiplicateur 1 = modèle actuel. Méthode : régression « présence contre fond groupe cible » (logit conditionnel : une observation
contre les cellules du fond de SA région), poids bornés 0..3, régularisés vers 1 (λ).
VALIDATION HONNÊTE : validation croisée à 5 plis par blocs de 5 km (un bloc entier est tenu à l'écart ; ni son observation ni son fond
ne servent à l'ajustement), répétée avec 5 découpages ; rang de l'observation tenue à l'écart parmi les forêts (pct) et parmi le fond (pctBg).
ANTI-DOUBLE-COMPTE : (1) une observation une seule fois (clé = indice dans obs.json, donc identifiant GBIF/iNat déjà fusionné par observations.py ;
une observation à cheval sur deux régions (recouvrement de 1 km) n'est gardée que dans la première) ; (2) une cellule par espèce (position ~25 m) ;
(3) les coins iNaturalist déjà présents dans GBIF ont été retirés en amont ; (4) le fond n'est pas compté deux fois par observation (fond de sa région seulement).
usage : calibrer.py <obs.json> <dossier des f_<zone>.json> [sortie.json]"""
import json, sys, random, numpy as np
from scipy.optimize import minimize
obsf, fdir = sys.argv[1], sys.argv[2]; outf = sys.argv[3] if len(sys.argv) > 3 else 'calibration.json'
NAMES = ['hab', 'host', 'wsl_N', 'wsl_B', 'wsl_G', 'alt', 'stand', 'slope', 'moist', 'soil', 'region_voisin', 'region_aucun']; K = len(NAMES)
# wsl : trois groupes d'espèces (N hôtes étroits, B feuillus précis, G généralistes) ; region : multiplicateur propre à « maille voisine » (×0,914) et à « aucune » (×0,83)
ZONES = ['ple', 'lsn', 'gdv', 'nyn', 'bro', 'vul', 'chb', 'pde']
O = json.load(open(obsf))['presences']
def L(a, grp=0):
    a = np.log(np.maximum(1e-4, np.array(a, float))); sh = a.shape; a = a.reshape(-1, 9); o = np.zeros((len(a), K))
    o[:, 0] = a[:, 0]; o[:, 1] = a[:, 1]; o[:, 2 + {1: 0, 2: 1, 0: 2}[grp]] = a[:, 2]; o[:, 5:10] = a[:, 3:8]
    r = a[:, 8]; o[:, 10] = np.where(np.abs(r - np.log(.914)) < 1e-3, r, 0); o[:, 11] = np.where(np.abs(r - np.log(.83)) < 1e-3, r, 0)
    return o.reshape(sh[:-1] + (K,))
rows = []; seen_k = set(); seen_cell = set(); drop = {'meme_observation_2_regions': 0, 'meme_espece_cellule': 0}
for z in ZONES:
    d = json.load(open(f'{fdir}/f_{z}.json'))
    if not d['B'] or not d['S']: continue
    cache = {}; GRP = d['grp']
    def mats(sp):
        if sp not in cache: cache[sp] = (np.array([L(b['f'][sp], GRP[sp]) for b in d['B']]), np.array([L(s['f'][sp], GRP[sp]) for s in d['S']]))
        return cache[sp]
    for p in d['P']:
        if p['k'] in seen_k: drop['meme_observation_2_regions'] += 1; continue
        o = O[p['k']]; ck = (o['sp'], round(o['lat'] / 2.25e-4), round(o['lon'] / 3.3e-4))
        if ck in seen_cell: drop['meme_espece_cellule'] += 1; continue
        seen_k.add(p['k']); seen_cell.add(ck)
        bg, sf = mats(p['sp'])
        rows.append(dict(z=z, sp=p['sp'], blk=p['blk'], f=L(p['f'], GRP[p['sp']]), bg=bg, sf=sf, src=o['src']))
print('observations utilisées', len(rows), '; retirées :', drop, '; par source', {s: sum(r['src'] == s for r in rows) for s in {r['src'] for r in rows}})
def rank(v, a): return (a < v).mean() + .5 * (a == v).mean()
def ll(w, r): s = r['f'] @ w; b = r['bg'] @ w; m = max(s, b.max()); return s - (m + np.log(np.exp(s - m) + np.exp(b - m).sum()))
def ev(w, r): s = r['f'] @ w; return rank(s, r['sf'] @ w), rank(s, r['bg'] @ w), ll(w, r)
def nll(w, rs, lam):
    t = 0
    for r in rs:
        s = r['f'] @ w; b = r['bg'] @ w; m = max(s, b.max()); t += -(s - (m + np.log(np.exp(s - m) + np.exp(b - m).sum())))
    return t / len(rs) + lam * np.sum((w - 1) ** 2)
def fit(rs, lam): return minimize(nll, np.ones(K), args=(rs, lam), method='L-BFGS-B', bounds=[(0, 3)] * K).x
def cv(lam, seed, F=5):
    blks = sorted({r['blk'] for r in rows}); random.Random(seed).shuffle(blks); fold = {b: i % F for i, b in enumerate(blks)}
    out = []
    for k in range(F):
        tr = [r for r in rows if fold[r['blk']] != k]; te = [r for r in rows if fold[r['blk']] == k]
        w = fit(tr, lam) if lam is not None else np.ones(K)
        out += [ev(w, r) for r in te]
    return np.mean(out, axis=0)
res = {'n': len(rows), 'retirees': drop}
base = np.mean([ev(np.ones(K), r) for r in rows], axis=0); res['avant_pct'], res['avant_pctBg'], res['avant_ll'] = map(float, base)
print('modèle actuel (observations distinctes, sans ajustement) : pct %.3f  pctBg %.3f  log-vraisemblance %.3f' % tuple(base))
best = None
for lam in [.3, .1, .03, .01, .003, .001]:
    c = np.mean([cv(lam, s) for s in range(5)], axis=0); print('λ=%-6s CV hors échantillon : pct %.3f  pctBg %.3f  log-vraisemblance %.3f' % (lam, *c))
    res.setdefault('cv', {})[str(lam)] = list(map(float, c))
    if best is None or c[2] > best[1][2]: best = (lam, c)
lam = best[0]; w = fit(rows, lam); res.update(lam=lam, apres_cv_pct=float(best[1][0]), apres_cv_pctBg=float(best[1][1]), apres_cv_ll=float(best[1][2]), poids=dict(zip(NAMES, map(float, w.round(3)))))
# incertitude des multiplicateurs : bootstrap par blocs
rb = random.Random(1); blks = sorted({r['blk'] for r in rows}); bs = []
for _ in range(30):
    pick = [rb.choice(blks) for _ in blks]; rs = [r for b in pick for r in rows if r['blk'] == b]; bs.append(fit(rs, lam))
bs = np.array(bs); res['poids_ic95'] = {n: [float(np.percentile(bs[:, i], 2.5).round(2)), float(np.percentile(bs[:, i], 97.5).round(2))] for i, n in enumerate(NAMES)}
print('λ retenu (meilleure log-vraisemblance hors échantillon)', lam, '| CV : pct %.3f pctBg %.3f ll %.3f' % tuple(best[1])); print('multiplicateurs (1 = actuel)', res['poids']); print('IC95 bootstrap par blocs', res['poids_ic95'])
json.dump(res, open(outf, 'w'), ensure_ascii=False, indent=1)
