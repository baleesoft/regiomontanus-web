/*
 * kerek.js – a Regiomontanus képletkerék SVG-ben, a Windows-os program (uAstro4AllDrawing.pas) geometriája szerint.
 * Bemenet: a böngészőben számolt pozíciók + a szerveroldali elemzés (házak, házurak, fényszögek, énjelölők).
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var VS = '︎';
  var SYM = '"Regio Symbols", "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols", sans-serif';
  var TXT = 'Arial, Tahoma, "Liberation Sans", sans-serif';

  var PLANETA = { 0: '☉', 1: '☽', 2: '☿', 3: '♀', 4: '♂', 5: '♃', 6: '♄', 7: '♅', 8: '♆', 9: '♇',
    10: '☊', 11: '☊', 12: '⚸', 13: '⚸', 15: '⚷', 17: '⚳', 18: '⚴', 19: '⚵', 20: '⚶', 24: '☋', 25: '☋' };
  var PNEV = { 0: 'Nap', 1: 'Hold', 2: 'Merkúr', 3: 'Vénusz', 4: 'Mars', 5: 'Jupiter', 6: 'Szaturnusz', 7: 'Uránusz',
    8: 'Neptunusz', 9: 'Plútó', 10: 'Felsz. holdcsomó (közepes)', 11: 'Felsz. holdcsomó (valódi)', 12: 'Lilith',
    13: 'Priapus', 15: 'Chiron', 16: 'Pholus', 17: 'Ceres', 18: 'Pallas Athene', 19: 'Juno', 20: 'Vesta',
    24: 'Lesz. holdcsomó (közepes)', 25: 'Lesz. holdcsomó (valódi)' };
  var JEGY = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  var JNEV = ['Kos', 'Bika', 'Ikrek', 'Rák', 'Oroszlán', 'Szűz', 'Mérleg', 'Skorpió', 'Nyilas', 'Bak', 'Vízöntő', 'Halak'];
  var FSZ = { 1: '☌', 2: '☍', 3: '□', 4: '∠', 5: '⚼', 6: '△', 7: '⚹', 8: '⚺', 9: '⚻', 10: '⊥', 11: '⫠', 12: '⫫' };
  var FSZNEV = { 1: 'Együttállás', 2: 'Szembenállás', 3: 'Negyedfény', 4: 'Nyolcadfény', 5: 'Három-nyolcadfény',
    6: 'Harmadfény', 7: 'Hatodfény', 8: 'Tizenkettedfény', 9: 'Öt-tizenkettedfény', 10: 'Ötödfény', 11: 'Tizedfény', 12: 'Két-ötödfény' };

  /* A Windows-os program gyári beállításai (uAstro4AllMain: alapértelmezések visszaállítása) */
  var ALAP = {
    planets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],          // chkbBolygok; holdcsomó és kisbolygó alapból nincs
    aspectTypes: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // chkbFenyszogek: együttállás-vonal nincs
    aspectSymbols: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    aspectPlanets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],     // chkbFenyszogeltBolygok
    dashed: [6, 7, 8, 9, 10, 11, 12],                  // chkbFenyszogStyle: harmadfénytől szaggatott (ha nincs aspectStyles)
    // aspectStyles: { fényszög: 0 sima | 1 szaggatott | 2 pettyezett }, aspectColors: { fényszög: szín } (fBeallitasok_Szinek)
    // vonal: alapvonal-vastagság (GetBaseLinePenWidth: körök, házcsúcsok); jelek: { 7: Uránusz-, 9: Plútó-jel } (cURANUSLETTERS, cPLUTOLETTERS)
    vonal: 1,
    houseLords: true, feral: true, retrograde: false, stationary: false,
    selfMarkers: true, selfMarkerAtOrigPlace: true, cuspLabels: true,
    colors: { fire: '#FB031B', earth: '#0BCA02', air: '#FFFF55', water: '#2A6AFF', aspectBg: '#FFFFFF', aspect: '#000000' },
    /* Megjelenítés (fBeallitasok_Megjelenites) – a gyári értékek szerint */
    jegyek: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],   // chkbZodiakusJelek: a jegyek jele
    analog: false,                                   // KELL_E_ANALOG: a jegy analóg planétája
    hazHatar: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // chkbHazHatarok (a házcsúcs fokszáma is csak ezeknél)
    hazSzam: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],  // chkbHazSzamok
    arab: true,                                      // HOUSENUMSBYARABICNUMBERS (ki: I, IV, VII, X)
    tengelyek: [],                                   // chkbTengelyek 4..7: 'vtx', 'ep', 'cas', 'pas'
    mcIc: false,                                     // egyenlő házaknál MC és IC jel (D 1859–1863)
    planetDeg: false,                                // PLANETDEG
    enKor: false,                                    // rgrpEnallapotJelolesMod: 0 kör, 1 háromszög
    meret: 1,                                        // BetumeretSzorzo – a planéták mérete
    fokKulso: false, fokBelso: true, fokFsz: false, fokKulon: true,  // chkbFokjelolok (a HOUSEDEG: cuspLabels)
    aspectHouses: [],                                // chkbFenyszogeltHazak: 1 = ASC, 10 = MC, a többi házcsúcs
    fszPlanetaig: false,                             // FSZVONALPLANETAIG – „Placidus-stílus”
    fszEredeti: false                                // ASPECTSATORIGPLACE
  };
  /** a jegyek analóg planétái (cZODIACANDPLANETLETTERS) */
  var ANALOG = [4, 3, 2, 1, 0, 2, 3, 9, 5, 6, 7, 8];
  /** a további tengelyek (cAXISNAMES) – a keréken a planétákkal együtt rendeződnek */
  var TPONT = { vtx: ['Vtx', 'Vertex'], ep: ['EP', 'Keletpont'], cas: ['Cas', 'Koascendens (M. Munkasey)'], pas: ['Pas', 'Sarki ascendens'] };
  /** házszám: a sarokházak (1, 4, 7, 10) arab számok helyett római számmal (cHOUSECAPTIONS.sHouseNumberOther) */
  function hazSzamStr(n, arab) { return arab ? String(n) : ({ 1: 'I', 4: 'IV', 7: 'VII', 10: 'X' }[n] || String(n)); }

  function el(tag, attrs, szulo) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (szulo) szulo.appendChild(e);
    return e;
  }
  function szoveg(t, attrs, szulo) { var e = el('text', attrs, szulo); e.textContent = t; return e; }
  function cim(e, t) { var c = el('title', {}, e); c.textContent = t; return e; }
  function fokNorm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function jegy(lon) { return Math.floor(Math.floor(fokNorm(lon)) / 30); }
  function elemSzin(j, c) { return [c.fire, c.earth, c.air, c.water][j % 4]; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fokStr(f) {
    var s = Math.trunc(f) + '°', r = f - Math.trunc(f);
    if (r !== 0) { s += pad2(Math.trunc(r * 60)) + '\''; r -= Math.trunc(r * 60) / 60; if (r !== 0) s += pad2(Math.trunc(r * 3600)) + '"'; }
    return s;
  }
  function kozott(x, a, b) { return a <= b ? (x >= a && x <= b) : (x >= a || x <= b); }
  /* állócsillagok (SE_FIXSTAR_OFFSET + n): a nevük a Regio.Allo listából */
  var CS_ELTOLAS = 10000000;
  function csillag(id) { return id > CS_ELTOLAS; }
  function allo() { return global.Regio && global.Regio.Allo; }
  function nevE(id) {
    if (csillag(id)) return allo() ? allo().teljesNev(id) : String(id);
    return PNEV[id] || (global.Regio && global.Regio.nev ? global.Regio.nev(id) : String(id));
  }
  /** jel nélküli kisbolygó/üstökös rövid felirata a keréken (Eris, Neow, Hall, Csur, Oumu, Hale, NMag-f) */
  function szovegJel(id) { var k = global.Regio && global.Regio.kisbolygo && global.Regio.kisbolygo(id); return k && k[2] ? k[2] : null; }
  var PHOLUS = 16;
  /** A Pholus jele (nincs Unicode-megfelelője): karika, szár, keresztvonal, alul ív – a RegiomontanusWIN betűkészlet szerint */
  function pholusJel(cx, cy, px, szulo) {
    var s = px * 0.36, f = function (v) { return v.toFixed(2); }, sw = Math.max(1, px * 0.075);
    var g = el('g', { stroke: '#000', 'stroke-width': f(sw), fill: 'none', 'stroke-linecap': 'round' }, szulo);
    el('circle', { cx: f(cx), cy: f(cy - s * 0.72), r: f(s * 0.3) }, g);
    el('path', { d: 'M' + f(cx) + ' ' + f(cy - s * 0.42) + 'V' + f(cy + s) + 'M' + f(cx - s * 0.4) + ' ' + f(cy + s * 0.05) + 'H' + f(cx + s * 0.4) +
      'M' + f(cx - s * 0.65) + ' ' + f(cy + s * 0.45) + 'Q' + f(cx - s * 0.6) + ' ' + f(cy + s * 1.05) + ' ' + f(cx) + ' ' + f(cy + s) +
      'Q' + f(cx + s * 0.6) + ' ' + f(cy + s * 1.05) + ' ' + f(cx + s * 0.65) + ' ' + f(cy + s * 0.45) }, g);
    return g;
  }


  /* ---------- asztroszkóp: a csillagképek ívei a kerék körül (Regio.CSILLAGKEPEK, J2000 + precesszió) ---------- */
  /** a „mint a képen” válogatás: az ekliptika menti csillagképeken kívül */
  var AS_KEP = ['Sex', 'Mon', 'Ori', 'Eri', 'Cet', 'Aql', 'Del', 'Equ', 'Oph', 'SerCap', 'SerCau', 'Crt', 'Crv', 'Hya'];
  /** színpaletta (kitöltés áttetszően, felirat és körvonal teltebben); a Tejút szürke */
  var AS_SZIN = ['#d9363e', '#3b5bd6', '#2c9a48', '#9446c2', '#d8801f'], AS_TEJUT = '#8a8a8a';
  var asSzaml = 0;
  /** a 27 naksatra (holdház): 13°20′-es egyenlő szakaszok a sziderikus Kos 0°-tól (Lahiri), uraik a vimsottari sorrendben */
  var NAKSATRA = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
    'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
    'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
  var NAK_UR = [['Ketu', '#9b6fb5'], ['Vénusz', '#eea3c4'], ['Nap', '#f2a33a'], ['Hold', '#e6e6e6'], ['Mars', '#e2493f'],
    ['Rahu', '#66708f'], ['Jupiter', '#f3d548'], ['Szaturnusz', '#3f63b8'], ['Merkúr', '#45a556']];
  function vilagos(h) { var n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 140; }
  /** a 13 csillagképes zodiákus színei: a megfelelő jegy eleme szerint (Kos = tűz …), a Kígyótartó szürke */
  var AS_ELEM = { Ari: 0, Tau: 1, Gem: 2, Cnc: 3, Leo: 4, Vir: 5, Lib: 6, Sco: 7, Sgr: 8, Cap: 9, Aqr: 10, Psc: 11 }, AS_OPH = '#a6a6a6';
  /** a felirat színe: a sáv színének sötétebb árnyalata */
  function sotet(h) {
    var n = parseInt(h.slice(1), 16), f = function (x) { return pad2h(Math.round(x * 0.72)); };
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }
  function pad2h(x) { var t = x.toString(16); return t.length < 2 ? '0' + t : t; }
  function hossz(a, b) { var h = fokNorm(b - a); return h === 0 ? 360 : h; }
  function atfed(x, y) { return fokNorm(y.l0 - x.l0) < x.h + 1 || fokNorm(x.l0 - y.l0) < y.h + 1; }
  /**
   * @param {Object} as – { eltolas: fok (precesszió − ajánamsa), mod: 'kep' | 'sav' | 'zod13', sav: fok, tejut: bool }
   *   'zod13': csak az ekliptika 13 csillagképe (13 csillagképes zodiákus), a jegyek elemszíneivel
   * @returns {{ekl: Array, sorok: Array}|null} – az ekliptika menti sor és a többi csillagkép sorokba rendezve
   */
  function asztroTerv(as, nak) {
    var D = global.Regio && global.Regio.CSILLAGKEPEK, gy = [];
    // naksatrák: a legbelső gyűrű (nak.kezdet = az Ashwini eleje a kerék zodiákusában)
    if (nak) gy.push({ szel: 0.085, telt: true, min: 0.4, lista: NAKSATRA.map(function (nv, i) {
      var l0 = fokNorm(+nak.kezdet + i * 40 / 3), u = NAK_UR[i % 9];
      // a keréken a Purva/Uttara rövidítve (P./U.), hogy a betűméret ne legyen túl kicsi; a teljes név a buborékban
      return { a: 'nak' + (i + 1), n: nv.replace(/^Purva /, 'P. ').replace(/^Uttara /, 'U. '), l0: l0, h: 40 / 3, szin: u[1],
        cim: nv + ' (' + (i + 1) + '. naksatra, ura: ' + u[0] + ')' };
    }) });
    if (!as || !D) return gy.length ? { gyuruk: gy } : null;
    var e = +as.eltolas || 0, eklNev = {}, lista = [], sorok = [];
    var ekl = D.ekl.map(function (x, i) {
      eklNev[x[0]] = true;
      var l0 = fokNorm(x[1] + e), l1 = fokNorm(D.ekl[(i + 1) % D.ekl.length][1] + e);
      return { a: x[0], n: D.nev[x[0]], l0: l0, l1: l1, h: hossz(l0, l1), ekl: true };
    });
    if (as.mod === 'zod13') {
      ekl.forEach(function (x) { x.szin = AS_ELEM[x.a] === undefined ? AS_OPH : elemSzin(AS_ELEM[x.a], as.colors); });
      gy.push({ szel: 0.09, telt: true, lista: ekl });
      return { gyuruk: gy };
    }
    ekl.forEach(function (x, i) { x.szin = AS_SZIN[i % AS_SZIN.length]; });
    gy.push({ szel: 0.075, lista: ekl });
    var sav = Math.min(30, Math.max(0, +as.sav || 10));
    D.kulso.forEach(function (x) {
      if (as.mod === 'sav' ? eklNev[x[0]] || x[2] > sav : AS_KEP.indexOf(x[0]) < 0) return;
      x[3].forEach(function (iv) {
        var l0 = fokNorm(iv[0] + e), l1 = fokNorm(iv[1] + e);
        lista.push({ a: x[0], n: x[1], l0: l0, l1: l1, h: hossz(l0, l1) });
      });
    });
    if (as.tejut !== false) D.tejut.forEach(function (iv) {
      var l0 = fokNorm(iv[0] + e), l1 = fokNorm(iv[1] + e);
      lista.push({ a: 'Tejút', n: 'Tejút', l0: l0, l1: l1, h: hossz(l0, l1), tejut: true });
    });
    // sorokba rendezés: a hosszabbak előbb, mindegyik az első olyan sorba, ahol nem fed át (1° hézaggal)
    lista.sort(function (p, q) { return q.h - p.h || (p.a < q.a ? -1 : 1); });
    lista.forEach(function (x) {
      for (var i = 0; i < sorok.length; i++) if (sorok[i].every(function (y) { return !atfed(x, y); })) { sorok[i].push(x); return; }
      sorok.push([x]);
    });
    sorok.forEach(function (s, si) {
      s.sort(function (p, q) { return p.l0 - q.l0; });
      s.forEach(function (x, i) { x.szin = x.tejut ? AS_TEJUT : AS_SZIN[(i + 2 * si + 1) % AS_SZIN.length]; });
      gy.push({ szel: 0.075, lista: s });
    });
    return { gyuruk: gy };
  }

  /** az asztroszkóp gyűrűi R_AS0-tól kifelé (mindkét stílusnál) */
  function asztroRajz(svg, AS, pont, r, R_AS0, G_AS) {
    var gA = el('g', { 'class': 'asztroszkop' }, svg), gDef = el('defs', {}, gA), id0 = 'as' + (++asSzaml) + '_', n = 0;
    var f = function (p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); };
    var hely = function (l) { var fj = fokNorm(l) - jegy(l) * 30, fo = Math.floor(fj), pc = Math.floor((fj - fo) * 60);
      return JNEV[jegy(l)] + ' ' + fo + '°' + pad2(pc) + '′'; };
    function iv(x, r1, gyuru) {
      var W_AS = gyuru.szel * r, telt = gyuru.telt, szin = x.szin;
      var r2 = r1 + W_AS, l1 = x.l0 + x.h, nagy = x.h > 180 ? 1 : 0, h360 = x.h >= 359.99;
      if (h360) l1 = x.l0 + 359.99;
      var g = el('g', { 'class': 'csk' + (x.tejut ? ' tejut' : ''), 'data-csk': x.a }, gA);
      el('path', { d: 'M' + f(pont(x.l0, r2)) + 'A' + r2 + ',' + r2 + ' 0 ' + nagy + ' 0 ' + f(pont(l1, r2)) + 'L' + f(pont(l1, r1)) +
        'A' + r1 + ',' + r1 + ' 0 ' + nagy + ' 1 ' + f(pont(x.l0, r1)) + 'Z', fill: szin, 'fill-opacity': telt ? 1 : 0.4,
        stroke: telt ? '#fff' : szin, 'stroke-opacity': telt ? 1 : 0.85, 'stroke-width': telt ? 1.5 : 1.2 }, g);
      cim(g, (x.cim || x.n + (x.tejut ? '' : ' (' + (x.a.indexOf('Ser') === 0 ? 'Ser' : x.a) + ')') +
        (x.ekl ? ' – az ekliptikán' : '')) + ': ' + hely(x.l0) + ' – ' + hely(l1));
      // felirat az ív közepén, a felső félkörben balról jobbra (óramutató szerint), az alsóban a másik irányban
      var rm = r1 + W_AS / 2, kozep = x.l0 + x.h / 2, fent = pont(kozep, rm)[1] < 0, ivh = rm * x.h * Math.PI / 180;
      var fs = gyuru.fs || W_AS * 0.6, t = x.n;
      if (t.length * fs * 0.56 > ivh * 0.92) {
        var fs2 = ivh * 0.92 / (t.length * 0.56);
        if (fs2 >= fs * (gyuru.min || 0.55)) fs = fs2;
        else if (x.cim) fs = fs2;   // naksatra: rövidítés helyett kisebb betű
        else { t = x.tejut ? '' : x.a.indexOf('Ser') === 0 ? 'Ser' : x.a; fs = Math.min(fs, ivh * 0.92 / (Math.max(1, t.length) * 0.56)); }
      }
      if (!t || fs < W_AS * 0.24) return;
      var pid = id0 + (n++), a0 = fent ? l1 : x.l0, a1 = fent ? x.l0 : l1;
      el('path', { id: pid, d: 'M' + f(pont(a0, rm)) + 'A' + rm + ',' + rm + ' 0 ' + nagy + ' ' + (fent ? 1 : 0) + ' ' + f(pont(a1, rm)) }, gDef);
      var tx = el('text', { 'font-size': fs.toFixed(1), fill: telt ? (vilagos(szin) ? '#000' : '#fff') : sotet(szin), stroke: 'none', dy: (fs * 0.35).toFixed(1), 'pointer-events': 'none' }, g);
      var tp = el('textPath', { href: '#' + pid, startOffset: '50%', 'text-anchor': 'middle' }, tx);
      tp.textContent = t;
    }
    var r1 = R_AS0;
    AS.gyuruk.forEach(function (gyuru) {
      // a naksatrák egyforma betűmérettel: a leghosszabb név is elférjen
      if (gyuru.min) gyuru.fs = gyuru.lista.reduce(function (m, x) {
        return Math.min(m, (r1 + gyuru.szel * r / 2) * x.h * Math.PI / 180 * 0.92 / (x.n.length * 0.56));
      }, gyuru.szel * r * 0.6);
      gyuru.lista.forEach(function (x) { iv(x, r1, gyuru); });
      r1 += gyuru.szel * r + G_AS;
    });
  }

  /**
   * Személyiségrajz (ptSzemelyisegRajz, D 1736–1782): csak az énjelölő planéták, a velük együtt álló
   * (megjelenített) planéták – a fényszöglista sorrendjében, láncolódva –, és a 12. házban, az ASC-től
   * legfeljebb 7,5°-ra álló planéták (körbefordulás nélkül, mint a Windows-os programban).
   */
  function szemelyisegrajz(k, o) {
    var pl = {}, be = {}, sor = [];
    k.planets.forEach(function (p) { pl[p.id] = p; });
    function add(id) { if (!be[id] && pl[id] && PLANETA[id] !== undefined) { be[id] = true; sor.push(pl[id]); } }
    (k.selfMarkers || []).forEach(function (m) { if (m.type === 'P') add(m.id); });
    (k.aspects || []).forEach(function (a) {
      if (a.aspect !== 1 || a.a[0] !== 'P' || a.b[0] !== 'P') return;
      if (be[a.a[1]] && o.planets.indexOf(a.b[1]) >= 0) add(a.b[1]);
      else if (be[a.b[1]] && o.planets.indexOf(a.a[1]) >= 0) add(a.a[1]);
    });
    k.planets.forEach(function (p) {
      if (p.house === 12 && Math.abs(k.asc - p.lon) <= 7.5 && o.planets.indexOf(p.id) >= 0) add(p.id);
    });
    return sor;
  }

  /**
   * Rajzolás.
   * @param {Element} hova  – a konténer (a meglévő tartalmat lecseréli)
   * @param {Object} k      – { asc, mc, cusps[1..12], planets: [{id, lon, house, lordOf, closedLordOf, feral, isolated, speed}],
   *                            aspects: [...api], selfMarkers: [...api] }
   * @param {Object} beall  – felülírja az ALAP beállításokat
   * @param {Object} [kulso] – összevetés „egymáson” (D.ReDrawCalculatedResults): a külső kör
   *   { planets, asc, mc, cusps[1..12], csucsok: 'mind' | 'tengely' | 'nincs', tengelyJel: bool, betuk: bool, egyenlo: bool }
   *   A külső planéták a zodiákus-sávon kívül (≈1,10 r), a házcsúcsok r…1,075 r tüskeként; énjelölő és
   *   házcsúcs-felirat ilyenkor nincs, a zodiákus-sáv külső szélén is van fokbeosztás.
   */
  function rajzol(hova, k, beall, kulso) {
    var o = {}, kk;
    for (kk in ALAP) o[kk] = ALAP[kk];
    for (kk in (beall || {})) if (beall[kk] !== undefined) o[kk] = beall[kk];
    // más stílus (Beállítások › Megjelenítés › Az ábra stílusa)
    if (o.stilus === 'placidus') return rajzolPlacidus(hova, k, o, kulso);
    if (kulso) { o.selfMarkers = false; o.cuspLabels = false; o.outerTicks = true; }

    var r = 400, R = r * (kulso ? 1.3 : 1.2);
    // planétajelek a beállított Uránusz-/Plútó-változattal
    var PLJ = {}, pj;
    for (pj in PLANETA) PLJ[pj] = PLANETA[pj];
    for (pj in (o.jelek || {})) PLJ[pj] = o.jelek[pj];
    var VV = Math.max(1, +o.vonal || 1);
    var fszSzin = function (a) { return (o.aspectColors && o.aspectColors[a]) || o.colors.aspect; };
    var fszVonal = function (a) {
      var st = o.aspectStyles ? +o.aspectStyles[a] || 0 : (o.dashed.indexOf(a) >= 0 ? 1 : 0);
      return st === 1 ? '6 5' : st === 2 ? '1 3' : null;
    };
    var asc = k.asc;
    // Képernyőszög: az ASC balra, a zodiákus az óramutatóval ellentétesen nő
    function pont(lon, rad) {
      var a = (180 + lon - asc) * Math.PI / 180;
      return [rad * Math.cos(a), -rad * Math.sin(a)];
    }
    function vonal(lon, r1, r2, attrs, szulo) {
      var p = pont(lon, r1), q = pont(lon, r2);
      attrs.x1 = p[0].toFixed(2); attrs.y1 = p[1].toFixed(2); attrs.x2 = q[0].toFixed(2); attrs.y2 = q[1].toFixed(2);
      return el('line', attrs, szulo);
    }

    // A planéták mérete (BetumeretSzorzo): a betűk ennyiszeresek, a planéta-gyűrű a GetSzorzoErtekFor_iGaps szerint
    // kerül beljebb (egész rész + a tört rész 3/10-e; 1 alatt és 2-től a Windows-os program hibásan rajzol, itt 1 … 1,3)
    var meret = Math.min(2, Math.max(0.5, +o.meret || 1));
    var gapSzorzo = meret >= 1 ? 1 + (meret - 1) * 0.3 : 1;
    // „Fényszög vonalak nagyítása a planétákig” (FAspectLinesToPlanets): a házszám-gyűrű a középre zsugorodik
    var FP = !!o.fszPlanetaig;
    var belsoHazRes = r / 2 * (FP ? 1.76 : 1.15);           // GetInnerHouseBorderGap
    var kulsoHazRes = belsoHazRes * (FP ? 0.92 : 0.85);     // GetOuterHouseBorderGap

    // Sugarak (r arányában) – GetInnerZodiacBorderGap stb.
    var R_ZOD_SAV = r - Math.round(r / 6 * 0.8);     // 0,867 r – a színes sáv belső széle („fokszám külön íven”)
    var R_ZOD_BELSO = r - r / 6;                      // 0,833 r – fokbeosztás alapja, vezetővonalak célja
    var R_PLANETA = r - 0.2833 * r * gapSzorzo;       // 0,717 r – planéta-jelek
    var R_HAZ_KULSO = r - (kulsoHazRes + 3);          // ≈0,511 r – házszám-gyűrű külső köre
    var R_HAZSZAM = r - belsoHazRes * (FP ? 0.968 : 0.93); // 0,465 r – házszámok
    var R_FSZ = r - belsoHazRes;                      // 0,425 r – fényszögkör (a házszám-gyűrű belső köre)
    var R_FSZ_PL = 0.2833 * r * 2.3;                  // 0,652 r – r − GetAspectBorderInCaseLinesToPlanets
    var R_FSZ_VEG = FP ? r - 0.2833 * r * 1.25 : R_FSZ; // a fényszögvonalak végpontja
    var kulon = o.fokKulon !== false;
    var R_SAV = kulon ? R_ZOD_SAV : R_ZOD_BELSO;      // a színes sáv belső széle

    // Betűméretek (GetFontSize = 12 - (450 - D) div 55, D = 2r; pt -> px)
    var Fpt = 12 - Math.trunc((450 - 2 * r) / 55), F = Fpt * 4 / 3;
    var pxPlaneta = F * 1.25 * meret, pxJegy = F * 1.3, pxHazszam = (F * 3 / 4 - 6) * 4 / 3;
    var pxKicsi = F * 0.62, pxFsz = F * 0.72, pxJelolo = F * 1.05;
    var pxUr = pxKicsi * meret, pxBetu = pxKicsi * 0.9 * meret, pxFok = pxKicsi * 0.94 * meret;
    var pxAnalog = pxJegy * (Fpt - 2) / (Fpt * 1.3);

    // asztroszkóp: a csillagképek ívei a kerék körül (az ekliptika menti sor, kívül a többi, átfedés nélkül sorokban)
    if (o.asztroszkop) o.asztroszkop.colors = o.colors;
    var AS = asztroTerv(o.asztroszkop, o.naksatra), G_AS = r * 0.01, R_AS0 = R + G_AS;
    // szoros elrendezés (egyetlen kerék): házcsúcs-feliratok nélkül, kisebb énjelölőkkel a zodiákuskörhöz simulva
    var SZ = !!AS && !kulso, EN_SZ = SZ ? 0.7 : 1, sEn = pxJelolo * 0.62 * EN_SZ;
    if (SZ) {
      o.cuspLabels = false;
      var enVan = o.selfMarkers && k.selfMarkers && k.selfMarkers.length, nemP = enVan && k.selfMarkers.some(function (m) { return m.type !== 'P'; });
      R_AS0 = r + G_AS + (enVan ? 3 + sEn * (nemP ? 3.7 : 1.8) : 2);
    }
    var RV = AS ? AS.gyuruk.reduce(function (s, g) { return s + g.szel * r + G_AS; }, R_AS0) + G_AS : R;
    // data-r-alap: a kerék szokásos (asztroszkóp nélküli) kiterjedése – a nyomtatás ehhez igazítja a méretet
    var svg = el('svg', { viewBox: [-RV, -RV, 2 * RV, 2 * RV].join(' '), xmlns: NS, role: 'img', 'data-r-alap': R,
      'aria-label': 'Képletábra', 'font-family': TXT, style: 'width:100%;height:auto;display:block' });
    el('rect', { x: -RV, y: -RV, width: 2 * RV, height: 2 * RV, fill: '#fff' }, svg);
    if (AS) asztroRajz(svg, AS, pont, r, R_AS0, G_AS);

    /* ---------- zodiákus-sáv ---------- */
    var gZod = el('g', {}, svg);
    // elemenkénti jegyzetek jelzése: k.jegyzetJelek = { 'P_0': true, 'H_1': true, 'J_0': true, … } (nyomtatásban nincs)
    var jJel = k.jegyzetJelek || {};
    function felkialt(x, y, szin, szulo) {
      return szoveg('!', { x: x, y: y, 'font-size': F * 0.95, 'font-weight': 'bold', 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: szin, stroke: 'none', 'class': 'jegyzetjel', 'pointer-events': 'none' }, szulo);
    }
    var jegyLat = o.jegyek || ALAP.jegyek;
    for (var j = 0; j < 12; j++) {
      var a0 = j * 30, a1 = j * 30 + 30;
      var p0 = pont(a0, r), p1 = pont(a1, r), q1 = pont(a1, R_SAV), q0 = pont(a0, R_SAV);
      el('path', { d: 'M' + p0 + 'A' + r + ',' + r + ' 0 0 0 ' + p1 + 'L' + q1 + 'A' + R_SAV + ',' + R_SAV + ' 0 0 1 ' + q0 + 'Z',
        fill: elemSzin(j, o.colors), stroke: 'none' }, gZod);
      var pj = pont(j * 30 + 15, (r + R_SAV) / 2);
      if (jegyLat.indexOf(j) >= 0) {
        cim(szoveg(JEGY[j] + VS, { x: pj[0], y: pj[1], 'font-size': pxJegy, 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000', 'data-olv': 'jegy:' + j, 'class': 'jegyjel' }, gZod), JNEV[j]);
      }
      // a jegy analóg planétája a jegy 5. fokánál, kisebb betűvel (DrawZodiacSigns, D 2322–2356)
      if (o.analog) {
        var pa = pont(j * 30 + 5, (r + R_SAV) / 2);
        cim(szoveg(PLJ[ANALOG[j]] + VS, { x: pa[0], y: pa[1], 'font-size': pxAnalog, 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000', 'class': 'analog' }, gZod), JNEV[j] + ' analóg planétája: ' + PNEV[ANALOG[j]]);
      }
      // jegyzet jelzése (DJ 26–95): a Kos, Oroszlán, Nyilas (piros sáv) jelénél fehér, máshol piros „!”
      if (jJel['J_' + j]) felkialt(pj[0] + pxJegy * 0.42, pj[1] - pxJegy * 0.42, j % 4 === 0 ? '#fff' : '#d00000', gZod);
    }
    var gVonal = el('g', { stroke: '#000', fill: 'none', 'stroke-width': VV }, svg);
    (kulon ? [r, R_ZOD_SAV, R_ZOD_BELSO] : [r, R_ZOD_BELSO]).concat(FP ? [R_FSZ_PL] : [], [R_HAZ_KULSO])
      .forEach(function (rr) { el('circle', { r: rr }, gVonal); });
    el('circle', { r: R_FSZ, fill: o.colors.aspectBg }, gVonal);
    /* fokbeosztás (DrawBaseCircles, D 1133–1196): 10° r/48, 5° r/72, 1° r/96 */
    function fokVonalak(alap, irany, kell30, h30) {
      var t = '';
      for (var d = 0; d < 360; d++) {
        if (d % 30 === 0 && !kell30) continue;
        var h = d % 30 === 0 ? h30 : d % 10 === 0 ? r / 48 : d % 5 === 0 ? r / 72 : r / 96;
        var t1 = pont(d, alap), t2 = pont(d, alap + irany * h);
        t += 'M' + t1[0].toFixed(2) + ',' + t1[1].toFixed(2) + 'L' + t2[0].toFixed(2) + ',' + t2[1].toFixed(2);
      }
      if (t) el('path', { d: t, 'stroke-width': 0.8 }, gVonal);
    }
    // a jegyhatárok mindig a teljes sávon át; a zodiákuskör belső fokbeosztása a 0,833 r körről kifelé
    fokVonalak(R_ZOD_BELSO, 1, true, r - R_ZOD_BELSO);
    if (o.fokBelso !== false) fokVonalak(R_ZOD_BELSO, 1, false, 0);
    // a zodiákuskör külső széle befelé – több képletnél mindig (DrawDegreeLines(0, −iSub))
    if (o.outerTicks || o.fokKulso) fokVonalak(r, -1, false, 0);
    // a fényszögkör (Placidus-stílusnál a planéták köre) belső oldalán, befelé; a jegyhatárnál r/24
    if (o.fokFsz) fokVonalak(FP ? R_FSZ_PL : R_FSZ, -1, true, r / 24);

    /* ---------- planéták elhelyezése (DrawPlanets + ReArrangePlanets) ---------- */
    var cs = k.cusps;
    var lathato = k.planets.filter(function (p) {
      return o.planets.indexOf(p.id) >= 0 && (PLANETA[p.id] !== undefined || p.id === PHOLUS || csillag(p.id) || !!szovegJel(p.id));
    });
    if (o.szemely) lathato = szemelyisegrajz(k, o);
    // Állócsillagok (DrawPlanets, D 1806–1830): ha 21-nél több van, csak a fényszöggel rendelkezők közül az első 21 látszik,
    // hacsak nincs bekapcsolva a „Megjelenítéskor mutasd mindig az összeset!”
    var csDb = lathato.filter(function (p) { return csillag(p.id); }).length;
    if (csDb > 21 && !o.csillagMind) {
      var csN = 0;
      lathato = lathato.filter(function (p) {
        if (!csillag(p.id)) return true;
        if (p.hasAspects) csN++;
        return csN <= 21 && !!p.hasAspects;
      });
    }
    var urSzoveg = function (p) {
      if (!o.houseLords || !p.lordOf) return '';
      var s = p.lordOf.join(',');
      if (p.closedLordOf && p.closedLordOf.length) s += (s ? ' ' : '') + '(' + p.closedLordOf.join(',') + ')';
      return s;
    };
    var W = pxPlaneta * 1.05;
    // a csillag neve (legfeljebb 10 betű) szövegként, a planétajel méretének 2/3-ával (SetSignLetter: nem Kepler-font)
    var pxCsillag = pxPlaneta * 2 / 3;
    var elemek = lathato.map(function (p) {
      var lon = p.lon, h = p.house;
      // házhatár melletti planéták 3°-kal beljebb (csak a kezdő elhelyezésnél)
      if (h) {
        var hk = cs[h], hv = cs[h % 12 + 1];
        if (lon >= hk && lon <= fokNorm(hk + 3)) lon = fokNorm(lon + 3);
        else if (lon <= hv && lon >= fokNorm(hv - 3)) lon = fokNorm(lon - 3);
      }
      if (csillag(p.id) || szovegJel(p.id)) {
        // szöveges felirat: állócsillag neve (10 betű) vagy a jel nélküli kisbolygó/üstökös rövid neve
        var cn = csillag(p.id) ? (allo() ? allo().rovid(p.id) : '') : szovegJel(p.id);
        var ec = { p: p, orig: p.lon, uj: p.lon, ur: '', szoveg: cn, csillag: csillag(p.id), w: cn.length * pxCsillag * 0.56 + 4, h: pxCsillag * 1.25 };
        ec.fel = ec.h / 2;
        helyez(ec, lon);
        return ec;
      }
      var ur = urSzoveg(p);
      // a doboz a házúr-feliratot is magában foglalja (a Windows-os vezérlő mérete is így számol)
      var e = { p: p, orig: p.lon, uj: p.lon, ur: ur, w: Math.max(W, ur.length * pxUr * 0.56),
        h: W + (ur ? pxUr * 1.15 : 0) };
      helyez(e, lon);
      return e;
    });
    function helyez(e, lon) { var q = pont(lon, R_PLANETA); e.x = q[0]; e.y = q[1]; e.bal = q[0] - e.w / 2; e.fent = q[1] - (e.fel || e.w / 2); }
    function atfed(a, b) {
      return a.bal < b.bal + b.w && b.bal < a.bal + a.w && a.fent < b.fent + b.h && b.fent < a.fent + a.h;
    }
    // planétaperspektívánál az eredeti ASC és MC jele a planéták között; nem mozdul (D 1841–1845, 2603–2609)
    (k.tengelyJelek || []).forEach(function (t) {
      if (typeof t[1] !== 'number') return;
      var e = { tengely: t[0], nev: t[2], orig: t[1], uj: t[1], ur: '', w: W, h: W, fix: true };
      helyez(e, t[1]); elemek.push(e);
    });
    // további tengelyek (Vertex, Keletpont, Koascendens, Sarki ASC) és egyenlő házaknál az MC/IC: a planétákkal együtt
    // rendeződnek (AddGraphicItemToPlanetList, D 1859–1875); planétaperspektívában csak az eredeti AC/MC
    var tovabbi = [];
    if (o.mcIc && !k.tengelyJelek && typeof k.mc === 'number') tovabbi.push(['IC', fokNorm(k.mc + 180), 'Imum Coeli'], ['MC', k.mc, 'Medium Coeli']);
    (o.tengelyek || []).forEach(function (t) {
      var lon = k.tengelyPontok && k.tengelyPontok[t];
      if (TPONT[t] && typeof lon === 'number') tovabbi.push([TPONT[t][0], lon, TPONT[t][1]]);
    });
    tovabbi.forEach(function (t) {
      var w = Math.max(W, t[0].length * pxKicsi * 0.78);
      var e = { tengely: t[0], nev: t[2], orig: t[1], uj: t[1], ur: '', w: w, h: W, fel: W / 2, fix: false, pont: true };
      helyez(e, t[1]); elemek.push(e);
    });
    // a Windows-os 250 lépés után megáll; állócsillagokkal (hosszú nevek) ez kevés, ott több lépést engedünk
    var biztonsag = 0, rendben, csillagDb = elemek.filter(function (e) { return e.csillag; }).length;
    var biztonsagMax = 250 + csillagDb * 120;
    do {
      rendben = true;
      for (var i = 0; i < elemek.length; i++) {
        for (var jj = i + 1; jj < elemek.length; jj++) {
          var e1 = elemek[i], e2 = elemek[jj];
          if (!atfed(e1, e2) || (e1.fix && e2.fix)) continue;
          rendben = false;
          var mozgat = Math.abs(e1.orig - e2.orig) >= 330 ? (e1.orig >= 330 ? -2 : 2) : (e1.orig < e2.orig ? -2 : 2);
          if (e1.fix || e2.fix) mozgat *= 2;
          if (!e1.fix) { e1.uj += mozgat; if (e1.uj < 0) e1.uj = 360; else if (e1.uj > 360) e1.uj = 0; helyez(e1, e1.uj); }
          if (!e2.fix) { e2.uj -= mozgat; if (e2.uj < 0) e2.uj = 360; else if (e2.uj > 360) e2.uj = 0; helyez(e2, e2.uj); }
          biztonsag++;
        }
      }
      biztonsag++;
    } while (!rendben && biztonsag <= biztonsagMax);

    // Házhatárt átlógó planéták: a házcsúcs a planéta-sávban pontozott lesz
    var cikk = {};
    elemek.forEach(function (e) {
      if (e.tengely) return;
      var h = e.p.house; if (!h) return;
      var kov = h % 12 + 1, pr = e.uj, hr = cs[kov];
      if (hr < pr && Math.abs(hr - pr) > 250) hr += 360;
      if (pr < hr && Math.abs(hr - pr) > 250) pr += 360;
      if (pr >= hr) cikk[kov] = true;
      pr = e.uj; hr = cs[h];
      if (hr < pr && Math.abs(hr - pr) > 250) hr += 360;
      if (pr < hr && Math.abs(hr - pr) > 250) pr += 360;
      if (pr <= hr) cikk[h] = true;
    });

    /* ---------- házcsúcsok ---------- */
    var gHaz = el('g', { stroke: '#000' }, svg);
    var hazHatar = o.hazHatar || ALAP.hazHatar, hazSzam = o.hazSzam || ALAP.hazSzam, arab = o.arab !== false;
    for (var hz = 1; hz <= 12; hz++) {
      var vast = ((hz === 1 || hz === 4 || hz === 7 || hz === 10) ? 2.2 : 1) * VV;
      if (hazHatar.indexOf(hz) < 0) { /* a ház határa nem látszik (chkbHazHatarok) */ }
      else if (cikk[hz]) {
        vonal(cs[hz], R_ZOD_BELSO, R_HAZ_KULSO, { 'stroke-width': VV, 'stroke-dasharray': '1.5 3' }, gHaz);
        vonal(cs[hz], R_HAZ_KULSO, R_FSZ, { 'stroke-width': vast, 'class': 'hazcsucs', 'data-haz': hz }, gHaz);
      } else {
        vonal(cs[hz], R_ZOD_BELSO, R_FSZ, { 'stroke-width': vast, 'class': 'hazcsucs', 'data-haz': hz }, gHaz);
      }
      if (hazSzam.indexOf(hz) < 0) continue;
      // házszám a ház közepén
      var kezd = cs[hz], veg = cs[hz % 12 + 1];
      if (veg < kezd) veg += 360;
      var hp = pont(kezd + (veg - kezd) / 2, R_HAZSZAM);
      szoveg(hazSzamStr(hz, arab), { x: hp[0], y: hp[1], 'font-size': pxHazszam, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: '#000', stroke: 'none', 'data-olv': 'haz:' + hz, 'class': 'hazszam' }, gHaz);
      if (jJel['H_' + hz]) felkialt(hp[0] + pxHazszam * 0.75, hp[1] - pxHazszam * 0.55, '#d00000', gHaz);
    }

    /* ---------- fényszögek (DrawAspects) ---------- */
    var gFsz = el('g', { stroke: o.colors.aspect, 'stroke-width': 1 }, svg);
    var hely = {}, origHely = {};
    elemek.forEach(function (e) { if (!e.tengely) { hely[e.p.id] = e.uj; origHely[e.p.id] = e.orig; } });
    var fszHaz = o.aspectHouses || [];
    (k.aspects || []).forEach(function (a) {
      if (a.a[0] !== 'P') return;
      var id1 = a.a[1], l2, nev2;
      if (hely[id1] === undefined) return;
      if (o.aspectTypes.indexOf(a.aspect) < 0) return;
      if (a.b[0] === 'P') {
        var id2 = a.b[1];
        if (hely[id2] === undefined) return;
        if (o.aspectPlanets.indexOf(id1) < 0 && o.aspectPlanets.indexOf(id2) < 0) return;
        l2 = o.fszEredeti ? origHely[id2] : hely[id2]; nev2 = nevE(id2);
      } else if (a.b[0] === 'A') {
        // fényszögelt tengelyek: az „1 (ASC)” és a „10 (MC)” (GetShownAspectAxis); a többi tengelyhez nincs vonal
        var th = a.b[1] === 0 ? 1 : a.b[1] === 1 ? 10 : 0;
        if (!th || fszHaz.indexOf(th) < 0) return;
        l2 = th === 1 ? k.asc : k.mc; nev2 = th === 1 ? 'Ascendens' : 'Medium Coeli';
      } else if (a.b[0] === 'H') {
        if (fszHaz.indexOf(a.b[1]) < 0) return;
        l2 = cs[a.b[1]]; nev2 = a.b[1] + '. házcsúcs';
      } else return;
      if (typeof l2 !== 'number') return;
      // a két vég azonosítója a kiemeléshez (fokusz): P<id>, A0/A1 (ASC/MC), H<n>
      var v2 = a.b[0] === 'P' ? 'P' + a.b[1] : a.b[0] + a.b[1];
      // „Vonalak a planéta eredeti helyzetéhez”: a valódi hosszúságnál, nem a széttolt jelnél (bAtOrigPlace)
      var p = pont(o.fszEredeti ? origHely[id1] : hely[id1], R_FSZ_VEG), q = pont(l2, R_FSZ_VEG);
      var vonalE = el('line', { x1: p[0].toFixed(2), y1: p[1].toFixed(2), x2: q[0].toFixed(2), y2: q[1].toFixed(2),
        stroke: fszSzin(a.aspect), 'stroke-dasharray': fszVonal(a.aspect),
        'stroke-linecap': fszVonal(a.aspect) === '1 3' ? 'round' : null, 'class': 'fszvonal', 'data-fsz': a.aspect, 'data-v1': 'P' + id1, 'data-v2': v2 }, gFsz);
      var leiras = nevE(id1) + ' – ' + nev2 + ': ' + FSZNEV[a.aspect] + ' (' + fokStr(a.orb).replace(/\d+"$/, '') + ')';
      cim(vonalE, leiras);
      if (o.aspectSymbols.indexOf(a.aspect) >= 0) {
        var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        cim(szoveg(FSZ[a.aspect] + VS, { x: mx, y: my, 'font-size': pxFsz, 'font-family': SYM, 'class': 'fszjel', 'data-v1': 'P' + id1, 'data-v2': v2,
          'text-anchor': 'middle', 'dominant-baseline': 'central', fill: fszSzin(a.aspect), stroke: 'none' }, gFsz), leiras);
      }
    });

    /* ---------- planéták: fehér doboz, jel, házúr, vezetővonal, F/i ---------- */
    var gPl = el('g', {}, svg);
    // vezetővonal: a doboz szélétől a valódi pozícióig (0,833 r)
    // vezetővonal (PrintKocsany): a doboz szélétől a valódi pozícióig (0,833 r); Placidus-stílusnál a doboz túloldalától
    // a planéták körén (0,652 r) lévő valódi helyig is
    function vezeto(e, g, h) {
      h = h || e.h;
      var z = pont(e.orig, R_ZOD_BELSO), cx = e.bal + e.w / 2, cy = e.fent + h / 2;
      var dx = z[0] - cx, dy = z[1] - cy, tMin = Infinity;
      if (dx !== 0) { tMin = Math.min(tMin, Math.abs((e.w / 2) / dx)); }
      if (dy !== 0) { tMin = Math.min(tMin, Math.abs((h / 2) / dy)); }
      if (tMin < 1) {
        el('line', { x1: (cx + dx * tMin).toFixed(2), y1: (cy + dy * tMin).toFixed(2), x2: z[0].toFixed(2), y2: z[1].toFixed(2),
          stroke: '#000', 'stroke-width': 0.8 }, g);
      }
      if (FP && tMin < Infinity) {
        var zb = pont(e.orig, R_FSZ_PL);
        el('line', { x1: (cx - dx * tMin).toFixed(2), y1: (cy - dy * tMin).toFixed(2), x2: zb[0].toFixed(2), y2: zb[1].toFixed(2),
          stroke: '#000', 'stroke-width': 0.8, 'class': 'vezeto-belso' }, g);
      }
    }
    // a planéta fokszáma (PrintPlanetDegs): a fok a planéták köre alatt, mellette jobbra fent kisebben a perc
    function fokszam(e, g) {
      var fj = fokNorm(e.orig) - jegy(e.orig) * 30, fo = Math.trunc(fj), pc = Math.round((fj - fo) * 60);
      if (pc === 60) { pc = 0; fo++; }
      var lh = pxFok * 1.15, q = pont(e.uj, R_FSZ_PL - lh * 1.2), w = 2 * pxFok * 0.56;
      szoveg((fo < 10 ? ' ' : '') + fo, { x: q[0], y: q[1], 'font-size': pxFok, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: '#000', 'class': 'plfok' }, g);
      szoveg(pad2(pc), { x: q[0] + w * 0.6, y: q[1] - lh * 0.733 + pxFok * 5 / 7 * 0.55, 'font-size': pxFok * 5 / 7,
        'text-anchor': 'start', 'dominant-baseline': 'central', fill: '#000', 'class': 'plperc' }, g);
    }
    elemek.forEach(function (e) {
      if (e.tengely) {
        var megj = e.tengely === 'AC' ? 'P_-1' : e.tengely === 'MC' && !e.pont ? 'P_-2' : null;
        var gt = el('g', { 'class': e.pont ? 'tengelypont' : 'tengelyjel', 'data-tengely': e.tengely, 'data-megj': megj }, gPl), jt = jegy(e.orig);
        cim(gt, e.nev + ': ' + JNEV[jt] + ' ' + fokStr(fokNorm(e.orig) - jt * 30));
        el('rect', { x: e.bal, y: e.fent, width: e.w, height: W, fill: '#fff' }, gt);
        szoveg(e.tengely, { x: e.x, y: e.y, 'font-size': pxKicsi * 1.25, 'font-weight': 'bold', 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000' }, gt);
        vezeto(e, gt, W);
        if (megj && jJel[megj]) felkialt(e.bal + e.w, e.fent, '#d00000', gt);
        return;
      }
      var p = e.p, j = jegy(p.lon), fj = fokNorm(p.lon) - j * 30;
      if (e.szoveg) {
        var gc = el('g', e.csillag ? { 'class': 'csillag', 'data-id': p.id } : { 'class': 'planeta kisb', 'data-id': p.id }, gPl);
        cim(gc, nevE(p.id) + ': ' + JNEV[j] + ' ' + fokStr(fj) + (p.house ? ', ' + p.house + '. ház' : ''));
        el('rect', { x: e.bal, y: e.fent, width: e.w, height: e.h, fill: '#fff' }, gc);
        szoveg(e.szoveg, { x: e.x, y: e.y, 'font-size': pxCsillag, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#000' }, gc);
        vezeto(e, gc);
        if (o.planetDeg) fokszam(e, gc);
        return;
      }
      var g = el('g', { 'class': 'planeta', 'data-id': p.id, 'data-olv': 'pl:' + p.id }, gPl);
      cim(g, nevE(p.id) + ': ' + JNEV[j] + ' ' + fokStr(fj) + (p.house ? ', ' + p.house + '. ház' : '') +
        (p.speed < 0 ? ', retrográd' : '') + (p.feral ? ', ferális' : '') + (p.isolated ? ', izolált' : ''));
      el('rect', { x: e.bal, y: e.fent, width: e.w, height: e.h, fill: '#fff' }, g);
      if (p.id === PHOLUS) pholusJel(e.x, e.y, pxPlaneta, g);
      else szoveg(PLJ[p.id] + VS, { x: e.x, y: e.y, 'font-size': pxPlaneta, 'font-family': SYM, 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: '#000' }, g);
      if (jJel['P_' + p.id]) felkialt(e.bal + e.w + F * 0.15, e.fent + F * 0.3, '#d00000', g);
      if (e.ur) {
        // házúr-számok: számonként külön elem (a horoszkópolvasó mindegyikhez külön szöveget ad)
        var tu = el('text', { x: e.x, y: e.fent + e.w + pxUr * 0.45, 'font-size': pxUr, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000' }, g);
        var darab = function (t, kulcs) { var ts = el('tspan', kulcs ? { 'data-olv': kulcs } : {}, tu); ts.textContent = t; };
        (p.lordOf || []).forEach(function (n, i) { if (i) darab(','); darab(String(n), 'ur:' + p.id + ':' + n); });
        if (p.closedLordOf && p.closedLordOf.length) {
          darab(((p.lordOf || []).length ? ' ' : '') + '(');
          p.closedLordOf.forEach(function (n, i) { if (i) darab(','); darab(String(n), 'ur:' + p.id + ':(' + n + ')'); });
          darab(')');
        }
      }
      vezeto(e, g);
      if (o.planetDeg) fokszam(e, g);
      // R / S / F / i betűk a házszám-gyűrű mellett (PrintRetrograde); a fokszám kijelzésekor kijjebb
      var jel = [];
      if (o.retrograde && p.speed < 0) jel.push('R');
      if (o.stationary && p.stationary) jel = ['S'];
      if (o.feral && p.feral) jel.push('F');
      if (o.feral && p.isolated) jel.push('i');
      if (jel.length) {
        var szv = jel.join(', ');
        var kij = o.planetDeg ? Math.abs((r / 6 * 0.8 - kulsoHazRes) / 2) - 1.7 * Math.max(pxBetu * 1.15, szv.length * pxBetu * 0.56) : pxKicsi * 1.35 * meret;
        var fp = pont(e.uj, r - kulsoHazRes * 0.95 + kij);
        szoveg(szv, { x: fp[0], y: fp[1], 'font-size': pxBetu, 'font-weight': 'bold', 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000', 'class': 'plbetu' }, g);
      }
    });

    /* ---------- házcsúcs-feliratok a kerék körül (fok, jegy, perc) ---------- */
    if (o.cuspLabels) {
      var gCim = el('g', { fill: '#000' }, svg);
      for (var hc = 1; hc <= 12; hc++) {
        if (hazHatar.indexOf(hc) < 0) continue;   // csak a látható házhatároknál (DrawHouseCusps)
        var lon = cs[hc], jj2 = jegy(lon), fokon = fokNorm(lon) - jj2 * 30;
        // a Windows-os program a percet kerekíti (DoubleToPerc), a fokot csonkolja
        var fEgesz = Math.trunc(fokon), perc = Math.round((fokon - fEgesz) * 60);
        if (perc === 60) { perc = 0; fEgesz++; }
        var fokTxt = pad2(fEgesz) + '°', percTxt = pad2(perc) + '\'';
        var bal = hc <= 6 ? fokTxt : percTxt, jobb = hc <= 6 ? percTxt : fokTxt;
        var rf = r + pxKicsi * 1.15, pb = pont(lon - 4, rf), pjb = pont(lon + 4, rf), ps = pont(lon, r + pxJegy * 0.62);
        szoveg(bal, { x: pb[0], y: pb[1], 'font-size': pxKicsi, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gCim);
        szoveg(jobb, { x: pjb[0], y: pjb[1], 'font-size': pxKicsi, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gCim);
        szoveg(JEGY[jj2] + VS, { x: ps[0], y: ps[1], 'font-size': pxJegy * 0.62, 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central' }, gCim);
      }
    }

    /* ---------- énjelölők (DrawSelfMarkers): elemszínű háromszög a kerék körül ---------- */
    if (o.selfMarkers && k.selfMarkers) {
      var gEn = el('g', { stroke: '#000', 'stroke-width': 1.2 }, svg);
      var enPlanetak = k.selfMarkers.filter(function (m) { return m.type === 'P'; }).map(function (m) { return m.id; });
      var poz = {}; k.planets.forEach(function (p) { poz[p.id] = p; });
      k.selfMarkers.forEach(function (m, enIndex) {
        var ra, sz, rr = SZ ? r + 3 + sEn : r + pxJelolo * 1.85, nev, plusz = SZ ? sEn * 1.9 : pxJelolo * 0.8;
        if (m.type === 'P') {
          if (hely[m.id] === undefined) return;
          var origRA = Math.round(poz[m.id].lon), ujRA = Math.round(hely[m.id]);
          ra = origRA;
          if (o.selfMarkerAtOrigPlace) {
            var kell = enPlanetak.some(function (id) { return id !== m.id && poz[id] && Math.abs(poz[id].lon - origRA) <= 1.5; });
            if (kell) {
              var elt = Math.trunc(Math.abs(origRA - ujRA) / 6);
              if (Math.abs(origRA - ujRA) >= 200) elt = -2;
              ra = ujRA >= origRA ? origRA + elt : origRA - elt;
            }
          } else ra = ujRA;
          sz = jegy(poz[m.id].lon); nev = PNEV[m.id];
        } else if (m.type === 'H') {
          // az ASC (házcsúcs) jelölője kijjebb kerül (D: iGap + TextWidth('I')), hogy az ugyanott álló
          // planéta-énjelölő is látszódjon (pl. planétaperspektívában a planéta = ASC)
          ra = Math.round(m.lon); sz = jegy(m.lon); rr += plusz;
          if (+m.house !== 1) { ra += 10; nev = hazSzamStr(+m.house, arab) + '. ház'; } else nev = 'Ascendens';  // házközép (D)
        } else {
          ra = Math.round(m.lon); sz = m.sign; nev = JNEV[m.sign] + ' (az 1. házba bezárt jegy)'; rr += plusz;
        }
        // kör: közelebb a kerékhez (TextWidth('MMI') a háromszög 'MMII'-je helyett)
        if (o.enKor && !SZ) rr -= pxJelolo * 1.85 * 0.126;
        var c = pont(ra, rr), cel = pont(ra, R_PLANETA), dx = cel[0] - c[0], dy = cel[1] - c[1], l = Math.hypot(dx, dy);
        var ux = dx / l, uy = dy / l, s = sEn;
        if (o.enKor) {
          cim(el('circle', { cx: c[0].toFixed(2), cy: c[1].toFixed(2), r: (s * 0.78).toFixed(2), fill: elemSzin(sz, o.colors),
            'data-olv': 'en:' + enIndex, 'class': 'enkor' }, gEn), 'Énjelölő: ' + nev);
          return;
        }
        // csúcs a planéta felé, alap kifelé
        var csucs = [c[0] + ux * s, c[1] + uy * s], b1 = [c[0] - ux * s * 0.8 - uy * s * 0.9, c[1] - uy * s * 0.8 + ux * s * 0.9],
          b2 = [c[0] - ux * s * 0.8 + uy * s * 0.9, c[1] - uy * s * 0.8 - ux * s * 0.9];
        cim(el('path', { d: 'M' + csucs + 'L' + b1 + 'L' + b2 + 'Z', fill: elemSzin(sz, o.colors), 'data-olv': 'en:' + enIndex }, gEn), 'Énjelölő: ' + nev);
      });
    }

    /* ---------- külső kör (összevetés, egymáson) ---------- */
    if (kulso) {
      var R_K_PL = r * 1.10, R_K_TUSKE = r * 1.075;
      var gK = el('g', { 'class': 'kulso' }, svg);
      // házcsúcs-tüskék: Tr/Pd csak ASC és MC, PH semmi, a többi mind a 12 (D 1289–1336)
      var kc = kulso.cusps || [];
      var csucsLista = kulso.csucsok === 'mind' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : kulso.csucsok === 'tengely' ? [1, 10] : [];
      csucsLista.forEach(function (hz) {
        var lonC = hz === 10 && kulso.egyenlo && typeof kulso.mc === 'number' ? kulso.mc : kc[hz];
        if (typeof lonC !== 'number') return;
        vonal(lonC, r, R_K_TUSKE, { stroke: '#000', 'stroke-width': (hz === 1 || hz === 4 || hz === 7 || hz === 10) ? 2.2 : 1 }, gK);
      });
      // planéták + ASC/MC jel; a tengelyjel nem mozdul (D 2603–2609)
      var kElemek = (kulso.planets || []).filter(function (p) {
        return o.planets.indexOf(p.id) >= 0 && (PLANETA[p.id] !== undefined || p.id === PHOLUS) && (!kulso.csakHold || p.id === 1);
      }).map(function (p) {
        var ur = o.houseLords && p.lordOf ? urSzoveg(p) : '';
        return { p: p, orig: p.lon, uj: p.lon, w: Math.max(W, ur.length * pxKicsi * 0.56), h: W + (ur ? pxKicsi * 1.15 : 0), fix: false };
      });
      if (kulso.tengelyJel) {
        [['AC', kulso.asc, 'Ascendens'], ['MC', kulso.mc, 'Medium Coeli']].forEach(function (t) {
          if (typeof t[1] === 'number') kElemek.push({ tengely: t[0], nev: t[2], orig: t[1], uj: t[1], w: W, h: W, fix: true });
        });
      }
      var helyezK = function (e, lon) { var q = pont(lon, R_K_PL); e.x = q[0]; e.y = q[1]; e.bal = q[0] - e.w / 2; e.fent = q[1] - e.w / 2; };
      kElemek.forEach(function (e) { helyezK(e, e.uj); });
      var bizt = 0, kesz;
      do {
        kesz = true;
        for (var a1 = 0; a1 < kElemek.length; a1++) {
          for (var a2 = a1 + 1; a2 < kElemek.length; a2++) {
            var f1 = kElemek[a1], f2 = kElemek[a2];
            if (!atfed(f1, f2) || (f1.fix && f2.fix)) continue;
            kesz = false;
            var mz = Math.abs(f1.orig - f2.orig) >= 330 ? (f1.orig >= 330 ? -2 : 2) : (f1.orig < f2.orig ? -2 : 2);
            if (!f1.fix) { f1.uj += f2.fix ? mz * 2 : mz; if (f1.uj < 0) f1.uj = 360; else if (f1.uj > 360) f1.uj = 0; helyezK(f1, f1.uj); }
            if (!f2.fix) { f2.uj -= f1.fix ? mz * 2 : mz; if (f2.uj < 0) f2.uj = 360; else if (f2.uj > 360) f2.uj = 0; helyezK(f2, f2.uj); }
            bizt++;
          }
        }
        bizt++;
      } while (!kesz && bizt <= 250);
      kElemek.forEach(function (e) {
        var g = el('g', e.tengely ? { 'class': 'kulso-tengely', 'data-id': e.tengely } : { 'class': 'planeta kulso', 'data-id': e.p.id, 'data-olv': 'kpl:' + e.p.id }, gK);
        var jk = jegy(e.orig), fjk = fokNorm(e.orig) - jk * 30;
        el('rect', { x: e.bal, y: e.fent, width: e.w, height: e.w, fill: '#fff' }, g);
        if (e.tengely) {
          cim(g, 'Külső kör – ' + e.nev + ': ' + JNEV[jk] + ' ' + fokStr(fjk));
          szoveg(e.tengely, { x: e.x, y: e.y, 'font-size': pxKicsi * 1.25, 'font-weight': 'bold', 'text-anchor': 'middle',
            'dominant-baseline': 'central', fill: '#000' }, g);
          return;
        }
        var p = e.p;
        cim(g, 'Külső kör – ' + nevE(p.id) + ': ' + JNEV[jk] + ' ' + fokStr(fjk) + (p.house ? ', ' + p.house + '. ház (saját képletében)' : '') +
          (p.speed < 0 ? ', retrográd' : '') + (p.feral ? ', ferális' : '') + (p.isolated ? ', izolált' : '') + (kulso.cimKieg && kulso.cimKieg[p.id] ? '\n' + kulso.cimKieg[p.id] : ''));
        if (p.id === PHOLUS) pholusJel(e.x, e.y, pxPlaneta, g);
        else szoveg(PLJ[p.id] + VS, { x: e.x, y: e.y, 'font-size': pxPlaneta, 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000' }, g);
        // vezetővonal: a doboz szélétől a valódi helyig a zodiákus külső körén (D 435–470)
        var z = pont(e.orig, r), dx = z[0] - e.x, dy = z[1] - e.y, tm = Infinity;
        if (dx !== 0) tm = Math.min(tm, Math.abs((e.w / 2) / dx));
        if (dy !== 0) tm = Math.min(tm, Math.abs((e.w / 2) / dy));
        if (tm < 1) el('line', { x1: (e.x + dx * tm).toFixed(2), y1: (e.y + dy * tm).toFixed(2), x2: z[0].toFixed(2), y2: z[1].toFixed(2),
          stroke: '#000', 'stroke-width': 0.8 }, g);
        // R / S / F / i a gyűrűn kívül (D 482–562; primer direkciónál nincs)
        if (kulso.betuk) {
          var jl = [];
          if (o.retrograde && p.speed < 0) jl.push('R');
          if (o.stationary && p.stationary) jl = ['S'];
          if (o.feral && p.feral) jl.push('F');
          if (o.feral && p.isolated) jl.push('i');
          if (jl.length) {
            var bp = pont(e.uj, r * 1.26 - pxKicsi * 1.1);
            szoveg(jl.join(', '), { x: bp[0], y: bp[1], 'font-size': pxKicsi * 0.9, 'font-weight': 'bold', 'text-anchor': 'middle',
              'dominant-baseline': 'central', fill: '#000' }, g);
          }
        }
      });
    }

    hova.innerHTML = '';
    hova.appendChild(svg);
    return svg;
  }

  /* ==================== „Placidus” stílus ====================
   * Egy másik magyar asztrológiai program ábrájának mintájára (Balázs kérése, 2026-10-25): fehér háttér, kék vonalak,
   * a jegyek jele a zodiákuskörön kívül, a planéták a körön belül fokszámmal (a perc felső indexben), vastag fekete
   * tengelyek nyíllal (ASC, MC), középen vastag kör a házszámgyűrűvel. A Regiomontanus-elemek (házurak, énjelölők,
   * F/i/R, jegyzetjelek, horoszkópolvasó, kiemelés) ugyanazokkal az osztályokkal és data-attribútumokkal, mint a
   * Regiomontanus-stílusban. Összevetésnél a zodiákus sáv, benne a jegyek; a külső kör planétái a sávon kívül.
   */
  var PL_SZIN = '#16168c';   // minden planéta egyszínű sötétkék (Balázs döntése, 2026-10-25)
  var PF_SZIN = { 1: '#16168c', 2: '#c81e1e', 3: '#a3402b', 4: '#a3402b', 5: '#a3402b', 6: '#2a8a2a', 7: '#2a8a2a',
    8: '#5a5abe', 9: '#5a5abe', 10: '#8a1a8a', 11: '#8a1a8a', 12: '#8a1a8a' };
  var PF_VONAL = { 4: '6 4', 5: '6 4', 6: '7 4', 7: '2 3', 8: '2 3', 9: '2 3', 10: '5 3', 11: '5 3', 12: '5 3' };
  var PLACIDUS_HATTER = '#ffffff';   // a minta szürke háttere helyett fehér (Balázs döntése, 2026-10-25)

  /** a körön elhelyezett elemek széttolása (fokban): a szomszédok legalább (w1 + w2) / 2 távolságra; a fix elemek nem mozdulnak */
  function korSzettol(lista, iter) {
    var n = lista.length;
    if (n < 2) return;
    lista.sort(function (a, b) { return a.orig - b.orig; });
    for (var it = 0; it < iter; it++) {
      var mozdult = false;
      for (var i = 0; i < n; i++) {
        var a = lista[i], b = lista[(i + 1) % n];
        var kell = (a.w + b.w) / 2 + 0.8, res = fokNorm(b.uj - a.uj);
        if (res >= kell || (a.fix && b.fix)) continue;
        var d = kell - res;
        if (a.fix) b.uj = fokNorm(b.uj + d);
        else if (b.fix) a.uj = fokNorm(a.uj - d);
        else { a.uj = fokNorm(a.uj - d / 2); b.uj = fokNorm(b.uj + d / 2); }
        mozdult = true;
      }
      if (!mozdult) break;
    }
  }

  function rajzolPlacidus(hova, k, o, kulso) {
    var ff = !!o.feketeFeher, bg = o.nyomtat || ff ? '#ffffff' : PLACIDUS_HATTER;
    var KEK = ff ? '#000' : '#2323b0', VKEK = ff ? '#000' : '#3a3ac6', FEK = '#000';
    var plSzin = function () { return ff ? '#000' : PL_SZIN; };
    var fSzin = function (a) { return ff ? '#000' : PF_SZIN[a] || '#000'; };
    var PLJ = {}, pj;
    for (pj in PLANETA) PLJ[pj] = PLANETA[pj];
    for (pj in (o.jelek || {})) PLJ[pj] = o.jelek[pj];
    var VV = Math.max(1, +o.vonal || 1);
    var asc = k.asc, cs = k.cusps, kos0 = !!k.kos0, jJel = k.jegyzetJelek || {};
    function pont(lon, rad) { var a = (180 + lon - asc) * Math.PI / 180; return [rad * Math.cos(a), -rad * Math.sin(a)]; }
    function f2(v) { return v.toFixed(2); }
    function vonal(lon, r1, r2, attrs, szulo) {
      var p = pont(lon, r1), q = pont(lon, r2);
      attrs.x1 = f2(p[0]); attrs.y1 = f2(p[1]); attrs.x2 = f2(q[0]); attrs.y2 = f2(q[1]);
      return el('line', attrs, szulo);
    }
    // a körre merőleges egységvektor a növekvő hosszúság felé (a képernyőn az óramutatóval ellentétesen)
    function meroleges(lon) { var a = (180 + lon - asc) * Math.PI / 180; return [-Math.sin(a), -Math.cos(a)]; }
    // a felirat körül háttérszínű szegély, hogy a vonalak fölött is olvasható maradjon
    var HALO = { stroke: bg, 'stroke-width': 3, 'stroke-linejoin': 'round', 'paint-order': 'stroke' };
    function halo(attrs) { for (var x in HALO) if (attrs[x] === undefined) attrs[x] = HALO[x]; return attrs; }
    /** fok + felső indexben a perc (a jegyen belül; a perc kerekítve, mint a Windows-os programban) */
    function fokPerc(lon, x, y, px, szin, szulo, cls) {
      var j = jegy(lon), fj = fokNorm(lon) - j * 30, fo = Math.trunc(fj), pc = Math.round((fj - fo) * 60);
      if (pc === 60) { pc = 0; fo++; }
      var t = szoveg('', halo({ x: f2(x), y: f2(y), 'font-size': f2(px), 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: szin, 'class': cls || null }), szulo);
      var t1 = el('tspan', {}, t); t1.textContent = String(fo);
      var t2 = el('tspan', { 'font-size': f2(px * 0.66), dy: f2(-px * 0.38) }, t); t2.textContent = pad2(pc);
      return t;
    }

    var r = 400, meret = Math.min(2, Math.max(0.5, +o.meret || 1)), fs = kulso ? 0.9 : 1;
    var R_ZB = kulso ? 0.86 * r : r;                        // a belső képlet határa (egy képletnél a zodiákuskör)
    var pxPl = 36 * meret * fs, pxFok = 18 * fs, pxUr = 13 * fs, pxJegy = kulso ? 27 : 32, pxHaz = 18 * fs;
    var pxFsz = 19 * fs, pxBetu = 12 * fs, pxCsillag = 15 * fs, pxCsucs = 17 * fs, pxJelolo = 9;
    var TICK_BE = kulso ? R_ZB - 1 : R_ZB - 11;            // a fokbeosztás belső vége
    var R_PL_TUSKE = TICK_BE - 16;                         // a planéta valódi helyének színes jele: TICK_BE … R_PL_TUSKE
    var R_PL = R_PL_TUSKE - 1 - pxPl * 0.5;                // planétajel
    var R_UR = R_PL - pxPl * 0.5 - pxUr * 0.6;             // házúr-számok
    var R_FOK = R_PL - pxPl * 0.5 - (o.houseLords ? pxUr * 1.2 : 0) - pxFok * 0.6;   // fokszám
    var R_FSZ = R_FOK - pxFok * 0.75 - 6;                  // a fényszögvonalak végpontja
    var R_HN = 0.29 * R_ZB, R_HUB = 0.155 * R_ZB;          // házszámgyűrű, középső kör
    var RV0 = kulso ? 1.34 * r : 1.22 * r;

    if (o.asztroszkop) o.asztroszkop.colors = o.colors;
    var AS = asztroTerv(o.asztroszkop, o.naksatra), G_AS = r * 0.01, R_AS0 = RV0 + G_AS;
    var RV = AS ? AS.gyuruk.reduce(function (s, g) { return s + g.szel * r + G_AS; }, R_AS0) + G_AS : RV0;
    var svg = el('svg', { viewBox: [-RV, -RV, 2 * RV, 2 * RV].join(' '), xmlns: NS, role: 'img', 'data-r-alap': RV0, 'data-stilus': 'placidus',
      'aria-label': 'Képletábra', 'font-family': TXT, style: 'width:100%;height:auto;display:block' });
    el('rect', { x: -RV, y: -RV, width: 2 * RV, height: 2 * RV, fill: bg }, svg);
    if (AS) asztroRajz(svg, AS, pont, r, R_AS0, G_AS);

    /* ---------- zodiákus: vastag kör(ök), fokbeosztás, jegyhatárok, a jegyek jele ---------- */
    var gZod = el('g', { stroke: KEK, fill: 'none' }, svg);
    el('circle', { r: r, 'stroke-width': 3 * VV }, gZod);
    if (kulso) el('circle', { r: R_ZB, 'stroke-width': 2.5 * VV }, gZod);
    function fokVonalak(alap, irany) {
      var t = '';
      for (var d = 0; d < 360; d++) {
        var h = d % 10 === 0 ? 10 : d % 5 === 0 ? 7.5 : 4.5;
        var t1 = pont(d, alap), t2 = pont(d, alap + irany * h);
        t += 'M' + f2(t1[0]) + ',' + f2(t1[1]) + 'L' + f2(t2[0]) + ',' + f2(t2[1]);
      }
      el('path', { d: t, 'stroke-width': 0.9 }, gZod);
    }
    fokVonalak(r, -1);
    if (kulso) fokVonalak(R_ZB, 1);
    // a jegyek jele közvetlenül a zodiákuskör mellett, rajtuk kívül (legkívül) az énjelölők
    var jegyLat = o.jegyek || ALAP.jegyek, R_JEGY = kulso ? (r + R_ZB) / 2 : r + 6 + pxJegy * 0.5;
    for (var j = 0; j < 12; j++) {
      if (kulso) vonal(j * 30, R_ZB, r, { 'stroke-width': 1.6 * VV }, gZod);
      else vonal(j * 30, r, r + pxJegy * 0.9, { 'stroke-width': 3.5 * VV }, gZod);
      var pjg = pont(j * 30 + 15, R_JEGY);
      if (jegyLat.indexOf(j) >= 0) {
        cim(szoveg(JEGY[j] + VS, halo({ x: f2(pjg[0]), y: f2(pjg[1]), 'font-size': pxJegy, 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: KEK, 'data-olv': 'jegy:' + j, 'class': 'jegyjel' }), gZod), JNEV[j]);
      }
      if (o.analog) {
        var pa = pont(j * 30 + 5, R_JEGY);
        cim(szoveg(PLJ[ANALOG[j]] + VS, { x: f2(pa[0]), y: f2(pa[1]), 'font-size': pxJegy * 0.55, 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: KEK, stroke: 'none', 'class': 'analog' }, gZod), JNEV[j] + ' analóg planétája: ' + PNEV[ANALOG[j]]);
      }
      if (jJel['J_' + j]) felkialtP(pjg[0] + pxJegy * 0.45, pjg[1] - pxJegy * 0.45, gZod);
    }
    function felkialtP(x, y, szulo) {
      return szoveg('!', { x: f2(x), y: f2(y), 'font-size': 22, 'font-weight': 'bold', 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: '#d00000', stroke: 'none', 'class': 'jegyzetjel', 'pointer-events': 'none' }, szulo);
    }

    /* ---------- házcsúcsok, tengelyek, középső kör, házszámok ---------- */
    var hazHatar = o.hazHatar || ALAP.hazHatar, hazSzam = o.hazSzam || ALAP.hazSzam, arab = o.arab !== false;
    var gHaz = el('g', { stroke: VKEK }, svg);
    var mc = typeof k.mc === 'number' ? k.mc : cs[10];
    var tengelyHaz = kos0 ? {} : { 1: asc, 7: fokNorm(asc + 180), 10: mc, 4: fokNorm(mc + 180) };
    for (var hz = 1; hz <= 12; hz++) {
      if (hazHatar.indexOf(hz) < 0) continue;
      // a sarokház csúcsa a tengely; egyenlő házaknál a 4./10. csúcs eltérhet az MC-től – az vékony vonal is
      if (tengelyHaz[hz] !== undefined && Math.abs(fokNorm(cs[hz] - tengelyHaz[hz] + 180) - 180) < 0.01) continue;
      vonal(cs[hz], R_HUB, R_ZB, { 'stroke-width': 0.9 * VV, 'class': 'hazcsucs', 'data-haz': hz }, gHaz);
    }
    el('circle', { r: R_HN, fill: 'none', 'stroke-width': 0.9 * VV }, gHaz);
    var gTeng = el('g', { stroke: FEK, fill: FEK }, svg);
    if (!kos0) {
      // ASC és MC nyíllal, a DSC és az IC vége nélküle; egy képletnél a zodiákuskörön túlnyúlva
      var vegT = kulso ? R_ZB - 2 : 1.165 * r, vegS = kulso ? R_ZB - 2 : 1.10 * r, NYIL = 22 * fs, NY_SZ = 8 * fs;
      [[1, asc, true], [7, fokNorm(asc + 180), false], [10, mc, true], [4, fokNorm(mc + 180), false]].forEach(function (t) {
        var nyil = t[2], ve = nyil ? vegT - NYIL + 2 : vegS;
        vonal(t[1], R_HUB, ve, { 'stroke-width': 4.5 * VV, 'class': 'hazcsucs tengely', 'data-haz': t[0], 'stroke-linecap': nyil ? 'butt' : 'square' }, gTeng);
        if (!nyil) return;
        var cs1 = pont(t[1], vegT), b0 = pont(t[1], vegT - NYIL), n = meroleges(t[1]);
        el('path', { d: 'M' + f2(cs1[0]) + ',' + f2(cs1[1]) + 'L' + f2(b0[0] + n[0] * NY_SZ) + ',' + f2(b0[1] + n[1] * NY_SZ) +
          'L' + f2(b0[0] - n[0] * NY_SZ) + ',' + f2(b0[1] - n[1] * NY_SZ) + 'Z', stroke: 'none', 'class': 'tengely-nyil' }, gTeng);
      });
    }
    el('circle', { r: R_HUB, fill: bg, stroke: FEK, 'stroke-width': 5 * VV }, gTeng);
    var gHsz = el('g', {}, svg);
    for (var hs = 1; hs <= 12; hs++) {
      if (hazSzam.indexOf(hs) < 0) continue;
      var kezd = cs[hs], veg = cs[hs % 12 + 1];
      if (veg < kezd) veg += 360;
      var hp = pont(kezd + (veg - kezd) / 2, (R_HUB + R_HN) / 2 + 2);
      // a sarokházak az „arab számokkal” beállítás szerint (ki: I, IV, VII, X)
      szoveg(hazSzamStr(hs, arab), { x: f2(hp[0]), y: f2(hp[1]), 'font-size': f2(pxHaz * (hs % 3 === 1 ? 0.92 : 1)), 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: KEK, 'data-olv': 'haz:' + hs, 'class': 'hazszam' }, gHsz);
      if (jJel['H_' + hs]) felkialtP(hp[0] + pxHaz * 0.8, hp[1] - pxHaz * 0.5, gHsz);
    }
    // házcsúcs-feliratok: a csúcs mentén, mellette (a növekvő hosszúság felé), fok + perc
    if (o.cuspLabels) {
      var gCim = el('g', {}, svg), R_CSUCS = (R_HN + R_FSZ) / 2 + 8;
      for (var hc = 1; hc <= 12; hc++) {
        if (hazHatar.indexOf(hc) < 0) continue;
        var lc = tengelyHaz[hc] !== undefined && (hc === 1 || hc === 10) ? tengelyHaz[hc] : cs[hc];
        var pc0 = pont(lc, R_CSUCS), nv = meroleges(lc), w = pxCsucs * 2.1, h = pxCsucs * 1.05;
        var off = 4 + 0.5 * (Math.abs(w * nv[0]) + Math.abs(h * nv[1]));
        fokPerc(lc, pc0[0] + nv[0] * off, pc0[1] + nv[1] * off, pxCsucs, FEK, gCim, 'csucsfok');
      }
    }

    /* ---------- planéták elhelyezése ---------- */
    var lathato = k.planets.filter(function (p) {
      return o.planets.indexOf(p.id) >= 0 && (PLANETA[p.id] !== undefined || p.id === PHOLUS || csillag(p.id) || !!szovegJel(p.id));
    });
    if (o.szemely) lathato = szemelyisegrajz(k, o);
    var csDb = lathato.filter(function (p) { return csillag(p.id); }).length;
    if (csDb > 21 && !o.csillagMind) {
      var csN = 0;
      lathato = lathato.filter(function (p) {
        if (!csillag(p.id)) return true;
        if (p.hasAspects) csN++;
        return csN <= 21 && !!p.hasAspects;
      });
    }
    var urSzoveg = function (p) {
      if (!o.houseLords || !p.lordOf) return '';
      var s = p.lordOf.join(',');
      if (p.closedLordOf && p.closedLordOf.length) s += (s ? ' ' : '') + '(' + p.closedLordOf.join(',') + ')';
      return s;
    };
    var FOK = 180 / Math.PI, wFok = (2 * 0.56 * pxFok + 2 * 0.56 * pxFok * 0.66) / R_FOK * FOK;
    var elemek = lathato.map(function (p) {
      var ur = urSzoveg(p), e = { p: p, orig: p.lon, uj: p.lon, ur: ur };
      if (csillag(p.id) || szovegJel(p.id)) {
        e.szoveg = csillag(p.id) ? (allo() ? allo().rovid(p.id) : '') : szovegJel(p.id);
        e.csillag = csillag(p.id);
        e.w = Math.max(pxCsillag * 1.25 / R_PL * FOK, wFok);
        return e;
      }
      e.w = Math.max(pxPl * 1.08 / R_PL * FOK, wFok, ur ? ur.length * 0.56 * pxUr / R_UR * FOK : 0);
      return e;
    });
    // planétaperspektívánál az eredeti AC és MC jele (nem mozdul), és a további tengelypontok (Vertex …)
    (k.tengelyJelek || []).forEach(function (t) {
      if (typeof t[1] === 'number') elemek.push({ tengely: t[0], nev: t[2], orig: t[1], uj: t[1], w: Math.max(pxPl * 1.2 / R_PL * FOK, wFok), fix: true });
    });
    var tovabbi = [];
    if (o.mcIc && !k.tengelyJelek && typeof k.mc === 'number') tovabbi.push(['IC', fokNorm(k.mc + 180), 'Imum Coeli'], ['MC', k.mc, 'Medium Coeli']);
    (o.tengelyek || []).forEach(function (t) {
      var lon = k.tengelyPontok && k.tengelyPontok[t];
      if (TPONT[t] && typeof lon === 'number') tovabbi.push([TPONT[t][0], lon, TPONT[t][1]]);
    });
    tovabbi.forEach(function (t) {
      elemek.push({ tengely: t[0], nev: t[2], orig: t[1], uj: t[1], w: Math.max(t[0].length * 0.62 * pxPl * 0.55 / R_PL * FOK, wFok), pont: true });
    });
    korSzettol(elemek, 400);

    /* ---------- fényszögek ---------- */
    var gFsz = el('g', { 'stroke-width': 1.3 }, svg);
    var hely = {};
    elemek.forEach(function (e) { if (!e.tengely) hely[e.p.id] = e; });
    var fszHaz = o.aspectHouses || [];
    (k.aspects || []).forEach(function (a) {
      if (a.a[0] !== 'P') return;
      var id1 = a.a[1], l2, nev2;
      if (!hely[id1] || o.aspectTypes.indexOf(a.aspect) < 0) return;
      if (a.b[0] === 'P') {
        var id2 = a.b[1];
        if (!hely[id2]) return;
        if (o.aspectPlanets.indexOf(id1) < 0 && o.aspectPlanets.indexOf(id2) < 0) return;
        l2 = hely[id2].orig; nev2 = nevE(id2);
      } else if (a.b[0] === 'A') {
        var th = a.b[1] === 0 ? 1 : a.b[1] === 1 ? 10 : 0;
        if (!th || fszHaz.indexOf(th) < 0) return;
        l2 = th === 1 ? k.asc : k.mc; nev2 = th === 1 ? 'Ascendens' : 'Medium Coeli';
      } else if (a.b[0] === 'H') {
        if (fszHaz.indexOf(a.b[1]) < 0) return;
        l2 = cs[a.b[1]]; nev2 = a.b[1] + '. házcsúcs';
      } else return;
      if (typeof l2 !== 'number') return;
      var v2 = a.b[0] === 'P' ? 'P' + a.b[1] : a.b[0] + a.b[1];
      var p = pont(hely[id1].orig, R_FSZ), q = pont(l2, R_FSZ), szin = fSzin(a.aspect), da = PF_VONAL[a.aspect] || null;
      var vonalE = el('line', { x1: f2(p[0]), y1: f2(p[1]), x2: f2(q[0]), y2: f2(q[1]), stroke: szin, 'stroke-dasharray': da,
        'stroke-linecap': da === '2 3' ? 'round' : null, 'class': 'fszvonal', 'data-fsz': a.aspect, 'data-v1': 'P' + id1, 'data-v2': v2 }, gFsz);
      var leiras = nevE(id1) + ' – ' + nev2 + ': ' + FSZNEV[a.aspect] + ' (' + fokStr(a.orb).replace(/\d+"$/, '') + ')';
      cim(vonalE, leiras);
      if (o.aspectSymbols.indexOf(a.aspect) >= 0) {
        cim(szoveg(FSZ[a.aspect] + VS, halo({ x: f2((p[0] + q[0]) / 2), y: f2((p[1] + q[1]) / 2), 'font-size': pxFsz, 'font-family': SYM,
          'class': 'fszjel', 'data-v1': 'P' + id1, 'data-v2': v2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: szin, 'stroke-width': 2.5 }), gFsz), leiras);
      }
    });

    /* ---------- planéták: színes jel a valódi helyen, a jel, házurak, fokszám, F/i/R ---------- */
    var gPl = el('g', {}, svg);
    function osszekoto(e, szin, g, r1, r2) {
      if (Math.abs(fokNorm(e.uj - e.orig + 180) - 180) < 0.3) return;
      var a = pont(e.orig, r1), b = pont(e.uj, r2);
      el('line', { x1: f2(a[0]), y1: f2(a[1]), x2: f2(b[0]), y2: f2(b[1]), stroke: szin, 'stroke-width': 0.8 }, g);
    }
    function talalat(x, y, w, h, g) {   // átlátszó doboz, hogy a jel egésze kattintható legyen
      el('rect', { x: f2(x - w / 2), y: f2(y - h / 2), width: f2(w), height: f2(h), fill: bg, 'fill-opacity': 0 }, g);
    }
    elemek.forEach(function (e) {
      var q = pont(e.uj, R_PL), qf = pont(e.uj, R_FOK);
      if (e.tengely) {
        var megj = e.tengely === 'AC' ? 'P_-1' : e.tengely === 'MC' && !e.pont ? 'P_-2' : null, jt = jegy(e.orig);
        var gt = el('g', { 'class': e.pont ? 'tengelypont' : 'tengelyjel', 'data-tengely': e.tengely, 'data-megj': megj }, gPl);
        cim(gt, e.nev + ': ' + JNEV[jt] + ' ' + fokStr(fokNorm(e.orig) - jt * 30));
        vonal(e.orig, TICK_BE, R_PL_TUSKE, { stroke: FEK, 'stroke-width': 2.2 }, gt);
        osszekoto(e, FEK, gt, R_PL_TUSKE, R_PL + pxPl * 0.45);
        talalat(q[0], q[1], pxPl * 1.2, pxPl, gt);
        szoveg(e.tengely, halo({ x: f2(q[0]), y: f2(q[1]), 'font-size': f2(pxPl * 0.55), 'font-weight': 'bold', 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: FEK }), gt);
        fokPerc(e.orig, qf[0], qf[1], pxFok, FEK, gt, 'plfok');
        if (megj && jJel[megj]) felkialtP(q[0] + pxPl * 0.6, q[1] - pxPl * 0.4, gt);
        return;
      }
      var p = e.p, j = jegy(p.lon), fj = fokNorm(p.lon) - j * 30, szin = e.csillag ? FEK : plSzin(p.id);
      var g = el('g', e.csillag ? { 'class': 'csillag', 'data-id': p.id } : e.szoveg ? { 'class': 'planeta kisb', 'data-id': p.id }
        : { 'class': 'planeta', 'data-id': p.id, 'data-olv': 'pl:' + p.id }, gPl);
      cim(g, nevE(p.id) + ': ' + JNEV[j] + ' ' + fokStr(fj) + (p.house ? ', ' + p.house + '. ház' : '') +
        (p.speed < 0 ? ', retrográd' : '') + (p.feral ? ', ferális' : '') + (p.isolated ? ', izolált' : ''));
      vonal(p.lon, TICK_BE, R_PL_TUSKE, { stroke: szin, 'stroke-width': 2.2 }, g);
      if (e.szoveg) {
        // a csillag (kisbolygó) neve sugárirányban, kívülről befelé olvasva
        var kp = pont(e.uj, R_PL_TUSKE - 2), sz = -(180 + e.uj - asc), jobb = Math.cos((180 + e.uj - asc) * Math.PI / 180) >= 0;
        osszekoto(e, szin, g, R_PL_TUSKE, R_PL_TUSKE - 2);
        szoveg(e.szoveg, halo({ x: f2(kp[0]), y: f2(kp[1]), 'font-size': pxCsillag, 'text-anchor': jobb ? 'end' : 'start', 'dominant-baseline': 'central',
          fill: szin, transform: 'rotate(' + f2(jobb ? sz : sz + 180) + ' ' + f2(kp[0]) + ' ' + f2(kp[1]) + ')' }), g);
        var kf = pont(e.uj, R_FSZ + pxFok * 0.7);
        fokPerc(p.lon, kf[0], kf[1], pxFok * 0.8, FEK, g, 'plfok');
        return;
      }
      osszekoto(e, szin, g, R_PL_TUSKE, R_PL + pxPl * 0.45);
      talalat(q[0], q[1], pxPl * 1.05, pxPl * 1.05, g);
      if (p.id === PHOLUS) pholusJel(q[0], q[1], pxPl, g);
      else szoveg(PLJ[p.id] + VS, halo({ x: f2(q[0]), y: f2(q[1]), 'font-size': f2(pxPl), 'font-family': SYM, 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: szin }), g);
      if (jJel['P_' + p.id]) felkialtP(q[0] + pxPl * 0.62, q[1] - pxPl * 0.3, g);
      if (e.ur) {
        var qu = pont(e.uj, R_UR);
        var tu = el('text', halo({ x: f2(qu[0]), y: f2(qu[1]), 'font-size': f2(pxUr), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: FEK }), g);
        var darab = function (t, kulcs) { var ts = el('tspan', kulcs ? { 'data-olv': kulcs } : {}, tu); ts.textContent = t; };
        (p.lordOf || []).forEach(function (n, i) { if (i) darab(','); darab(String(n), 'ur:' + p.id + ':' + n); });
        if (p.closedLordOf && p.closedLordOf.length) {
          darab(((p.lordOf || []).length ? ' ' : '') + '(');
          p.closedLordOf.forEach(function (n, i) { if (i) darab(','); darab(String(n), 'ur:' + p.id + ':(' + n + ')'); });
          darab(')');
        }
      }
      fokPerc(p.lon, qf[0], qf[1], pxFok, FEK, g, 'plfok');
      var jel = [];
      if (o.retrograde && p.speed < 0) jel.push('R');
      if (o.stationary && p.stationary) jel = ['S'];
      if (o.feral && p.feral) jel.push('F');
      if (o.feral && p.isolated) jel.push('i');
      if (jel.length) {
        // a jel mellett, a növekvő hosszúság felőli oldalon
        var nb = meroleges(e.uj);
        szoveg(jel.join(','), halo({ x: f2(q[0] - nb[0] * pxPl * 0.62), y: f2(q[1] - nb[1] * pxPl * 0.62 - pxPl * 0.3), 'font-size': pxBetu,
          'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: FEK, 'class': 'plbetu' }), g);
      }
    });

    /* ---------- énjelölők: a zodiákuskörön kívül, a planéta felé mutató háromszög (vagy kör) ---------- */
    if (o.selfMarkers && k.selfMarkers && !kulso) {
      var gEn = el('g', { stroke: FEK, 'stroke-width': 1 }, svg), poz = {};
      k.planets.forEach(function (p) { poz[p.id] = p; });
      k.selfMarkers.forEach(function (m, enIndex) {
        var ra, sz, rr = R_JEGY + pxJegy * 0.5 + 6 + pxJelolo, nev;
        if (m.type === 'P') {
          if (!hely[m.id]) return;
          ra = o.selfMarkerAtOrigPlace ? poz[m.id].lon : hely[m.id].uj; sz = jegy(poz[m.id].lon); nev = PNEV[m.id];
        } else if (m.type === 'H') {
          ra = m.lon; sz = jegy(m.lon); rr += 18;
          // az ASC jelölője kicsit odébb, hogy a tengely nyila ne takarja
          if (+m.house !== 1) { ra += 10; nev = hazSzamStr(+m.house, arab) + '. ház'; } else { ra += 3.5; nev = 'Ascendens'; }
        } else { ra = m.lon; sz = m.sign; nev = JNEV[m.sign] + ' (az 1. házba bezárt jegy)'; rr += 18; }
        var c = pont(ra, rr), u = pont(ra, 1), ux = -u[0], uy = -u[1], s = pxJelolo;
        var szinE = ff ? '#fff' : elemSzin(sz, o.colors);
        if (o.enKor) {
          cim(el('circle', { cx: f2(c[0]), cy: f2(c[1]), r: f2(s * 0.8), fill: szinE, 'data-olv': 'en:' + enIndex, 'class': 'enkor' }, gEn), 'Énjelölő: ' + nev);
          return;
        }
        var csu = [c[0] + ux * s, c[1] + uy * s], b1 = [c[0] - ux * s * 0.8 - uy * s * 0.9, c[1] - uy * s * 0.8 + ux * s * 0.9],
          b2 = [c[0] - ux * s * 0.8 + uy * s * 0.9, c[1] - uy * s * 0.8 - ux * s * 0.9];
        cim(el('path', { d: 'M' + csu.map(f2) + 'L' + b1.map(f2) + 'L' + b2.map(f2) + 'Z', fill: szinE, 'data-olv': 'en:' + enIndex }, gEn), 'Énjelölő: ' + nev);
      });
    }

    /* ---------- külső kör (összevetés, egymáson): a zodiákus sávon kívül ---------- */
    if (kulso) {
      var gK = el('g', { 'class': 'kulso' }, svg);
      var K_TUSKE = r + 14, K_FOK = K_TUSKE + 3 + pxFok * 0.7, K_PL = K_FOK + pxFok * 0.6 + pxPl * 0.55 + 2, K_UR = K_PL + pxPl * 0.5 + pxUr * 0.7;
      var K_TENG = 1.255 * r, K_TCIM = 1.295 * r;
      var kc = kulso.cusps || [], kmc = kulso.egyenlo && typeof kulso.mc === 'number' ? kulso.mc : kc[10];
      var csucsLista = kulso.csucsok === 'mind' ? [2, 3, 5, 6, 8, 9, 11, 12] : [];
      csucsLista.forEach(function (hz) {
        if (typeof kc[hz] === 'number') vonal(kc[hz], r, r + 12, { stroke: VKEK, 'stroke-width': 1.2 * VV }, gK);
      });
      if (kulso.csucsok === 'mind' || kulso.csucsok === 'tengely') {
        var kasc = typeof kulso.asc === 'number' ? kulso.asc : kc[1];
        [kasc, fokNorm(kasc + 180), kmc, fokNorm(kmc + 180)].forEach(function (l) {
          if (typeof l === 'number' && !isNaN(l)) vonal(l, r, K_TENG, { stroke: FEK, 'stroke-width': 3.5 * VV }, gK);
        });
      }
      var kElemek = (kulso.planets || []).filter(function (p) {
        return o.planets.indexOf(p.id) >= 0 && (PLANETA[p.id] !== undefined || p.id === PHOLUS) && (!kulso.csakHold || p.id === 1);
      }).map(function (p) {
        var ur = o.houseLords && p.lordOf ? urSzoveg(p) : '';
        return { p: p, orig: p.lon, uj: p.lon, ur: ur, w: Math.max(pxPl * 1.08 / K_PL * FOK, wFok * R_FOK / K_FOK, ur ? ur.length * 0.56 * pxUr / K_UR * FOK : 0) };
      });
      korSzettol(kElemek, 400);
      kElemek.forEach(function (e) {
        var p = e.p, jk = jegy(e.orig), fjk = fokNorm(e.orig) - jk * 30, szin = plSzin(p.id), q = pont(e.uj, K_PL), qf = pont(e.uj, K_FOK);
        var g = el('g', { 'class': 'planeta kulso', 'data-id': p.id, 'data-olv': 'kpl:' + p.id }, gK);
        cim(g, 'Külső kör – ' + nevE(p.id) + ': ' + JNEV[jk] + ' ' + fokStr(fjk) + (p.house ? ', ' + p.house + '. ház (saját képletében)' : '') +
          (p.speed < 0 ? ', retrográd' : '') + (p.feral ? ', ferális' : '') + (p.isolated ? ', izolált' : '') + (kulso.cimKieg && kulso.cimKieg[p.id] ? '\n' + kulso.cimKieg[p.id] : ''));
        vonal(p.lon, r + 1, K_TUSKE, { stroke: szin, 'stroke-width': 2.2 }, g);
        osszekoto(e, szin, g, K_TUSKE, K_FOK - pxFok * 0.55);
        talalat(q[0], q[1], pxPl * 1.05, pxPl * 1.05, g);
        if (p.id === PHOLUS) pholusJel(q[0], q[1], pxPl, g);
        else szoveg(PLJ[p.id] + VS, halo({ x: f2(q[0]), y: f2(q[1]), 'font-size': f2(pxPl), 'font-family': SYM, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: szin }), g);
        fokPerc(p.lon, qf[0], qf[1], pxFok, FEK, g, 'plfok');
        if (e.ur) {
          var qu = pont(e.uj, K_UR);
          szoveg(e.ur, halo({ x: f2(qu[0]), y: f2(qu[1]), 'font-size': f2(pxUr), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: FEK }), g);
        }
        if (kulso.betuk) {
          var jl = [];
          if (o.retrograde && p.speed < 0) jl.push('R');
          if (o.stationary && p.stationary) jl = ['S'];
          if (o.feral && p.feral) jl.push('F');
          if (o.feral && p.isolated) jl.push('i');
          if (jl.length) {
            var nb = meroleges(e.uj);
            szoveg(jl.join(','), halo({ x: f2(q[0] - nb[0] * pxPl * 0.62), y: f2(q[1] - nb[1] * pxPl * 0.62 - pxPl * 0.3), 'font-size': pxBetu,
              'font-weight': 'bold', 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: FEK }), g);
          }
        }
      });
      // a külső kör ASC és MC fokszáma a tengelyvonal végénél
      if (kulso.tengelyJel) {
        [['AC', kulso.asc, 'Ascendens'], ['MC', kulso.mc, 'Medium Coeli']].forEach(function (t) {
          if (typeof t[1] !== 'number') return;
          var jk = jegy(t[1]), g = el('g', { 'class': 'kulso-tengely', 'data-id': t[0] }, gK), qt = pont(t[1], K_TCIM);
          cim(g, 'Külső kör – ' + t[2] + ': ' + JNEV[jk] + ' ' + fokStr(fokNorm(t[1]) - jk * 30));
          var tx = szoveg('', halo({ x: f2(qt[0]), y: f2(qt[1]), 'font-size': f2(pxFok * 0.95), 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: FEK }), g);
          var b1 = el('tspan', { 'font-weight': 'bold', 'font-size': f2(pxFok * 0.7) }, tx); b1.textContent = t[0] + ' ';
          var fj = fokNorm(t[1]) - jk * 30, fo = Math.trunc(fj), pc = Math.round((fj - fo) * 60); if (pc === 60) { pc = 0; fo++; }
          var b2 = el('tspan', {}, tx); b2.textContent = String(fo);
          var b3 = el('tspan', { 'font-size': f2(pxFok * 0.62), dy: f2(-pxFok * 0.36) }, tx); b3.textContent = pad2(pc);
        });
      }
    }

    hova.innerHTML = '';
    hova.appendChild(svg);
    return svg;
  }

  /**
   * Kiemelés (fókusz): a kiválasztott planéta, a vele fényszögben álló elemek és a fényszögvonalak erősek, a többi elhalványul.
   * svg: egy rajzolt kerék, id: planéta-azonosító (null: kikapcsol). Visszaad: true, ha a planéta a keréken van.
   */
  function fokusz(svg, id) {
    if (!svg) return false;
    Array.prototype.forEach.call(svg.querySelectorAll('.fk-be, .fk-fo'), function (x) { x.classList.remove('fk-be', 'fk-fo'); });
    var fo = id === null || id === undefined ? null : svg.querySelector('g.planeta:not(.kulso)[data-id="' + id + '"], g.csillag[data-id="' + id + '"]');
    svg.classList.toggle('fokusz', !!fo);
    if (!fo) return false;
    fo.classList.add('fk-fo');
    var cel = 'P' + id;
    Array.prototype.forEach.call(svg.querySelectorAll('.fszvonal, .fszjel'), function (x) {
      var v1 = x.getAttribute('data-v1'), v2 = x.getAttribute('data-v2'), masik = v1 === cel ? v2 : v2 === cel ? v1 : null;
      if (!masik) return;
      x.classList.add('fk-be');
      if (masik.charAt(0) === 'P') {
        var g = svg.querySelector('g.planeta:not(.kulso)[data-id="' + masik.slice(1) + '"], g.csillag[data-id="' + masik.slice(1) + '"]');
        if (g) g.classList.add('fk-be');
      } else {
        var h = masik === 'A0' ? 1 : masik === 'A1' ? 10 : +masik.slice(1);
        Array.prototype.forEach.call(svg.querySelectorAll('line.hazcsucs[data-haz="' + h + '"]'), function (l) { l.classList.add('fk-be'); });
      }
    });
    return true;
  }

  /** Összevetés egymáson: a belső képlet a megszokott módon, a külső kör a zodiákus-sávon kívül */
  function rajzolDupla(hova, belso, kulso, beall) { return rajzol(hova, belso, beall, kulso); }

  global.RegioKerek = { STILUSOK: [['regio', 'Regiomontanus'], ['placidus', 'Placidus']], rajzol: rajzol, rajzolDupla: rajzolDupla, fokusz: fokusz, ALAP: ALAP };
})(typeof window !== 'undefined' ? window : globalThis);
