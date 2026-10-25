/*
 * beallini.js – a Windows-os Regiomontanus beállításfájlja (settings.ini, Beállítások › „Betöltés fájlból” / „Mentés fájlba”)
 * olvasása és írása a webes beállításokkal (Regio.Tarolo) megfeleltetve. A kulcsok: uAstro4AllConsts.pas cGRP_* / cGRPITM_*;
 * az értékek: 1/0 logikai, a számok tizedesvesszővel, a színek Delphi TColor (BGR egész).
 * A webes változat saját beállításai (pl. az ábra stílusa, asztroszkóp, primer direkciók) a [WebRegiomontanus] szakaszba
 * kerülnek JSON-ként – a Windows-os program ezt nem olvassa, a webes betöltéskor ebből indul, és a Windows-os kulcsok felülírják.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};

  var FSZ = ['Konjunkcio', 'Oppozicio', 'Kvadrat', 'Semiquadrat', 'Szeszkvikvadrat', 'Trigon', 'Szextil', 'Szemiszextil',
    'Kvinkunx', 'Kvintil', 'Decil', 'Bikvintil'];                                   // a fényszög-azonosító 1..12 sorrendjében
  var FSZ_NAGY = FSZ.map(function (s) { return s.toUpperCase().replace('KONJUNKCIO', 'KONJUKCIO'); });   // a Windows-os elírással
  var JEGY = ['KOS', 'BIKA', 'IKREK', 'RAK', 'OROSZLAN', 'SZUZ', 'MERLEG', 'SKORPIO', 'NYILAS', 'BAK', 'VIZONTO', 'HALAK'];
  var PL = ['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO'];
  var KISB = [['CHIRON', 15], ['PHOLUS', 16], ['CERES', 17], ['PALLAS', 18], ['JUNO', 19], ['VESTA', 20], ['ERIS', 146199], ['LILITH', 12],
    ['NEOWISE', 1009043], ['HALLEY', 1009044], ['CHURYUMOV', 1009032], ['OUMUAMUA', 1009045], ['HALEBOPP', 1009046], ['MAGELLAN', 14055]];
  var TENG = [['VTX', 'vtx'], ['EP', 'ep'], ['CAC', 'cas'], ['PAC', 'pas']];
  var ELEM = [['TUZES', 'fire'], ['FOLDES', 'earth'], ['LEVEGOS', 'air'], ['VIZES', 'water']];
  var FEJLEC = [['NAME', 'fNev'], ['BIRTHDATE', 'fDatum'], ['BIRTHTIME', 'fIdo'], ['BIRTHDAY', 'fNap'], ['TIMEZONE', 'fZona'], ['DST', 'fNyari'],
    ['UT', 'fUT'], ['ST', 'fST'], ['PRINTTYPE', 'fTipus'], ['BIRTHPLACE', 'fHely'], ['BIRTCOORD', 'fKoord'], ['HOUSESYSTEM', 'fHaz']];
  var EGYEB = [['PLANETDEG', 'planetDeg'], ['HOUSELORDS', 'houseLords'], ['RETROGADE', 'retrograde'], ['FERALIS', 'feral'], ['STACIONER', 'stationary'],
    ['SELFMARKERS', 'selfMarkers'], ['SELFMARKERATORIGPLACE', 'enEredeti'], ['ELETKORELREJT', 'eletkorRejt'], ['HOUSENUMSBYARABICNUMBERS', 'arab'],
    ['CSAKAKTSYNASTRY', 'csakOssz'], ['ASPECTSATORIGPLACE', 'fszEredeti']];
  var FOK = [['OUTERZODIACDEG', 'fokKulso'], ['INNERZODIACDEG', 'fokBelso'], ['INNERASPECTDEG', 'fokFsz'], ['HOUSEDEG', 'cuspLabels'], ['ZODIACDEGKULON', 'fokKulon']];
  var WEB = 'WebRegiomontanus';

  /* ---------- INI szöveg ---------- */
  function dekodol(buf) {
    var b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    if (b.length > 3 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('windows-1250').decode(b); }
  }
  function ertelmez(t) {
    var d = {}, sz = null;
    t.replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach(function (s) {
      var m = /^\s*\[([^\]]+)\]\s*$/.exec(s);
      if (m) { sz = d[m[1]] = d[m[1]] || {}; return; }
      var i = s.indexOf('=');
      if (sz && i > 0 && !/^\s*;/.test(s)) sz[s.slice(0, i).trim()] = s.slice(i + 1);
    });
    return d;
  }

  /**
   * A settings.ini tartalma a webes beállításokra: { beall, alapTelepules: 'Budapest; H' | null, db: beolvasott kulcsok száma }.
   * alap: a jelenlegi webes beállítások (a fájlban nem szereplők ezek maradnak).
   */
  function olvas(buf, alap) {
    var d = ertelmez(dekodol(buf)), b = JSON.parse(JSON.stringify(alap)), db = 0;
    if (!d.chkbZodiakusJelek && !d.chkbOrbSettingsSimple && !d.chkbBolygok && !d[WEB]) throw new Error('Ez nem Regiomontanus beállításfájl.');
    // a webes kiegészítés (ha van) az alap; a Windows-os kulcsok felülírják
    if (d[WEB] && d[WEB].Beallitasok) {
      try { var w = JSON.parse(d[WEB].Beallitasok); b = R.Tarolo && R.Tarolo.osszefesul ? R.Tarolo.osszefesul(b, w) : w; if (w.nyomtatas) b.nyomtatas = w.nyomtatas; db++; } catch (e) { /* hibás JSON: kimarad */ }
    }
    var k = b.kerek, ny = b.nyomtatas = b.nyomtatas || {};
    function sz(g) { return d[g] || {}; }
    function van(g, n) { return d[g] && d[g][n] !== undefined; }
    function log(g, n) { var v = (d[g][n] || '').trim(); db++; return v === '1' || /^(t|true|igen)$/i.test(v); }
    function szam(g, n) { db++; return parseFloat(String(d[g][n]).replace(',', '.')); }
    function egesz(g, n) { db++; return parseInt(d[g][n], 10); }
    function lista(g, nevek, ertekek) {                     // a bekapcsolt elemek listája
      if (!d[g]) return null;
      var l = [], volt = false;
      nevek.forEach(function (n, i) { if (van(g, n)) { volt = true; if (log(g, n)) l.push(ertekek[i]); } });
      return volt ? l : null;
    }
    function bgr(g, n) { var v = egesz(g, n); return '#' + [v & 255, (v >> 8) & 255, (v >> 16) & 255].map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('').toUpperCase(); }
    var i, l, h12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    var HAZ = h12.map(function (n) { return 'HOUSE_' + n; });

    // Megjelenítés › Általános I.
    if ((l = lista('chkbZodiakusJelek', JEGY, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))) k.jegyek = l;
    if (van('chkbZodiakusJelek', 'KELL_E_ANALOG')) k.analog = log('chkbZodiakusJelek', 'KELL_E_ANALOG');
    if ((l = lista('chkbTengelyek', TENG.map(function (x) { return x[0]; }), TENG.map(function (x) { return x[1]; })))) k.tengelyek = l;
    if ((l = lista('chkbHazHatarok', HAZ, h12))) k.hazHatar = l;
    if ((l = lista('chkbHazSzamok', HAZ, h12))) k.hazSzam = l;
    if ((l = lista('chkbBolygok', PL, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))) k.planetak = l;
    if ((l = lista('chkbKisBolygok', KISB.map(function (x) { return x[0]; }), KISB.map(function (x) { return x[1]; })))) b.kisb = l;
    if (van('chkbKisBolygok', 'KELL_E_MEGJELENITES')) k.asteroids = log('chkbKisBolygok', 'KELL_E_MEGJELENITES');
    if (van('chkbHoldcsomo', 'FELSZ_NODE')) k.nodes = log('chkbHoldcsomo', 'FELSZ_NODE');
    if (van('chkbHoldcsomo', 'LESZ_NODE')) k.nodesDown = log('chkbHoldcsomo', 'LESZ_NODE');
    if (van('chkbHoldocsomoTipus', 'MEAN_NODE')) b.csomo = log('chkbHoldocsomoTipus', 'MEAN_NODE') ? 10 : 11;
    // Általános II.
    EGYEB.forEach(function (x) { if (van('chkbEgyebMegjelenitesek', x[0])) k[x[1]] = log('chkbEgyebMegjelenitesek', x[0]); });
    FOK.forEach(function (x) { if (van('chkbFokjelolok', x[0])) k[x[1]] = log('chkbFokjelolok', x[0]); });
    if (van('rgrpEnallapotJelolMod', 'JelolesMod')) k.enMod = egesz('rgrpEnallapotJelolMod', 'JelolesMod') === 0 ? 0 : 1;
    if (van('grpBetumeretSzorzo', 'BetumeretSzorzo')) { var m = szam('grpBetumeretSzorzo', 'BetumeretSzorzo'); if (m >= 0.5 && m <= 2) k.meret = m; }
    if (van('rgrpTobbKepletMegjelenitese', 'MegjelenitesiMod')) b.osszevetesMod = egesz('rgrpTobbKepletMegjelenitese', 'MegjelenitesiMod') === 1 ? 'egymasmellett' : 'egymason';
    if (van('rgrpTobbKepletElhelyezese', 'KepletElhelyezesiMod')) b.osszElhely = egesz('rgrpTobbKepletElhelyezese', 'KepletElhelyezesiMod') === 1 ? 'vizszintes' : 'fuggoleges';
    // Fényszögek
    if ((l = lista('chkbFenyszogek', FSZ_NAGY, h12))) k.fszTipus = l;
    if ((l = lista('chkbFenyszogJelek', FSZ_NAGY, h12))) k.fszJel = l;
    if (van('chkbFenyszogVonalak', 'FSZVONALPLANETAIG')) k.fszPlanetaig = log('chkbFenyszogVonalak', 'FSZVONALPLANETAIG');
    var hz = lista('chkbFenyszogeltHazak', HAZ, h12);
    if (hz) {   // a webes „Házak / Tengelyek” listában az 1. az ASC, a 10. az MC
      if (van('chkbFenyszogeltTengelyek', 'AC') && log('chkbFenyszogeltTengelyek', 'AC') && hz.indexOf(1) < 0) hz.push(1);
      if (van('chkbFenyszogeltTengelyek', 'MC') && log('chkbFenyszogeltTengelyek', 'MC') && hz.indexOf(10) < 0) hz.push(10);
      k.fszHaz = hz.sort(function (x, y) { return x - y; });
    }
    if ((l = lista('chkbFenyszogeltBolygok', PL, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))) k.fszPl = l;
    if ((l = lista('chkbFenyszogeltKisBolygok', KISB.slice(0, 8).map(function (x) { return x[0]; }), KISB.slice(0, 8).map(function (x) { return x[1]; })))) k.fszKisb = l;
    if ((l = lista('chkbFenyszogeltCsompontok', ['FELSZ_NODE', 'LESZ_NODE'], ['fel', 'le']))) k.fszCsomo = l;
    // Állócsillagok
    var al = b.allo;
    if (van('chkbFixedStars', 'KELL_E_MEGJELENITES')) al.megj = log('chkbFixedStars', 'KELL_E_MEGJELENITES');
    if (van('chkbFixedStars', 'MEGJELENITES_MINDENKEPP')) al.mind = log('chkbFixedStars', 'MEGJELENITES_MINDENKEPP');
    if (van('chkbFixedStars', 'SELECTED_STARIDS')) {
      db++; al.ids = d.chkbFixedStars.SELECTED_STARIDS.split(',').map(function (x) { return parseInt(x, 10); }).filter(function (x) { return x > 10000000; });
    }
    if ((l = lista('chkbFenyszogekFixedStars', FSZ_NAGY, h12))) al.fsz = l;
    if (van('chkbFenyszogekFixedStars', 'chkbFenyszogekFixedStarsOrbValue')) { var o = szam('chkbFenyszogekFixedStars', 'chkbFenyszogekFixedStarsOrbValue'); if (o >= 0) al.orb = o; }
    // Fényszög orbisok
    FSZ.forEach(function (n, j) {
      var s = sz('chkbOrbSettingsSimple')[n], r = sz('chkbOrbSettingsDetailed')[n];
      if (s !== undefined) { var v = parseFloat(String(s).split('|')[0].replace(',', '.')); if (isFinite(v)) { b.orb.S[j + 1] = v; db++; } }
      if (r !== undefined) {
        var t = String(r).split('|').map(function (x) { return parseFloat(x.replace(',', '.')); });
        if (t.length >= 14 && t.every(isFinite)) { b.orb.D[j + 1] = t.slice(0, 14); db++; }
      }
    });
    if (van('chkbOrbSettingsSwitch', 'ReszletesBeallitas')) b.orb.mod = log('chkbOrbSettingsSwitch', 'ReszletesBeallitas') ? 'reszletes' : 'egyszeru';
    // Színek és szimbólumok
    ELEM.forEach(function (x) { if (van('chkbZodiakusBackGroundColor', x[0])) b.szin[x[1]] = bgr('chkbZodiakusBackGroundColor', x[0]); });
    if (van('chkbFenyszogekBackgroundColor', 'FenyszogBackgroundColor')) b.szin.aspectBg = bgr('chkbFenyszogekBackgroundColor', 'FenyszogBackgroundColor');
    FSZ.forEach(function (n, j) {
      if (van('chkbFenyszogColor', n)) b.szin.fsz[j + 1] = bgr('chkbFenyszogColor', n);
      if (van('chkbFenyszogStyle', n)) { var st = egesz('chkbFenyszogStyle', n); if (st >= 0 && st <= 2) b.szin.stilus[j + 1] = st; }
    });
    if (van('Vonalvastagsagok', 'Alapvonalak')) { var vv = egesz('Vonalvastagsagok', 'Alapvonalak'); if (vv >= 1 && vv <= 5) b.szin.vonal = vv; }
    if (van('PlanetSymbolsGroup', 'UranusSymbol')) b.szin.uranusz = egesz('PlanetSymbolsGroup', 'UranusSymbol') === 1 ? 1 : 0;
    if (van('PlanetSymbolsGroup', 'PlutoSymbol')) { var pv = egesz('PlanetSymbolsGroup', 'PlutoSymbol'); b.szin.pluto = pv >= 0 && pv <= 2 ? pv : 0; }
    // Nyomtatás és exportálás
    function nyl(g, n, kulcs) { if (van(g, n)) ny[kulcs] = log(g, n); }
    nyl('chkbBolygoTablazat', 'KELL_E', 'planetak'); nyl('chkbBolygoTablazat', 'PLANETDEG', 'plFok'); nyl('chkbBolygoTablazat', 'ZODIACSIGN', 'plJegy');
    nyl('chkbBolygoTablazat', 'HOUSENUM', 'plHaz'); nyl('chkbBolygoTablazat', 'HOUSELORDS', 'plUr');
    nyl('chkbHazTablazat', 'KELL_E', 'hazak'); nyl('chkbHazTablazat', 'HOUSEDEG', 'hzFok'); nyl('chkbHazTablazat', 'ZODIACSIGN', 'hzJegy');
    nyl('chkbFenyszogTablazat', 'KELL_E', 'fenyszog'); nyl('chkbEletStratTablazat', 'KELL_E', 'eletstrat');
    nyl('chkbNyomtatasSzinesben', 'NyomtatSzinesben', 'szines'); nyl('chkbInkognito', 'Inkognito', 'inkognito');
    nyl('chkbFejlecKijelzesek', 'KELL_E', 'fejlec'); FEJLEC.forEach(function (x) { nyl('chkbFejlecKijelzesek', x[0], x[1]); });
    nyl('chkbLablecKijelzesek', 'KELL_E', 'lablec'); nyl('chkbLablecKijelzesek', 'BASEINFO', 'lAlap'); nyl('chkbLablecKijelzesek', 'REGINFO', 'lReg');
    // Egyebek: házrendszer, zodiákus, progressziók, alapértelmezett település
    if (van('chkbHazrendszer', 'Hazrendszer')) { var hs = d.chkbHazrendszer.Hazrendszer.trim(); db++; if (R.HAZRENDSZER && R.HAZRENDSZER[hs]) b.hsys = hs; }
    if (van('chkbZodiakus', 'Zodiakus')) { db++; b.sid = d.chkbZodiakus.Zodiakus.trim().toUpperCase() === 'S'; }
    if (van('chkbProgresszioIrany', 'ProgresszioIrany')) b.pdKonverz = egesz('chkbProgresszioIrany', 'ProgresszioIrany') === 1;
    if (van('chkbProgressziok', 'CsakSzekDirHold')) b.phCsakHold = log('chkbProgressziok', 'CsakSzekDirHold');
    if (van('chkbProgressziok', 'SzekDirHoldAscMC')) b.phTengely = log('chkbProgressziok', 'SzekDirHoldAscMC');
    var tel = van('chkbEgyebek', 'KivalTelepules') ? d.chkbEgyebek.KivalTelepules.trim() : null;
    if (tel) db++;
    return { beall: b, alapTelepules: tel, db: db };
  }

  /* ---------- írás (a Windows-os settings.ini szakaszrendjében, UTF-16LE) ---------- */
  function ir(b) {
    var k = b.kerek, ny = b.nyomtatas || {}, s = [];
    function T(x) { return x ? '1' : '0'; }
    function vesszo(v) { return String(v).replace('.', ','); }
    function szak(nev, sorok) { s.push('[' + nev + ']'); sorok.forEach(function (x) { s.push(x[0] + '=' + x[1]); }); s.push(''); }
    function van(l, v) { return (l || []).indexOf(v) >= 0; }
    function tc(hex) { var h = String(hex || '#000000').replace('#', ''); var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), bl = parseInt(h.slice(4, 6), 16); return String(r + g * 256 + bl * 65536); }
    var h12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], NY = function (kulcs) { return ny[kulcs] !== false; };
    szak('chkbOrbSettingsSimple', FSZ.map(function (n, j) { var v = vesszo(b.orb.S[j + 1]); return [n, h12.concat([13, 14]).map(function () { return v; }).join('|')]; }));
    szak('chkbOrbSettingsDetailed', FSZ.map(function (n, j) { return [n, (b.orb.D[j + 1] || []).map(vesszo).join('|')]; }));
    szak('chkbZodiakusJelek', JEGY.map(function (n, j) { return [n, T(van(k.jegyek, j))]; }).concat([['KELL_E_ANALOG', T(k.analog)]]));
    szak('chkbHazHatarok', h12.map(function (n) { return ['HOUSE_' + n, T(van(k.hazHatar, n))]; }));
    szak('chkbHazSzamok', h12.map(function (n) { return ['HOUSE_' + n, T(van(k.hazSzam, n))]; }));
    szak('chkbTengelyek', [['AC', '1'], ['MC', '1'], ['DC', '1'], ['IC', '1']].concat(TENG.map(function (x) { return [x[0], T(van(k.tengelyek, x[1]))]; })));
    szak('chkbBolygok', PL.map(function (n, j) { return [n, T(van(k.planetak, j))]; }));
    szak('chkbKisBolygok', KISB.slice(0, 10).map(function (x) { return [x[0], T(van(b.kisb, x[1]))]; }).concat([['KELL_E_MEGJELENITES', T(k.asteroids)]],
      KISB.slice(10).map(function (x) { return [x[0], T(van(b.kisb, x[1]))]; })));
    szak('chkbFixedStars', [['KELL_E_MEGJELENITES', T(b.allo.megj)], ['SELECTED_STARIDS', (b.allo.ids || []).join(',') + ','], ['MEGJELENITES_MINDENKEPP', T(b.allo.mind)]]);
    szak('chkbHoldcsomo', [['FELSZ_NODE', T(k.nodes)], ['LESZ_NODE', T(k.nodesDown)]]);
    szak('chkbHoldocsomoTipus', [['MEAN_NODE', T(b.csomo === 10)], ['TRUE_NODE', T(b.csomo !== 10)]]);
    szak('chkbFenyszogek', FSZ_NAGY.map(function (n, j) { return [n, T(van(k.fszTipus, j + 1))]; }));
    szak('chkbFenyszogJelek', FSZ_NAGY.map(function (n, j) { return [n, T(van(k.fszJel, j + 1))]; }));
    szak('chkbFenyszogVonalak', [['FSZVONALPLANETAIG', T(k.fszPlanetaig)]]);
    szak('chkbFenyszogeltTengelyek', [['AC', T(van(k.fszHaz, 1))], ['MC', T(van(k.fszHaz, 10))], ['DC', '0'], ['IC', '0']]);
    szak('chkbFenyszogeltCsompontok', [['FELSZ_NODE', T(van(k.fszCsomo, 'fel'))], ['LESZ_NODE', T(van(k.fszCsomo, 'le'))]]);
    szak('chkbFenyszogeltHazak', h12.map(function (n) { return ['HOUSE_' + n, T(van(k.fszHaz, n))]; }));
    szak('chkbFenyszogeltBolygok', PL.map(function (n, j) { return [n, T(van(k.fszPl, j))]; }));
    szak('chkbFenyszogeltKisBolygok', KISB.slice(0, 8).map(function (x) { return [x[0], T(van(k.fszKisb, x[1]))]; }));
    szak('chkbEgyebMegjelenitesek', EGYEB.map(function (x) { return [x[0], T(k[x[1]])]; }));
    szak('chkbFokjelolok', FOK.map(function (x) { return [x[0], T(k[x[1]])]; }));
    szak('rgrpEnallapotJelolMod', [['JelolesMod', k.enMod === 0 ? '0' : '1']]);
    szak('grpBetumeretSzorzo', [['BetumeretSzorzo', vesszo(k.meret || 1)]]);
    szak('chkbProgressziok', [['CsakSzekDirHold', T(b.phCsakHold)], ['SzekDirHoldAscMC', T(b.phTengely)]]);
    szak('rgrpTobbKepletMegjelenitese', [['MegjelenitesiMod', b.osszevetesMod === 'egymasmellett' ? '1' : '0']]);
    szak('rgrpTobbKepletElhelyezese', [['KepletElhelyezesiMod', b.osszElhely === 'vizszintes' ? '1' : '0']]);
    szak('chkbProgresszioIrany', [['ProgresszioIrany', b.pdKonverz ? '1' : '0']]);
    szak('chkbBolygoTablazat', [['KELL_E', T(NY('planetak'))], ['PLANETDEG', T(NY('plFok'))], ['ZODIACSIGN', T(NY('plJegy'))], ['HOUSENUM', T(NY('plHaz'))], ['HOUSELORDS', T(NY('plUr'))]]);
    szak('chkbHazTablazat', [['KELL_E', T(NY('hazak'))], ['HOUSEDEG', T(NY('hzFok'))], ['ZODIACSIGN', T(NY('hzJegy'))]]);
    szak('chkbFenyszogTablazat', [['KELL_E', T(NY('fenyszog'))]]);
    szak('chkbEletStratTablazat', [['KELL_E', T(NY('eletstrat'))]]);
    szak('chkbNyomtatasSzinesben', [['NyomtatSzinesben', T(ny.szines)]]);
    szak('chkbFejlecKijelzesek', [['KELL_E', T(NY('fejlec'))]].concat(FEJLEC.map(function (x) { return [x[0], T(NY(x[1]))]; })));
    szak('chkbLablecKijelzesek', [['KELL_E', T(NY('lablec'))], ['BASEINFO', T(NY('lAlap'))], ['REGINFO', T(NY('lReg'))]]);
    szak('chkbInkognito', [['Inkognito', T(ny.inkognito)]]);
    szak('chkbHazrendszer', [['Hazrendszer', b.hsys || 'P']]);
    szak('chkbZodiakus', [['Zodiakus', b.sid ? 'S' : 'T']]);
    var hely = b.alapHely || {};
    szak('chkbEgyebek', [['LastOpenedFilesNum', '10'], ['TelepulesDB', '0'], ['KivalTelepules', (hely.telepules || 'Budapest') + '; ' + (hely.orszagKod || 'H')]]);
    szak('chkbZodiakusBackGroundColor', ELEM.map(function (x) { return [x[0], tc(b.szin[x[1]])]; }));
    szak('chkbFenyszogekBackgroundColor', [['FenyszogBackgroundColor', tc(b.szin.aspectBg)]]);
    szak('chkbFenyszogColor', FSZ.map(function (n, j) { return [n, tc(b.szin.fsz[j + 1])]; }));
    szak('chkbFenyszogStyle', FSZ.map(function (n, j) { return [n, String(b.szin.stilus[j + 1] || 0)]; }));
    szak('Vonalvastagsagok', [['Alapvonalak', String(b.szin.vonal || 1)]]);
    szak('PlanetSymbolsGroup', [['UranusSymbol', String(b.szin.uranusz || 0)], ['PlutoSymbol', String(b.szin.pluto || 0)]]);
    szak('chkbFenyszogekFixedStars', FSZ_NAGY.map(function (n, j) { return [n, T(van(b.allo.fsz, j + 1))]; }).concat([['chkbFenyszogekFixedStarsOrbValue', vesszo(b.allo.orb)]]));
    szak('chkbOrbSettingsSwitch', [['ReszletesBeallitas', T(b.orb.mod === 'reszletes')]]);
    szak(WEB, [['Beallitasok', JSON.stringify(b)]]);
    var t = s.join('\r\n'), ki = new Uint8Array(2 + t.length * 2);
    ki[0] = 0xFF; ki[1] = 0xFE;
    for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); ki[2 + 2 * i] = c & 255; ki[3 + 2 * i] = c >> 8; }
    return ki.buffer;
  }

  R.BeallIni = { olvas: olvas, ir: ir, ertelmez: ertelmez, dekodol: dekodol };
})(typeof window !== 'undefined' ? window : globalThis);
