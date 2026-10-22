# Regiomontanus – webes változat

A [Regiomontanus](https://regiomontanus.hu) asztrológiai program böngészős változata. Az eredeti Windows-os
(Delphi 6) program a Humanisztikus Asztrológia Iskola hallgatóinak készült ingyenes segédeszköz.

## Felépítés

A bolygók, házak és állócsillagok számítása a böngészőben fut: a Swiss Ephemeris 2.10.03 hivatalos
C-forrásából WebAssemblyre fordított modul olvassa a `.se1` adatfájlokat. A szervernek így nem kell
natív kódot futtatnia. A képlet-elemzést (fényszögek, házurak, énállapotok, életstratégia) egy
szerveroldali végpont (`api/szamol.php`) végzi, a településkeresést az `api/telepules.php`; ezek nem részei
ennek a repónak. Nélkülük a program a pozíciókat és a kereket megmutatja, az elemzést nem, a településkereső
pedig egy rövid beépített listából keres.

```
public/                ← ez a tartalom kerül fel FTP-vel a tárhelyre
  swe/
    sweph.js           betöltő + csak olvasható WASI-réteg (függőség nélkül)
    swe.wasm           Swiss Ephemeris 2.10.03 (WebAssembly)
    ephe/              .se1 adatfájlok 600–2999 (600 éves blokkok, igény szerint töltődnek) + sefstars.txt
  index.html           átirányítás az app/-ra
  app/                 a program: menüsor, eszköztár, mozaikos munkaasztal, részletes nézet, léptető
    app.js             vezérlés (menük, billentyűk, fájlkezelés, kép, nyomtatás, munkamenet)
    adatlap.js         „Születési képlet adatai” párbeszédablak
    telepules.js       településkereső mező (api/telepules.php)
  js/kozos.js          közös nevek, jelek, formázás, időzóna (böngésző IANA-adatbázisa)
  js/keplet.js         képletadat, zóna/LMT, Kos 0°, léptetés, számítás (WASM + api/szamol.php)
  js/szk.js            a Windows-os program .szk képletfájljainak olvasása és írása (UTF-16LE, v3.1)
  js/kerek.js          a képletkerék SVG-ben, a Windows-os program geometriája szerint
  js/tablak.js         a Táblázatok menü táblái
  js/tarolo.js         beállítások, legutóbbi képletek, munkamenet (localStorage)
  fonts/               asztrológiai jelek: Noto Sans Symbols / Symbols 2 részhalmaz (SIL OFL 1.1, OFL.txt)
  proba/               próbaoldal: pozíciók + képlet-elemzés (api/szamol.php) + .szk megnyitás
tools/
  build-wasm.sh        a swe.wasm reprodukálható fordítása a hivatalos forrásból
  genref.py            referenciaértékek a natív swetest-ből
  browsertest.py       a próbaoldal ellenőrzése headless böngészőben
```

## Billentyűk

A Windows-os gyorsbillentyűk közül a böngésző fenntartja a Ctrl+N, Ctrl+W, Ctrl+Tab és Ctrl+F4 kombinációt,
ezért: új képlet **Alt+N**, bezárás **Alt+W**, váltás a megnyitott képletek közt **Alt+1…9**.
Változatlan: Ctrl+O, Ctrl+S, Ctrl+P, Ctrl+A, Ctrl+B/H/F/J/E (táblák), Ctrl+L (léptető), Esc (vissza a mozaikhoz).

## A swe.wasm újrafordítása

```bash
pip install ziglang
tools/build-wasm.sh            # alapértelmezés: aloistr/swisseph c69c14a (2.10.03)
```

## Licenc

AGPL-3.0 (lásd `LICENSE`). A `public/fonts/` betűkészletei a Noto Project munkái, SIL Open Font License 1.1
(`public/fonts/OFL.txt`). A Swiss Ephemeris © Astrodienst AG, AGPL-3.0 / Swiss Ephemeris Professional
License kettős licenccel: <https://www.astro.com/swisseph/>.
