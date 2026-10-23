"""
Az égbolt-nézet (public/js/egbolt.js) adatai: fényes csillagok, csillagképvonalak, -határok, -nevek, Tejút-sáv.

Forrás: d3-celestial (c) 2015 Olaf Frohn, BSD-3-Clause – `npm pack d3-celestial`, a csomag data/ mappája:
  stars.6.json (XHIP / Hipparcos, 6m-ig), starnames.json, constellations.lines.json, constellations.borders.json
  (Davenhall & Leggett 1989, IAU-határok), constellations.json (a nevek helye). J2000 egyenlítői koordináták.
A Tejút-sáv a galaktikus egyenlítő (|b| = 0, ±10°) – számolva, nem adatfájlból.

Kimenet: public/js/egbolt-adat.js – minden J2000 ekliptikai hosszúság/szélesség (fok); a kliens a képlet idejére
precesszálja (az ekliptikai hosszúsághoz hozzáadja az általános precessziót).

Használat: python3 tools/build-egbolt.py <d3-celestial/data>
"""
import json, math, os, sys

D = sys.argv[1] if len(sys.argv) > 1 else 'data'
EPS = math.radians(23.4392911)          # J2000 ferdeség


def ekl(ra, dec):
    """J2000 egyenlítői (fok) → J2000 ekliptikai (fok); a d3-celestial RA-ja −180…180"""
    a, d = math.radians(ra % 360), math.radians(dec)
    x, y, z = math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d)
    y2 = y * math.cos(EPS) + z * math.sin(EPS)
    z2 = -y * math.sin(EPS) + z * math.cos(EPS)
    return (math.degrees(math.atan2(y2, x)) % 360, math.degrees(math.asin(max(-1, min(1, z2)))))


def kerek(v, n=2):
    return round(v, n)


def olvas(n):
    with open(os.path.join(D, n), encoding='utf-8') as f:
        return json.load(f)


# csillagok: [λ, β, mag, B−V] lapos tömbben (század fok / század magnitúdó egész)
cs, nevek = [], []
nv = olvas('starnames.json')
for f in olvas('stars.6.json')['features']:
    p = f['properties']
    l, b = ekl(*f['geometry']['coordinates'])
    mag = float(p['mag'])
    try:
        bv = float(p['bv'])
    except (TypeError, ValueError):
        bv = 0.6
    cs += [int(round(l * 100)), int(round(b * 100)), int(round(mag * 100)), int(round(bv * 100))]
    n = nv.get(str(f['id']), {}).get('name', '')
    if n and mag <= 2.6:
        nevek.append([kerek(l), kerek(b), n, kerek(mag, 1)])

# csillagképvonalak és -határok: vonalláncok [λ0, β0, λ1, β1, …]
vonal = []
for f in olvas('constellations.lines.json')['features']:
    for ln in f['geometry']['coordinates']:
        t = []
        for ra, de in ln:
            l, b = ekl(ra, de)
            t += [kerek(l), kerek(b)]
        vonal.append(t)
hatar = []
for f in olvas('constellations.borders.json')['features']:
    for ln in f['geometry']['coordinates']:
        t = []
        for i, (ra, de) in enumerate(ln):
            # a határszakaszok RA mentén hosszúak lehetnek: sűrítés, hogy vetítéskor se törjenek meg
            if i:
                ra0, de0 = ln[i - 1]
                dra = ((ra - ra0 + 180) % 360) - 180
                lepes = max(1, int(abs(dra) / 2))
                for k in range(1, lepes):
                    l, b = ekl(ra0 + dra * k / lepes, de0 + (de - de0) * k / lepes)
                    t += [kerek(l), kerek(b)]
            l, b = ekl(ra, de)
            t += [kerek(l), kerek(b)]
        hatar.append(t)
cnev = []
for f in olvas('constellations.json')['features']:
    l, b = ekl(*f['geometry']['coordinates'])
    cnev.append([f['id'], kerek(l), kerek(b)])

# Tejút: a galaktikus egyenlítő és ±10° (J2000: északi galaktikus pólus RA 192,85948°, D +27,12825°, l(ÉÉP) = 122,93192°)
ag, dg, lncp = math.radians(192.85948), math.radians(27.12825), math.radians(122.93192)


def gal2eq(lg, bg):
    l, b = math.radians(lg), math.radians(bg)
    sd = math.sin(b) * math.sin(dg) + math.cos(b) * math.cos(dg) * math.cos(lncp - l)
    d = math.asin(sd)
    y = math.cos(b) * math.sin(lncp - l)
    x = math.sin(b) * math.cos(dg) - math.cos(b) * math.sin(dg) * math.cos(lncp - l)
    return math.degrees(ag + math.atan2(y, x)) % 360, math.degrees(d)


tejut = []
for bg in (0, -10, 10):
    t = []
    for lg in range(0, 361, 3):
        l, b = ekl(*gal2eq(lg, bg))
        t += [kerek(l), kerek(b)]
    tejut.append(t)

ki = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'js', 'egbolt-adat.js')
with open(ki, 'w', encoding='utf-8') as f:
    f.write('/*\n * egbolt-adat.js – az égbolt-nézet adatai (tools/build-egbolt.py generálja, kézzel ne szerkeszd).\n'
            ' * J2000 ekliptikai hosszúság/szélesség, fok. csillag: [λ·100, β·100, mag·100, (B−V)·100]…; nevek: [λ, β, név, mag];\n'
            ' * vonal / hatar: vonalláncok [λ0, β0, λ1, β1, …]; cnev: [rövidítés, λ, β]; tejut: [közép, −10°, +10°].\n *\n'
            ' * Adatforrás: d3-celestial – Copyright (c) 2015, Olaf Frohn. All rights reserved. BSD-3-Clause licenc\n'
            ' * (public/js/egbolt-adat.LICENSE). Eredeti források: XHIP (Anderson & Francis 2012), IAU, Davenhall & Leggett 1989.\n */\n')
    f.write("(function (global) {\n  'use strict';\n  var R = global.Regio = global.Regio || {};\n  R.EGBOLT = ")
    json.dump({'csillag': cs, 'nevek': nevek, 'vonal': vonal, 'hatar': hatar, 'cnev': cnev, 'tejut': tejut},
              f, ensure_ascii=False, separators=(',', ':'))
    f.write(";\n})(typeof window !== 'undefined' ? window : globalThis);\n")
print(len(cs) // 4, 'csillag,', len(nevek), 'név,', len(vonal), 'vonallánc,', len(hatar), 'határ,', len(cnev), 'csillagkép')
