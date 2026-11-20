#!/usr/bin/env python3
"""Ajoute aux tuiles <zone>/grid/c_i_j.json la couche « wsl » (essence dominante, carte WSL 10 m Koch et al. 2024).
Valeur : 0 = inconnu (hors forêt, hors zone d'applicabilité, série incomplète), 1..15 = classe WSL + 1
(1 Abies alba, 2 Acer pseudoplatanus, 3 Alnus glutinosa, 4 Alnus incana, 5 Betula pendula, 6 Castanea sativa, 7 Fagus sylvatica,
8 Fraxinus excelsior, 9 Picea abies, 10 Pinus cembra, 11 Pinus mugo arborea, 12 Pinus sylvestris, 13 Quercus petraea,
14 Quercus robur, 15 Sorbus aucuparia). Par cellule de 25 m : classe majoritaire de 3 x 3 points (≥ 2 votes valides).
usage : python3 -I wsl_vers_tuiles.py <raster.tif> <dossier Magichampi> [zone ...]
Le raster (non versionné, accès sur demande auprès du WSL) se reconstruit depuis le dépôt privé app-champignons (data-wsl-essences/LIRE_MOI.md)."""
import sys, os, json, gzip, base64
import numpy as np, rasterio
from pyproj import Transformer
from rasterio.windows import Window

tif, root = sys.argv[1], sys.argv[2]
zones = sys.argv[3:] or ['ple', 'lsn', 'gdv']
src = rasterio.open(tif)
T = Transformer.from_crs(3857, 3035, always_xy=True)
OFF = (-25 / 3, 0, 25 / 3)
stats = {}
for z in zones:
    meta = json.load(open(f'{root}/{z}/data.json'))['meta']['grid']
    x0, y1, res, cols, rows, cs = meta['x0'], meta['y1'], meta['res'], meta['cols'], meta['rows'], meta['cs']
    # fenêtre du raster couvrant la zone
    xs = [x0, x0 + cols * res]; ys = [y1 - rows * res, y1]
    px, py = T.transform([xs[0], xs[1], xs[0], xs[1]], [ys[0], ys[0], ys[1], ys[1]])
    c0 = int((min(px) - src.transform.c) / 10) - 3; c1 = int((max(px) - src.transform.c) / 10) + 4
    r0 = int((src.transform.f - max(py)) / 10) - 3; r1 = int((src.transform.f - min(py)) / 10) + 4
    arr = src.read(1, window=Window(c0, r0, c1 - c0, r1 - r0))
    a = np.where(np.isnan(arr), 255, arr).astype(np.uint8)
    W = np.zeros((rows, cols), np.uint8)
    cc, rr = np.meshgrid(np.arange(cols), np.arange(rows))
    votes = np.zeros((rows, cols, 15), np.uint8)
    for dx in OFF:
        for dy in OFF:
            X = x0 + (cc + .5) * res + dx; Y = y1 - (rr + .5) * res + dy
            ex, ey = T.transform(X, Y)
            ci = ((ex - src.transform.c) / 10).astype(int) - c0; ri = ((src.transform.f - ey) / 10).astype(int) - r0
            ok = (ci >= 0) & (ci < a.shape[1]) & (ri >= 0) & (ri < a.shape[0])
            v = np.full((rows, cols), 255, np.uint8); v[ok] = a[ri[ok], ci[ok]]
            for k in range(15): votes[:, :, k] += (v == k)
    best = votes.argmax(2); tot = votes.sum(2)
    W = np.where(tot >= 2, best + 1, 0).astype(np.uint8)
    n = 0; nf = 0; nk = 0
    for fn in sorted(os.listdir(f'{root}/{z}/grid')):
        p = f'{root}/{z}/grid/{fn}'
        _, i, j = fn[:-5].split('_'); i = int(i); j = int(j)
        d = json.load(open(p))
        raw = bytearray(gzip.decompress(base64.b64decode(d['b64'])))
        w, h = d['w'], d['h']
        if any(l['k'] == 'wsl' for l in d['layers']):
            raise SystemExit('couche wsl déjà présente : repartir des tuiles d\'origine')
        sub = W[j * cs:j * cs + h, i * cs:i * cs + w]
        sub = np.pad(sub, ((0, h - sub.shape[0]), (0, w - sub.shape[1])))
        raw += sub.astype(np.uint8).tobytes()
        d['layers'].append({'k': 'wsl', 't': 'uint8', 'delta': False})
        fx = np.frombuffer(raw, np.uint8, w * h, 0)  # fx = première couche (uint8)
        nf += int((fx > 0).sum()); nk += int(((fx > 0) & (sub.reshape(-1) > 0)).sum())
        d['b64'] = base64.b64encode(gzip.compress(bytes(raw), 9, mtime=0)).decode()
        json.dump(d, open(p, 'w'), separators=(',', ':'))
    stats[z] = dict(cellules_foret=nf, avec_essence=nk, part=round(nk / max(nf, 1), 3),
                    classes={int(k): int(v) for k, v in zip(*np.unique(W[W > 0], return_counts=True))})
    print(z, stats[z])
