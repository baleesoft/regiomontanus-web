# Regiomontanus – webes változat

A [Regiomontanus](https://regiomontanus.hu) asztrológiai program böngészős változata. Az eredeti Windows-os
(Delphi 6) program a Humanisztikus Asztrológia Iskola hallgatóinak készült ingyenes segédeszköz.

## Felépítés

A bolygók, házak és állócsillagok számítása a böngészőben fut: a Swiss Ephemeris 2.10.03 hivatalos
C-forrásából WebAssemblyre fordított modul olvassa a `.se1` adatfájlokat. A szervernek így nem kell
natív kódot futtatnia, a tárhely elég, ha statikus fájlokat szolgál ki.

```
public/                ← ez a tartalom kerül fel FTP-vel a tárhelyre
  swe/
    sweph.js           betöltő + csak olvasható WASI-réteg (függőség nélkül)
    swe.wasm           Swiss Ephemeris 2.10.03 (WebAssembly)
    ephe/              sepl_18, semo_18, seas_18 (.se1, 1800–2399) és sefstars.txt
  proba/               technikai próba: számítás + összevetés a natív swetest-tel
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
