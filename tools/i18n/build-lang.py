#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""A felület szótárainak generálása: tools/i18n/<nyelv>_szotar.py → public/lang/<nyelv>.js.
Használat: python3 tools/i18n/build-lang.py   (a repó gyökeréből)"""
import importlib.util, json, os, sys

GYOKER = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NYELVEK = {'en': 'en_szotar.py'}

def betolt(fajl):
    spec = importlib.util.spec_from_file_location('szotar', os.path.join(GYOKER, 'tools', 'i18n', fajl))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

for nyelv, fajl in NYELVEK.items():
    m = betolt(fajl)
    szavak = {' '.join(k.split()): v for k, v in m.SZAVAK.items() if k.strip()}
    ki = os.path.join(GYOKER, 'public', 'lang', nyelv + '.js')
    os.makedirs(os.path.dirname(ki), exist_ok=True)
    with open(ki, 'w', encoding='utf-8') as f:
        f.write('/* A felület %s szótára – generálva: tools/i18n/build-lang.py (forrás: tools/i18n/%s). Licenc: AGPL-3.0. */\n' % (nyelv, fajl))
        f.write('Regio.Nyelv.szotar(%s,\n' % json.dumps(nyelv))
        f.write(json.dumps(szavak, ensure_ascii=False, indent=0, sort_keys=True))
        f.write(',\n')
        f.write(json.dumps([list(x) for x in m.MINTAK], ensure_ascii=False, indent=0))
        f.write(');\n')
    print(ki, len(szavak), 'szó,', len(m.MINTAK), 'minta')
