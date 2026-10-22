# Regiomontanus – webes változat

A [Regiomontanus](https://regiomontanus.hu) asztrológiai program böngészős változata. Az eredeti Windows-os
(Delphi 6) program a Humanisztikus Asztrológia Iskola hallgatóinak készült ingyenes segédeszköz.

## Felépítés

A bolygók, házak és állócsillagok számítása a böngészőben fut: a Swiss Ephemeris 2.10.03 hivatalos
C-forrásából WebAssemblyre fordított modul olvassa a `.se1` adatfájlokat. A szervernek így nem kell
natív kódot futtatnia. A képlet-elemzést (fényszögek, házurak, énállapotok, életstratégia) egy
szerveroldali végpont (`api/szamol.php`), két képlet összevetését (keresztkapcsolati fényszögek) az
`api/osszevet.php` végzi, a településkeresést az `api/telepules.php`, a horoszkópolvasó szövegeit
az `api/olvaso.php`, a képletek közti keresést az `api/kereses.php`, a „Jegyek és játszmák” kártyát az
`api/jj.php` adja; ezek nem részei ennek a repónak (az olvasó szövegei az iskola tananyaga, ezért
csak a szerveren vannak). Nélkülük a program a pozíciókat és a kereket megmutatja, az elemzést nem, a településkereső
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
    progr.js           a Progressziók menü ablakai (progressziós Hold, primer direkció, szolár, revolúciók)
    jegyzet.js         „Jegyzetek a horoszkóp elemeihez” (jobb kattintás a keréken; RTF, .mgj import/export)
    mappa.js           a Windows-os Regiomontanus mappájának elérése (hors\, képek, csatolmányok; File System Access)
    kereses.js         „Keresés a képletek közt” és „Megnyitás névre kereséssel”
    kartyak.js         Kiegészítések: „Jegyek és játszmák”, „Születési értesítő” kártya
  js/kozos.js          közös nevek, jelek, formázás, időzóna (böngésző IANA-adatbázisa)
  js/keplet.js         képletadat, zóna/LMT, Kos 0°, léptetés, planétaperspektíva, számítás (WASM + api/szamol.php)
  js/szk.js            a Windows-os program .szk képletfájljainak olvasása és írása (UTF-16LE, v3.1; a webes
                       kiegészítések: [Megjegyzes] elemenkénti jegyzetek, [Other] PictureData kicsinyített fénykép)
  js/rtf.js            a Windows-os jegyzetek (RichEdit RTF, RegiomontanusWIN szimbólumok) és a .mgj fájl olvasása/írása
  js/nyomtatas.js      A4-es nyomtatási / exportálási lapkép SVG-ben (fejléc, kerék, táblák, lábléc)
  js/kerek.js          a képletkerék SVG-ben, a Windows-os program geometriája szerint (összevetésnél bi-kerék,
                       személyiségrajz-szűrő, data-olv jelölések a horoszkópolvasónak)
  js/idotech.js        időbeli technikák: tranzit, progressziós Hold, primer direkció, szolár, revolúció-kereső
  js/tablak.js         a Táblázatok menü táblái
  js/tarolo.js         beállítások, legutóbbi képletek, munkamenet (localStorage)
  fonts/               asztrológiai jelek: Noto Sans Symbols / Symbols 2 részhalmaz (SIL OFL 1.1, OFL.txt);
                       Amatic SC, Bebas Neue, Source Sans 3 (SIL OFL 1.1) a Kiegészítések kártyáihoz;
                       a kártyák dizájnképei nem részei a repónak (a tárhelyen: kieg/)
  proba/               próbaoldal: pozíciók + képlet-elemzés (api/szamol.php) + .szk megnyitás
tools/
  build-wasm.sh        a swe.wasm reprodukálható fordítása a hivatalos forrásból
  genref.py            referenciaértékek a natív swetest-ből
  browsertest.py       a próbaoldal ellenőrzése headless böngészőben
```

## Billentyűk

A Windows-os gyorsbillentyűk közül a böngésző fenntartja a Ctrl+N, Ctrl+W, Ctrl+Tab és Ctrl+F4 kombinációt,
ezért: új képlet **Alt+N**, bezárás **Alt+W**, váltás a megnyitott képletek közt **Alt+1…9**.
Változatlan: Ctrl+O, Ctrl+S, Ctrl+P, Ctrl+A, Ctrl+B/H/F/J/E (táblák), Ctrl+L (léptető), Ctrl+Q (horoszkópolvasó),
Esc (vissza a mozaikhoz).

## A swe.wasm újrafordítása

```bash
pip install ziglang
tools/build-wasm.sh            # alapértelmezés: aloistr/swisseph c69c14a (2.10.03)
```

## Licenc

AGPL-3.0 (lásd `LICENSE`). A `public/fonts/` betűkészletei a Noto Project munkái, SIL Open Font License 1.1
(`public/fonts/OFL.txt`). A Swiss Ephemeris © Astrodienst AG, AGPL-3.0 / Swiss Ephemeris Professional
License kettős licenccel: <https://www.astro.com/swisseph/>.
