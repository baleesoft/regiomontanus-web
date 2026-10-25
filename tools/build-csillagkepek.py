"""
Az asztroszkóp adatai: a csillagképek kiterjedése ekliptikai hosszúságban (J2000 közepes ekliptika és napéjegyenlőség).

Forrás: a hivatalos IAU-csillagképhatárok (Delporte 1930, B1875) Roman (1987) szerinti táblázata
(CDS VI/42, közkincs), az astropy `get_constellation` függvényén át. A Kígyó (Ser) két részre bontva:
feje (B1875 RA < 17h) és farka.

Kimenet: public/js/csillagkepek.js
  ekl:   az ekliptika menti csillagképek (a Nap útja), [rövidítés, kezdő hosszúság] – a következő elejéig tart
  kulso: [rövidítés, magyar név, legkisebb |β| (fok), [[λ0, λ1], …]] – a |β| ≤ 60° sávban elfoglalt hosszúság-ívek
  tejut: [[λ0, λ1], …] – az ekliptika azon szakaszai, ahol a galaktikus szélesség |b| ≤ 10°
  csill: {rövidítés: [λ0, λ1]} – a csillagkép csillagai közül az első és az utolsó ekliptikai hosszúsága (a Swiss Ephemeris
         csillagkatalógusa, sefstars.txt; a lefedő legkisebb ív) – a Kígyó két része külön (RA < 17h: feje)
  zona:  {rövidítés: [λ0, λ1]} – az ekliptika 13 csillagképe az állatöv ±8°-os sávjában (IAU-határok; kissé egymásra lógnak)
  alak:  {rövidítés: [λ0, λ1]} – a csillagkép-alakzat (a vonalas ábra csillagai) által lefedett legkisebb ív; forrás:
         d3-celestial constellations.lines.json (BSD-3, Olaf Frohn) – a Kígyó két része külön (SerCap, SerCau)

Használat: pip install astropy; python3 tools/build-csillagkepek.py <d3-celestial/data> <sefstars.txt>
A kliens a képlet időpontjára a precesszióval (IAU 2006, p_A) tolja el; sziderikus zodiákusnál az ajánamsával vissza.
"""
import json, os
import numpy as np
import astropy.units as u
from astropy.coordinates import SkyCoord, GeocentricMeanEcliptic, FK5, Galactic, get_constellation

NEV = {
    'And': 'Androméda', 'Ant': 'Légszivattyú', 'Aps': 'Paradicsommadár', 'Aql': 'Sas', 'Aqr': 'Vízöntő', 'Ara': 'Oltár',
    'Ari': 'Kos', 'Aur': 'Szekeres', 'Boo': 'Ökörhajcsár', 'Cae': 'Véső', 'Cam': 'Zsiráf', 'Cnc': 'Rák',
    'CVn': 'Vadászebek', 'CMa': 'Nagy Kutya', 'CMi': 'Kis Kutya', 'Cap': 'Bak', 'Car': 'Hajógerinc', 'Cas': 'Kassziopeia',
    'Cen': 'Kentaur', 'Cep': 'Cepheus', 'Cet': 'Cet', 'Cha': 'Kaméleon', 'Cir': 'Körző', 'Col': 'Galamb',
    'Com': 'Bereniké Haja', 'CrA': 'Déli Korona', 'CrB': 'Északi Korona', 'Crv': 'Holló', 'Crt': 'Serleg',
    'Cru': 'Dél Keresztje', 'Cyg': 'Hattyú', 'Del': 'Delfin', 'Dor': 'Aranyhal', 'Dra': 'Sárkány', 'Equ': 'Csikó',
    'Eri': 'Eridanus', 'For': 'Kemence', 'Gem': 'Ikrek', 'Gru': 'Daru', 'Her': 'Herkules', 'Hor': 'Ingaóra',
    'Hya': 'Északi Vízikígyó', 'Hyi': 'Déli Vízikígyó', 'Ind': 'Indián', 'Lac': 'Gyík', 'Leo': 'Oroszlán',
    'LMi': 'Kis Oroszlán', 'Lep': 'Nyúl', 'Lib': 'Mérleg', 'Lup': 'Farkas', 'Lyn': 'Hiúz', 'Lyr': 'Lant',
    'Men': 'Táblahegy', 'Mic': 'Mikroszkóp', 'Mon': 'Egyszarvú', 'Mus': 'Légy', 'Nor': 'Szögmérő', 'Oct': 'Oktáns',
    'Oph': 'Kígyótartó', 'Ori': 'Orion', 'Pav': 'Páva', 'Peg': 'Pegazus', 'Per': 'Perszeusz', 'Phe': 'Főnix',
    'Pic': 'Festőállvány', 'Psc': 'Halak', 'PsA': 'Déli Hal', 'Pup': 'Hajófara', 'Pyx': 'Tájoló', 'Ret': 'Háló',
    'Sge': 'Nyíl', 'Sgr': 'Nyilas', 'Sco': 'Skorpió', 'Scl': 'Szobrász', 'Sct': 'Pajzs', 'SerCap': 'Kígyó feje',
    'SerCau': 'Kígyó farka', 'Sex': 'Szextáns', 'Tau': 'Bika', 'Tel': 'Távcső', 'Tri': 'Háromszög',
    'TrA': 'Déli Háromszög', 'Tuc': 'Tukán', 'UMa': 'Nagy Medve', 'UMi': 'Kis Medve', 'Vel': 'Vitorla',
    'Vir': 'Szűz', 'Vol': 'Repülőhal', 'Vul': 'Róka'}
MAX_B = 30          # a kliens legfeljebb ±30°-os sávot kínál
LEPES, BLEPES = 0.1, 0.2
ECL = GeocentricMeanEcliptic(equinox='J2000')


def csk(lon, lat):
    c = SkyCoord(lon=lon * u.deg, lat=lat * u.deg, frame=ECL)
    k = np.array(get_constellation(c, short_name=True), dtype=object)
    ra = c.transform_to(FK5(equinox='B1875')).ra.hour
    return np.where((k == 'Ser') & (ra < 17), 'SerCap', np.where(k == 'Ser', 'SerCau', k)), c


def ivek(fedett, lepes):
    """körkörös, összevont ívek a lefedett rekeszekből"""
    n = len(fedett)
    if fedett.all():
        return [[0, 360]]
    s0 = int(np.where(~fedett)[0][0]); ki, cur = [], None
    for j in range(n):
        i = (s0 + j) % n
        if fedett[i]:
            cur = [i, i] if cur is None else [cur[0], i]
        elif cur is not None:
            ki.append(cur); cur = None
    if cur is not None:
        ki.append(cur)
    return [[round(a * lepes, 2), round(((b + 1) * lepes) % 360, 2)] for a, b in ki]


# 1. az ekliptika mentén (0,01°)
lam = np.arange(0, 360, 0.01)
k, _ = csk(lam, np.zeros_like(lam))
ekl = [[k[0], 0.0]] + [[k[i], round(float(lam[i]), 2)] for i in range(1, len(k)) if k[i] != k[i - 1]]
if ekl[-1][0] == ekl[0][0]:
    ekl = ekl[1:]          # a 0°-on átnyúló Halak egyetlen szakasz
ekl_nevek = set(x[0] for x in ekl)

# 2. a |β| ≤ 60° sáv rácsa (0,1° × 0,2°)
L = np.arange(0, 360, LEPES) + LEPES / 2
B = np.arange(-60, 60 + 1e-9, BLEPES)
LL, BB = np.meshgrid(L, B)
k, _ = csk(LL.ravel(), BB.ravel())
k = k.reshape(LL.shape)
kulso = []
for a in sorted(set(k.ravel())):
    m = k == a
    bmin = float(np.abs(B[m.any(axis=1)]).min())
    if bmin > MAX_B:
        continue
    kulso.append([a, NEV[a], round(bmin, 1), ivek(m.any(axis=0), LEPES)])

# 3. Tejút: |b| ≤ 10° az ekliptikán
c = SkyCoord(lon=lam * u.deg, lat=np.zeros_like(lam) * u.deg, frame=ECL)
tejut = ivek(np.abs(c.transform_to(Galactic()).b.deg) <= 10, 0.01)

# 3b. az ekliptika csillagképei az állatöv ±8°-os sávjában (0,05° × 0,5°)
ZB = 8
Lz = np.arange(0, 360, 0.05) + 0.025
Bz = np.arange(-ZB, ZB + 1e-9, 0.5)
LLz, BBz = np.meshgrid(Lz, Bz)
kz, _ = csk(LLz.ravel(), BBz.ravel())
kz = kz.reshape(LLz.shape)
zona = {}
for a in ekl_nevek:
    iv = ivek((kz == a).any(axis=0), 0.05)
    zona[a] = max(iv, key=lambda x: (x[1] - x[0]) % 360)   # az ekliptika csillagképei egyetlen ívben

# 4. az alakzatok kiterjedése: a vonalas ábra csúcsainak ekliptikai hosszúsága → a legnagyobb rés kihagyásával a lefedő ív
import math, sys
EPS = math.radians(23.4392911)


def ekl_lon(ra, dec):
    a, d = math.radians(ra % 360), math.radians(dec)
    x, y, z = math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d)
    return math.degrees(math.atan2(y * math.cos(EPS) + z * math.sin(EPS), x)) % 360


def lefedo(ls):
    ls = sorted(ls)
    res = [(ls[(i + 1) % len(ls)] - ls[i]) % 360 for i in range(len(ls))]
    i = max(range(len(ls)), key=lambda k: res[k])
    return [round(ls[(i + 1) % len(ls)], 2), round(ls[i], 2)]


alak = {}
d3 = sys.argv[1] if len(sys.argv) > 1 else None
if d3:
    with open(os.path.join(d3, 'constellations.lines.json'), encoding='utf-8') as f:
        for ft in json.load(f)['features']:
            pts = [p for ln in ft['geometry']['coordinates'] for p in ln]
            a = ft['id']
            if a == 'Ser':
                a = 'SerCap' if sum(p[0] % 360 for p in pts) / len(pts) < 255 else 'SerCau'
            alak[a] = lefedo([ekl_lon(*p) for p in pts])

# 5. a csillagkatalógus csillagai csillagképenként (a nómenklatúra vége a csillagkép rövidítése: ,alTau / ,41Ari / ,alCMa)
import re
csill = {}
sef = sys.argv[2] if len(sys.argv) > 2 else None
if sef:
    volt, cs_l = set(), {}
    with open(sef, encoding='latin-1') as f:
        for ln in f:
            if ln.startswith('#') or ln.count(',') < 13:
                continue
            p = [x.strip() for x in ln.split(',')]
            m = re.match(r'^[^,]*?([A-Z][A-Za-z]{2})$', p[1])
            if not m or m.group(1) not in NEV and m.group(1) != 'Ser' or p[1] in volt:
                continue
            volt.add(p[1])
            try:
                ra = (float(p[3]) + float(p[4]) / 60 + float(p[5]) / 3600) * 15
                dec = (-1 if p[6].startswith('-') else 1) * (abs(float(p[6])) + float(p[7]) / 60 + float(p[8]) / 3600)
            except ValueError:
                continue
            a = m.group(1)
            if a == 'Ser':
                a = 'SerCap' if ra < 255 else 'SerCau'
            cs_l.setdefault(a, []).append(ekl_lon(ra, dec))
    csill = {a: lefedo(v) for a, v in cs_l.items()}

ki = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'js', 'csillagkepek.js')
with open(ki, 'w', encoding='utf-8') as f:
    f.write('/*\n * csillagkepek.js – az asztroszkóp adatai (tools/build-csillagkepek.py generálja, kézzel ne szerkeszd).\n'
            ' * IAU-csillagképhatárok (Delporte 1930; Roman 1987, CDS VI/42), ekliptikai hosszúság, J2000.\n'
            ' * ekl: [rövidítés, kezdet]; kulso: [rövidítés, név, legkisebb |β|, ívek]; tejut: ívek (|b| ≤ 10°);\n'
            ' * csill: {rövidítés: [λ0, λ1]} – a csillagkép csillagai közül az első és az utolsó (Swiss Ephemeris sefstars.txt, AGPL);\n'
            ' * zona: {rövidítés: [λ0, λ1]} – az ekliptika csillagképei az állatöv ±8°-os sávjában (IAU-határok);\n'
            ' * alak: {rövidítés: [λ0, λ1]} – az alakzat csillagai által lefedett ív (d3-celestial, BSD-3, (c) 2015 Olaf Frohn). Licenc: AGPL-3.0.\n */\n')
    f.write('(function (global) {\n  \'use strict\';\n  var R = global.Regio = global.Regio || {};\n')
    f.write('  R.CSILLAGKEPEK = {\n    nev: ' + json.dumps(NEV, ensure_ascii=False) + ',\n')
    f.write('    ekl: ' + json.dumps(ekl) + ',\n')
    f.write('    kulso: [\n' + ',\n'.join('      ' + json.dumps(x, ensure_ascii=False) for x in kulso) + '\n    ],\n')
    f.write('    tejut: ' + json.dumps(tejut) + ',\n')
    f.write('    csill: ' + json.dumps(csill, separators=(',', ':')) + ',\n')
    f.write('    zona: ' + json.dumps(zona, separators=(',', ':')) + ',\n')
    f.write('    alak: ' + json.dumps(alak, separators=(',', ':')) + '\n  };\n})(typeof window !== \'undefined\' ? window : globalThis);\n')
print(len(ekl), 'ekliptikai,', len(kulso), 'külső csillagkép; Tejút:', tejut)
