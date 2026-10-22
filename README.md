# Regiomontanus – webes változat

A [Regiomontanus](https://regiomontanus.hu) asztrológiai program böngészős változata. Az eredeti Windows-os
(Delphi 6) program a Humanisztikus Asztrológia Iskola hallgatóinak készült ingyenes segédeszköz.

## Felépítés

A bolygók, házak és állócsillagok számítása a böngészőben fut: a Swiss Ephemeris 2.10.03 hivatalos
C-forrásából WebAssemblyre fordított modul olvassa a `.se1` adatfájlokat. A szervernek így nem kell
natív kódot futtatnia. A képlet-elemzést (fényszögek, házurak, énállapotok, életstratégia) egy
szerveroldali végpont (`api/szamol.php`) végzi, amely nem része ennek a repónak; nélküle a próbaoldal
a pozíciókat megmutatja, az elemzést nem.

```
public/                ← ez a tartalom kerül fel FTP-vel a tárhelyre
  swe/
    sweph.js           betöltő + csak olvasható WASI-réteg (függőség nélkül)
    swe.wasm           Swiss Ephemeris 2.10.03 (WebAssembly)
    ephe/              .se1 adatfájlok 600–2999 (600 éves blokkok, igény szerint töltődnek) + sefstars.txt
  js/szk.js            a Windows-os program .szk képletfájljainak beolvasása
  proba/               próbaoldal: pozíciók + képlet-elemzés (api/szamol.php) + .szk megnyitás
tools/
  build-wasm.sh        a swe.wasm reprodukálható fordítása a hivatalos forrásból
  genref.py            referenciaértékek a natív swetest-ből
  browsertest.py       a próbaoldal ellenőrzése headless böngészőben
```

## A swe.wasm újrafordítása

```bash
pip install ziglang
tools/build-wasm.sh            # alapértelmezés: aloistr/swisseph c69c14a (2.10.03)
```

## Licenc

AGPL-3.0 (lásd `LICENSE`). A Swiss Ephemeris © Astrodienst AG, AGPL-3.0 / Swiss Ephemeris Professional
License kettős licenccel: <https://www.astro.com/swisseph/>.
