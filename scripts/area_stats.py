#!/usr/bin/env python3
"""
Rank rail-station catchments (500 m circles) in Bangkok as a place for the demo plot.

Inputs (not in the repository):
  --osm   bkk_osm.json made by scripts/fetch-osm-tiles.mjs (stations, buildings, roads from OpenFreeMap tiles)
  --map   200 dpi PNG of the BMA land-use annex map of the 2013 plan (docs/zoning-rules.md section 2.3)
Output: a CSV and a printed ranking.

Measures, per station (circle of 500 m, the distance in the plan's 500 m station rule, article 37):
  orange   share of the zoned (coloured) map pixels that are orange (Y.5 to Y.7); worst case over map shifts of 25 px (about 240 m)
  bld      share of the circle covered by OSM building footprints
  hinfo    share of footprint area whose height is not the default 5 m (a sign that height or levels were tagged)
  roads    how many of four road classes (primary or bigger, secondary, tertiary, minor) have at least 300 m in the circle
  tall     share of footprint area in buildings of 23 m or more (high-rise), as a sign of condo-type development (not in the score)
  score    orange * mean(min(bld/0.20,1), hinfo, roads/4)
The map position of each station comes from a fitted shift of the station coordinates (checked against the rail lines drawn on the map);
it is good to about 300 m, so orange shares are approximate.
"""
import argparse, csv, json, math
import numpy as np
from PIL import Image, ImageDraw

Image.MAX_IMAGE_PIXELS = None
ap = argparse.ArgumentParser()
ap.add_argument('--osm', required=True)
ap.add_argument('--map', required=True)
ap.add_argument('--out', default='area_stats.csv')
ap.add_argument('--probe', action='append', default=[], help='extra point to measure, as name:lat,lon (repeatable)')
a = ap.parse_args()

LON0, LON1, LAT0, LAT1 = 100.44, 100.72, 13.64, 13.92
KX, KY, CELL = 111320 * math.cos(math.radians(13.78)), 110574, 5
W, H = int((LON1 - LON0) * KX / CELL) + 2, int((LAT1 - LAT0) * KY / CELL) + 2
px = lambda lon, lat: ((lon - LON0) * KX / CELL, (LAT1 - lat) * KY / CELL)

d = json.load(open(a.osm))

# --- OSM rasters (5 m cells)
bld, bldh, bldt = Image.new('L', (W, H), 0), Image.new('L', (W, H), 0), Image.new('L', (W, H), 0)
db, dh, dt = ImageDraw.Draw(bld), ImageDraw.Draw(bldh), ImageDraw.Draw(bldt)
for b in d['buildings']:
    g = b['g']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']] if g['type'] == 'Polygon' else []
    tagged = b['h'] not in (None, 5)
    for poly in polys:
        for i, ring in enumerate(poly):
            pts = [px(*c[:2]) for c in ring]
            v = 255 if i == 0 else 0
            db.polygon(pts, fill=v)
            if tagged or i > 0: dh.polygon(pts, fill=v if tagged else 0)
            if (b['h'] or 0) >= 23 or i > 0: dt.polygon(pts, fill=v if (b['h'] or 0) >= 23 else 0)
CLASSES = {'major': ('motorway', 'trunk', 'primary'), 'secondary': ('secondary',), 'tertiary': ('tertiary',), 'minor': ('minor',)}
rmask = {k: Image.new('L', (W, H), 0) for k in CLASSES}
rd = {k: ImageDraw.Draw(v) for k, v in rmask.items()}
for r in d['roads']:
    for k, cl in CLASSES.items():
        if r['c'] in cl:
            g = r['g']; lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']] if g['type'] == 'LineString' else []
            for ln in lines: rd[k].line([px(*c[:2]) for c in ln], fill=255, width=1)
bld, bldh, bldt = np.array(bld) > 0, np.array(bldh) > 0, np.array(bldt) > 0
rmask = {k: np.array(v) > 0 for k, v in rmask.items()}

# --- zoning map
zm = np.array(Image.open(a.map).convert('RGB')).astype(np.int16)
PAL = {'orange': (255, 153, 51), 'brown': (184, 80, 0), 'yellow': (255, 255, 0), 'red': (255, 0, 0), 'blue': (51, 112, 255)}
S = 105.52  # map pixels per km at 200 dpi
# station coordinates -> map pixel. Anchor: MRT Phahon Yothin (100.5615, 13.8129), fitted by eye against the rail lines (shift +25, +5 px).
AX, AY = 3040 + 25, 2510 + 5
mpx = lambda lon, lat: (AX + (lon - 100.5615) * KX / 1000 * S, AY - (lat - 13.8129) * KY / 1000 * S)

def zone_shares(cx, cy, rad=0.5 * S):
    x0, y0, r = int(cx - rad), int(cy - rad), int(rad) + 1
    win = zm[max(y0, 0):y0 + 2 * r, max(x0, 0):x0 + 2 * r]
    if win.size == 0: return None
    yy, xx = np.mgrid[0:win.shape[0], 0:win.shape[1]]
    inside = (xx + max(x0, 0) - cx) ** 2 + (yy + max(y0, 0) - cy) ** 2 <= rad ** 2
    dist = {k: np.abs(win - np.array(v)).sum(axis=2) for k, v in PAL.items()}
    best = np.stack([dist[k] for k in PAL]); idx = best.argmin(axis=0); dmin = best.min(axis=0)
    ok = inside & (dmin < 60)
    n = ok.sum()
    if n < 0.25 * inside.sum(): return None
    return {k: float(((idx == i) & ok).sum() / n) for i, k in enumerate(PAL)} | {'classified': float(n / inside.sum())}

# --- stations (de-duplicated within ~130 m)
st = []
for s in d['stations']:
    if s['sub'] not in ('subway', 'station'): continue
    lon, lat = s['g'][:2]
    if any(abs(lon - t['lon']) < .0012 and abs(lat - t['lat']) < .0012 for t in st): continue
    st.append({'name': s['name'] or s.get('name_th') or '?', 'lon': lon, 'lat': lat, 'kind': s['sub']})

for p in a.probe:
    nm, ll = p.split(':'); la, lo = map(float, ll.split(','))
    st.append({'name': nm, 'lon': lo, 'lat': la, 'kind': 'probe'})

rows = []
for s in st:
    cx, cy = mpx(s['lon'], s['lat'])
    z = zone_shares(cx, cy)
    if z is None: continue
    shifted = [zone_shares(cx + dx, cy + dy) for dx, dy in ((25, 0), (-25, 0), (0, 25), (0, -25))]
    z_min = min([z['orange']] + [t['orange'] for t in shifted if t])
    x, y = px(s['lon'], s['lat']); R = 100
    xs, ys = int(x) - R, int(y) - R
    if xs < 0 or ys < 0 or xs + 2 * R > W or ys + 2 * R > H: continue
    yy, xx = np.mgrid[0:2 * R, 0:2 * R]; disc = (xx - R) ** 2 + (yy - R) ** 2 <= R * R
    cov = bld[ys:ys + 2 * R, xs:xs + 2 * R][disc].mean()
    ba, ha = bld[ys:ys + 2 * R, xs:xs + 2 * R][disc].sum(), bldh[ys:ys + 2 * R, xs:xs + 2 * R][disc].sum()
    hinfo = ha / ba if ba else 0
    tall = bldt[ys:ys + 2 * R, xs:xs + 2 * R][disc].sum() / ba if ba else 0
    rl = {k: int(v[ys:ys + 2 * R, xs:xs + 2 * R][disc].sum()) * CELL for k, v in rmask.items()}
    nroad = sum(1 for v in rl.values() if v >= 300)
    score = z_min * float(np.mean([min(cov / 0.20, 1), hinfo, nroad / 4]))
    rows.append(dict(name=s['name'], lat=round(s['lat'], 4), lon=round(s['lon'], 4), orange=round(z_min, 2), brown=round(z['brown'], 2),
                     yellow=round(z['yellow'], 2), red_blue=round(z['red'] + z['blue'], 2), bld=round(float(cov), 2), hinfo=round(float(hinfo), 2), tall=round(float(tall), 2),
                     roads=nroad, major_m=rl['major'], score=round(score, 3)))
rows.sort(key=lambda r: -r['score'])
with open(a.out, 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print(f"{len(rows)} stations scored")
print(f"{'rank':>4} {'station':28} {'orange':>6} {'brown':>5} {'yellow':>6} {'bld':>5} {'hinfo':>5} {'tall':>5} {'roads':>5} {'score':>6}")
for i, r in enumerate(rows[:25], 1):
    print(f"{i:>4} {r['name'][:28]:28} {r['orange']:>6} {r['brown']:>5} {r['yellow']:>6} {r['bld']:>5} {r['hinfo']:>5} {r['tall']:>5} {r['roads']:>5} {r['score']:>6}")
