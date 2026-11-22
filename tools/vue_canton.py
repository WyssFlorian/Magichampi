#!/usr/bin/env python3
"""Vue d'ensemble du canton de Vaud (zone « vd ») : fusion des 8 régions à faible résolution pour les zooms éloignés.

usage (depuis la racine du dépôt) :  python3 tools/vue_canton.py [grille] [fond] [meteo]   (sans argument : tout)

 grille : agrège les grilles de 25 m des régions (ple, lsn, gdv, nyn, bro, vul, chb, pde) en blocs de 250 m (≈ 170 m réels)
          -> vd/grid/c_*.json, vd/data.json (méta, relevés SwissFungi fusionnés, météo à 4 km), vd/zone.js, vd/places.json, vd/files.json
 fond   : fond de carte swisstopo sans noms (swissTLM3D) et photo aérienne, zooms 8 à 11, tout le canton -> vd/tiles/, vd/tiles_index.json
 meteo  : (inclus dans « grille ») la météo de la zone vd est reprise des régions ; ensuite l'Action « Météo » la met à jour seule
          (elle traite tous les */data.json).
Aucun fichier des régions n'est modifié. Dépendances : numpy, Pillow.
"""
import json, base64, gzip, os, sys, math, subprocess, io
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REG = ["ple", "lsn", "gdv", "nyn", "bro", "vul", "chb", "pde"]
OUT = os.path.join(ROOT, "vd")
F = 10                 # facteur d'agrégation : 25 m (Mercator) -> 250 m
RES = 25 * F
MIN_FOREST = 20        # nombre minimal de cellules de forêt (sur ~100) pour qu'un bloc soit de la forêt
MET_STEP = 4           # météo : un point sur 4 de la grille MétéoSuisse de 1 km (4 km)
LAYERS = [("fx", "uint8"), ("dem", "int16"), ("midx", "uint16"), ("slope", "uint8"), ("aspect", "uint8"), ("conif", "uint8"), ("vhm", "uint8"),
          ("tpi", "int8"), ("edge", "uint8"), ("sq", "uint16"), ("zone", "uint16"), ("hab", "uint8"), ("mi", "int8"), ("ca", "uint8"), ("rg", "uint8"), ("wsl", "uint8")]
DT = {"int16": np.int16, "uint16": np.uint16, "uint8": np.uint8, "int8": np.int8}
R_EARTH = 6378137.0


def dec_chunk(path):
    j = json.load(open(path)); w, h = j["w"], j["h"]; n = w * h
    buf = np.frombuffer(gzip.decompress(base64.b64decode(j["b64"])), dtype=np.uint8); off = 0; out = {}
    for L in j["layers"]:
        k, t, d = L["k"], L["t"], L["delta"]; dt = DT[t]; isz = np.dtype(dt).itemsize
        if isz == 1:
            a = buf[off:off + n].view(dt).copy().reshape(h, w)
        else:
            lo = buf[off:off + n].astype(np.uint16); hi = buf[off + n:off + 2 * n].astype(np.uint16); v = (lo | (hi << 8)).astype(np.uint16)
            if d or t == "int16": v = v.view(np.int16)
            a = v.reshape(h, w)
            if d: a = np.cumsum(a.astype(np.int64), axis=1)
            a = a.astype(dt)
        off += n * isz; out[k] = a
    return out


def load_region(z):
    d = json.load(open(f"{ROOT}/{z}/data.json")); G = d["meta"]["grid"]; cs = G["cs"]; A = {}
    for i, j in G["chunks"]:
        c = dec_chunk(f"{ROOT}/{z}/grid/c_{i}_{j}.json")
        for k, a in c.items():
            if k not in A: A[k] = np.zeros((G["rows"], G["cols"]), a.dtype)
            h, w = a.shape; A[k][j * cs:j * cs + h, i * cs:i * cs + w] = a
    return d, A


def enc_layer(a, t):
    a = np.ascontiguousarray(a)
    if np.dtype(DT[t]).itemsize == 1: return a.astype(DT[t]).tobytes()
    v = a.astype(np.int64) & 0xFFFF
    return (v & 0xFF).astype(np.uint8).tobytes() + (v >> 8).astype(np.uint8).tobytes()


def merc_to_ll(x, y):
    return math.degrees(y / R_EARTH * 0 + (2 * math.atan(math.exp(y / R_EARTH)) - math.pi / 2)), math.degrees(x / R_EARTH)


def grille():
    os.makedirs(f"{OUT}/grid", exist_ok=True)
    data = {z: json.load(open(f"{ROOT}/{z}/data.json")) for z in REG}
    # emprise commune (Mercator)
    gx0 = min(d["meta"]["grid"]["x0"] for d in data.values()); gy1 = max(d["meta"]["grid"]["y1"] for d in data.values())
    gx1 = max(d["meta"]["grid"]["x0"] + d["meta"]["grid"]["cols"] * 25 for d in data.values()); gy0 = min(d["meta"]["grid"]["y1"] - d["meta"]["grid"]["rows"] * 25 for d in data.values())
    cols = int(math.ceil((gx1 - gx0) / RES)); rows = int(math.ceil((gy1 - gy0) / RES)); NB = cols * rows
    print("grille canton", cols, "x", rows, "=", NB, "blocs")
    # carrés SwissFungi : table commune
    sq_all = {}
    for z in REG:
        for q in data[z]["meta"]["squares"]: sq_all[q["id"]] = q
    sq_ids = sorted(sq_all)
    S = lambda n: np.zeros(NB, np.float64)
    n1 = S(0); n23 = S(0); n4 = S(0); nf = S(0)
    s_dem = S(0); c_dem = S(0); s_slope = S(0); s_cos = S(0); s_sin = S(0); s_conif = S(0); c_conif = S(0); s_vhm = S(0); s_tpi = S(0); s_edge = S(0); s_mi = S(0)
    H = {k: np.zeros((NB, 16), np.uint32) for k in ("hab", "wsl", "ca")}
    sq_b = np.full(NB, -1, np.int32); nodeE = np.zeros(NB); nodeN = np.zeros(NB); node_ok = np.zeros(NB, bool); src_reg = np.full(NB, -1, np.int8)
    for ri, z in enumerate(REG):
        d, A = load_region(z); m = d["meta"]; g = m["grid"]
        rr, cc = np.nonzero(A["fx"] > 0)
        X = g["x0"] + (cc + .5) * 25; Y = g["y1"] - (rr + .5) * 25
        bx = np.floor((X - gx0) / RES).astype(np.int64); by = np.floor((gy1 - Y) / RES).astype(np.int64)
        ok = (bx >= 0) & (bx < cols) & (by >= 0) & (by < rows); rr, cc, bx, by = rr[ok], cc[ok], bx[ok], by[ok]
        b = by * cols + bx; v = {k: A[k][rr, cc] for k in A}
        bc = lambda w=None: np.bincount(b, weights=w, minlength=NB)
        f = v["fx"]
        n1 += bc(f == 1); n23 += bc((f == 2) | (f == 3)); n4 += bc(f == 4); nf += bc()
        dm = v["dem"] > 0; s_dem += np.bincount(b[dm], weights=v["dem"][dm].astype(float), minlength=NB); c_dem += np.bincount(b[dm], minlength=NB)
        s_slope += bc(v["slope"].astype(float)); ang = v["aspect"].astype(float) * 2 * np.pi / 180
        s_cos += bc(np.cos(ang)); s_sin += bc(np.sin(ang))
        cm = v["conif"] <= 100; s_conif += np.bincount(b[cm], weights=v["conif"][cm].astype(float), minlength=NB); c_conif += np.bincount(b[cm], minlength=NB)
        s_vhm += bc(v["vhm"].astype(float)); s_tpi += bc(v["tpi"].astype(float)); s_edge += bc(v["edge"].astype(float)); s_mi += bc(v["mi"].astype(float))
        for k in H:
            nz = (v[k] > 0) & (v[k] < 16)
            H[k] += np.bincount(b[nz] * 16 + v[k][nz].astype(np.int64), minlength=NB * 16).reshape(NB, 16).astype(np.uint32)
        # carré SwissFungi : index dans la table commune (dernier écrit)
        lut = np.array([sq_ids.index(q["id"]) for q in m["squares"]] + [0] * 256, np.int32)
        sq_b[b] = lut[v["sq"].astype(np.int64)]
        # point météo (E, N) de la région pour chaque bloc
        me = d["meteo"]; mi_ = v["midx"].astype(np.int64)
        nodeE[b] = np.array(me["E"])[mi_ % me["nE"]]; nodeN[b] = np.array(me["N"])[mi_ // me["nE"]]; node_ok[b] = True; src_reg[b] = ri
        print(" ", z, "ok", len(b), "cellules de forêt")
        del A, v
    cnt = np.maximum(nf, 1)
    forest = nf >= MIN_FOREST
    fx = np.zeros(NB, np.uint8)
    fx[forest & (n1 >= .4 * nf)] = 1
    rest = forest & (fx == 0)
    fx[rest & (n4 >= n23)] = 4; fx[rest & (n4 < n23)] = 2
    mean = lambda s, c: np.where(c > 0, s / np.maximum(c, 1), 0)
    out = {}
    out["fx"] = fx
    out["dem"] = np.rint(mean(s_dem, c_dem)).astype(np.int16)
    out["slope"] = np.rint(mean(s_slope, cnt)).astype(np.uint8)
    out["aspect"] = (np.rint((np.degrees(np.arctan2(s_sin, s_cos)) % 360) / 2) % 181).astype(np.uint8)
    out["conif"] = np.where(c_conif > 0, np.rint(mean(s_conif, c_conif)), 255).astype(np.uint8)
    out["vhm"] = np.rint(mean(s_vhm, cnt)).clip(0, 255).astype(np.uint8)
    out["tpi"] = np.rint(mean(s_tpi, cnt)).clip(-128, 127).astype(np.int8)
    out["edge"] = np.rint(mean(s_edge, cnt)).clip(0, 255).astype(np.uint8)
    out["mi"] = np.rint(mean(s_mi, cnt)).clip(-100, 100).astype(np.int8)
    for k in H:
        h = H[k]; mode = h.argmax(axis=1); out[k] = np.where(h.max(axis=1) > 0, mode, 0).astype(np.uint8)
    out["sq"] = np.where(sq_b >= 0, sq_b, 0).astype(np.uint16)
    out["zone"] = np.zeros(NB, np.uint16); out["rg"] = np.zeros(NB, np.uint8)
    for k in out:
        if k not in ("fx",): out[k] = np.where(fx > 0, out[k], 255 if k == "conif" else 0).astype(out[k].dtype)
    # carrés SwissFungi réellement utilisés : table compacte
    used = np.unique(out["sq"][fx > 0]); remap = np.zeros(len(sq_ids), np.int64); remap[used] = np.arange(len(used))
    out["sq"] = np.where(fx > 0, remap[out["sq"].astype(np.int64)], 0).astype(np.uint16)
    squares = [sq_all[sq_ids[i]] for i in used]; print("carrés SwissFungi utilisés :", len(squares))
    # ---- météo à 4 km ----
    meteo, nodeidx = build_meteo(data, nodeE, nodeN, node_ok & (fx > 0))
    out["midx"] = np.where(fx > 0, nodeidx, 0).astype(np.uint16)
    # ---- écriture des tuiles de grille ----
    cs = 256; chunks = []
    for j in range((rows + cs - 1) // cs):
        for i in range((cols + cs - 1) // cs):
            r0, c0 = j * cs, i * cs; h = min(cs, rows - r0); w = min(cs, cols - c0)
            sub = {k: out[k].reshape(rows, cols)[r0:r0 + h, c0:c0 + w] for k in out}
            if not (sub["fx"] > 0).any(): continue
            raw = b"".join(enc_layer(sub[k], t) for k, t in LAYERS)
            gz = gzip.compress(raw, 9, mtime=0)
            json.dump({"w": w, "h": h, "layers": [{"k": k, "t": t, "delta": False} for k, t in LAYERS], "b64": base64.b64encode(gz).decode()},
                      open(f"{OUT}/grid/c_{i}_{j}.json", "w"), separators=(",", ":"))
            chunks.append([i, j])
    print("tuiles de grille :", len(chunks))
    # ---- méta, relevés fusionnés ----
    s, w = merc_to_ll(gx0, gy0); n, e = merc_to_ll(gx1, gy1)
    ple = data["ple"]
    polys = {}; clab = {}
    for z in REG:
        for k, p in data[z]["meta"].get("polys", {}).items(): polys[k] = p
        for c in data[z]["meta"].get("clab", []): clab[(c[0])] = c
    meta = {"rows": rows, "cols": cols, "res": RES, "x0": gx0, "y0": gy1 - rows * RES, "x1": gx0 + cols * RES, "y1": gy1,
            "bounds": [[round(s, 5), round(w, 5)], [round(n, 5), round(e, 5)]],
            "areas": [{"id": "vd", "name": "Canton de Vaud (vue d'ensemble)", "short": "Canton", "bounds": [[round(s, 5), round(w, 5)], [round(n, 5), round(e, 5)]], "maxz": 11}],
            "order": ple["meta"]["order"], "dtypes": {k: t for k, t in LAYERS},
            "squares": squares, "polys": {k: polys[k] for k in polys if k in {q["id"] for q in squares}},
            "grid": {"cs": cs, "chunks": chunks, "cols": cols, "rows": rows, "x0": gx0, "y1": gy1, "res": RES},
            "view": [[46.2, 6.1], [46.95, 7.25]], "basemaps": [], "thr": {}, "model": ple["meta"]["model"], "rg": [], "thrScope": ple["meta"].get("thrScope"),
            "zn": {}, "znl": [""], "zcl": [], "clab": list(clab.values()), "overview": True}
    fungi = {}
    for z in REG:
        for sp, f in data[z]["fungi"].items():
            g = fungi.setdefault(sp, {"months": list(f["months"]), "squares": {}, "elev": [], "n": 0})
            g["months"] = [max(a, b) for a, b in zip(g["months"], f["months"])]
            for k, a in f["squares"].items():
                if k not in g["squares"] or a[0] > g["squares"][k][0]: g["squares"][k] = a
    for sp, g in fungi.items():
        # seuls les carrés de la table sont lus ; on garde aussi les voisins (utilisés par le facteur « près »)
        g["n"] = sum(a[0] for a in g["squares"].values())
    json.dump({"meta": meta, "meteo": meteo, "fungi": fungi, "obs": []}, open(f"{OUT}/data.json", "w"), ensure_ascii=False, separators=(",", ":"))
    # ---- places, zone.js, fichiers vides, files.json ----
    pl = {}
    for z in REG:
        p = f"{ROOT}/{z}/places.json"
        if os.path.exists(p):
            for q in json.load(open(p)): pl[(q[0], round(q[1], 3), round(q[2], 3))] = q
    json.dump(sorted(pl.values(), key=lambda q: (q[3], q[0])), open(f"{OUT}/places.json", "w"), ensure_ascii=False, separators=(",", ":"))
    for nm in ("reserves", "acces", "sentiers", "routes", "cours_eau"):
        json.dump({"type": "FeatureCollection", "features": []}, open(f"{OUT}/{nm}.geojson", "w"))
    zjs = open(f"{ROOT}/nyn/zone.js").read().split("\n")
    keep = [l for l in zjs if l.startswith(("ZONE.MAP_THR_V6", "ZONE.MAP_AMAX", "ZONE.MULTI_REF"))]
    # sorties des sociétés : union de celles des régions (mêmes données, une seule fois par identifiant)
    src, sp_ = {}, {}
    for z in REG:
        for l in open(f"{ROOT}/{z}/zone.js").read().split("\n"):
            if l.startswith(("ZONE.SORT_SRC=", "ZONE.SORT_P=")):
                v = json.loads(l.split("=", 1)[1].rstrip().rstrip(";"))
                if isinstance(v, dict): src.update({k: x for k, x in v.items() if k not in src})
                else:
                    for q in v: sp_.setdefault(q["id"], q)
    head = ['/* Vue d\'ensemble du canton (générée par tools/vue_canton.py) : seuils et références communs à tout le canton, pas de couches locales */', "var ZONE={};",
            'ZONE.id="vd";ZONE.title="Champignons – Canton de Vaud";ZONE.sub="Vue d\'ensemble du canton de Vaud";ZONE.mb="\\u2248 %s Mo";' % "@MB@",
            "ZONE.SORT_SRC=" + json.dumps(src, ensure_ascii=False, separators=(",", ":")) + ";", "ZONE.SORT_P=" + json.dumps(list(sp_.values()), ensure_ascii=False, separators=(",", ":")) + ";", "ZONE.MAP_THR_EXTRA={};", "ZONE.SHOOT_Z=[];", "ZONE.HUNT_FREE=[];"]
    open(f"{OUT}/zone.js", "w").write("\n".join(head + keep) + "\n")
    print("grille et données écrites ; lancer « fond » puis « fichiers »")


def build_meteo(data, nodeE, nodeN, need):
    """Météo à 4 km : pour chaque point de 4 km, copie des séries du point de 1 km le plus proche (une région qui le contient)."""
    # séries alignées sur les 46 derniers jours (mêmes dates que ple/lsn/gdv), les autres régions en gardent 53
    ref = data["ple"]["meteo"]; dates = ref["dates"]; nobs = ref["nobs"]
    allE = []; allN = []
    for z, d in data.items():
        me = d["meteo"]; allE += me["E"]; allN += me["N"]
    E0 = min(allE); N0 = min(allN); nE = int((max(allE) - E0) // (1000 * MET_STEP)) + 1; nN = int((max(allN) - N0) // (1000 * MET_STEP)) + 1
    ncell = nE * nN
    best = {}   # idx -> (dist, region, m)
    for z, d in data.items():
        me = d["meteo"]
        for m in range(me["nE"] * me["nN"]):
            if me["tabsd"][m] is None: continue
            e = me["E"][m % me["nE"]]; n = me["N"][m // me["nE"]]
            a = int(round((e - E0) / (1000 * MET_STEP))); b = int(round((n - N0) / (1000 * MET_STEP)))
            if not (0 <= a < nE and 0 <= b < nN): continue
            dist = math.hypot(e - (E0 + 1000 * MET_STEP * a), n - (N0 + 1000 * MET_STEP * b)); k = b * nE + a
            if k not in best or dist < best[k][0]: best[k] = (dist, z, m)
    VARS = ["rprelimd", "tabsd", "tmind", "sreld"]
    me_out = {"dates": dates, "nE": nE, "nN": nN, "E": [E0 + 1000 * MET_STEP * a for a in range(nE)], "N": [N0 + 1000 * MET_STEP * b for b in range(nN)],
              "dem": [None] * ncell, "nobs": nobs, "fc_run": ref["fc_run"]}
    for v in VARS: me_out[v] = [None] * ncell
    for k, (dist, z, m) in best.items():
        me = data[z]["meteo"]; off = me["dates"].index(dates[0])
        me_out["dem"][k] = me["dem"][m]
        for v in VARS: me_out[v][k] = me[v][m][off:off + len(dates)] if me[v][m] is not None else None
        for v in VARS:
            if me_out[v][k] is not None and len(me_out[v][k]) < len(dates): me_out[v][k] += [None] * (len(dates) - len(me_out[v][k]))
    # indice de point de 4 km le plus proche (vivant) pour chaque bloc
    live = np.array([me_out["tabsd"][k] is not None for k in range(ncell)])
    a = np.rint((nodeE - E0) / (1000 * MET_STEP)).astype(np.int64).clip(0, nE - 1); b = np.rint((nodeN - N0) / (1000 * MET_STEP)).astype(np.int64).clip(0, nN - 1)
    idx = b * nE + a
    bad = need & ~live[idx]
    if bad.any():
        li = np.nonzero(live)[0]; lx = (li % nE).astype(float); ly = (li // nE).astype(float)
        for q in np.nonzero(bad)[0]:
            idx[q] = li[np.argmin((lx - a[q]) ** 2 + (ly - b[q]) ** 2)]
    print("météo : %d points de 4 km (dont %d vivants), %d jours" % (ncell, live.sum(), len(dates)))
    return me_out, idx


def fond():
    import urllib.request
    from concurrent.futures import ThreadPoolExecutor
    from PIL import Image
    os.makedirs(f"{OUT}/tiles", exist_ok=True)
    d = json.load(open(f"{OUT}/data.json"))["meta"]["bounds"]; (s, w), (n, e) = d
    def tile(z, la, lo):
        nn = 2 ** z; x = int((lo + 180) / 360 * nn); y = int((1 - math.asinh(math.tan(math.radians(la))) / math.pi) / 2 * nn); return x, y
    SRC = {"tlm": ("ch.swisstopo.swisstlm3d-karte-farbe", "png"), "ortho": ("ch.swisstopo.swissimage", "jpeg")}
    def opaque(im):   # les tuiles PNG sont transparentes hors de la Suisse : fond gris clair (sinon noir une fois en JPEG)
        im = im.convert("RGBA"); bg = Image.new("RGBA", im.size, (232, 232, 226, 255)); return Image.alpha_composite(bg, im).convert("RGB")
    index = {"B": 4, "packs": {"carte": {}, "ortho": {}, "tlm": {}}}
    def get(url):
        for t in range(4):
            try:
                with urllib.request.urlopen(url, timeout=40) as r: return r.read()
            except Exception as ex: err = ex
        raise err
    for name, (layer, ext) in SRC.items():
        for z in range(8, 12):
            x0, y1_ = tile(z, s, w); x1, y0_ = tile(z, n, e); ys = (y0_, y1_)
            xr = range(x0, x1 + 1); yr = range(min(ys), max(ys) + 1)
            jobs = [(x, y) for x in xr for y in yr]
            with ThreadPoolExecutor(6) as ex:
                imgs = dict(zip(jobs, ex.map(lambda p: opaque(Image.open(io.BytesIO(get(f"https://wmts.geo.admin.ch/1.0.0/{layer}/default/current/3857/{z}/{p[0]}/{p[1]}.{ext}")))), jobs)))
            packs = {}
            for (x, y) in jobs: packs.setdefault((x >> 2, y >> 2), []).append((x, y))
            ent = []
            for (bx, by), ts in packs.items():
                ax0 = min(t[0] for t in ts); ax1 = max(t[0] for t in ts); ay0 = min(t[1] for t in ts); ay1 = max(t[1] for t in ts)
                im = Image.new("RGB", ((ax1 - ax0 + 1) * 256, (ay1 - ay0 + 1) * 256), (230, 230, 225))
                for (x, y) in ts: im.paste(imgs[(x, y)], ((x - ax0) * 256, (y - ay0) * 256))
                im.save(f"{OUT}/tiles/{name}-{z}-{bx}-{by}.jpg", quality=72, optimize=True)
                ent.append([bx, by, ax0, ay0, ax1, ay1])
            index["packs"][name][str(z)] = ent
            print(name, z, len(jobs), "tuiles,", len(ent), "paquets")
    json.dump(index, open(f"{OUT}/tiles_index.json", "w"), separators=(",", ":"))


def fichiers():
    fl = []
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            p = os.path.relpath(os.path.join(dp, f), OUT)
            if p not in ("files.json", "zone.js"): fl.append(p.replace(os.sep, "/"))
    fl.sort(); json.dump(fl, open(f"{OUT}/files.json", "w"), separators=(",", ":"))
    mb = sum(os.path.getsize(os.path.join(OUT, f)) for f in fl) / 1e6
    zj = open(f"{OUT}/zone.js").read().replace("@MB@", "%d" % math.ceil(mb)); open(f"{OUT}/zone.js", "w").write(zj)
    print("files.json :", len(fl), "fichiers,", round(mb, 1), "Mo")


if __name__ == "__main__":
    a = set(sys.argv[1:]) or {"grille", "fond", "fichiers"}
    if "grille" in a: grille()
    if "fond" in a: fond()
    if "fichiers" in a: fichiers()
