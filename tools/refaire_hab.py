#!/usr/bin/env python3
"""Recalcule la couche « hab » (type de forêt, Carte des milieux naturels OFEV/WSL v1.2, TypoCH 6.x) des tuiles d'une région
avec TOUS les cantons que la région touche (la première version n'utilisait que le canton de Vaud : Vully, Broye, Chablais alpin,
Pays-d'Enhaut avaient 5 à 43 % de forêts classées au lieu de 84 à 93 %).
usage : python3 tools/refaire_hab.py <zone> <dossier des .gdb : contient vd/ fr/ vs/ be/ ...> [cantons séparés par des virgules]
Ne touche que les cellules de forêt (fx > 0) ; les autres couches ne changent pas. Écrit les tuiles <zone>/grid/c_*.json en place."""
import sys, os, json, gzip, base64, glob
import numpy as np, pyogrio, pandas as pd, geopandas as gpd
from rasterio import features
from rasterio.transform import from_origin

CODES = [('6.1', 1), ('6.2.4', 2), ('6.2.5', 4), ('6.2', 3), ('6.3', 5), ('6.4', 6), ('6.5', 7), ('6.6', 8)]
def code(t):
    if t.startswith('6.1'): return 1
    if t == '6.2.4': return 2
    if t == '6.2.5': return 4
    if t.startswith('6.2'): return 3
    if t.startswith('6.3'): return 5
    if t.startswith('6.4'): return 6
    if t.startswith('6.5'): return 7
    if t.startswith('6.6'): return 8
    return 0

z, root = sys.argv[1:3]
cantons = sys.argv[3].split(',') if len(sys.argv) > 3 else ['vd', 'fr', 'vs', 'be']
D = json.load(open(f'{z}/data.json')); G = D['meta']['grid']; res = G['res']; cols, rows = G['cols'], G['rows']
T = from_origin(G['x0'], G['y1'], res, res)
# emprise en EPSG:2056 pour filtrer la lecture
from pyproj import Transformer
t = Transformer.from_crs(3857, 2056, always_xy=True)
xs, ys = zip(*[t.transform(G['x0'] + a * cols * res, G['y1'] - b * rows * res) for a in (0, 1) for b in (0, 1)])
bbox = (min(xs) - 500, min(ys) - 500, max(xs) + 500, max(ys) + 500)
parts = []
for c in cantons:
    g = glob.glob(f'{root}/{c}/*.gdb')[0]; ly = [l[0] for l in pyogrio.list_layers(g)][0]
    d = pyogrio.read_dataframe(g, layer=ly, bbox=bbox, columns=['TypoCH'], where="TypoCH LIKE '6%'")
    print(c, len(d), 'polygones', flush=True); parts.append(d)
d = gpd.GeoDataFrame(pd.concat(parts), crs=2056); d['c'] = d.TypoCH.map(code); d = d[d.c > 0].to_crs(3857)
hab = features.rasterize(((g, int(v)) for g, v in zip(d.geometry, d.c)), out_shape=(rows, cols), transform=T, fill=0, dtype='uint8')
SZ = {'int16': 2, 'uint16': 2, 'uint8': 1, 'int8': 1}
tot = known = known0 = 0
for f in sorted(glob.glob(f'{z}/grid/c_*.json')):
    i, j = map(int, os.path.basename(f)[2:-5].split('_')); c = json.load(open(f)); w, h = c['w'], c['h']; n = w * h
    raw = bytearray(gzip.decompress(base64.b64decode(c['b64']))); off = {}; o = 0
    for L in c['layers']: off[L['k']] = o; o += n * SZ[L['t']]
    fx = np.frombuffer(raw, np.uint8, n, off['fx']).reshape(h, w)
    old = np.frombuffer(raw, np.uint8, n, off['hab']).reshape(h, w).copy()
    new = hab[j * G['cs']:j * G['cs'] + h, i * G['cs']:i * G['cs'] + w]
    out = np.where(fx > 0, new, old).astype(np.uint8)
    tot += (fx > 0).sum(); known0 += ((fx > 0) & (old > 0)).sum(); known += ((fx > 0) & (out > 0)).sum()
    raw[off['hab']:off['hab'] + n] = out.tobytes()
    c['b64'] = base64.b64encode(gzip.compress(bytes(raw), 9)).decode()
    json.dump(c, open(f, 'w'), separators=(',', ':'))
print(f'{z}: type de forêt connu {100*known0/tot:.1f} % -> {100*known/tot:.1f} % des cellules de forêt')
