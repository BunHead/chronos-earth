#!/usr/bin/env python3
"""osm-3d-plan.py -- a site's OpenStreetMap Simple-3D-Buildings data as a true-metre plan.

  python3 scripts/osm-3d-plan.py <map.json from api.openstreetmap.org/api/0.6/map.json> \
      <lat0> <lon0> <outline way id> <dates.json> <out.json> [margin m]

Keeps every building / building:part (and historic ruins) whose centroid lies
inside the outline way (buffered by `margin`), applying the S3DB rule: a
building outline that has building:parts inside it is not drawn itself.
Heights: height / min_height / roof:height / building:levels as tagged; else
the kind's default. Each part gets a `from` (and optional `until`) year from
dates.json: {"byName": {name: [from, until?, kind?]}, "byId": {...},
"defaultFrom": year}. A part takes the date of the named building it stands in
(or of the nearest named building within 12 m) when it has no name of its own.
Coordinates: metres, x east, y north of (lat0, lon0).
OpenStreetMap data (c) OpenStreetMap contributors, ODbL 1.0.
"""
import json, math, sys

src, lat0, lon0, outline_id, dates_f, out_f = sys.argv[1:7]
margin = float(sys.argv[7]) if len(sys.argv) > 7 else 0
lat0, lon0, outline_id = float(lat0), float(lon0), int(outline_id)
d = json.load(open(src))
D = json.load(open(dates_f))
nodes = {e['id']: (e['lat'], e['lon']) for e in d['elements'] if e['type'] == 'node'}
W = {e['id']: e for e in d['elements'] if e['type'] == 'way'}
k = 111320 * math.cos(math.radians(lat0))
def xy(n):
    la, lo = nodes[n]
    return (round((lo - lon0) * k, 2), round((la - lat0) * 110574, 2))
def ring(w):
    p = [xy(n) for n in w['nodes']]
    if len(p) > 1 and p[0] == p[-1]: p = p[:-1]
    return p
def pip(p, x, y):
    ins = False; j = len(p) - 1
    for i in range(len(p)):
        xi, yi = p[i]; xj, yj = p[j]
        if ((yi > y) != (yj > y)) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
def segdist(px, py, a, b):
    ax, ay = a; bx, by = b; dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))
def dist_to_ring(p, x, y):
    if pip(p, x, y): return 0
    return min(segdist(x, y, p[i], p[(i + 1) % len(p)]) for i in range(len(p)))
def cen(p): return (sum(a for a, b in p) / len(p), sum(b for a, b in p) / len(p))
def num(v):
    if v is None: return None
    v = str(v).strip().replace('m', '').strip()
    try:
        if v.endswith("'"): return float(v[:-1]) * 0.3048
        if v.endswith('ft'): return float(v[:-2]) * 0.3048
        return float(v)
    except ValueError: return None

OUT = ring(W[outline_id])
cands = []
for e in d['elements']:
    if e['type'] != 'way' or 'nodes' not in e: continue
    t = e.get('tags', {})
    isb = 'building' in t and t['building'] not in ('no',)
    isp = 'building:part' in t and t['building:part'] not in ('no',)
    if not (isb or isp or t.get('historic') == 'ruins'): continue
    try: r = ring(e)
    except KeyError: continue
    if len(r) < 3: continue
    cx, cy = cen(r)
    if dist_to_ring(OUT, cx, cy) > margin and str(e['id']) not in D.get('extraIds', []): continue
    cands.append((e, r, isp))
parts = [c for c in cands if c[2]]
named = [(c[0]['tags']['name'], c[1]) for c in cands if c[0].get('tags', {}).get('name')]
out = []
for e, r, isp in cands:
    t = e['tags']
    if not isp and any(pip(r, *cen(pr)) for _, pr, ip in parts if ip):
        continue  # S3DB: the parts draw this building
    name = t.get('name')
    kind = None
    cx, cy = cen(r)
    host = name
    if not host:
        for nm, nr in named:
            if pip(nr, cx, cy): host = nm; break
    if not host:
        best = min(((dist_to_ring(nr, cx, cy), nm) for nm, nr in named), default=(1e9, None))
        if best[0] < float(D.get('nearM', 12)): host = best[1]
    rec = D['byId'].get(str(e['id'])) or (D['byName'].get(host) if host else None)
    if rec is None:
        rec = [D['defaultFrom']]
    frm = rec[0]; until = rec[1] if len(rec) > 1 else None; kind = rec[2] if len(rec) > 2 else None
    b = t.get('building:part') if isp else t.get('building')
    if not kind:
        kind = {'castle': 'castle', 'ruins': 'ruin', 'chapel': 'chapel', 'church': 'chapel', 'cathedral': 'chapel',
                'house': 'house', 'barracks': 'house', 'roof': 'roof', 'bridge': 'bridge', 'tower': 'tower'}.get(b, 'house')
        if t.get('man_made') == 'tower': kind = 'tower'
        if t.get('historic') == 'ruins': kind = 'ruin'
    h = num(t.get('height')); mh = num(t.get('min_height')) or 0
    lv = num(t.get('building:levels'))
    if h is None:
        h = (lv * 4 + 2) if lv else D.get('defaultH', {}).get(kind, 9)
        h = max(h, mh + 2)
    rh = num(t.get('roof:height'))
    roof = t.get('roof:shape', 'flat')
    rec_out = {'id': e['id'], 'r': r, 'h': round(h, 2), 'k': kind, 'f': frm}
    if mh: rec_out['mh'] = mh
    if roof != 'flat': rec_out['roof'] = roof
    if rh: rec_out['rh'] = rh
    if until: rec_out['u'] = until
    if name: rec_out['n'] = name
    elif host: rec_out['in'] = host
    out.append(rec_out)
json.dump({'source': 'OpenStreetMap contributors (ODbL 1.0), Simple 3D Buildings; way ids per part',
           'origin': [lat0, lon0], 'outline': OUT, 'parts': out}, open(out_f, 'w'), separators=(',', ':'))
print(len(out), 'parts;', sum(1 for p in out if 'n' in p or 'in' in p), 'dated by a name')
