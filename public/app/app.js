/*
 * Regiomontanus – webes alkalmazás (1. fázis: alkalmazás-keret).
 * Menüsor, eszköztár, mozaikos munkaasztal, részletes nézet, képletléptető, fájlkezelés.
 * Licenc: AGPL-3.0.
 */
(function () {
  'use strict';
  var R = Regio, K = R.Keplet, T = R.Tablak, S = R.Tarolo;
  var $ = function (id) { return document.getElementById(id); };

  var se = null, beall = S.beallitasok();
  /* a Windows-os cURANUSLETTERS / cPLUTOLETTERS megfelelői (RegiomontanusWIN 'k' '!' és ';' '¦' '_') */
  var URANUSZ_JEL = ['♅', '⛢'], PLUTO_JEL = ['⯓', '⯖', '♇'];
  function jelek() { return { 7: URANUSZ_JEL[beall.szin.uranusz] || '♅', 9: PLUTO_JEL[beall.szin.pluto] || '⯓' }; }
  /** a táblák és a nyomtatás is a beállított jelet használja */
  function szimbolumAlkalmaz() { var j = jelek(); R.PLANETA[7][1] = j[7]; R.PLANETA[9][1] = j[9]; }
  szimbolumAlkalmaz();
  /*
   * Ideiglenesen kikapcsolt funkciók – amíg nincs adatbázis a háttérben (Nemes Balázs döntése, 2026-10-22):
   * jegyzetek (szerkesztő, „!” jelek, .mgj) és csatolás (fénykép, dokumentum, URL/e-mail – az oldalsáv).
   * A .szk-ban meglévő adatok (Megjegyzes, PictureData, CsatDocNN) beolvasáskor megmaradnak és mentéskor változatlanul visszaíródnak.
   * Visszakapcsolás: Regio.FUNKCIO.jegyzet / .csatolmany = true (a tesztek is így használják).
   */
  R.FUNKCIO = R.FUNKCIO || { jegyzet: false, csatolmany: false };
  function fk(n) { return !!R.FUNKCIO[n]; }
  function oldalsavVan(k) { return fk('csatolmany') && !k.fajta && beall.oldalsav !== false; }
  var kepletek = [], aktiv = -1, nezet = 'mozaik', ful = 'planetak', lepNyitva = false, kovId = 1;
  var tesztek = [], betoltve = false;
  var MEZOK = ['Év', 'Hó', 'Nap', 'Óra', 'Perc'];
  var FULEK = [['planetak', 'Planéták', 'Ctrl+B'], ['hazak', 'Házak', 'Ctrl+H'], ['fenyszogek', 'Fényszögek', 'Ctrl+F'],
    ['eletstrat', 'Életstratégia', 'Ctrl+J'], ['enallapotok', 'Énállapotok', 'Ctrl+E'], ['egyeb', 'Egyéb', '']];
  var FAZIS = { 2: '2. fázis', 3: '3. fázis', 4: '4. fázis', 5: 'később' };

  /** a táblafülek – az „Állócsillagok” csak bekapcsolt megjelenítésnél */
  function fulek() { return beall.allo && beall.allo.megj ? FULEK.concat([['allo', 'Állócsillagok', '']]) : FULEK; }
  function akt() { return kepletek[aktiv] || null; }
  function vanAkt() { return !!akt(); }

  /* ====================================================================== */
  /* Képletek kezelése                                                       */
  /* ====================================================================== */
  function ujKepletObj(adat, fajl) {
    return { id: kovId++, eredeti: K.masol(adat), adat: K.masol(adat), eltolas: [0, 0, 0, 0, 0], e: null, hiba: null,
      sorszam: 0, fajlnev: fajl ? fajl.nev : '', handle: fajl ? fajl.handle || null : null, valtozott: !fajl, mini: '', idozito: null,
      fajta: null, kulso: null, mod: beall.osszevetesMod || 'egymason', kereszt: null, phHold: null };
  }
  /*
   * Összevetés-csempe (a Windows-os „<-> belső - külső” fül): k.adat/k.e a belső (radix) képlet,
   * k.kulso a külső kör: { eredeti, adat, e, hiba, sorszam, eltolas[5], ph: {napok, orak}, pd: fok, sol: {ev, hely}, rev: {pl} }.
   * fajta: 'tranzit' | 'ph' | 'pd' | 'sol' | 'rev' | 'szin'
   */
  function osszevetesHozzaad(belso, fajta, kulsoAdat, extra) {
    var k = ujKepletObj(belso, null);
    k.valtozott = false; k.fajta = fajta;
    k.kulso = { eredeti: kulsoAdat ? K.masol(kulsoAdat) : null, adat: kulsoAdat ? K.masol(kulsoAdat) : null, e: null, hiba: null,
      sorszam: 0, eltolas: [0, 0, 0, 0, 0], idozito: null };
    var x; for (x in (extra || {})) { if (x === 'mod') k.mod = extra[x]; else k.kulso[x] = extra[x]; }
    k.kulso.alap = JSON.parse(JSON.stringify({ ph: k.kulso.ph, pd: k.kulso.pd, sol: k.kulso.sol, pdv: k.kulso.pdv }));
    kepletek.push(k); aktiv = kepletek.length - 1;
    szamol(k); render();
    return k;
  }
  /** A szerver felé minden hívással: orbisok (egyszerű / részletes) és az aszteroidák kapcsolója */
  K.apiBeall = function () {
    var o = beall.orb, d = o.mod === 'reszletes', orbs = {}, k, i;
    for (k = 1; k <= 12; k++) {
      if (d) orbs[k] = o.D[k].slice(0, 14);
      else { orbs[k] = []; for (i = 0; i < 14; i++) orbs[k].push(o.S[k]); }
    }
    return { orbMode: d ? 'detailed' : 'simple', orbs: orbs, showAsteroids: !!beall.kerek.asteroids };
  };
  /** alap: a képlet saját (belső) számítása – csak ehhez kellenek az állócsillagok (a Windows-osban is a radixon látszanak) */
  function szamolOpt(alap) {
    var b = beall.kerek, cs = beall.csomo, pl = b.fszPl.concat(b.fszKisb);
    if (b.fszCsomo.indexOf('fel') >= 0) pl.push(cs);
    if (b.fszCsomo.indexOf('le') >= 0) pl.push(cs === 11 ? 25 : 24);
    // a fényszögelt elemek a szerveroldali csillag-szűréshez (>21 csillagnál csak a fényszöggel rendelkezők látszanak)
    var fsz = { tipus: b.fszTipus, pl: pl, haz: b.fszHaz,
      tengely: [b.fszHaz.indexOf(1) >= 0 ? 0 : -1, b.fszHaz.indexOf(10) >= 0 ? 1 : -1].filter(function (x) { return x >= 0; }) };
    return { hsys: beall.hsys, sid: beall.sid, allo: alap ? beall.allo : null, kisb: { be: !!beall.kerek.asteroids, ids: beall.kisb }, fsz: fsz };
  }
  function sweFlag() { return SwissEph.SE.FLG_SWIEPH | SwissEph.SE.FLG_SPEED | (beall.sid ? SwissEph.SE.FLG_SIDEREAL : 0); }
  /** A külső kör számítása (a belső kész eredményéből a primer direkció) + kereszt-fényszögek */
  function kulsoSzamol(k) {
    var ks = k.kulso, sz = ++ks.sorszam;
    function kesz(e) {
      if (sz !== ks.sorszam) return;
      ks.e = e; ks.hiba = null; ks.olv = null;
      k.phHold = k.fajta === 'ph' ? R.Idotech.progrHold(se, k.adat, ks.adat, sweFlag()) : null;
      k.kereszt = null;
      K.osszevet(k.e, e).then(function (x) { if (sz === ks.sorszam) { k.kereszt = x; render(); } },
        function (h) { if (sz === ks.sorszam) { k.kereszt = { hiba: h.message }; render(); } });
      k.mini = miniSvg(k);
      // „Csak az összevetés képlet megjelenítése” kikapcsolva: a Windows-oshoz hasonlóan a külső kör önálló képletként is
      // megnyílik (egyszer, a háttérben; a primer direkció elforgatott képlet, az nem)
      if (!beall.kerek.csakOssz && !ks.kulonNyitva && k.fajta !== 'pd' && k.fajta !== 'pdv' && k.fajta !== 'szin' && ks.adat) {
        ks.kulonNyitva = true;
        var ka = K.masol(ks.adat); ka.nev = kulsoNev(k); ka.tipus = 'radix';
        hozzaad(ka, null, true).valtozott = false;
      }
      render();
    }
    if (!k.e) return;
    if (k.fajta === 'pd') { kesz(R.Idotech.primer(k.e, ks.pd)); return; }
    if (k.fajta === 'pdv') { K.elemez(pdvKeplet(k)).then(kesz); return; }
    if (k.fajta === 'ph') ks.adat = R.Idotech.progr(se, k.adat, ks.ph.napok, ks.ph.orak);
    if (k.fajta === 'sol' && ks.sol) {
      var napHossz = k.e.poz[0].lon;
      se.ensureEphe([ks.sol.ev, ks.sol.ev + 1]).then(function () {
        var jd = R.Idotech.szolar(se, k.adat, napHossz, ks.sol.ev, sweFlag());
        if (jd === null) { ks.hiba = 'Nincs szolár-időpont.'; render(); return; }
        ks.adat = R.Idotech.adatJd(se, jd, ks.sol.hely, k.adat);
        ks.adat.nev = kulsoNev(k);
        K.szamol(se, ks.adat, szamolOpt()).then(kesz, function (h) { if (sz === ks.sorszam) { ks.hiba = h.message; render(); } });
      });
      return;
    }
    K.szamol(se, ks.adat, szamolOpt()).then(kesz, function (h) { if (sz === ks.sorszam) { ks.hiba = h.message; render(); } });
  }
  function hozzaad(adat, fajl, nemAktival) {
    var k = ujKepletObj(adat, fajl);
    kepletek.push(k);
    if (!nemAktival) aktiv = kepletek.length - 1;
    if (fajl) S.legutobbiHozzaad(adat, fajl.nev);
    szamol(k);
    render();
    return k;
  }
  function szamol(k) {
    if (!se) return;
    var sz = ++k.sorszam;
    // rögzített képlet (pl. a direktált képlet önállóan): a radix időpontjának adatai, de a tárolt pozíciókkal és házakkal elemezve
    var p = K.szamol(se, k.adat, szamolOpt(true));
    if (k.rogzitett) p = p.then(function (e) {
      var r = JSON.parse(JSON.stringify(k.rogzitett));
      e.poz = r.poz; e.hz = r.hz; e.elemzes = null; e.rogzitett = true;
      return K.elemez(e);
    });
    p.then(function (e) {
      if (sz !== k.sorszam) return;
      k.e = e; k.hiba = null; k.mini = miniSvg(k); k.olv = null;
      if (k.fajta) kulsoSzamol(k);
      render();
    }, function (h) {
      if (sz !== k.sorszam) return;
      k.e = null; k.hiba = h.message; k.mini = '';
      render();
    });
  }
  function utemezSzamol(k, csakKulso) {
    var o = csakKulso ? k.kulso : k;
    clearTimeout(o.idozito);
    o.idozito = setTimeout(function () { if (csakKulso) kulsoSzamol(k); else szamol(k); }, 90);
  }
  function mindSzamol() { kepletek.forEach(szamol); }

  function bezar(i) {
    var k = kepletek[i]; if (!k) return Promise.resolve(false);
    var elott = k.valtozott && k.adat.tipus !== 'aktualis'
      ? kerdez('A(z) „' + R.esc(cim(k)) + '” képlet változásai nincsenek elmentve. Mented bezárás előtt?', true)
      : Promise.resolve('nem');
    return elott.then(function (v) {
      if (!v) return false;
      var lep = v === 'igen' ? ment(k, false) : Promise.resolve(true);
      return lep.then(function (ok) {
        if (!ok) return false;
        var j = kepletek.indexOf(k); if (j < 0) return true;
        kepletek.splice(j, 1);
        if (aktiv >= kepletek.length) aktiv = kepletek.length - 1;
        if (!kepletek.length) nezet = 'mozaik';
        render();
        return true;
      });
    });
  }
  function mindBezar() {
    var i = kepletek.length - 1;
    function kov() {
      if (i < 0) return Promise.resolve(true);
      return bezar(i--).then(function (ok) { return ok ? kov() : false; });
    }
    return kov();
  }
  function aktival(i, reszletbe) {
    if (i < 0 || i >= kepletek.length) return;
    aktiv = i;
    if (reszletbe) nezet = 'reszlet';
    render();
  }

  /* ====================================================================== */
  /* Kerék és bélyegkép                                                      */
  /* ====================================================================== */
  var nyomtatFelul = null;   // nyomtatás/export alatt: { colors } – fekete-fehér kerék, jegyzetjelek nélkül
  function kerekBeall(k) {
    var b = beall.kerek, pl = b.planetak.slice(), cs = beall.csomo, csLe = cs === 11 ? 25 : 24;
    // holdcsomók: a felszálló és a leszálló külön (a Windows-osban bármelyik pipa mindkettőt mutatja)
    if (b.nodes) pl.push(cs);
    if (b.nodesDown) pl.push(csLe);
    if (b.asteroids) beall.kisb.forEach(function (id) { pl.push(id); });
    if (beall.allo && beall.allo.megj && k.e && k.e.csillagok) k.e.csillagok.forEach(function (c) { pl.push(c.id); });
    // fényszögelt elemek (GetShownAspectPlanets): planéták + kisbolygók + holdcsomók (a beállított típusból)
    var fszPl = b.fszPl.concat(b.fszKisb);
    if (b.fszCsomo.indexOf('fel') >= 0) fszPl.push(cs);
    if (b.fszCsomo.indexOf('le') >= 0) fszPl.push(csLe);
    var sz = beall.szin, ff = nyomtatFelul && nyomtatFelul.colors, kos0 = !!(k.e && k.e.hz.kos0);
    return { stilus: b.stilus || 'regio', nyomtat: !!nyomtatFelul, feketeFeher: !!ff, planets: pl, csillagMind: !!(beall.allo && beall.allo.mind), jelek: jelek(), vonal: sz.vonal,
      aspectColors: ff ? null : sz.fsz, aspectStyles: sz.stilus, houseLords: b.houseLords, feral: b.feral, retrograde: b.retrograde, stationary: b.stationary,
      selfMarkers: b.selfMarkers && !kos0, selfMarkerAtOrigPlace: b.enEredeti, enKor: b.enMod === 0,
      cuspLabels: b.cuspLabels, szemely: !!k.szemely && !k.fajta,
      aspectTypes: b.fszTipus, aspectSymbols: b.fszJel, aspectPlanets: fszPl, aspectHouses: b.fszHaz,
      fszPlanetaig: b.fszPlanetaig, fszEredeti: b.fszEredeti,
      jegyek: b.jegyek, analog: b.analog, hazHatar: b.hazHatar, hazSzam: b.hazSzam, arab: b.arab, tengelyek: b.tengelyek,
      mcIc: beall.hsys === 'A' && !kos0, planetDeg: b.planetDeg, meret: b.meret,
      fokKulso: b.fokKulso, fokBelso: b.fokBelso, fokFsz: b.fokFsz, fokKulon: b.fokKulon,
      asztroszkop: b.asztro && k.e ? { eltolas: asztroEltolas(k.e), mod: b.asztroMod, sav: b.asztroSav, tejut: b.asztroTejut,
        kiterj: b.asztroKiterj || 'csill', atfed: b.asztroAtfed !== false } : null,
      naksatra: b.naksatra && k.e ? { kezdet: nakKezdet(k.e) } : null,
      colors: ff || { fire: sz.fire, earth: sz.earth, air: sz.air, water: sz.water, aspectBg: sz.aspectBg, aspect: '#000000' } };
  }
  /** az asztroszkóp (J2000-es csillagkép-határok) eltolása a képlet időpontjára: általános precesszió (IAU 2006, p_A),
   *  sziderikus zodiákusnál az ajánamsával vissza (a csillagképek a csillagokhoz rögzítettek) */
  function asztroEltolas(e) {
    var T = (e.jd - 2451545) / 36525, p = (5028.796195 * T + 1.1054348 * T * T) / 3600;
    return p - (e.sid && e.egyeb && typeof e.egyeb.ayanamsa === 'number' ? e.egyeb.ayanamsa : 0);
  }
  /* ---------- Nagy kerék: csak a kerék a teljes ablakban (kis képernyőkön, pl. 150%-os nagyítású laptopon) ---------- */
  function nagyKerek(be) {
    document.body.classList.toggle('kerek-max', !!be);
    if (!be && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  }
  function teljesKepernyo() {
    var d = document.documentElement;
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen().catch(function () {}); return; }
    if (d.requestFullscreen) d.requestFullscreen().catch(function () { uzen('A böngésző nem engedte a teljes képernyőt – próbáld az F11 billentyűt.'); });
    else uzen('A teljes képernyőhöz nyomd meg az F11 billentyűt.');
  }
  document.addEventListener('fullscreenchange', function () { render(); });
  /* ---------- Égbolt-nézet (Speciális › Égbolt-nézet (3D)) ---------- */
  var egbAblak = null;
  function scriptBetolt(src) {
    return new Promise(function (ok, hiba) {
      var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { hiba(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  /** a fényszögvonalak színei a sötét égen (a kerék színei fehér háttérre valók) */
  var EGB_FSZ = { 1: 'rgba(255,224,102,0.8)', 2: 'rgba(255,92,92,0.8)', 3: 'rgba(255,92,92,0.8)', 4: 'rgba(255,154,122,0.7)', 5: 'rgba(255,154,122,0.7)',
    6: 'rgba(92,200,255,0.8)', 7: 'rgba(92,200,255,0.8)', 8: 'rgba(160,170,195,0.6)', 9: 'rgba(160,170,195,0.6)', 10: 'rgba(180,140,255,0.7)',
    11: 'rgba(180,140,255,0.7)', 12: 'rgba(180,140,255,0.7)' };
  function egboltNyit(k) {
    if (!k.e) { uzen('A képlet még nem készült el.'); return; }
    if (egbAblak) egbAblak.zar();
    (R.EGBOLT ? Promise.resolve() : scriptBetolt('../js/egbolt-adat.js')).then(function () {
      var e = k.e, a = k.adat, g = e.egyeb || {};
      var ayan = e.sid ? (typeof g.ayanamsa === 'number' ? g.ayanamsa : se.ayanamsaUt(e.jd)) : 0;
      var cs = beall.csomo === 10 ? 10 : 11, ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, cs];
      var pont = function (id, L, B, spd) {
        var p = e.elemPl && e.elemPl[id];
        return { id: id, jel: R.glif(id), nev: R.nev(id), L: L, B: B || 0, retro: spd < 0, haz: p ? p.house : 0 };
      };
      var pontok = ids.filter(function (id) { return e.poz[id]; }).map(function (id) { var x = e.poz[id]; return pont(id, x.lon, x.lat, x.speedLon); });
      if (e.poz[cs]) {
        var lesz = pont(cs === 10 ? 24 : 25, (e.poz[cs].lon + 180) % 360, 0, e.poz[cs].speedLon), pf = e.elemPl && e.elemPl[cs];
        if (pf && pf.house) lesz.haz = (pf.house + 5) % 12 + 1;
        pontok.push(lesz);
      }
      var vanIdo = !a.ismeretlen && !K.kos0e(a) && typeof e.hz.armc === 'number';
      var hz = e.hz, persp = a.tipus === 'persp' ? a.perspId : null;
      var fszTip = beall.kerek.fszTipus || [];
      var fszek = ((e.elemzes && e.elemzes.aspects) || []).filter(function (f) {
        return f.a[0] === 'P' && f.b[0] === 'P' && fszTip.indexOf(f.aspect) >= 0 && ids.indexOf(f.a[1]) >= 0 && ids.indexOf(f.b[1]) >= 0;
      }).map(function (f) { return { a: f.a[1], b: f.b[1], fsz: f.aspect, szin: EGB_FSZ[f.aspect] }; });
      // léptetett időpont: geocentrikus pozíciók, ASC/MC/ARMC (a képlet helyén, házrendszerével)
      var szamolJd = function (jd) {
        var jdEt = jd + se.deltat(jd), fl = sweFlag();
        var pk = ids.map(function (id) { var x = se.calc(jdEt, id, fl); return pont(id, x.lon, x.lat, x.speedLon); });
        pk.forEach(function (x) { x.haz = 0; });
        var n = pk[pk.length - 1]; pk.push(pont(cs === 10 ? 24 : 25, (n.L + 180) % 360, 0, n.retro ? -1 : 1)); pk[pk.length - 1].haz = 0;
        if (!vanIdo) return { pontok: pk, tengelyek: null, armc: hz.armc };
        var h = se.housesEx(jd, e.sid ? SwissEph.SE.FLG_SIDEREAL : 0, a.lat, a.lon, beall.hsys);
        return { pontok: pk, tengelyek: { asc: h.asc, mc: h.mc }, armc: h.armc };
      };
      var zo = (e.zona && typeof e.zona.orak === 'number') ? e.zona.orak : 0, zk = e.zona && e.zona.kod ? ' ' + e.zona.kod : '';
      var datum = function (jd) {
        var d = se.revjul(jd + zo / 24), h = Math.floor(d.hour + 1e-9), mi = Math.floor((d.hour - h) * 60 + 1e-6);
        return R.datumStr(d.year, d.month, d.day, h, mi) + zk;
      };
      // heliocentrikus helyvektorok (CsE, a képlet zodiákusában) – a Naprendszer-nézethez; a Hold geocentrikusan
      var helioXyz = function (jdEt, id, fl) {
        if (id === 0) return [0, 0, 0];
        var x = se.calc(jdEt, id, fl), l = (x.lon - ayan) * Math.PI / 180, b = x.lat * Math.PI / 180;
        return [x.dist * Math.cos(b) * Math.cos(l), x.dist * Math.cos(b) * Math.sin(l), x.dist * Math.sin(b)];
      };
      var helio = function (jd) {
        var SE = SwissEph.SE, jdEt = jd + se.deltat(jd), fl = SE.FLG_SWIEPH | SE.FLG_HELCTR, xyz = {};
        [0, 2, 3, 4, 5, 6, 7, 8, 9, 14].forEach(function (id) { xyz[id] = helioXyz(jdEt, id, fl); });
        return { xyz: xyz, hold: helioXyz(jdEt, 1, SE.FLG_SWIEPH) };
      };
      // egy keringés mintái (a pályák rajzához), a képlet időpontja körül
      var KERINGES = { 2: 87.969, 3: 224.701, 4: 686.98, 5: 4332.59, 6: 10759.2, 7: 30688.5, 8: 60182, 9: 90560, 14: 365.256 };
      var palya = function (id) {
        var SE = SwissEph.SE, fl = SE.FLG_SWIEPH | SE.FLG_HELCTR, n = 180, P = KERINGES[id], jdEt = e.jd + se.deltat(e.jd), l = [];
        if (!P) return [];
        for (var i = 0; i < n; i++) l.push(helioXyz(jdEt + (i / n - 0.5) * P, id, fl));
        return l;
      };
      // nézőpont: a Nap (heliocentrikus) vagy egy planéta – a heliocentrikus helyvektorok különbsége (fénymenet nélkül)
      var nezopontFv = function (vid, jd) {
        jd = jd || e.jd;
        var SE = SwissEph.SE, jdEt = jd + se.deltat(jd), fl = SE.FLG_SWIEPH | SE.FLG_HELCTR;
        var xyz = function (id) {
          if (id === 0) return [0, 0, 0];
          var x = se.calc(jdEt, id, fl), l = x.lon * Math.PI / 180, b = x.lat * Math.PI / 180;
          return [x.dist * Math.cos(b) * Math.cos(l), x.dist * Math.cos(b) * Math.sin(l), x.dist * Math.sin(b)];
        };
        var v = xyz(vid);
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 14].filter(function (id) { return id !== vid; }).map(function (id) {
          var t = xyz(id), d = [t[0] - v[0], t[1] - v[1], t[2] - v[2]], r = Math.hypot(d[0], d[1], d[2]) || 1;
          var L = (Math.atan2(d[1], d[0]) * 180 / Math.PI - ayan + 720) % 360, B = Math.asin(d[2] / r) * 180 / Math.PI;
          return { id: id, jel: id === 14 ? '' : R.glif(id), nev: id === 14 ? 'Föld' : R.nev(id), L: L, B: B, retro: false, haz: 0 };
        });
      };
      var nev = [[-1, 'Föld (geocentrikus)'], [0, 'Nap (heliocentrikus)']].concat([1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (id) { return [id, R.nev(id)]; }));
      egbAblak = R.Egbolt.nyit({
        cim: K.cim(a), alcim: tipusNev(k), pontok: pontok,
        tengelyek: vanIdo ? { asc: hz.persp !== undefined ? hz.origAsc : hz.asc, mc: hz.persp !== undefined ? hz.origMc : hz.mc } : null,
        eltolas: asztroEltolas(e), ayan: ayan, eps: e.eps, armc: hz.armc, phi: a.lat, fszek: fszek,
        nezopontok: nev, nezopontFv: nezopontFv, jd0: e.jd, szamol: szamolJd, datum: datum, helio: helio, palya: palya,
        // planéta-perspektívánál a planéta szemszögéből (a Nap-perspektíva heliocentrikus); drakonikusnál a holdcsomó középen
        nezopont: persp !== null && persp >= 0 && persp <= 9 ? persp : -1,
        kozep: persp === 10 ? cs : null,
        beall: beall.egbolt, ment: function (x) { beall.egbolt = x; beallMent(); },
        bezarva: function () { egbAblak = null; }
      });
    }, function () { uzen('Az égbolt adatai nem tölthetők be.'); });
  }
  /** a naksatrák kezdete (Ashwini 0°) a kerék zodiákusában: a Lahiri-ajánamsa; sziderikus (Fagan/Bradley) képletnél a kettő különbsége */
  function nakKezdet(e) {
    var g = e.egyeb || {}, T = (e.jd - 2451545) / 36525;
    var lah = typeof g.ayanamsaLahiri === 'number' ? g.ayanamsaLahiri : 23.857 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
    return e.sid && typeof g.ayanamsa === 'number' ? lah - g.ayanamsa : lah;
  }
  function kerekRajzol(hova, k) {
    var svg = kerekRajzolAlap(hova, k);
    // a planétára kattintással kiemelt fényszögkapcsolatok újrarajzolás után is megmaradnak (nyomtatásban nem)
    if (svg && !nyomtatFelul && k.fokusz !== undefined && k.fokusz !== null) {
      var kk = hova.querySelectorAll('.kk'), cel = kk.length ? (kk[k.fokuszK ? 1 : 0] || kk[0]).querySelector('svg') : svg;
      if (!cel || !RegioKerek.fokusz(cel, k.fokusz)) k.fokusz = null;
    }
    return svg;
  }
  /** Fókusz (kiemelés): a kattintott planéta, a vele fényszögben álló elemek és a fényszögvonalak; a többi halvány.
   *  Ugyanarra kattintva, vagy a kerék üres részére kattintva kikapcsol. */
  function fokuszKatt(k, svg, t) {
    var g = t.closest('g.planeta:not(.kulso), g.csillag'), kulso = !!svg.closest('[data-kulso]');
    var id = g ? +g.getAttribute('data-id') : null, volt = k.fokusz !== undefined && k.fokusz !== null;
    if (id !== null && volt && k.fokusz === id && !!k.fokuszK === kulso) id = null;
    if (id === null && !volt) return;
    Array.prototype.forEach.call(svg.closest('.kerek').querySelectorAll('svg'), function (s) { RegioKerek.fokusz(s, null); });
    k.fokusz = id; k.fokuszK = kulso;
    if (id !== null && !RegioKerek.fokusz(svg, id)) k.fokusz = null;
  }
  function fokuszTorol() {
    var volt = false;
    kepletek.forEach(function (k) { if (k.fokusz !== undefined && k.fokusz !== null) { k.fokusz = null; volt = true; } });
    Array.prototype.forEach.call(document.querySelectorAll('#asztal .kerek svg.fokusz'), function (s) { RegioKerek.fokusz(s, null); });
    return volt;
  }
  function kerekRajzolAlap(hova, k) {
    if (k.fajta) return osszKerekRajzol(hova, k);
    if (k.e) {
      var kd = T.kerekAdat(k.e);
      kd.jegyzetJelek = nyomtatFelul || !fk('jegyzet') ? null : k.jegyzetKulcsok || (k.jegyzetKulcsok = R.Jegyzet.jelek(k));
      var svg = RegioKerek.rajzol(hova, kd, kerekBeall(k));
      svg.setAttribute('aria-label', 'Képletábra: ' + cim(k));
      return svg;
    }
    hova.innerHTML = k.hiba ? '<div class="hiba">Hiba: ' + R.esc(k.hiba) + '</div>' : '<div class="betolt">számítás…</div>';
    return null;
  }
  /** Összevetés: egymáson (bi-kerék) vagy egymás mellett (két kerék) */
  function osszKerekRajzol(hova, k) {
    var ks = k.kulso;
    if (!k.e || !ks.e) {
      var h = k.hiba || ks.hiba;
      hova.innerHTML = h ? '<div class="hiba">Hiba: ' + R.esc(h) + '</div>' : '<div class="betolt">számítás…</div>';
      return null;
    }
    var o = kerekBeall(k), csakHold = k.fajta === 'ph' && beall.phCsakHold !== false;
    if (k.mod === 'egymasmellett') {
      // két önálló kerék: énjelölő és házcsúcs-felirat nélkül, külső fokbeosztással (D 2810–2956)
      hova.innerHTML = '<div class="ketkerek' + (beall.osszElhely === 'vizszintes' ? '' : ' atlos') + '"><figure><div class="kk"></div><figcaption>Belső kör – ' + R.esc(K.cim(k.adat)) +
        '</figcaption></figure><figure><div class="kk" data-kulso="1"></div><figcaption>Külső kör – ' + R.esc(kulsoNev(k)) + '</figcaption></figure></div>';
      var kk = hova.querySelectorAll('.kk');
      o.selfMarkers = false; o.cuspLabels = false; o.outerTicks = true;
      RegioKerek.rajzol(kk[0], T.kerekAdat(k.e), o);
      var o2 = {}, x; for (x in o) o2[x] = o[x];
      if (csakHold) o2.planets = [1];
      if (k.fajta === 'pd' || k.fajta === 'pdv') o2.feral = false;
      RegioKerek.rajzol(kk[1], T.kerekAdat(ks.e), o2);
      return hova.querySelector('svg');
    }
    var kd = T.kerekAdat(ks.e);
    kd.csucsok = k.fajta === 'tranzit' || k.fajta === 'pd' ? 'tengely' : k.fajta === 'ph' ? (beall.phTengely ? 'tengely' : 'nincs') : 'mind';
    kd.tengelyJel = k.fajta !== 'ph' || !!beall.phTengely;
    kd.betuk = k.fajta !== 'pd' && k.fajta !== 'pdv';
    kd.egyenlo = beall.hsys === 'A';
    kd.csakHold = csakHold;
    if (k.fajta === 'ph' && k.phHold) kd.cimKieg = { 1: 'Progressziós Hold értékek:\n' + k.phHold.map(function (x) { return x.szoveg; }).join('\n') };
    var svg = RegioKerek.rajzolDupla(hova, T.kerekAdat(k.e), kd, o);
    svg.setAttribute('aria-label', 'Összevetés: ' + cim(k));
    return svg;
  }
  function miniSvg(k) {
    if (!k.e) return '';
    var d = document.createElement('div');
    var sz = beall.szin;
    RegioKerek.rajzol(d, T.kerekAdat(k.e), { stilus: beall.kerek.stilus || 'regio', houseLords: false, cuspLabels: false, selfMarkers: false, feral: false,
      aspectSymbols: [], jelek: jelek(), aspectColors: sz.fsz, aspectStyles: sz.stilus,
      colors: { fire: sz.fire, earth: sz.earth, air: sz.air, water: sz.water, aspectBg: sz.aspectBg, aspect: '#000000' } });
    var s = d.firstChild; s.removeAttribute('style'); s.setAttribute('aria-hidden', 'true'); s.removeAttribute('role');
    Array.prototype.forEach.call(s.querySelectorAll('title'), function (t) { t.parentNode.removeChild(t); });
    return s.outerHTML;
  }

  /* ====================================================================== */
  /* Kiírás                                                                  */
  /* ====================================================================== */
  function lepettE(k) {
    if (k.fajta) {
      var ks = k.kulso, a = ks.alap || {};
      return ks.eltolas.some(function (x) { return x !== 0; }) || JSON.stringify({ ph: ks.ph, pd: ks.pd, sol: ks.sol, pdv: ks.pdv }) !== JSON.stringify(a);
    }
    return k.eltolas.some(function (x) { return x !== 0; });
  }
  /** A külső kör neve, a Windows-os előtagokkal (Tr>, PH>, Pd>, Sol>, Rev>) */
  function kulsoNev(k) {
    var I = R.Idotech, n = K.cim(k.adat);
    if (k.fajta === 'rev') return 'Rev> ' + R.nev(k.kulso.rev.pl) + ' (' + R.datumStr(k.kulso.eredeti.ev, k.kulso.eredeti.ho, k.kulso.eredeti.nap) + '.) ' + n;
    if (k.fajta === 'szin') return k.kulso.adat ? K.cim(k.kulso.adat) : '';
    return I.ELOTAG[k.fajta] + ' ' + n;
  }
  function cim(k) { return k.fajta ? '<-> ' + K.cim(k.adat) + ' - ' + kulsoNev(k) : K.cim(k.adat); }
  /** a képlet neve HTML-ben: felhasználói adat, ezért nem fordítjuk (az „Aktuális égi állás” igen) */
  function cimHtml(k) { var s = R.esc(cim(k)); return !k.fajta && k.adat.tipus === 'aktualis' ? s : '<span data-nofordit>' + s + '</span>'; }
  /** A státuszsor és a csempe típusfelirata (GetActivePageStringTypeToStatBar) */
  function tipusNev(k) {
    if (k.rogzitett) return k.rogzitett.tipus;
    if (!k.fajta) return K.tipusNev(k.adat);
    if (k.fajta === 'ph') {
      var nap = k.kulso.ph ? k.kulso.ph.napok + k.kulso.ph.orak / 24 : 0, d = new Date(Date.UTC(k.adat.ev, k.adat.ho - 1, k.adat.nap));
      d.setUTCMonth(d.getUTCMonth() + Math.round(nap * 12));
      return 'Progressziós Hold - ' + d.getUTCFullYear() + '. évre';
    }
    return { tranzit: 'Tranzit - Összevetés', pd: 'Primer (1° = 1 év) direkció - Összevetés', pdv: 'Primer direkció - Összevetés',
      sol: 'Szolár-képlet - Összevetés' }[k.fajta] || 'Összevetés';
  }
  /** A külső kör időpontjának leírása (a Windows-os státuszsor 2. mezője) */
  function kulsoMikor(k) {
    var ks = k.kulso, a = ks.adat;
    if (k.fajta === 'pd') return 'Primer (1° = 1 év) direkció a(z) ' + (k.adat.ev + (ks.konverz ? -ks.pd : ks.pd)) + '. évre (' + Math.abs(ks.pd) + '°)';
    if (k.fajta === 'pdv') {
      var x = ks.pdv, info = ks.pdvInfo;
      return 'Primer direkció ' + R.datumStr(x.datum[0], x.datum[1], x.datum[2]) + ' időpontra' +
        (info ? ' (' + Math.floor(info.kor) + ' év ' + Math.floor((info.kor % 1) * 12) + ' hó, ív ' + R.fokStr(info.iv, false) + ', ' +
          R.Primer.KULCSOK[x.kulcs] + (x.konverz ? ', konverz' : '') + ')' : '');
    }
    if (k.fajta === 'sol') return 'Szolár-képlet a(z) ' + ks.sol.ev + '. évre' + (a ? ' – ' + idoStr(a) + (K.helyNev(a) ? ' ' + K.helyNev(a) : '') : '');
    if (k.fajta === 'ph') {
      var nap = ks.ph.napok + ks.ph.orak / 24, ev = Math.trunc(Math.abs(nap)), ho = Math.round((Math.abs(nap) - ev) * 12);
      if (ho === 12) { ev++; ho = 0; }
      return (nap < 0 ? '−' : '') + (ho ? ev + ' év ' + ho + ' hónapos' : ev + ' éves') + ' korra' + (a ? ' (a képlet ideje: ' + idoStr(a) + ')' : '');
    }
    return a ? idoStr(a) + ' időpontra' + (K.helyNev(a) ? ' · ' + K.helyNev(a) : '') : '';
  }
  /**
   * Személyes adatok elrejtése (chkbInkognito – közös a nyomtatás „Személyes adatok elrejtése” pipájával).
   * A Windows-osban a fül-súgóból és a státuszsorból tűnik el a születési idő, hely és életkor (és a nyomtatásból);
   * itt a csempékről, a megnyitott és a legutóbbi képletek listájából is – pl. kivetítéshez, órán.
   */
  function inkognito() { return !!(beall.nyomtatas && beall.nyomtatas.inkognito); }
  function idoStr(a) {
    return R.datumStr(a.ev, a.ho, a.nap) + (a.ismeretlen ? ' (idő ismeretlen)' : ' ' + R.pad(a.ora) + ':' + R.pad(a.perc));
  }
  function datumSor(k) {
    var a = k.adat;
    if (inkognito() && a.tipus !== 'aktualis') return 'személyes adatok elrejtve';
    return idoStr(a) + (K.helyNev(a) ? ' · ' + K.helyNev(a) : '');
  }
  function infoSor(k) {
    if (k.hiba) return '<span class="figy">' + R.esc(k.hiba) + '</span>';
    if (!k.e) return 'számítás…';
    if (!k.e.elemzes) return '<span class="figy">Képlet-elemzés nem érhető el</span>';
    var es = k.e.elemzes.lifeStrategy;
    var s = es.walked.length ? 'Életstratégia: ' + es.walked.map(function (j) { return R.JEGYEK[j] + ' / ' + R.HAZNEV[j + 1] + ' Ház'; }).join(', ') : '';
    if (k.adat.tipus === 'aktualis') s = (beall.aktualisFrissit ? 'automatikus frissítés: 3 perc' : 'frissítés kikapcsolva');
    return R.esc(s);
  }
  function tipusCimke(k) {
    return '<span class="tipus">' + R.esc(tipusNev(k)) + '</span>' + (k.szemely && !k.fajta ? ' <span class="tipus lep">Személyiségrajz</span>' : '') + (lepettE(k) ? ' <span class="tipus lep" title="Léptetett időpont">léptetve</span>' : '');
  }

  function render() {
    // a nagy kerék csak a részletes nézetben, megnyitott képlettel
    if (document.body.classList.contains('kerek-max') && (nezet !== 'reszlet' || !vanAkt())) nagyKerek(false);
    renderCim(); renderEszkoztar(); renderLista(); renderLepteto(); renderAsztal(); renderStatusz();
    // bekapcsolt horoszkópolvasónál a böngésző saját buboréka ne takarja az olvasó szövegét
    if (olvasoBe) Array.prototype.forEach.call(document.querySelectorAll('#asztal [data-olv] title'), function (t) { t.remove(); });
    R.Jegyzet.aktValt();
    munkamenetMent();
  }
  function renderCim() {
    var k = akt();
    $('cimNev').textContent = k ? '– ' + cim(k) + (k.valtozott && k.adat.tipus !== 'aktualis' ? ' *' : '') : '';
    document.title = k ? cim(k) + ' – Regiomontanus' : 'Regiomontanus';
    $('db').textContent = kepletek.length;
    Array.prototype.forEach.call($('racs').querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(+b.getAttribute('data-r') === beall.elrendezes && nezet === 'mozaik'));
    });
  }
  function renderStatusz() {
    var k = akt();
    if (!k) { $('st1').textContent = kepletek.length ? '' : 'Nincs megnyitott képlet'; $('st2').textContent = ''; $('st3').textContent = ''; return; }
    var a = k.adat;
    // a Windows-os fül-súgó szerint: név, születési idő, hely, majd az életkor (GetKora + „é”)
    var ek = a.tipus !== 'aktualis' ? K.eletkor(a) : -1;
    // a név (felhasználói adat) külön elemben: a felület fordítása nem érinti
    $('st1').innerHTML = (a.tipus === 'aktualis' ? '<span>' + R.esc(K.cim(a)) + '</span>' : '<span data-nofordit>' + R.esc(K.cim(a)) + '</span>') +
      R.esc(inkognito() && a.tipus !== 'aktualis' ? '' : ' ' + idoStr(a) + (K.helyNev(a) ? ' ' + K.helyNev(a) : '') +
      (ek >= 0 && ek < 150 && !beall.kerek.eletkorRejt ? ' · ' + ek + ' é' : ''));
    $('st2').textContent = tipusNev(k);
    if (k.fajta) {
      var rr = [kulsoMikor(k)];
      if (k.kulso.hiba) rr.push(k.kulso.hiba);
      if (lepettE(k)) rr.push('léptetve');
      $('st3').textContent = rr.join(' · ');
      return;
    }
    var r = [];
    if (k.e) r.push(k.e.hz.kos0 ? 'Kos 0° házak' : R.HAZRENDSZER[beall.hsys] + (beall.sid ? ', sziderikus' : ''));
    if (lepettE(k)) r.push('léptetve: ' + eltolasStr(k.eltolas));
    if (k.e && k.e.figyelmeztetes.length) r.push(k.e.figyelmeztetes.join(' '));
    $('st3').textContent = r.join(' · ');
  }
  function eltolasStr(e) {
    var n = ['év', 'hó', 'nap', 'óra', 'perc'];
    return e.map(function (x, i) { return x ? (x > 0 ? '+' : '') + x + ' ' + n[i] : ''; }).filter(Boolean).join(', ');
  }

  /* ---------- munkaasztal ---------- */
  function renderAsztal() {
    var hova = $('asztal');
    if (!kepletek.length) { renderUdv(hova); return; }
    if (nezet === 'reszlet' && akt()) { renderReszlet(hova); return; }
    nezet = 'mozaik';
    var r = beall.elrendezes;
    var l = r === 1 ? [aktiv] : kepletek.map(function (k, i) { return i; });
    hova.innerHTML = '<main class="mozaik r' + r + '" aria-label="Munkaasztal">' + l.map(function (i) {
      var k = kepletek[i];
      return '<section class="csempe' + (i === aktiv ? ' aktiv' : '') + '" data-i="' + i + '" aria-label="' + R.esc(cim(k)) + '">' +
        '<div class="fej"><b>' + cimHtml(k) + (k.valtozott && k.adat.tipus !== 'aktualis' ? ' *' : '') + '</b> ' + tipusCimke(k) +
        '<span class="tolt"></span>' +
        '<button type="button" class="kisgomb" data-tett="nagyit" aria-label="Kinagyítás" title="Kinagyítás (dupla kattintás)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>' +
        '<button type="button" class="kisgomb" data-tett="bezar" aria-label="Bezárás" title="Bezárás (Alt+W)"><svg viewBox="0 0 24 24" aria-hidden="true" style="stroke:#6b665d"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div><div class="kerek"></div><div class="lab"><span>' + R.esc(datumSor(k)) + '</span><span>' + infoSor(k) + '</span></div></section>';
    }).join('') + '</main>';
    Array.prototype.forEach.call(hova.querySelectorAll('.csempe'), function (s) {
      kerekRajzol(s.querySelector('.kerek'), kepletek[+s.getAttribute('data-i')]);
    });
  }
  function renderUdv(hova) {
    var l = S.legutobbi();
    hova.innerHTML = '<div class="udv"><h1>Regiomontanus</h1>' +
      '<p>' + (betoltve ? 'Nyiss meg egy .szk képletfájlt (vagy húzd ide), vagy készíts új képletet.' : 'A számítómotor betöltése folyamatban…') + '</p>' +
      '<div class="gombok"><button type="button" class="gomb fo" data-tett="uj">Új képlet (Alt+N)</button>' +
      '<button type="button" class="gomb" data-tett="megnyit">Megnyitás (Ctrl+O)</button>' +
      '<button type="button" class="gomb" data-tett="aktualis">Aktuális égi állás</button></div>' +
      (l.length ? '<h2>Legutóbbi képletek</h2><ul>' + l.map(function (x, i) {
        return '<li><button type="button" data-legutobbi="' + i + '"><span data-nofordit>' + R.esc(K.cim(x.adat)) + '</span><small>' + (inkognito() ? '' : R.esc(idoStr(x.adat))) +
          (x.fajlnev ? (inkognito() ? '' : ' · ') + R.esc(x.fajlnev) : '') + '</small></button></li>';
      }).join('') + '</ul>' : '') + '</div>';
  }
  function renderReszlet(hova) {
    var k = akt();
    hova.innerHTML = (kepletek.length < 2 ? '' : '<nav class="belyegek" aria-label="Megnyitott képletek">' + kepletek.map(function (x, i) {
      return '<button type="button" data-valt="' + i + '" aria-current="' + (i === aktiv) + '"><span class="mini">' + x.mini + '</span>' +
        '<span class="ln"><b>' + cimHtml(x) + '</b><small>' + R.esc(tipusNev(x)) + '</small></span></button>';
    }).join('') + '</nav>') +
      '<main class="reszlet" aria-label="Részletes nézet" style="--kerek-arany:' + (aranyKorlat(beall.reszletArany) * 100).toFixed(1) + '%"><section class="fo-kerek"><div class="fej"><b>' + cimHtml(k) + '</b> ' +
      tipusCimke(k) + '<span class="tolt"></span>' + (!k.fajta && fk('csatolmany') ? '<button type="button" class="gomb" data-tett="oldalsav" aria-pressed="' + (beall.oldalsav !== false) +
        '" title="Oldalsáv elrejtése/mutatása (fénykép, csatolmányok, jegyzet)">Oldalsáv</button>' : '') +
      (!k.fajta && k.adat.tipus !== 'aktualis' ? '<button type="button" class="gomb" data-tett="szemely" aria-pressed="' +
        !!k.szemely + '" title="Csak az énállapotok (énjelölő planéták és együttállóik) az ábrán">Személyiségrajz</button>' : '') + (k.fajta ? '<div class="csoport" role="group" aria-label="Megjelenítés">' +
        '<button type="button" data-tett="egymason" aria-pressed="' + (k.mod !== 'egymasmellett') + '">Egymáson</button>' +
        '<button type="button" data-tett="egymasmellett" aria-pressed="' + (k.mod === 'egymasmellett') + '">Egymás mellett</button></div>' : '') +
      (document.body.classList.contains('kerek-max')
        // nagy ábránál a menüsor rejtve: a megnyitott képletek közötti váltó itt, a fejlécben
        ? (kepletek.length > 1 ? '<label class="kepvalto"><span>Képlet:</span><select data-kepvalto aria-label="Megnyitott képletek">' + kepletek.map(function (x, i) {
            return '<option value="' + i + '"' + (i === aktiv ? ' selected' : '') + '>' + (i + 1) + '. ' + R.esc(cim(x)) + ' – ' + R.esc(tipusNev(x)) + '</option>';
          }).join('') + '</select></label>' : '') +
          '<button type="button" class="gomb" data-tett="teljesKepernyo" aria-pressed="' + !!document.fullscreenElement + '" title="A böngésző saját sávjai nélkül (F11)">' +
          (document.fullscreenElement ? 'Kilépés a teljes képernyőből' : 'Teljes képernyő') + '</button>' +
          '<button type="button" class="gomb fo" data-tett="nagyKerekValt" title="Vissza a táblákhoz és a menühöz (Esc)">Kicsinyítés (Esc)</button>'
        : '<button type="button" class="gomb" data-tett="nagyKerekValt" title="Csak az ábra, a teljes ablakban (a menü, az eszköztár és a táblák nélkül)">⤢ Nagy ábra</button>' +
          '<button type="button" class="gomb fo" data-tett="vissza">Vissza a mozaikhoz (Esc)</button>') + '</div>' +
      '<div class="torzs"><div class="kerek"></div>' + (oldalsavVan(k) ? oldalsavHtml(k) : '') + '</div></section>' +
      '<div class="elvalaszto" role="separator" tabindex="0" aria-orientation="vertical" aria-controls="tablaTart" ' +
      'aria-label="Az ábra és a táblák szélességének állítása" aria-valuemin="30" aria-valuemax="80" aria-valuenow="' +
      Math.round(aranyKorlat(beall.reszletArany) * 100) + '" title="Húzd oldalra (vagy ←/→); dupla kattintás: alapméret"></div>' +
      '<aside class="tablak" aria-label="Táblák"><div class="fulek" role="tablist">' + fulek().map(function (f) {
        return '<button type="button" role="tab" data-ful="' + f[0] + '" aria-selected="' + (ful === f[0]) + '"' +
          (f[2] ? ' title="' + f[2] + '"' : '') + '>' + f[1] + '</button>';
      }).join('') + '</div><div class="tabla-tart" role="tabpanel" id="tablaTart"></div></aside></main>';
    kerekRajzol(hova.querySelector('.fo-kerek .kerek'), k);
    renderTabla($('tablaTart'), k);
    if (oldalsavVan(k)) kepFeloldas(k);
  }

  /* ---------- oldalsáv: fénykép, csatolmányok, jegyzet (D BSK.dfm 164–556) ---------- */
  function csatNev(v) {
    // WideExtractFileName: az utolsó \ / : utáni rész; URL-nél a cím, e-mailnél a cím
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/$/, '');
    return String(v).split(/[\\/:]/).pop() || v;
  }
  function csatTipus(v) { return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^www\./i.test(v) ? 'url' : /@/.test(v) && !/[\\/]/.test(v) ? 'mail' : 'fajl'; }
  function oldalsavHtml(k) {
    var a = k.adat, l = a.csatolmanyok || [], kj = k.csatKijelolt;
    var foto = a.kepAdat ? '<img src="' + a.kepAdat + '" alt="Fénykép">'
      : k.kepUrl ? '<img src="' + k.kepUrl + '" alt="Fénykép">'
      : '<span class="hely">' + (a.kepFajl ? 'A fénykép a Regiomontanus mappában van:<br><small>' + R.esc(a.kepFajl) + '</small><br>Kattints a mappa megnyitásához.' : 'Fénykép hozzáadása') + '</span>';
    return '<aside class="oldalsav" aria-label="Fénykép, csatolmányok és jegyzet">' +
      '<button type="button" class="foto" data-tett="kepValaszt" title="' + (a.kepAdat || k.kepUrl ? 'Fénykép cseréje (jobb kattintás: megnyitás nagyban)' : 'Fénykép hozzáadása') + '">' + foto + '</button>' +
      ((a.kepAdat || a.kepFajl) ? '<button type="button" class="kisgomb kep-torol" data-tett="kepTorol" title="Fénykép törlése" aria-label="Fénykép törlése"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button>' : '') +
      '<ul class="csat" role="listbox" aria-label="Csatolt dokumentumok, URL-ek és e-mail címek">' + l.map(function (v, i) {
        var t = csatTipus(v);
        return '<li role="option" tabindex="0" aria-selected="' + (kj === i) + '" data-csat="' + i + '" title="' + R.esc(v) + ' (dupla kattintás: megnyitás)">' +
          '<span class="ct ' + t + '" aria-hidden="true"></span>' + R.esc(csatNev(v)) + '</li>';
      }).join('') + '</ul>' +
      '<div class="csat-gombok">' +
      (!fk('jegyzet') ? '' : '<button type="button" class="kisgomb jegyzetgomb' + (R.Jegyzet.vanJegyzet(k) ? ' van' : '') + '" data-tett="jegyzet" title="Jegyzet az aktuális születési képlethez" aria-label="Jegyzet az aktuális születési képlethez"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5zM8 12h8M8 16h6"/></svg></button>') +
      '<button type="button" class="kisgomb" data-tett="csatDok" title="Dokumentum csatolása" aria-label="Dokumentum csatolása"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l7-7"/></svg></button>' +
      '<button type="button" class="kisgomb" data-tett="csatUrl" title="URL (http://www.esetneve.hu) és e-mail (esetneve@email.hu) csatolása" aria-label="URL vagy e-mail csatolása"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 .01 0M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg></button>' +
      '<button type="button" class="kisgomb" data-tett="csatTorol" title="Csatolás törlése" aria-label="Csatolás törlése"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '</div></aside>';
  }
  /** Adatmódosítás a képleten (az adat és az eredeti is, hogy a léptetés ne vesszen el). */
  function adatModosit(k, fn) {
    [k.adat, k.eredeti].forEach(function (a) { if (a) fn(a); });
    k.valtozott = true; render();
  }
  /** A Windows-os PictureFilename útvonal feloldása a kiválasztott Regiomontanus mappából. */
  function kepFeloldas(k) {
    var a = k.adat;
    if (a.kepAdat || !a.kepFajl || k.kepUrl || k.kepKeres === a.kepFajl) return;
    k.kepKeres = a.kepFajl;
    R.Mappa.elerheto(false).then(function (ok) { return ok ? R.Mappa.fajl(a.kepFajl) : null; }).then(function (f) {
      if (f) { k.kepUrl = URL.createObjectURL(f); render(); }
    });
  }
  function kepKicsinyit(f, max) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(f), img = new Image();
      img.onload = function () {
        var sz = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * sz)); c.height = Math.max(1, Math.round(img.naturalHeight * sz));
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('A kép nem olvasható.')); };
      img.src = u;
    });
  }
  function fajlValaszt(accept) {
    return new Promise(function (res) {
      var i = document.createElement('input'); i.type = 'file'; if (accept) i.accept = accept;
      i.addEventListener('change', function () { res(i.files && i.files[0] || null); });
      i.click();
    });
  }
  function kepValaszt() {
    var k = akt(); if (!k || k.fajta) return;
    if (k.adat.kepFajl && !k.adat.kepAdat && !k.kepUrl) {
      R.Mappa.valaszt().then(function (ok) { if (ok) { k.kepKeres = null; render(); } });
      return;
    }
    fajlValaszt('image/*').then(function (f) {
      if (!f) return;
      kepKicsinyit(f, 320).then(function (d) {
        var nev = f.name.replace(/[\\/:*?"<>|]+/g, '_');
        adatModosit(k, function (a) { a.kepAdat = d; a.kepFajl = 'hors\\images\\' + nev; });
        if (k.kepUrl) { URL.revokeObjectURL(k.kepUrl); k.kepUrl = null; }
        // a Windows-os program számára az eredeti kép a hors\images mappába (ha a mappa írható)
        if (R.Mappa.irhato()) R.Mappa.ir(['hors', 'images', nev], f).then(function (ok) { if (ok) uzen('A kép a hors\\images mappába is bekerült.'); });
      }, function (e) { uzen(e.message); });
    });
  }
  function kepTorol() {
    var k = akt(); if (!k || k.fajta) return;
    kerdez('Valóban törölni szeretné a csatolt képet?', false).then(function (v) {
      if (v !== 'igen') return;
      if (k.kepUrl) { URL.revokeObjectURL(k.kepUrl); k.kepUrl = null; }
      adatModosit(k, function (a) { a.kepAdat = ''; a.kepFajl = ''; });
    });
  }
  function kepMegnyit() {
    var k = akt(); if (!k) return;
    var src = k.adat.kepAdat || k.kepUrl; if (!src) return;
    var w = window.open('', '_blank');
    if (w) w.document.write('<!doctype html><title>' + R.esc(K.cim(k.adat)) + '</title><body style="margin:0;background:#222;display:grid;place-items:center;min-height:100vh"><img src="' + src + '" style="max-width:100%;max-height:100vh">');
  }
  function csatDok() {
    var k = akt(); if (!k || k.fajta) return;
    fajlValaszt('').then(function (f) {
      if (!f) return;
      var nev = f.name.replace(/[\\/:*?"<>|]+/g, '_'), v = 'hors\\docs\\' + nev;
      k.csatFajlok = k.csatFajlok || {}; k.csatFajlok[v.toLowerCase()] = f;
      adatModosit(k, function (a) { a.csatolmanyok = (a.csatolmanyok || []).concat([v]); });
      (R.Mappa.irhato() ? R.Mappa.ir(['hors', 'docs', nev], f) : Promise.resolve(false)).then(function (ok) {
        uzen(ok ? 'A(z) ' + nev + ' a hors\\docs mappába másolva és csatolva.'
          : 'Csatolva: ' + nev + '. A Windows-os program a Regiomontanus hors\\docs mappájában keresi – másold oda a fájlt.');
      });
    });
  }
  function csatUrl() {
    var k = akt(); if (!k || k.fajta) return;
    var d = $('dlgUrl'); $('urlMezo').value = ''; $('urlHiba').textContent = '';
    d.returnValue = ''; d.showModal(); $('urlMezo').focus();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      var v = $('urlMezo').value.trim();
      if (!v) return;
      // D URL 33–47: ha nincs @ és nincs benne http → http:// elé
      if (v.indexOf('@') < 0 && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'http://' + v;
      adatModosit(k, function (a) { a.csatolmanyok = (a.csatolmanyok || []).concat([v]); });
    };
  }
  function csatTorol() {
    var k = akt(); if (!k || k.fajta) return;
    var i = k.csatKijelolt, l = k.adat.csatolmanyok || [];
    if (i === undefined || i === null || !l[i]) { uzen('Jelöld ki a törlendő csatolást a listában.'); return; }
    kerdez('Valóban törölni szeretné a csatolt dokumentum hivatkozást?<br>„' + R.esc(l[i]) + '”', false).then(function (v) {
      if (v !== 'igen') return;
      k.csatKijelolt = null;
      adatModosit(k, function (a) { a.csatolmanyok = (a.csatolmanyok || []).filter(function (x, j) { return j !== i; }); });
    });
  }
  function csatMegnyit(k, i) {
    var v = (k.adat.csatolmanyok || [])[i]; if (!v) return;
    var t = csatTipus(v);
    if (t === 'url') { window.open(/^www\./i.test(v) ? 'http://' + v : v, '_blank', 'noopener'); return; }
    if (t === 'mail') { location.href = 'mailto:' + v; return; }
    var mem = k.csatFajlok && k.csatFajlok[v.toLowerCase()];
    (mem ? Promise.resolve(mem) : R.Mappa.elerheto(true).then(function (ok) { return ok ? R.Mappa.fajl(v) : null; })).then(function (f) {
      if (!f) {
        kerdez('Nem található a csatolt dokumentum:<br>' + R.esc(v) + '<br><br>Megnyitod a Windows-os Regiomontanus mappáját, hogy a program megkeresse benne?', false)
          .then(function (x) { if (x === 'igen') R.Mappa.valaszt().then(function (ok) { if (ok) csatMegnyit(k, i); }); });
        return;
      }
      if (/\.szk$/i.test(f.name)) { f.arrayBuffer().then(function (b) { fajlbolMegnyit(f.name, b, null); }); return; }
      var u = URL.createObjectURL(f);
      var w = window.open(u, '_blank');
      if (!w) letolt(f, f.name);
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    });
  }
  /* ---------- elválasztó a részletes nézetben ---------- */
  function aranyKorlat(x) { x = +x; return isFinite(x) ? Math.min(0.8, Math.max(0.3, x)) : 0.58; }
  function aranyBeallit(x, ment) {
    x = aranyKorlat(x);
    var m = document.querySelector('.reszlet'), e = document.querySelector('.elvalaszto');
    if (m) m.style.setProperty('--kerek-arany', (x * 100).toFixed(1) + '%');
    if (e) e.setAttribute('aria-valuenow', String(Math.round(x * 100)));
    beall.reszletArany = x;
    if (ment) beallMent();
  }
  function elvalasztoInit() {
    var huz = null;
    $('asztal').addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.elvalaszto'); if (!el || e.button !== 0) return;
      var m = el.parentNode, r = m.getBoundingClientRect(), cs = getComputedStyle(m);
      huz = { el: el, bal: r.left + parseFloat(cs.paddingLeft), szel: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - el.offsetWidth };
      el.setPointerCapture(e.pointerId); el.classList.add('huz'); document.body.classList.add('huzas');
      e.preventDefault();
    });
    $('asztal').addEventListener('pointermove', function (e) {
      if (!huz) return;
      aranyBeallit((e.clientX - huz.bal - huz.el.offsetWidth / 2) / huz.szel, false);
    });
    function vege() {
      if (!huz) return;
      huz.el.classList.remove('huz'); document.body.classList.remove('huzas'); huz = null;
      beallMent();
    }
    $('asztal').addEventListener('pointerup', vege);
    $('asztal').addEventListener('pointercancel', vege);
    $('asztal').addEventListener('dblclick', function (e) { if (e.target.closest('.elvalaszto')) aranyBeallit(0.58, true); });
    $('asztal').addEventListener('keydown', function (e) {
      if (!e.target.classList || !e.target.classList.contains('elvalaszto')) return;
      var d = { ArrowLeft: -0.02, ArrowRight: 0.02 }[e.key];
      if (d) { e.preventDefault(); aranyBeallit(beall.reszletArany + d, true); }
      else if (e.key === 'Home') { e.preventDefault(); aranyBeallit(0.3, true); }
      else if (e.key === 'End') { e.preventDefault(); aranyBeallit(0.8, true); }
    });
  }

  function renderTabla(hova, k) {
    if (ful === 'allo' && !(beall.allo && beall.allo.megj)) ful = 'planetak';
    if (!k.e) { hova.innerHTML = k.hiba ? '<p class="hiba">' + R.esc(k.hiba) + '</p>' : '<p class="betolt">számítás…</p>'; return; }
    if (ful === 'allo') {
      // a Windows-osban is csak az alap (belső) képlethez érhető el
      hova.innerHTML = (k.fajta ? '<p class="t-hint">Az állócsillagok táblázata csak az alap születési képlethez érhető el: ' + R.esc(K.cim(k.adat)) + '.</p>' : '') +
        T.allocsillagok(k.e, beall);
      return;
    }
    if (k.fajta) {
      var eK = k.kulso.e, cB = K.cim(k.adat), cK = kulsoNev(k);
      if (ful === 'fenyszogek') { T.keresztFenyszogek(hova, k.kereszt, k.e, eK, beall, cB, cK); return; }
      hova.innerHTML = ful === 'hazak' ? T.ket(T.hazak, k.e, eK, cB, cK, beall)
        : ful === 'egyeb' ? T.ket(T.egyeb, k.e, eK, cB, cK, beall) + T.progrHold(k.phHold)
        : ful === 'eletstrat' ? T.ket(T.eletstrat, k.e, eK, cB, cK, beall)
        : ful === 'enallapotok' ? T.ket(T.enallapotok, k.e, eK, cB, cK, beall)
        : T.ket(T.planetak, k.e, eK, cB, cK, beall) + T.progrHold(k.phHold);
      return;
    }
    if (ful === 'fenyszogek') { T.fenyszogek(hova, k.e, beall); return; }
    hova.innerHTML = ful === 'hazak' ? T.hazak(k.e) : ful === 'eletstrat' ? T.eletstrat(k.e) : ful === 'enallapotok' ? T.enallapotok(k.e)
      : ful === 'egyeb' ? T.egyeb(k.e) : T.planetak(k.e, beall);
  }

  /* ---------- megnyitott képletek lenyíló ---------- */
  function renderLista() {
    var l = $('lista');
    if (l.hidden) return;
    l.innerHTML = (kepletek.length ? kepletek.map(function (k, i) {
      return '<button type="button" role="menuitem" data-valt="' + i + '" aria-current="' + (i === aktiv) + '"><span class="mini">' + k.mini + '</span>' +
        '<span class="ln"><b>' + cimHtml(k) + '</b><small>' + R.esc(tipusNev(k)) + ' · ' + R.esc(datumSor(k)) + '</small></span></button>';
    }).join('') : '<div class="ures">Nincs megnyitott képlet.</div>') +
      '<div class="lab">Váltás billentyűzetről: Alt+1 … Alt+9</div>';
  }
  function listaValt(nyit) {
    var l = $('lista');
    l.hidden = nyit === undefined ? !l.hidden : !nyit;
    $('listaGomb').setAttribute('aria-expanded', String(!l.hidden));
    renderLista();
    if (!l.hidden) { var b = l.querySelector('[aria-current="true"]') || l.querySelector('button'); if (b) b.focus(); }
  }

  /* ---------- léptető ---------- */
  function renderLepteto() {
    var l = $('lepteto'), k = akt();
    l.hidden = !lepNyitva;
    if (!lepNyitva) return;
    if (!$('lepMezok').firstChild) {
      $('lepMezok').innerHTML = MEZOK.map(function (n, i) {
        return '<span class="mezo"><button type="button" data-lep="' + i + '" data-ir="1" aria-label="' + n + ' plusz">+</button><span>' + n +
          '</span><button type="button" data-lep="' + i + '" data-ir="-1" aria-label="' + n + ' mínusz">−</button></span>';
      }).join('');
    }
    var progr = !!(k && k.fajta), eng = lepEngedett(k);
    l.querySelector('b').textContent = progr ? 'Progresszióléptető' : 'Képletléptető';
    $('lepNev').textContent = k ? (progr ? kulsoNev(k) : cim(k)) : 'nincs aktív képlet';
    var la = k ? (progr ? k.kulso.adat : k.adat) : null;
    $('lepIdo').textContent = progr && k.fajta === 'pd' ? (k.adat.ev + (k.kulso.konverz ? -k.kulso.pd : k.kulso.pd)) + '. év'
      : progr && k.fajta === 'pdv' ? R.datumStr(k.kulso.pdv.datum[0], k.kulso.pdv.datum[1], k.kulso.pdv.datum[2])
      : la ? R.datumStr(la.ev, la.ho, la.nap, la.ora, la.perc) + (jatek && jatek.k === k ? ':' + ('0' + (la.mp || 0)).slice(-2) : '') : '–';
    // lejátszás: az aktuális égi állás valós időben, a választott gyakorisággal frissül
    var jt = !!k && !k.fajta && k.adat.tipus === 'aktualis', megy = !!jatek && jatek.k === k;
    $('lepJatek').hidden = !jt;
    $('lepPlay').textContent = megy ? '⏸ Megállítás' : '▶ Lejátszás';
    $('lepPlay').setAttribute('aria-pressed', String(megy));
    $('lepPlayIv').value = String(beall.jatekIv || 2000);
    $('lepElt').textContent = k && k.rogzitett ? 'A direktált képlet nem léptethető – léptesd az összevetést, majd nyisd meg újra önállóan.'
      : k && !k.fajta && k.adat.tipus === 'persp' ? 'Planétaperspektíva nem léptethető – léptesd a radixot, majd nyisd újra.'
      : k && k.fajta === 'szin' ? 'Szinasztriánál nem léptethető – használja a képletléptetőt az egyes képleteken.'
      : k && lepettE(k) ? (progr ? '(léptetve)' : '(' + eltolasStr(k.eltolas) + ')') : '';
    Array.prototype.forEach.call(l.querySelectorAll('button[data-lep]'), function (b) {
      var i = +b.getAttribute('data-lep');
      b.disabled = !k || eng.indexOf(i) < 0;
      b.parentNode.hidden = !!k && eng.indexOf(i) < 0;
    });
    $('lepEredeti').disabled = !k;
    l.title = progr ? 'A külső kör (' + R.Idotech.NEV[k.fajta] + ') időpontját lépteti; a belső radix marad.' + (k.fajta === 'ph' ? ' Év = 1 nap, Hó = 2 óra.' : '')
      : 'Az aktív képlet időpontját lépteti (Ctrl+L: be/ki)';
  }
  /** A léptetőben használható mezők (a Windows-os fProgrLepteto szabályai) */
  function lepEngedett(k) {
    if (k && !k.fajta && (k.adat.tipus === 'persp' || k.rogzitett)) return [];
    if (!k || !k.fajta) return [0, 1, 2, 3, 4];
    if (k.fajta === 'ph') return [0, 1];
    if (k.fajta === 'pd' || k.fajta === 'sol') return [0];
    if (k.fajta === 'pdv') return [0, 1, 2];
    if (k.fajta === 'szin') return [];
    return [0, 1, 2, 3, 4];
  }
  /* lejátszás (aktuális égi állás): { k, idozito } */
  var jatek = null;
  function jatekAll() { if (!jatek) return; clearInterval(jatek.idozito); jatek = null; renderLepteto(); }
  function jatekIndit(k) {
    jatekAll();
    k.eltolas = [0, 0, 0, 0, 0];
    jatek = { k: k, idozito: setInterval(jatekLep, Math.max(1000, +beall.jatekIv || 2000)) };
    jatekLep();
  }
  function jatekLep() {
    if (!jatek) return;
    if (kepletek.indexOf(jatek.k) < 0) { jatekAll(); return; }
    if (document.hidden) return;              // háttérben lévő lapon nem számol
    aktualisMost(jatek.k);
    renderLepteto();
  }
  function lep(i, ir) {
    var k = akt(); if (!k) return;
    if (jatek && jatek.k === k) jatekAll();
    var m = Math.max(1, Math.min(999, Math.floor(+$('lepMertek').value) || 1));
    if (k.fajta) { progrLep(k, i, ir * m); return; }
    k.eltolas[i] += ir * m;
    k.adat = K.leptet(k.eredeti, k.eltolas);
    if (k.adat.ismeretlen && (i >= 3)) { k.adat.ismeretlen = false; k.adat.tipus = 'kos0'; }
    if (k.adat.ev < 1 || k.adat.ev > 2999) { k.eltolas[i] -= ir * m; k.adat = K.leptet(k.eredeti, k.eltolas); uzen('Az év 1 és 2999 között lehet.'); }
    k.valtozott = lepettE(k) || k.valtozott;
    utemezSzamol(k);
    renderLepteto(); renderStatusz(); renderCim();
  }
  /** Progresszióléptető: a külső kör léptetése */
  function progrLep(k, i, d) {
    var ks = k.kulso;
    if (lepEngedett(k).indexOf(i) < 0) return;
    if (k.fajta === 'pd') ks.pd += ks.konverz ? -d : d;
    else if (k.fajta === 'pdv') {
      var dt = ks.pdv.datum, n = new Date(Date.UTC(dt[0] + (i === 0 ? d : 0), dt[1] - 1 + (i === 1 ? d : 0), dt[2] + (i === 2 ? d : 0)));
      ks.pdv = JSON.parse(JSON.stringify(ks.pdv)); ks.pdv.datum = [n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate()];
    }
    else if (k.fajta === 'sol') {
      var ev = ks.sol.ev + d;
      if (ev < 1 || ev > 2998) { uzen('Az év 1 és 2998 között lehet.'); return; }
      ks.sol = { ev: ev, hely: ks.sol.hely };
    } else if (k.fajta === 'ph') {
      if (i === 0) ks.ph = { napok: ks.ph.napok + d, orak: ks.ph.orak };
      else ks.ph = { napok: ks.ph.napok, orak: ks.ph.orak + 2 * d };
    } else {
      ks.eltolas[i] += d;
      var u = K.leptet(ks.eredeti, ks.eltolas);
      if (u.ev < 1 || u.ev > 2999) { ks.eltolas[i] -= d; uzen('Az év 1 és 2999 között lehet.'); return; }
      ks.adat = u;
    }
    utemezSzamol(k, true);
    renderLepteto(); renderStatusz();
  }
  function lepEredeti() {
    var k = akt(); if (k && jatek && jatek.k === k) jatekAll();
    if (!k || !lepettE(k)) return;
    if (k.fajta) {
      var ks = k.kulso, a = JSON.parse(JSON.stringify(ks.alap || {}));
      ks.eltolas = [0, 0, 0, 0, 0]; ks.adat = ks.eredeti ? K.masol(ks.eredeti) : null;
      ks.ph = a.ph; ks.pd = a.pd; ks.sol = a.sol; ks.pdv = a.pdv;
      kulsoSzamol(k); render();
      return;
    }
    k.eltolas = [0, 0, 0, 0, 0]; k.adat = K.masol(k.eredeti);
    szamol(k); render();
  }

  /* ====================================================================== */
  /* Menü és eszköztár                                                       */
  /* ====================================================================== */
  function link(url) { return function () { window.open(url, '_blank', 'noopener'); }; }
  var TETT = {
    uj: ujKeplet, adatok: adatokSzerk, megnyit: megnyit,
    ment: function () { var k = akt(); if (k) ment(k, false); }, mentMaskent: function () { var k = akt(); if (k) ment(k, true); },
    bezar: function () { if (vanAkt()) bezar(aktiv); }, mindBezar: mindBezar,
    kep: kepMent, nyomtat: nyomtat,
    planetak: function () { tablaMutat('planetak'); }, hazak: function () { tablaMutat('hazak'); },
    fenyszogek: function () { tablaMutat('fenyszogek'); }, eletstrat: function () { tablaMutat('eletstrat'); },
    enallapotok: function () { tablaMutat('enallapotok'); }, egyeb: function () { tablaMutat('egyeb'); },
    lepteto: function () { lepNyitva = !lepNyitva; render(); if (lepNyitva) { var b = document.querySelector('#lepteto button[data-lep]'); if (b) b.focus(); } },
    kos0: kos0Keplet, aktualis: aktualisKeplet,
    enJel: function () { beall.kerek.selfMarkers = !beall.kerek.selfMarkers; beallMent(); render(); },
    szemely: function () {
      var k = akt(); if (!k || k.fajta) return;
      if (k.adat.tipus === 'aktualis') { uzen('Aktuális égi állásnál a személyiségrajz nem kapcsolható be.'); return; }
      k.szemely = !k.szemely; render();
    },
    enallPersp: enallapotPerspektiva,
    asztro: function () { beall.kerek.asztro = !beall.kerek.asztro; beallMent(); render(); },
    egbolt: function () { var k = akt(); if (k) egboltNyit(k); },
    suti: function () { if (R.Suti) R.Suti.beallit(); },
    naksatra: function () { beall.kerek.naksatra = !beall.kerek.naksatra; beallMent(); render(); },
    stilusRegio: function () { beall.kerek.stilus = 'regio'; beallMent(); render(); },
    stilusPlacidus: function () { beall.kerek.stilus = 'placidus'; beallMent(); render(); },
    // az ábra stílusa: Regiomontanus ↔ Placidus (később több stílusnál körbe)
    stilus: function () {
      var L = RegioKerek.STILUSOK.map(function (x) { return x[0]; }), i = L.indexOf(beall.kerek.stilus || 'regio');
      beall.kerek.stilus = L[(i + 1) % L.length]; beallMent(); render();
      uzen('Az ábra stílusa: ' + RegioKerek.STILUSOK[(i + 1) % L.length][1]);
    },
    aszteroidak: function () { beall.kerek.asteroids = !beall.kerek.asteroids; beallMent(); mindSzamol(); render(); },
    allo: function () {
      beall.allo.megj = !beall.allo.megj; beallMent(); mindSzamol(); render();
      if (beall.allo.megj && !beall.allo.ids.length) uzen('Nincs kijelölt állócsillag – Beállítások › Állócsillagok.');
    },
    alloTabla: function () {
      if (!beall.allo.megj) { uzen('Az állócsillagok fényszög-táblázata csak akkor érhető el, ha a megjelenítésük is be van kapcsolva!'); return; }
      tablaMutat('allo');
    },
    alloBeall: alloDlg, orbisok: orbDlg, szinek: szinDlg,
    inkognito: function () {
      beall.nyomtatas = beall.nyomtatas || {}; beall.nyomtatas.inkognito = !beall.nyomtatas.inkognito; beallMent(); render();
      uzen(inkognito() ? 'Személyes adatok elrejtve (születési idő, hely, életkor) – a képernyőn és a nyomtatásban.' : 'Személyes adatok megjelenítve.');
    },
    megjelenites: megjelenitesDlg, egyebek: egyebekDlg, gyari: gyariBeall,
    beallLetolt: beallLetolt, beallBetolt: beallBetolt,
    nevjegy: function () { $('nvSwe').textContent = se ? 'Swiss Ephemeris ' + se.version() + ' (WebAssembly)' : ''; $('dlgNevjegy').showModal(); },
    segitseg: link('https://www.regiomontanus.hu/'), facebook: link('https://www.facebook.com/regiomontanus.astrology'),
    iskola: link('https://humanisztikus.hu/'),
    olvaso: function () { olvasoValt(); }, olvasoBe: function () { if (!olvasoBe) olvasoValt(true); },
    szin: szinasztria, tranzit: tranzit, ph: progrHold, pd: primerDirekcio, pdValodi: valodiPrimer, sol: szolar, rev: revolucio, kulsoKulon: kulsoKulon,
    egymason: function () { megjelenitesMod('egymason'); }, egymasmellett: function () { megjelenitesMod('egymasmellett'); },
    pdDirekt: function () { beall.pdKonverz = false; beallMent(); }, pdKonverz: function () { beall.pdKonverz = true; beallMent(); },
    progrLepteto: function () { TETT.lepteto(); },
    oldalsav: function () { beall.oldalsav = beall.oldalsav === false; beallMent(); render(); },
    jj: function () { R.Kartyak.jj(akt()); }, sze: function () { R.Kartyak.sze(akt()); },
    kereses: function () { R.Kereses.nyit(); }, gyorsKeres: function () { R.Kereses.gyors(false); },
    mappaNyit: function () { R.Kereses.gyors(true); },
    kepValaszt: kepValaszt, kepTorol: kepTorol, csatDok: csatDok, csatUrl: csatUrl, csatTorol: csatTorol,
    jegyzet: function () { if (fk('jegyzet')) R.Jegyzet.nyit(akt(), 'A', 999); },
    mgjBe: function () { if (!fk('jegyzet')) return; var k = akt(); if (k && k.fajta) { uzen('Összevetés képletekhez nem lehet megjegyzést adni!'); return; } $('mgjInput').click(); },
    mgjKi: function () { if (!fk('jegyzet')) return; var k = akt(); if (k && !k.fajta) R.Jegyzet.mgjExport(k, k.fajlnev); },
    vissza: function () { nagyKerek(false); nezet = 'mozaik'; render(); }, nagyit: function () { if (vanAkt()) { nezet = 'reszlet'; render(); } },
    nagyKerekValt: function () { if (vanAkt()) { if (nezet !== 'reszlet') nezet = 'reszlet'; nagyKerek(!document.body.classList.contains('kerek-max')); render(); } },
    teljesKepernyo: function () { teljesKepernyo(); },
  };
  ['P', 'R', 'C', 'K', 'O', 'A'].forEach(function (h) {
    TETT['hsys' + h] = function () { if (beall.hsys !== h) { beall.hsys = h; beallMent(); mindSzamol(); render(); } };
  });
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (id) { TETT['persp' + id] = function () { perspektiva(id); }; });
  TETT.zodT = function () { if (beall.sid) { beall.sid = false; beallMent(); mindSzamol(); render(); } };
  TETT.zodS = function () { if (!beall.sid) { beall.sid = true; beallMent(); mindSzamol(); render(); } };

  var KELL_AKT = { egbolt: 1, adatok: 1, ment: 1, mentMaskent: 1, bezar: 1, kep: 1, nyomtat: 1, planetak: 1, hazak: 1, fenyszogek: 1,
    eletstrat: 1, enallapotok: 1, egyeb: 1, alloTabla: 1, kos0: 1, jegyzet: 1, mgjBe: 1, mgjKi: 1, kepValaszt: 1, kepTorol: 1, jj: 1, sze: 1, csatDok: 1, csatUrl: 1, csatTorol: 1, nagyit: 1, tranzit: 1, ph: 1, pd: 1, pdValodi: 1, sol: 1, rev: 1, kulsoKulon: 1, szemely: 1, enallPersp: 1, persp0: 1, persp1: 1, persp2: 1, persp3: 1, persp4: 1, persp5: 1, persp6: 1,
    persp7: 1, persp8: 1, persp9: 1, persp10: 1 };
  var ROGZ_TILT = /^(ment|mentMaskent|adatok|pd|pdValodi|ph|tranzit|sol|rev|szin|kos0|enallPersp|persp\d+|jj|sze|szemely)$/;
  function engedelyezett(t) {
    if (t === 'kulsoKulon' && !(akt() && akt().fajta)) return false;
    // rögzített (direktált) képletnek nincs saját születési időpontja: nem menthető, nem szerkeszthető, nem progresszálható
    if (akt() && akt().rogzitett && ROGZ_TILT.test(t)) return false;
    return engedelyezettAlap(t);
  }
  function engedelyezettAlap(t) { return !!TETT[t] && (!KELL_AKT[t] || vanAkt()) && (betoltve || ['nevjegy', 'suti', 'segitseg', 'facebook', 'iskola', 'megjelenites', 'egyebek', 'gyari', 'alloBeall', 'allo', 'inkognito', 'orbisok', 'szinek'].indexOf(t) >= 0 || t.indexOf('hsys') === 0 || t.indexOf('zod') === 0); }
  function vegrehajt(t) { if (engedelyezett(t)) TETT[t](); }

  function legutobbiMenu() {
    var l = S.legutobbi();
    if (!l.length) return [{ c: '(üres)', t: '' }];
    return l.map(function (x, i) {
      return { c: K.cim(x.adat) + (inkognito() ? '' : ' – ' + idoStr(x.adat)), fn: function () { legutobbiNyit(i); } };
    }).concat(['-', { c: 'Lista törlése', fn: function () { S.legutobbiTorol(); render(); } }]);
  }
  function tesztMenu() {
    return tesztek.map(function (t) { return { c: t.cim, fn: function () { tesztNyit(t); } }; });
  }

  var MENU = [
    { c: 'Fájl', l: [
      { c: 'Új képlet', b: 'Alt+N', t: 'uj' }, { c: 'Az aktuális képlet adatai', b: 'Ctrl+A', t: 'adatok' }, '-',
      { c: 'Megnyitás', b: 'Ctrl+O', t: 'megnyit' }, { c: 'Megnyitás könyvtárból...', t: 'mappaNyit' }, { c: 'Megnyitás névre kereséssel', t: 'gyorsKeres' },
      { c: 'Legutóbbi képletek', al: legutobbiMenu }, { c: 'Teszt-képletek', al: tesztMenu, lathato: function () { return tesztek.length > 0; } }, '-',
      { c: 'Mentés', b: 'Ctrl+S', t: 'ment' }, { c: 'Mentés másként', t: 'mentMaskent' }, { c: 'Bezár', b: 'Alt+W', t: 'bezar' },
      { c: 'Mind bezár', t: 'mindBezar' }, '-',
      { c: 'Jegyzet az aktuális képlethez', t: 'jegyzet', lathato: function () { return fk('jegyzet'); } },
      { c: 'Jegyzetek betöltése (.mgj)…', t: 'mgjBe', lathato: function () { return fk('jegyzet'); } },
      { c: 'Jegyzetek mentése a Windows-os programnak (.mgj)', t: 'mgjKi', lathato: function () { return fk('jegyzet'); } }, '-',
      { c: 'Horoszkóp mentése képként', t: 'kep' }, { c: 'Nyomtatás', b: 'Ctrl+P', t: 'nyomtat' }] },
    { c: 'Táblázatok', l: [
      { c: 'Planéták', b: 'Ctrl+B', t: 'planetak' }, { c: 'Házak', b: 'Ctrl+H', t: 'hazak' }, { c: 'Fényszögek', b: 'Ctrl+F', t: 'fenyszogek' },
      { c: 'Életstratégia, járatlan út', b: 'Ctrl+J', t: 'eletstrat' }, { c: 'Énállapotok', b: 'Ctrl+E', t: 'enallapotok' }, '-',
      { c: 'Állócsillagok', t: 'alloTabla' }, '-', { c: 'Egyéb információk', t: 'egyeb' }] },
    { c: 'Speciális', l: [
      { c: 'Képletléptető', b: 'Ctrl+L', t: 'lepteto', pipa: function () { return lepNyitva; } }, { c: 'Progresszióléptető', t: 'progrLepteto', pipa: function () { return lepNyitva && !!(akt() && akt().fajta); } }, '-',
      { c: 'Planéta az Ascendensen', al: function () {
        return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (id) { return { c: R.nev(id) + '-perspektíva', t: 'persp' + id }; })
          .concat(['-', { c: 'Drakonikus-perspektíva', t: 'persp10' }, '-', { c: 'Énállapotok perspektívája', t: 'enallPersp' }]);
      } }, { c: 'Kos 0° képlet', t: 'kos0' }, '-',
      // az ábra körüli rétegek és a kinézet (az eszköztárról ide kerültek – Balázs kérése, 2026-10-25)
      { c: 'Az ábra megjelenítése', al: function () {
        var st = beall.kerek.stilus || 'regio';
        return [{ c: 'Asztroszkóp (csillagképek az ábra körül)', t: 'asztro', pipa: function () { return !!beall.kerek.asztro; } },
          { c: 'Naksatrák (27 holdház) az ábra körül', t: 'naksatra', pipa: function () { return !!beall.kerek.naksatra; } }, '-',
          { c: 'Regiomontanus-stílus', t: 'stilusRegio', radio: true, pipa: function () { return st === 'regio'; } },
          { c: 'Placidus-stílus', t: 'stilusPlacidus', radio: true, pipa: function () { return st === 'placidus'; } }];
      } },
      { c: 'Égbolt-nézet (3D)…', t: 'egbolt' }, '-',
      { c: 'Horoszkópolvasó aktiválása', b: 'Ctrl+Q', t: 'olvasoBe', pipa: function () { return olvasoBe; } }, '-', { c: 'Aktuális égi állások', t: 'aktualis' }, '-', { c: 'Keresés', t: 'kereses' }] },
    { c: 'Progressziók', l: [
      { c: 'Primer (1° = 1 év) direkciók', t: 'pd' }, { c: 'Primer direkciók (valódi)...', t: 'pdValodi' }, { c: 'Progressziós Hold', t: 'ph' }, { c: 'Tranzitok', t: 'tranzit' }, '-',
      { c: 'Szolár-képlet', t: 'sol' }, '-', { c: 'Revolúciók...', t: 'rev' }] },
    { c: 'Összevetés', l: [{ c: 'Összevetés (Szinasztria)', t: 'szin' },
      { c: 'Képletek megjelenítése...', al: function () {
        var m = akt() && akt().fajta ? akt().mod : (beall.osszevetesMod || 'egymason');
        return [{ c: '... egymáson', t: 'egymason', radio: true, pipa: function () { return m === 'egymason'; } },
          { c: '... egymás mellett', t: 'egymasmellett', radio: true, pipa: function () { return m === 'egymasmellett'; } }];
      } }, '-', { c: kulsoKulonCim, t: 'kulsoKulon' }] },
    { c: 'Beállítások', l: [
      { c: 'Megjelenítés', t: 'megjelenites' }, { c: 'Állócsillagok', t: 'alloBeall' }, { c: 'Egyebek', t: 'egyebek' }, { c: 'Fényszög orbisok', t: 'orbisok' }, { c: 'Színek és szimbólumok', t: 'szinek' },
      { c: 'Házrendszer', al: function () {
        return ['P', 'R', 'C', 'K', 'O', 'A'].map(function (h) { return { c: R.HAZRENDSZER[h], t: 'hsys' + h, radio: true, pipa: function () { return beall.hsys === h; } }; });
      } },
      { c: 'Zodiákus', al: function () {
        return [{ c: 'Sziderikus', t: 'zodS', radio: true, pipa: function () { return beall.sid; } },
          { c: 'Tropikus', t: 'zodT', radio: true, pipa: function () { return !beall.sid; } }];
      } },
      { c: 'Primer (1° = 1 év) direkció iránya', al: function () {
        return [{ c: 'Direkt', t: 'pdDirekt', radio: true, pipa: function () { return !beall.pdKonverz; } },
          { c: 'Konverz', t: 'pdKonverz', radio: true, pipa: function () { return !!beall.pdKonverz; } }];
      } }, '-', { c: 'Születési képletek importálása', f: 5 }, '-',
      { c: 'Település adatok szerkesztése', f: 5 }, '-',
      { c: 'Betöltés fájlból', t: 'beallBetolt' }, { c: 'Mentés fájlba', t: 'beallLetolt' }, '-',
      { c: 'Alapértelmezések visszatöltése', t: 'gyari' }] },
    { c: 'Információk', l: [
      { c: 'Segítség a program használatához', t: 'segitseg' }, { c: 'Tippek és trükkök', f: 5 }, '-',
      { c: 'Regiomontanus a Facebookon', t: 'facebook' }, { c: 'Humanisztikus Asztrológia Iskola', t: 'iskola' }, '-',
      { c: 'Adatvédelem és sütik…', t: 'suti', lathato: function () { return !!(R.Suti && R.Suti.van); } }, '-',
      { c: 'Névjegy', t: 'nevjegy' }] },
    { c: 'Kiegészítések', l: [{ c: 'Jegyek és játszmák', t: 'jj' }, { c: 'Születési értesítő', t: 'sze' }] }
  ];

  /* Eszköztár – a Windows-os ikonsor sorrendjében. [cím, ikon, tett | fázis, lenyomva?] */
  var ESZKOZ = [
    ['Új képlet (Alt+N)', 'M6 3h8l4 4v14H6zM12 11v6M9 14h6', 'uj'],
    ['Az aktuális képlet adatai (Ctrl+A)', 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5', 'adatok'], 0,
    ['Megnyitás (Ctrl+O)', 'M3 7h6l2 2h10v10H3z', 'megnyit'],
    ['Mentés (Ctrl+S)', 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', 'ment'],
    ['Mind bezár', 'M4 7h12v13H4zM8 4h12v12M7 11l6 6M13 11l-6 6', 'mindBezar'], 0,
    ['Horoszkóp mentése képként', 'M3 6h18v13H3zM6 16l4-4 3 3 3-3 3 3', 'kep'],
    ['Nyomtatás (Ctrl+P)', 'M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z', 'nyomtat'], 0,
    ['Planéták (Ctrl+B)', 'M17 12a5 5 0 1 1-10 0a5 5 0 1 1 10 0M2.13 15.59A10.5 3.4 -20 0 0 21.87 8.41M2.13 15.59A10.5 3.4 -20 0 1 6.08 11.02M21.87 8.41A10.5 3.4 -20 0 0 15.9 7.44', 'planetak'],
    ['Házak (Ctrl+H)', 'M3 11.5L12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20', 'hazak'],
    ['Fényszögek (Ctrl+F)', 'M12 2v2M10.4 5.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0M11.3 7.1L6.5 20.5M12.7 7.1l4.8 13.4M6.5 20.5l-.6 1.3M17.5 20.5l.6 1.3', 'fenyszogek'],
    ['Életstratégia, járatlan út (Ctrl+J)', 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16', 'eletstrat'],
    ['Énállapotok – be/ki (személyiségrajz)', 'M5 4l14 8-14 8z', 'szemely', function () { return !!(akt() && akt().szemely); }],
    ['Személyes adatok elrejtése – be/ki', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6', 'inkognito', inkognito],
    ['Állócsillagok – be/ki', 'M9 3.8L10.64 7.74L14.9 8.08L11.65 10.86L12.64 15.02L9 12.79L5.36 15.02L6.35 10.86L3.1 8.08L7.36 7.74ZM18.2 2.3L19.05 4.34L21.24 4.51L19.57 5.94L20.08 8.09L18.2 6.94L16.32 8.09L16.83 5.94L15.16 4.51L17.35 4.34ZM17.5 13.2L18.51 15.62L21.11 15.83L19.13 17.53L19.73 20.07L17.5 18.71L15.27 20.07L15.87 17.53L13.89 15.83L16.49 15.62Z', 'allo', function () { return !!beall.allo.megj; }],
    ['Chiron és a kisbolygók – be/ki', 'M12 3v6.5M4.5 13h5L12 10.5l2.5 2.5h5M6 16l6 5 6-5', 'aszteroidak', function () { return beall.kerek.asteroids; }],
    ['Aktuális égi állás', 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18M12 7v5l3.5 2', 'aktualis'],
    ['Planéta az Ascendensen – perspektívák (legördülő)', 'M12 3L4 16.9A16 16 0 0 0 20 16.9ZM6.4 15.4A13 13 0 0 0 17.6 15.4M12 3l2.4 16.2M13.4 6.2h5.2v2.4h-5.2z', 'enallPersp', null, perspLista],
    ['Kos 0° képlet', 'M12 21V10a5 5 0 0 0-9-3M12 10a5 5 0 0 1 9-3', 'kos0'], 0,
    ['Összevetés (szinasztria)', 'M9 6a6 6 0 1 0 .01 0M15 6a6 6 0 1 0 .01 0', 'szin'], 0,
    ['Primer (1° = 1 év) direkciók', 'M12 3v18M9 21h6M12 5h6.5l2.2 2.5-2.2 2.5H12M12 12.5H5.5l-2.2 2.5 2.2 2.5H12', 'pd'],
    ['Progressziós Hold', 'M15 3a9 9 0 1 0 6 15A7 7 0 0 1 15 3z', 'ph'],
    ['Tranzitok', 'M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2', 'tranzit'], 0,
    ['Szolár-képlet', 'M12 8a4 4 0 1 0 .01 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2', 'sol'], 0,
    ['Revolúciók…', 'M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 16.8h.01M12 16.8h.01', 'rev'], 0,
    ['Képletléptető (Ctrl+L)', 'M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4', 'lepteto', function () { return lepNyitva; }],
    ['Progresszióléptető', 'M4 18l6-6-6-6M12 18l6-6-6-6', 'progrLepteto', function () { return lepNyitva && !!(akt() && akt().fajta); }], 0,
    ['Segítség a program használatához', 'M12 3a9 9 0 1 0 .01 0M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 17h.01', 'segitseg'], 0,
    ['Humanisztikus Asztrológia Iskola', 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5', 'iskola'], 0,
    ['Jegyek és játszmák', 'M3 8.5h8.5v8.5H3zM12.5 5.5H21V14h-8.5zM4.70 10.80a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0M6.65 12.75a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0M8.60 14.70a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0M14.20 7.80a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0M18.10 7.80a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0M14.20 11.70a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0M18.10 11.70a.6 .6 0 1 0 1.2 0a.6 .6 0 1 0-1.2 0', 'jj'],
    ['Születési értesítő', 'M12 2.8a3 3 0 1 1 0 6a3 3 0 1 1 0-6M8.5 10.5h7c1 0 1.5.8 1.5 1.8V17a5 5 0 0 1-10 0v-4.7c0-1 .5-1.8 1.5-1.8zM7 14.5l10-2M7.4 18.4l9.2-2.6', 'sze'], 0,
    ['Horoszkópolvasó – be/ki (Ctrl+Q)', 'M4 5h16v11H9l-5 4z', 'olvaso', function () { return olvasoBe; }], 0,
    ['Keresés a képletek közt', 'M10 4a6 6 0 1 0 .01 0M15 15l6 6', 'kereses'],
    ['Megnyitás névre kereséssel', 'M4 6h10M4 12h7M4 18h7M17 11a3 3 0 1 0 .01 0M19.5 15.5L22 18', 'gyorsKeres']
  ];
  function eszkoztarEpit() {
    var jobb = $('ikonok').querySelector('.jobb');   // az áthelyezett „Megnyitott képletek / Elrendezés” megmarad
    if (jobb) document.querySelector('.fosor').appendChild(jobb);
    $('ikonok').innerHTML = ESZKOZ.map(function (e, i) {
      if (e === 0) return '<span class="sep" aria-hidden="true"></span>';
      var fz = typeof e[2] === 'number', cim = e[0] + (fz ? ' – ' + FAZIS[e[2]] : '');
      return '<button type="button" class="ikon' + (e[4] ? ' legordulo' : '') + '" data-eszk="' + i + '" aria-label="' + R.esc(cim) + '" title="' + R.esc(cim) + '"' +
        (e[3] ? ' aria-pressed="false"' : '') + (e[4] ? ' aria-haspopup="true" aria-expanded="false"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + e[1] + '"/></svg></button>';
    }).join('');
    if (jobb) jobbAthelyez();
  }
  function renderEszkoztar() {
    Array.prototype.forEach.call($('ikonok').querySelectorAll('button[data-eszk]'), function (b) {
      var e = ESZKOZ[+b.getAttribute('data-eszk')];
      b.disabled = typeof e[2] === 'number' || !engedelyezett(e[2]);
      if (e[3]) b.setAttribute('aria-pressed', String(!!e[3]()));
    });
  }

  /* ---------- legördülő menük ---------- */
  var nyitottMenu = null;
  function menuEpit() {
    $('menusor').innerHTML = MENU.map(function (m, i) {
      return '<div class="mf" data-m="' + i + '"><button type="button" aria-haspopup="true" aria-expanded="false">' + m.c + '</button></div>';
    }).join('');
  }
  function menuLista(l) {
    var ul = document.createElement('ul');
    ul.className = 'menu'; ul.setAttribute('role', 'menu');
    l.forEach(function (x) {
      var li = document.createElement('li');
      if (x === '-') {
        // rejtett menüpontok után ne legyen dupla (vagy kezdő) elválasztó
        if (!ul.lastChild || ul.lastChild.className === 'sep') return;
        li.className = 'sep'; li.setAttribute('role', 'separator'); ul.appendChild(li); return; }
      if (x.lathato && !x.lathato()) return;
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', x.radio ? 'menuitemradio' : x.pipa ? 'menuitemcheckbox' : 'menuitem');
      var pipa = x.pipa ? x.pipa() : false;
      if (x.pipa) b.setAttribute('aria-checked', String(pipa));
      if (typeof x.t === 'string') b.setAttribute('data-t', x.t);
      b.innerHTML = '<span class="pipa" aria-hidden="true">' + (pipa ? (x.radio ? '•' : '✓') : '') + '</span><span>' + R.esc(typeof x.c === 'function' ? x.c() : x.c) + '</span>' +
        (x.b ? '<span class="bill">' + x.b + '</span>' : '') + (x.al ? '<span class="nyil" aria-hidden="true">▸</span>' : '') +
        (x.f ? '<span class="fazis">' + FAZIS[x.f] + '</span>' : '');
      if (x.f || (x.t !== undefined && !x.fn && !x.al && (!x.t || !engedelyezett(x.t)))) b.disabled = true;
      if (x.al) {
        b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
        b.addEventListener('click', function (ev) { ev.stopPropagation(); alMenuNyit(li, x); });
        b.addEventListener('mouseenter', function () { alMenuNyit(li, x); });
      } else {
        b.addEventListener('mouseenter', function () { alMenuZar(ul); });
        b.addEventListener('click', function () {
          menuZar();
          if (x.fn) x.fn(); else if (x.t) vegrehajt(x.t);
        });
      }
      li.appendChild(b); ul.appendChild(li);
    });
    ul.addEventListener('keydown', menuBill);
    return ul;
  }
  function alMenuZar(ul) {
    Array.prototype.forEach.call(ul.querySelectorAll(':scope > li.nyitva'), function (li) {
      li.classList.remove('nyitva'); var s = li.querySelector('.menu'); if (s) li.removeChild(s);
      li.firstChild.setAttribute('aria-expanded', 'false');
    });
  }
  function alMenuNyit(li, x, fokusz) {
    if (li.classList.contains('nyitva')) { if (fokusz) { var f = li.querySelector('.menu button:not(:disabled)'); if (f) f.focus(); } return; }
    alMenuZar(li.parentNode);
    var s = menuLista(x.al());
    li.appendChild(s); li.classList.add('nyitva'); li.firstChild.setAttribute('aria-expanded', 'true');
    if (fokusz) { var b = s.querySelector('button:not(:disabled)'); if (b) b.focus(); }
  }
  function menuNyit(i, fokusz) {
    menuZar();
    var mf = $('menusor').querySelector('[data-m="' + i + '"]');
    var ul = menuLista(MENU[i].l);
    mf.appendChild(ul); mf.classList.add('nyitva'); mf.firstChild.setAttribute('aria-expanded', 'true');
    nyitottMenu = i;
    if (fokusz) { var b = ul.querySelector('button:not(:disabled)') || ul.querySelector('button'); if (b) b.focus(); }
  }
  /** az eszköztár legördülő gombjának menüje (pl. Planéta az Ascendensen) – a főmenük elemeivel azonos */
  var eszkMenu = null;
  function eszkMenuZar() {
    if (!eszkMenu) return;
    if (eszkMenu.parentNode) eszkMenu.parentNode.removeChild(eszkMenu);
    eszkMenu._gomb.setAttribute('aria-expanded', 'false'); eszkMenu = null;
  }
  function eszkMenuNyit(gomb, lista) {
    var volt = eszkMenu && eszkMenu._gomb === gomb;
    menuZar(); eszkMenuZar();
    if (volt) return;
    var ul = menuLista(lista), r = gomb.getBoundingClientRect();
    ul.classList.add('eszk-menu'); ul._gomb = gomb;
    ul.style.left = Math.max(4, Math.min(r.left, innerWidth - 274)) + 'px'; ul.style.top = (r.bottom + 2) + 'px';
    document.body.appendChild(ul); eszkMenu = ul; gomb.setAttribute('aria-expanded', 'true');
    var f = ul.querySelector('button:not(:disabled)'); if (f) f.focus();
  }
  /** a perspektívák listája (eszköztár: „Planéta az Ascendensen”) */
  function perspLista() {
    return [{ c: 'Mindegyik énállapot-planéta (énállapotok perspektívája)', t: 'enallPersp' }, '-']
      .concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (id) { return { c: R.nev(id) + '-perspektíva', t: 'persp' + id }; }))
      .concat(['-', { c: 'Drakonikus-perspektíva', t: 'persp10' }]);
  }
  function menuZar() {
    eszkMenuZar();
    if (nyitottMenu === null) return;
    var mf = $('menusor').querySelector('[data-m="' + nyitottMenu + '"]');
    var ul = mf.querySelector('.menu'); if (ul) mf.removeChild(ul);
    mf.classList.remove('nyitva'); mf.firstChild.setAttribute('aria-expanded', 'false');
    nyitottMenu = null;
  }
  function menuBill(e) {
    var ul = e.currentTarget, gombok = Array.prototype.filter.call(ul.querySelectorAll(':scope > li > button'), function (b) { return !b.disabled; });
    var i = gombok.indexOf(document.activeElement);
    if (i < 0 && !ul.contains(document.activeElement)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (!gombok.length) return;
      i = e.key === 'ArrowDown' ? (i + 1) % gombok.length : (i - 1 + gombok.length) % gombok.length;
      gombok[i].focus();
    } else if (e.key === 'ArrowRight') {
      if (i >= 0 && gombok[i].getAttribute('aria-haspopup')) { e.preventDefault(); e.stopPropagation(); gombok[i].click(); var s = gombok[i].parentNode.querySelector('.menu button:not(:disabled)'); if (s) s.focus(); }
      else if (!ul.parentNode.closest('.menu') && nyitottMenu !== null) { e.preventDefault(); e.stopPropagation(); menuNyit((nyitottMenu + 1) % MENU.length, true); }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopPropagation();
      var szulo = ul.parentNode;
      if (szulo.closest('.menu')) { var gb = szulo.firstChild; alMenuZar(szulo.parentNode); gb.focus(); }
      else if (nyitottMenu !== null) menuNyit((nyitottMenu - 1 + MENU.length) % MENU.length, true);
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      var sz = ul.parentNode;
      if (sz.closest('.menu')) { var g = sz.firstChild; alMenuZar(sz.parentNode); g.focus(); }
      else if (eszkMenu && eszkMenu === ul) { var eg = eszkMenu._gomb; eszkMenuZar(); eg.focus(); }
      else { var m = nyitottMenu; menuZar(); $('menusor').querySelector('[data-m="' + m + '"] > button').focus(); }
    } else if (e.key === 'Tab') { menuZar(); }
  }

  /* ====================================================================== */
  /* Műveletek                                                               */
  /* ====================================================================== */
  function alapAdat() {
    var a = K.ures(), h = beall.alapHely;
    a.telepules = h.telepules; a.telepulesKijelzes = h.telepulesKijelzes || ''; a.orszag = h.orszag; a.orszagKod = h.orszagKod; a.lat = h.lat; a.lon = h.lon; a.tz = h.tz;
    a.zonaMod = h.tz ? 'iana' : 'lmt';
    var n = new Date(); a.ev = n.getFullYear(); a.ho = n.getMonth() + 1; a.nap = n.getDate(); a.ora = n.getHours(); a.perc = n.getMinutes(); a.mp = 0;
    return a;
  }
  function ujKeplet() {
    var a = alapAdat(); a.nev = '';
    R.Adatlap.megnyit(a, 'Új születési képlet').then(function (u) { if (u) hozzaad(u, null); });
  }
  function adatokSzerk() {
    var k = akt(); if (!k) return;
    R.Adatlap.megnyit(k.adat, 'Születési képlet adatai – ' + K.cim(k.adat)).then(function (u) {
      if (!u) return;
      if (u.tipus === 'aktualis') u.tipus = 'radix'; // szerkesztve már nem frissül automatikusan
      k.eredeti = u; k.adat = K.masol(u); k.eltolas = [0, 0, 0, 0, 0]; k.valtozott = true;
      szamol(k); render();
    });
  }
  function kos0Keplet() {
    var k = akt(); if (!k) return;
    var a = K.masol(k.adat);
    a.tipus = 'kos0'; a.nev = K.cim(a); delete a.eredeti;
    hozzaad(a, null).valtozott = false;
    render();
  }
  function aktualisAdat() {
    var a = alapAdat(); a.nev = 'Aktuális égi állás'; a.tipus = 'aktualis';
    if (a.zonaMod === 'iana') {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: a.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = +x.value; });
      a.ev = p.year; a.ho = p.month; a.nap = p.day; a.ora = p.hour; a.perc = p.minute; a.mp = p.second;
    }
    return a;
  }
  function aktualisKeplet() { hozzaad(aktualisAdat(), null).valtozott = false; render(); }
  function aktualisFrissit() {
    if (!beall.aktualisFrissit) return;
    kepletek.forEach(function (k) {
      if (k.adat.tipus !== 'aktualis' || lepettE(k) || (jatek && jatek.k === k)) return;
      aktualisMost(k);
    });
  }
  /** az aktuális égi állás képletét a mostani időpontra állítja (a helye és zónája marad) és újraszámolja */
  function aktualisMost(k) {
    var u = aktualisAdat(); u.telepules = k.adat.telepules; u.telepulesKijelzes = k.adat.telepulesKijelzes || ''; u.orszag = k.adat.orszag; u.orszagKod = k.adat.orszagKod;
    u.lat = k.adat.lat; u.lon = k.adat.lon; u.tz = k.adat.tz; u.zonaMod = k.adat.zonaMod; u.eltolas = k.adat.eltolas;
    if (u.zonaMod !== 'iana') { var d = new Date(Date.now() + K.zona(u).orak * 3600000);
      u.ev = d.getUTCFullYear(); u.ho = d.getUTCMonth() + 1; u.nap = d.getUTCDate(); u.ora = d.getUTCHours(); u.perc = d.getUTCMinutes(); u.mp = d.getUTCSeconds(); }
    k.eredeti = u; k.adat = K.masol(u); szamol(k);
  }
  /* ---------- Progressziók ---------- */
  /** Az aktív képlet, ha egyszerű (nem összevetés) – a progressziók ehhez készülnek */
  function radixAkt() {
    var k = akt();
    if (!k) return null;
    if (!k.e) { uzen('A képlet még nem készült el.'); return null; }
    return k;
  }
  function belsoAdat(k) { var a = K.masol(k.adat); delete a.eredeti; return a; }
  function tranzit() {
    var k = radixAkt(); if (!k) return;
    R.helyZonaval(k.fajta ? k.kulso.adat || k.adat : k.adat).then(function (hely) {
      var a = belsoAdat(k), n = new Date();
      a.nev = R.Idotech.ELOTAG.tranzit + ' ' + K.cim(k.adat); a.tipus = 'radix'; a.ismeretlen = false; a.jegyzet = ''; a.cimkek = []; a.megjegyzesek = {}; a.kepAdat = ''; a.kepFajl = ''; a.csatolmanyok = [];
      a.telepules = hely.telepules; a.telepulesKijelzes = hely.telepulesKijelzes; a.tz = hely.tz;
      if (hely.tz) {
        a.zonaMod = 'iana';
        var p = {};
        new Intl.DateTimeFormat('en-US', { timeZone: hely.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(n).forEach(function (x) { p[x.type] = +x.value; });
        a.ev = p.year; a.ho = p.month; a.nap = p.day; a.ora = p.hour; a.perc = p.minute; a.mp = 0;
      } else {
        var d = new Date(n.getTime() + K.zona(a).orak * 3600000);
        a.ev = d.getUTCFullYear(); a.ho = d.getUTCMonth() + 1; a.nap = d.getUTCDate(); a.ora = d.getUTCHours(); a.perc = d.getUTCMinutes(); a.mp = 0;
      }
      return R.Adatlap.megnyit(a, 'Progresszió beállítások - Tranzit');
    }).then(function (u) {
      if (!u) return;
      u.tipus = 'radix';
      osszevetesHozzaad(belsoAdat(k), 'tranzit', u);
    });
  }
  function progrHold() {
    var k = radixAkt(); if (!k) return;
    R.Progr.ph(k.adat).then(function (x) {
      if (!x) return;
      osszevetesHozzaad(belsoAdat(k), 'ph', null, { ph: { napok: x.napok, orak: x.orak } });
    });
  }
  function primerDirekcio() {
    var k = radixAkt(); if (!k) return;
    R.Progr.pd(k.adat, !!beall.pdKonverz).then(function (x) {
      if (!x) return;
      osszevetesHozzaad(belsoAdat(k), 'pd', null, { pd: x.n, konverz: !!beall.pdKonverz });
    });
  }
  /** a Nap rektaszcenziója / hossza a születés után t nappal (a napív-kulcsokhoz; 1 nap = 1 év) */
  function napFv(e) {
    var flag = sweFlag(), cache = {};
    function x(t) { return cache[t] || (cache[t] = se.calcUt(e.jd + t, 0, flag)); }
    return { napRa: function (t) { var y = x(t); return R.Primer.egyenlitoi(y.lon, y.lat || 0, e.eps).ra; }, napLon: function (t) { return x(t).lon; } };
  }
  /** Valódi primer direkciók (Placidus-félív): eseménylista a radixra (js/primer.js, app/progr.js) */
  function valodiPrimer() {
    var k = radixAkt(); if (!k) return;
    if (k.fajta) { uzen('A primer direkciók egy születési képletre számolhatók – válaszd ki a radixot.'); return; }
    if (R.Keplet.kos0e(k.adat) || k.e.hz.persp !== undefined) { uzen('Ismeretlen születési időnél, Kos 0° és perspektíva-képletnél a primer direkció nem értelmezhető.'); return; }
    var e = k.e, ctx = napFv(e);
    R.Progr.valodiPrimer({ e: e, adat: k.adat, cim: K.cim(k.adat) }, beall.primer, ctx, beallMent, function (datum) {
      var o = beall.primer;
      osszevetesHozzaad(belsoAdat(k), 'pdv', null, { mod: 'egymasmellett',
        pdv: { datum: datum, kulcs: o.kulcs, egyeni: o.egyeni, konverz: o.irany === 'konverz' } });
    });
  }
  /** A direkciós képlet (figura directionis) egy összevetés-csempe külső köréhez: ARMC ± ív, a beállított házrendszerrel */
  function pdvKeplet(k) {
    var e = k.e, ks = k.kulso, x = ks.pdv, ctx = napFv(e);
    var kulcs = R.Primer.kulcs(x.kulcs, { napRa: ctx.napRa, napLon: ctx.napLon, egyeni: x.egyeni });
    var ms = Date.UTC(x.datum[0], x.datum[1] - 1, x.datum[2], 12), szul = Date.UTC(e.ut.year, e.ut.month - 1, e.ut.day) + e.ut.hour * 3600000;
    var kor = Math.max(0, (ms - szul) / (365.2422 * 86400000)), iv = kulcs.iv(kor);
    // a házak swe_houses_armc-vel; a radix ARMC-jén mért eltérés (pl. sziderikus zodiákus) levonva
    var hsys = beall.hsys, h0 = se.housesArmc(e.hz.armc, k.adat.lat, e.eps, hsys), elt = h0.mc - e.hz.mc;
    var hazak = function (armc) {
      var h = se.housesArmc(armc, k.adat.lat, e.eps, hsys), n = function (v) { v = (v - elt) % 360; return v < 0 ? v + 360 : v; };
      h.cusps = h.cusps.map(function (c, i) { return i === 0 ? c : n(c); });
      ['asc', 'mc', 'vertex', 'equAsc', 'coAscKoch', 'coAscMunkasey', 'polarAsc'].forEach(function (t) { h[t] = n(h[t]); });
      return h;
    };
    var d = R.Primer.direktalt({ armc: e.hz.armc, eps: e.eps, phi: k.adat.lat, poz: e.poz }, iv, !!x.konverz, hazak);
    ks.pdvInfo = { kor: kor, iv: iv };
    var u = {}, kk; for (kk in e) u[kk] = e[kk];
    u.poz = d.poz; u.hz = d.hz; u.elemzes = null; u.elemPl = {}; u.pdv = { kor: kor, iv: iv };
    return u;
  }
  function szolar() {
    var k = radixAkt(); if (!k) return;
    R.helyZonaval(k.adat).then(function (hely) {
      return R.Progr.szolar(se, k.adat, k.e.poz[0].lon, sweFlag(), hely);
    }).then(function (x) {
      if (!x) return;
      osszevetesHozzaad(belsoAdat(k), 'sol', null, { sol: { ev: x.ev, hely: x.hely } });
    });
  }
  function revolucio() {
    var k = radixAkt(); if (!k) return;
    R.helyZonaval(k.adat).then(function (hely) {
      return R.Progr.rev(se, k.adat, k.e, sweFlag(), hely);
    }).then(function (x) {
      if (!x) return;
      x.talalatok.forEach(function (t) {
        var a = t.adat;
        a.nev = 'Rev> ' + R.nev(t.pl) + ' (' + R.datumStr(a.ev, a.ho, a.nap) + '.) ' + K.cim(k.adat);
        a.tipus = 'radix';
        if (x.osszevetes) osszevetesHozzaad(belsoAdat(k), 'rev', a, { rev: { pl: t.pl } });
        else hozzaad(a, null).valtozott = true;
      });
    });
  }
  /** Planéta-perspektíva (Specialis_PlanetaPerspektiva): új képlet, a planéta az ASC-n, egyenlő házak */
  function perspektiva(id, k) {
    k = k || radixAkt(); if (!k) return null;
    var a = belsoAdat(k), alap = K.masol(a);
    if (alap.tipus === 'persp' || alap.tipus === 'kos0') alap.nev = K.cim(alap);
    a.tipus = 'persp'; a.perspId = id; a.nev = K.perspCim(alap, id);
    var u = hozzaad(a, null); u.valtozott = false;
    return u;
  }
  /** Énállapotok perspektívája: minden énjelölő planétára egy perspektíva; az eredeti képlet marad aktív */
  function enallapotPerspektiva() {
    var k = radixAkt(); if (!k) return;
    if (!k.e.elemzes) { uzen('A képlet-elemzés (énjelölők) most nem érhető el.'); return; }
    var i0 = kepletek.indexOf(k), db = 0;
    k.e.elemzes.selfMarkers.forEach(function (m) { if (m.type === 'P' && m.id <= 9) { perspektiva(m.id, k); db++; } });
    if (!db) uzen('Ennek a képletnek nincs énjelölő planétája.');
    aktiv = i0; render();
  }
  /** Összevetés (szinasztria): két megnyitott képlet, mindkét irányban (Specialis_Osszevetes) */
  function szinasztria() {
    var lista = [];
    kepletek.forEach(function (k, i) { if (!k.fajta) lista.push({ i: i, cim: K.cim(k.adat) }); });
    if (lista.length < 2) { uzen('Nincs elegendő képlet megnyitva az Összevetés funkció indításához!'); return; }
    var elso = 0;
    lista.forEach(function (x, n) { if (x.i === aktiv) elso = n; });
    R.Progr.szin(lista, elso).then(function (x) {
      if (!x) return;
      var A = kepletek[x.a], B = kepletek[x.b];
      osszevetesHozzaad(belsoAdat(A), 'szin', belsoAdat(B), { mod: 'egymason' });
      osszevetesHozzaad(belsoAdat(B), 'szin', belsoAdat(A), { mod: 'egymason' });
      // „Csak az összevetés képlet” kikapcsolva: egymás mellett is (Kepletek_Osszevetese(…, ovetEgymasMellett, …))
      if (!beall.kerek.csakOssz) { osszevetesHozzaad(belsoAdat(A), 'szin', belsoAdat(B), { mod: 'egymasmellett' }); aktiv = kepletek.length - 3; }
      else aktiv = kepletek.length - 2;
      render();
    });
  }
  /** A külső kör megnyitása önálló képletként (a Windows-os program ezt is megnyitja) */
  function kulsoKulon() {
    var k = akt(); if (!k || !k.fajta) return;
    if (k.fajta === 'pd' || k.fajta === 'pdv') {
      // a direktált képletnek nincs saját időpontja: rögzített képletként nyílik (a radix adataival, a direktált pozíciókkal)
      var ks = k.kulso; if (!ks.e) { uzen('A direktált képlet még nem készült el.'); return; }
      var mikor = k.fajta === 'pd' ? (k.adat.ev + (ks.konverz ? -ks.pd : ks.pd)) + '. év'
        : R.datumStr(ks.pdv.datum[0], ks.pdv.datum[1], ks.pdv.datum[2]);
      var a = belsoAdat(k); a.nev = kulsoNev(k) + ' (' + mikor + ')'; a.tipus = 'radix';
      var u = ujKepletObj(a, null);
      u.valtozott = false;
      u.rogzitett = { tipus: k.fajta === 'pd' ? 'Primer (1° = 1 év) direkció – ' + mikor : 'Primer direkció – ' + mikor,
        poz: JSON.parse(JSON.stringify(ks.e.poz)), hz: JSON.parse(JSON.stringify(ks.e.hz)) };
      kepletek.push(u); aktiv = kepletek.length - 1; szamol(u); render();
      return;
    }
    if (!k.kulso.adat) return;
    var a2 = K.masol(k.kulso.adat); a2.nev = kulsoNev(k); a2.tipus = 'radix';
    hozzaad(a2, null);
  }
  /** az Összevetés menüpont felirata az aktív összevetés fajtája szerint */
  function kulsoKulonCim() {
    var k = akt(), f = k && k.fajta;
    return f === 'ph' ? 'A progressziós képlet önálló képletként'
      : f === 'tranzit' ? 'A tranzit-képlet önálló képletként'
      : f === 'pd' ? 'A primer (1° = 1 év) direkciós képlet önálló képletként'
      : f === 'pdv' ? 'A direkciós képlet önálló képletként'
      : f === 'sol' ? 'A szolár-képlet önálló képletként'
      : f === 'rev' ? 'A revolúciós képlet önálló képletként'
      : f === 'szin' ? 'A külső kör (' + (kulsoNev(k) || 'szinasztria') + ') önálló képletként'
      : 'A külső kör önálló képletként';
  }
  function megjelenitesMod(m) {
    beall.osszevetesMod = m; beallMent();
    var k = akt(); if (k && k.fajta) { k.mod = m; render(); }
  }

  /* ---------- Horoszkópolvasó (Ctrl+Q) ---------- */
  var olvasoBe = false, olvIdozito = null, olvTip = null;
  function olvasoValt(be) {
    olvasoBe = be === undefined ? !olvasoBe : !!be;
    if (!olvasoBe) olvTipZar();
    document.body.classList.toggle('olvaso-be', olvasoBe);
    uzen(olvasoBe ? 'Horoszkópolvasó bekapcsolva – mutass egy jegyre, házszámra, planétára, házúr-számra vagy énjelölőre; dupla kattintás: külön ablak.'
      : 'Horoszkópolvasó kikapcsolva.');
    render();
  }
  /** A szövegek lekérése (gyorsítótárazva a képleten) */
  function olvSzovegek(cel) {
    if (!cel || !cel.e) return Promise.reject(new Error('A képlet még nem készült el.'));
    if (cel.olv) return Promise.resolve(cel.olv);
    if (!cel.olvIgeret) {
      cel.olvIgeret = K.olvaso(cel.e).then(function (x) { cel.olv = x; cel.olvIgeret = null; return x; },
        function (h) { cel.olvIgeret = null; throw h; });
    }
    return cel.olvIgeret;
  }
  /** Melyik képlethez és melyik szöveghez tartozik a kerék eleme */
  function olvCel(elem) {
    var kulcs = elem.getAttribute('data-olv'), cs = elem.closest('.csempe'), k = cs ? kepletek[+cs.getAttribute('data-i')] : akt();
    if (!k || !kulcs) return null;
    var kulso = kulcs.charAt(0) === 'k' && kulcs.indexOf('kpl:') === 0;
    if (elem.closest('[data-kulso]')) kulso = true;
    if (kulso && !k.kulso) return null;
    return { k: k, cel: kulso ? k.kulso : k, kulcs: kulcs.replace(/^kpl:/, 'pl:') };
  }
  function olvKeres(x, kulcs) {
    var t = kulcs.split(':');
    if (t[0] === 'jegy') return x.signs[t[1]];
    if (t[0] === 'haz') return x.houses[t[1]];
    if (t[0] === 'pl') return x.planets[t[1]];
    if (t[0] === 'ur') return x.houseLords[t[1]] ? x.houseLords[t[1]][t.slice(2).join(':')] : null;
    if (t[0] === 'en') return x.selfMarkers[+t[1]];
    return null;
  }
  /*
   * A forrásszövegben a „@” a Windows-os buborék kézi sortörése (ott a hint nem tördel magától, ~100 karakteres sorok).
   * A webes buborék és ablak maga tördel, ezért a „@” elmarad – különben a kézi és az automatikus törés
   * együtt magányos szavakat hagy a sorok végén („… gyorsan és” / „önállóan …”).
   */
  function olvHtml(s) {
    return R.esc(s).replace(/@/g, '').replace(/\n/g, '<br>');
  }
  /* ---------- érintőképernyő: a buborékszövegek (title) koppintásra ----------
   * Tableten és telefonon nincs egérmutató, így a kerék és a táblák buborékjai (SVG <title>, HTML title) nem jelennének meg:
   * koppintásra ugyanaz a szöveg egy buborékban látszik, a következő érintésig, görgetésig vagy 10 másodpercig. */
  var mutatoTipus = 'mouse', erTip = null, erIdozito = null;
  function erTipZar() { clearTimeout(erIdozito); if (erTip) erTip.hidden = true; }
  function cimSzoveg(el, hatar) {
    for (; el && el !== hatar && el.nodeType === 1; el = el.parentNode) {
      if (el instanceof SVGElement) {
        var t = el.querySelector(':scope > title');
        if (t && t.textContent) return t.textContent;
      } else if (el.getAttribute('title')) return el.getAttribute('title');
    }
    return null;
  }
  document.addEventListener('pointerdown', function (e) { mutatoTipus = e.pointerType || 'mouse'; erTipZar(); }, true);
  document.addEventListener('scroll', erTipZar, true);
  $('asztal').addEventListener('click', function (e) {
    if (mutatoTipus === 'mouse' || olvasoBe) return;
    if (e.target.closest('button, a, input, select, textarea, label, .elvalaszto')) return;
    var t = cimSzoveg(e.target, this); if (!t) return;
    if (!erTip) { erTip = document.createElement('div'); erTip.className = 'erinto-tip'; erTip.setAttribute('role', 'tooltip'); document.body.appendChild(erTip); }
    erTip.textContent = t; erTip.hidden = false;
    var w = erTip.offsetWidth, h = erTip.offsetHeight, x = e.clientX - w / 2, y = e.clientY - h - 18;
    if (y < 8) y = e.clientY + 22;
    x = Math.max(8, Math.min(x, innerWidth - w - 8)); y = Math.min(y, innerHeight - h - 8);
    erTip.style.left = x + 'px'; erTip.style.top = y + 'px';
    clearTimeout(erIdozito); erIdozito = setTimeout(erTipZar, 10000);
  });
  function olvTipZar() { clearTimeout(olvIdozito); if (olvTip) olvTip.hidden = true; }
  function olvTipMutat(ev, html) {
    if (!olvTip) { olvTip = document.createElement('div'); olvTip.className = 'olv-tip'; olvTip.setAttribute('role', 'tooltip'); olvTip.setAttribute('data-nofordit', ''); document.body.appendChild(olvTip); }
    olvTip.innerHTML = html; olvTip.hidden = false;
    var w = olvTip.offsetWidth, h = olvTip.offsetHeight, x = ev.clientX + 14, y = ev.clientY + 16;
    if (x + w > innerWidth - 8) x = Math.max(8, ev.clientX - w - 14);
    if (y + h > innerHeight - 8) y = Math.max(8, ev.clientY - h - 14);
    olvTip.style.left = x + 'px'; olvTip.style.top = y + 'px';
  }
  function olvAblak(cim0, szoveg) {
    var a = document.createElement('div');
    a.className = 'olv-ablak'; a.setAttribute('role', 'dialog'); a.setAttribute('aria-label', cim0);
    a.innerHTML = '<div class="olv-fej"><b>' + R.esc(cim0) + '</b><button type="button" class="kisgomb" data-masol title="Másolás a vágólapra" aria-label="Másolás"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button>' +
      '<button type="button" class="kisgomb" data-zar title="Bezárás (Esc)" aria-label="Bezárás"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="olv-torzs" data-nofordit>' + olvHtml(szoveg) + '</div>';
    var n = document.querySelectorAll('.olv-ablak').length;
    a.style.left = (60 + n * 24) + 'px'; a.style.top = (120 + n * 24) + 'px';
    document.body.appendChild(a);
    a.querySelector('[data-zar]').addEventListener('click', function () { a.remove(); });
    a.querySelector('[data-masol]').addEventListener('click', function () {
      try { navigator.clipboard.writeText(szoveg.replace(/@/g, '')); uzen('A szöveg a vágólapra került.'); } catch (e) { uzen('A másolás nem sikerült.'); }
    });
    var fej = a.querySelector('.olv-fej'), huz = null;
    fej.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      huz = { x: e.clientX - a.offsetLeft, y: e.clientY - a.offsetTop }; fej.setPointerCapture(e.pointerId);
    });
    fej.addEventListener('pointermove', function (e) { if (huz) { a.style.left = (e.clientX - huz.x) + 'px'; a.style.top = (e.clientY - huz.y) + 'px'; } });
    fej.addEventListener('pointerup', function () { huz = null; });
    a.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); a.remove(); } });
    a.tabIndex = -1; a.focus();
  }
  function olvasoInit() {
    var asztal = $('asztal');
    asztal.addEventListener('mouseover', function (ev) {
      if (!olvasoBe) return;
      var elem = ev.target.closest('[data-olv]'); if (!elem) return;
      var c = olvCel(elem); if (!c) return;
      clearTimeout(olvIdozito);
      olvIdozito = setTimeout(function () {
        olvSzovegek(c.cel).then(function (x) {
          var t = olvKeres(x, c.kulcs);
          if (t && elem.matches(':hover')) olvTipMutat(ev, olvHtml(t));
        }, function () { /* nincs szöveg */ });
      }, 100);
    });
    asztal.addEventListener('mousemove', function (ev) {
      if (olvTip && !olvTip.hidden && ev.target.closest('[data-olv]')) olvTipMutat(ev, olvTip.innerHTML);
    });
    asztal.addEventListener('mouseout', function (ev) { if (ev.target.closest('[data-olv]')) olvTipZar(); });
    // dupla kattintás: külön ablak (a kapcsolótól függetlenül, mint a Windows-os programban)
    asztal.addEventListener('dblclick', function (ev) {
      var elem = ev.target.closest('[data-olv]'); if (!elem) return;
      var c = olvCel(elem); if (!c) return;
      ev.stopPropagation(); ev.preventDefault();
      olvTipZar();
      olvSzovegek(c.cel).then(function (x) {
        var t = olvKeres(x, c.kulcs);
        if (!t) { uzen('Ehhez az elemhez nincs olvasó-szöveg.'); return; }
        olvAblak(t.split('\n')[0], t);
      }, function (h) { uzen('A horoszkópolvasó most nem érhető el: ' + h.message); });
    }, true);
  }

  function tablaMutat(f) {
    if (!vanAkt()) return;
    ful = f; nezet = 'reszlet'; render();
    var t = document.querySelector('.fulek [data-ful="' + f + '"]'); if (t) t.focus();
  }

  /* ---------- fájlok ---------- */
  var HOR = /\.(hor|ho_)$/i;
  function fajlbolMegnyit(nev, buf, handle) {
    if (HOR.test(nev)) return horMegnyit(nev, buf);
    try {
      var p = RegioSzk.parse(buf);
      if (p.bc) throw new Error('Időszámításunk előtti dátum még nem támogatott.');
      if (p.year < 1 || p.year > 2999) throw new Error('Az év 1 és 2999 között lehet.');
      hozzaad(RegioSzk.toAdat(p), { nev: nev, handle: handle });
      return true;
    } catch (e) { uzen(nev + ': nem nyitható meg – ' + e.message); return false; }
  }
  /**
   * A PLACIDUS v4.0 horoszkópfájl (.hor) új, még nem mentett képletként nyílik meg (a .hor-t sosem írjuk felül;
   * mentéskor .szk lesz belőle); az ellenőrzések figyelmeztetései üzenetben.
   */
  function horMegnyit(nev, buf) {
    try {
      var r = RegioHor.toAdat(RegioHor.parse(buf));
      hozzaad(r.adat, null);
      if (r.figyelmeztetes.length) uzen(nev + ' (Placidus): ' + r.figyelmeztetes.join('; ') + '.');
      return true;
    } catch (e) { uzen(nev + ': nem nyitható meg – ' + e.message); return false; }
  }
  function megnyit() {
    if (window.showOpenFilePicker) {
      window.showOpenFilePicker({ multiple: true, types: [fk('jegyzet')
        ? { description: 'Regiomontanus képlet (és jegyzetfájl)', accept: { 'application/octet-stream': ['.szk', '.mgj'] } }
        : { description: 'Regiomontanus képlet', accept: { 'application/octet-stream': ['.szk'] } },
        { description: 'PLACIDUS horoszkóp', accept: { 'application/octet-stream': ['.hor', '.ho_'] } }] })
        .then(function (hl) {
          var mgj = [];
          return hl.reduce(function (p, h) {
            return p.then(function () { return h.getFile(); }).then(function (f) {
              if (/\.mgj$/i.test(f.name)) { mgj.push(f); return; }
              return f.arrayBuffer().then(function (b) { fajlbolMegnyit(f.name, b, h); });
            });
          }, Promise.resolve()).then(function () { return mgjParosit(mgj); });
        }).catch(function (e) { if (e && e.name !== 'AbortError') uzen('Megnyitási hiba: ' + e.message); });
      return;
    }
    $('fajlInput').accept = fk('jegyzet') ? '.szk,.hor,.ho_,.mgj' : '.szk,.hor,.ho_';
    $('fajlInput').click();
  }
  function fajlokMegnyit(lista) {
    var l = Array.prototype.slice.call(lista), szk = l.filter(function (f) { return /\.szk$/i.test(f.name) || HOR.test(f.name); }),
      mgj = l.filter(function (f) { return /\.mgj$/i.test(f.name); });
    l.forEach(function (f) { if (szk.indexOf(f) < 0 && mgj.indexOf(f) < 0) uzen(f.name + (fk('jegyzet') ? ': csak .szk / .hor képletfájl (és .mgj jegyzetfájl) nyitható meg.' : ': csak .szk / .hor képletfájl nyitható meg.')); });
    return szk.reduce(function (p, f) {
      return p.then(function () { return f.arrayBuffer().then(function (b) { fajlbolMegnyit(f.name, b, null); }); });
    }, Promise.resolve()).then(function () { return mgjParosit(mgj); });
  }
  /** A .mgj a vele azonos nevű megnyitott képlethez kerül (Windows: hors\docs\<szk-név>.mgj), különben az aktívhoz. */
  function mgjParosit(mgj) {
    if (!fk('jegyzet')) {
      mgj.forEach(function (f) { uzen(f.name + ': a jegyzetek egyelőre nem érhetők el a webes változatban.'); });
      return Promise.resolve();
    }
    return mgj.reduce(function (p, f) {
      return p.then(function () {
        var alap = f.name.replace(/\.mgj$/i, '').toLowerCase(), cel = null;
        kepletek.forEach(function (k) { if (!k.fajta && k.fajlnev && k.fajlnev.replace(/\.szk$/i, '').toLowerCase() === alap) cel = k; });
        if (!cel) cel = akt() && !akt().fajta ? akt() : null;
        if (!cel) { uzen(f.name + ': nincs megnyitott képlet, amelyhez a jegyzetek tartoznak.'); return; }
        return f.arrayBuffer().then(function (b) { return R.Jegyzet.mgjImport(cel, b, f.name); });
      });
    }, Promise.resolve());
  }
  function fajlnevJavasol(k) {
    if (k.fajlnev) return k.fajlnev;
    return (K.cim(k.adat).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'kepet') + '.szk';
  }
  function letolt(blob, nev) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function irHandle(h, adat) {
    var elo = h.queryPermission ? h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      return p === 'granted' ? p : h.requestPermission({ mode: 'readwrite' });
    }) : Promise.resolve('granted');
    return elo.then(function (p) {
      if (p !== 'granted') throw new Error('Nincs írási engedély a fájlhoz.');
      return h.createWritable();
    }).then(function (w) { return w.write(adat).then(function () { return w.close(); }); });
  }
  /** Promise<boolean>: sikerült-e menteni */
  function ment(k, maskent) {
    if (k.fajta) {
      // összevetésnél a külső kör képlete menthető (a belső a saját fájljában van)
      if (k.fajta === 'pd' || k.fajta === 'pdv' || !k.kulso.adat) { uzen('A direktált képlet nem menthető .szk-ba.'); return Promise.resolve(false); }
      var ka = K.masol(k.kulso.adat); ka.nev = kulsoNev(k);
      var kk = { adat: ka, eredeti: ka, eltolas: [0, 0, 0, 0, 0], fajlnev: k.kulso.fajlnev || '', handle: k.kulso.handle || null };
      return ment(kk, maskent).then(function (ok) { if (ok) { k.kulso.fajlnev = kk.fajlnev; k.kulso.handle = kk.handle; } return ok; });
    }
    var a = K.masol(k.adat); a.nev = K.cim(a);
    var buf = RegioSzk.build(a, K.zona(a)), nev = fajlnevJavasol(k), p;
    if (!maskent && k.handle && k.handle.createWritable) p = irHandle(k.handle, buf);
    else if (window.showSaveFilePicker) {
      p = window.showSaveFilePicker({ suggestedName: nev, types: [{ description: 'Regiomontanus képlet', accept: { 'application/octet-stream': ['.szk'] } }] })
        .then(function (h) { k.handle = h; k.fajlnev = h.name; return irHandle(h, buf); });
    } else { letolt(new Blob([buf], { type: 'application/octet-stream' }), nev); k.fajlnev = nev; p = Promise.resolve(); }
    return p.then(function () {
      k.valtozott = false; k.eredeti = K.masol(k.adat); k.eltolas = [0, 0, 0, 0, 0];
      S.legutobbiHozzaad(k.adat, k.fajlnev);
      uzen('Mentve: ' + k.fajlnev);
      render();
      return true;
    }, function (e) {
      if (!(e && e.name === 'AbortError')) uzen('Nem sikerült menteni: ' + e.message);
      return false;
    });
  }
  function legutobbiNyit(i) {
    var x = S.legutobbi()[i]; if (!x) return;
    hozzaad(K.masol(x.adat), null);
    var k = akt(); k.fajlnev = x.fajlnev || ''; k.valtozott = false; render();
  }
  function tesztNyit(t) {
    fetch(new URL(t.fajl, new URL('../proba/', location.href)).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (b) { fajlbolMegnyit(t.fajl.split('/').pop(), b, null); })
      .catch(function (e) { uzen(t.cim + ': ' + e.message); });
  }

  /* ---------- kép és nyomtatás ---------- */
  var fontCache = null;
  function fontDataUri() {
    if (fontCache) return fontCache;
    var fajlok = [['../fonts/regio-symbols-1.woff2', 'U+260A-260D, U+263D-2653, U+26B3-26BC'], ['../fonts/regio-symbols-2.woff2', 'U+2609, U+25A1, U+25B3'],
      ['../fonts/regio-symbols-3.woff2', 'U+26E2'], ['../fonts/regio-symbols-4.woff2', 'U+2BD3, U+2BD6'],
      ['../fonts/regio-symbols-5.woff2', 'U+2220, U+22A5, U+2AE0, U+2AEB']];
    fontCache = Promise.all(fajlok.map(function (f) {
      return fetch(f[0]).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var o = new FileReader(); o.onload = function () { res('@font-face{font-family:"Regio Symbols";src:url(' + o.result + ') format("woff2");unicode-range:' + f[1] + ';}'); }; o.readAsDataURL(b); });
      });
    })).then(function (l) { return l.join(''); });
    return fontCache;
  }
  /* ---------- nyomtatás és „Mentés képként” (TfrmPrintSettingsPreview, D PSP; lapkép: js/nyomtatas.js) ---------- */
  var FEKETEFEHER = { fire: '#FFFFFF', earth: '#FFFFFF', air: '#FFFFFF', water: '#FFFFFF', aspectBg: '#FFFFFF', aspect: '#000000' };
  function nyomtatOpt() {
    var o = {}, x, a = beall.nyomtatas || {};
    for (x in R.Nyomtatas.ALAP) o[x] = a[x] !== undefined ? !!a[x] : R.Nyomtatas.ALAP[x];
    return o;
  }
  /** A lapkép (<svg>, 210×297 mm) az aktív képletből. */
  function lapEpit(k, o) {
    nyomtatFelul = { colors: o.szines ? undefined : FEKETEFEHER };
    var d = document.createElement('div'), kerekek = [];
    try {
      kerekRajzol(d, k);
      kerekek = Array.prototype.slice.call(d.querySelectorAll('svg'));
    } finally { nyomtatFelul = null; }
    var adat = { e: k.e, cim: cim(k), tipus: k.szemely && !k.fajta ? 'Személyiségrajz' : tipusNev(k), kerekek: kerekek, b: beall };
    if (k.fajta) {
      adat.kulso = k.kulso; adat.fajta = k.fajta; adat.kereszt = k.kereszt; adat.belsoNev = K.cim(k.adat);
      adat.kulsoNev = kulsoNev(k); adat.kulsoMikor = kulsoMikor(k);
    }
    return R.Nyomtatas.lap(adat, o, beall);
  }
  function nyomtatDlg(kezdo) {
    var k = akt(); if (!k || !k.e) { uzen('A képlet még nem készült el.'); return; }
    var d = $('dlgNyomtat'), o = nyomtatOpt();
    d.querySelector('.ny-tobb').hidden = !k.fajta;
    Array.prototype.forEach.call(d.querySelectorAll('[data-csak1]'), function (x) { x.hidden = !!k.fajta; });
    function kitolt() {
      Array.prototype.forEach.call(d.querySelectorAll('input[data-ny]'), function (c) { c.checked = !!o[c.getAttribute('data-ny')]; });
      var tablak = o.fenyszog || o.planetak || o.hazak || o.eletstrat;
      d.querySelector('[data-csak="radix"]').setAttribute('aria-pressed', String(o.kerek && !tablak));
      d.querySelector('[data-csak="tabla"]').setAttribute('aria-pressed', String(!o.kerek));
      var e = d.querySelector('.ny-elonezet'); e.innerHTML = '';
      e.appendChild(lapEpit(k, o));
    }
    d.onchange = function (ev) {
      var c = ev.target.closest('input[data-ny]'); if (!c) return;
      o[c.getAttribute('data-ny')] = c.checked; kitolt();
    };
    d.onclick = function (ev) {
      var b = ev.target.closest('[data-csak]'); if (b) {
        var be = b.getAttribute('aria-pressed') !== 'true';
        if (b.getAttribute('data-csak') === 'radix') { o.kerek = true; o.fenyszog = o.planetak = o.hazak = o.eletstrat = !be; }
        else { o.kerek = !be; o.fenyszog = o.planetak = o.hazak = o.eletstrat = true; }
        kitolt(); return;
      }
      var g = ev.target.closest('[data-nyg]'); if (!g) return;
      var t = g.getAttribute('data-nyg');
      var inkElotte = inkognito();
      beall.nyomtatas = o; beallMent();
      if (inkognito() !== inkElotte) render();   // a „Személyes adatok elrejtése” a képernyőre is vonatkozik
      if (t === 'megse') { d.close(); return; }
      if (t !== 'elonezet') d.close();
      if (t === 'nyomtat') { nyomtatasElokeszit(); setTimeout(function () { window.print(); }, 60); }
      else if (t === 'elonezet') reszletesElonezet(k, o);
      else kepExport(k, o, d.querySelector('[data-kepfmt]').value);
    };
    kitolt();
    d.showModal();
    var f = d.querySelector('[data-nyg="' + (kezdo === 'kep' ? 'kep' : 'nyomtat') + '"]'); if (f) f.focus();
  }
  function kepMent() { nyomtatDlg('kep'); }
  function nyomtat() { nyomtatDlg('nyomtat'); }
  /* A nyomtatási lap a beforeprint eseménykor készül, így a böngésző saját Nyomtatás menüjére is működik. */
  function nyomtatasElokeszit() {
    var k = akt(), n = $('nyomtat');
    n.innerHTML = '';
    if (!k || !k.e) { n.innerHTML = '<p>Nincs kiszámolt képlet a nyomtatáshoz.</p>'; return; }
    n.appendChild(lapEpit(k, nyomtatOpt()));
  }
  /** Részletes előnézet („Nyomtatási kép nézet”): a lap új lapon, teljes méretben, nagyítható */
  function reszletesElonezet(k, o) {
    var svg = lapEpit(k, o), w = window.open('', '_blank');
    if (!w) { uzen('A böngésző letiltotta az új ablakot.'); return; }
    fontDataUri().then(function (css) { return css; }, function () { return ''; }).then(function (css) {
      w.document.write('<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Nyomtatási kép – ' + R.esc(cim(k)) + '</title><style>' + css +
        'body{margin:0;background:#7a7a7a;display:flex;justify-content:center;padding:16px}svg{background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.4);width:min(100%,1488px);height:auto}</style></head><body>' +
        new XMLSerializer().serializeToString(svg) + '</body></html>');
      w.document.close();
    });
  }
  /** A lapkép PNG/JPG-ként (1488×2105 képpont, mint a Windows-os export; a jelek beágyazott betűkkel). */
  function kepExport(k, o, fmt) {
    var oe = {}, x; for (x in o) oe[x] = o[x]; oe.kepExport = true;
    var svg = lapEpit(k, oe), sz = 1488, mag = 2105;
    fontDataUri().then(function (css) {
      var st = document.createElementNS('http://www.w3.org/2000/svg', 'style'); st.textContent = css; svg.insertBefore(st, svg.firstChild);
      svg.setAttribute('width', sz); svg.setAttribute('height', mag);
      var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = sz; c.height = mag;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, sz, mag);
        setTimeout(function () {
          g.drawImage(img, 0, 0, sz, mag);
          var jpg = fmt === 'jpg';
          c.toBlob(function (b) { letolt(b, fajlnevJavasol(k).replace(/\.szk$/i, '') + (jpg ? '.jpg' : '.png')); }, jpg ? 'image/jpeg' : 'image/png', 0.95);
        }, 80);
      };
      img.onerror = function () { uzen('A kép nem készíthető el ebben a böngészőben.'); };
      img.src = src;
    }).catch(function (e) { uzen('A kép nem készíthető el: ' + e.message); });
  }

  /* ---------- beállítások ---------- */
  function beallMent() { S.beallitasMent(beall); }
  /* ---------- Beállítások › Megjelenítés (fBeallitasok_Megjelenites) ---------- */
  var JEGYNEV = ['Kos', 'Bika', 'Ikrek', 'Rák', 'Oroszlán', 'Szűz', 'Mérleg', 'Skorpió', 'Nyilas', 'Bak', 'Vízöntő', 'Halak'];
  var HAZNEV = ['1 (ASC)', '2', '3', '4 (IC)', '5', '6', '7 (DC)', '8', '9', '10 (MC)', '11', '12'];
  function plNevek() { return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (id) { return [id, R.nev(id)]; }); }
  var MEGJ_LISTA = {
    jegyek: function () { return JEGYNEV.map(function (n, i) { return [i, n]; }); },
    tengelyek: function () { return [['vtx', 'Vertex'], ['ep', 'Keletpont'], ['cas', 'Koascendens'], ['pas', 'Sarki ascendens']]; },
    planetak: plNevek, fszPl: plNevek,
    fszHaz: function () { return HAZNEV.map(function (n, i) { return [i + 1, n]; }); },
    fszCsomo: function () { return [['fel', 'Felsz. holdcsomó'], ['le', 'Lesz. holdcsomó']]; },
    // chkbFenyszogeltKisBolygok: a Windows-os listában ez a nyolc szerepel
    fszKisb: function () { return [[15, 'Chiron'], [16, 'Pholus'], [17, 'Ceres'], [18, 'Pallas Athene'], [19, 'Juno'], [20, 'Vesta'], [146199, 'Eris'], [12, 'Lilith']]; }
  };
  /** a kerékre ható beállítások kulcsa – változáskor a szerveroldali csillag-szűréshez újra kell számolni */
  function fszKulcs() { var b = beall.kerek; return JSON.stringify([b.fszTipus, b.fszPl, b.fszKisb, b.fszCsomo, b.fszHaz, beall.csomo]); }
  function megjelenitesDlg() {
    var d = $('dlgMegj'), kb = $('mKisb');
    if (!kb.firstChild) {
      kb.innerHTML = R.KISBOLYGOK.map(function (k) {
        return '<label class="pipa"><input type="checkbox" data-kisb="' + k[0] + '"> ' + R.esc(k[1]) + '</label>';
      }).join('');
      Array.prototype.forEach.call(d.querySelectorAll('[data-tomb]'), function (t) {
        var n = t.getAttribute('data-tomb');
        t.innerHTML = MEGJ_LISTA[n]().map(function (x) {
          return '<label class="pipa"><input type="checkbox" data-tm="' + n + '" value="' + x[0] + '"> ' + R.esc(x[1]) + '</label>';
        }).join('');
      });
      var hazSor = function (n, i) {
        return '<div class="megj-hsor"><span>' + n + '</span><input type="checkbox" data-tm="hazHatar" value="' + (i + 1) + '" aria-label="' + (i + 1) + '. ház határa">' +
          '<input type="checkbox" data-tm="hazSzam" value="' + (i + 1) + '" aria-label="' + (i + 1) + '. ház száma"></div>';
      };
      $('mHazak').innerHTML = '<div><div class="megj-hfej"><span>Ház</span><label class="pipa"><input type="checkbox" id="mHatarMind"> Határai</label><span>Számok</span></div>' +
        HAZNEV.slice(0, 6).map(hazSor).join('') + '</div><div><div class="megj-hfej"><span>Ház</span><span>Határai</span><span>Számok</span></div>' +
        HAZNEV.slice(6).map(function (n, i) { return hazSor(n, i + 6); }).join('') + '</div>';
      $('mFsz').tBodies[0].innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (k) {
        return '<tr><td>' + R.esc(R.FENYSZOG[k][0]) + ' (' + R.FENYSZOG[k][1] + '°)</td><td><input type="checkbox" data-tm="fszTipus" value="' + k + '" aria-label="' +
          R.esc(R.FENYSZOG[k][0]) + ' vizsgálata"></td><td><input type="checkbox" data-tm="fszJel" value="' + k + '" aria-label="' + R.esc(R.FENYSZOG[k][0]) + ' szimbóluma"></td></tr>';
      }).join('');
      // „Határai”: mind a 12 házhatár egyszerre (chkbShowHideHousesClickCheck)
      $('mHatarMind').onchange = function () {
        var be = this.checked;
        Array.prototype.forEach.call(d.querySelectorAll('[data-tm="hazHatar"]'), function (c) { c.checked = be; });
      };
      d.addEventListener('change', function (ev) {
        if (ev.target.getAttribute('data-tm') === 'hazHatar') hatarMind();
      });
      Array.prototype.forEach.call(d.querySelectorAll('[data-megjful]'), function (b) {
        b.onclick = function () { megjFul(b.getAttribute('data-megjful')); };
      });
    }
    function hatarMind() {
      $('mHatarMind').checked = Array.prototype.every.call(d.querySelectorAll('[data-tm="hazHatar"]'), function (c) { return c.checked; });
    }
    function megjFul(nev) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-megjful]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-megjful') === nev)); });
      Array.prototype.forEach.call(d.querySelectorAll('[data-megjlap]'), function (l) { l.hidden = l.getAttribute('data-megjlap') !== nev; });
    }
    function kitolt(kr, x) {
      Array.prototype.forEach.call(kb.querySelectorAll('input'), function (c) { c.checked = x.kisb.indexOf(+c.getAttribute('data-kisb')) >= 0; });
      Array.prototype.forEach.call(d.querySelectorAll('input[data-k]'), function (c) { c.checked = !!kr[c.getAttribute('data-k')]; });
      Array.prototype.forEach.call(d.querySelectorAll('input[data-tm]'), function (c) {
        var t = kr[c.getAttribute('data-tm')] || [], v = c.value;
        c.checked = t.some(function (e) { return String(e) === v; });
      });
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mCsomo"]'), function (r) { r.checked = +r.value === x.csomo; });
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mEnMod"]'), function (r) { r.checked = +r.value === kr.enMod; });
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mOsszMod"]'), function (r) { r.checked = r.value === (x.osszevetesMod || 'egymason'); });
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mElhely"]'), function (r) { r.checked = r.value === x.osszElhely; });
      Array.prototype.forEach.call(d.querySelectorAll('input[data-b]'), function (c) { c.checked = !!x[c.getAttribute('data-b')]; });
      $('mMeret').value = (+kr.meret || 1).toFixed(1);
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mStilus"]'), function (r) { r.checked = r.value === (kr.stilus || 'regio'); });
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mAsztroMod"]'), function (r) { r.checked = r.value === (kr.asztroMod || 'kep'); });
      $('mAsztroSav').value = +kr.asztroSav || 10;
      Array.prototype.forEach.call(d.querySelectorAll('input[name="mAsztroKiterj"]'), function (r) { r.checked = r.value === (kr.asztroKiterj || 'csill'); });
      // Nyomtatás és Exportálás: a nyomtatási ablakkal közös beállítások (beall.nyomtatas)
      var ny = x.nyomtatas || {};
      Array.prototype.forEach.call(d.querySelectorAll('input[data-ny2]'), function (c) {
        var k = c.getAttribute('data-ny2'); c.checked = ny[k] !== undefined ? !!ny[k] : !!R.Nyomtatas.ALAP[k];
      });
      hatarMind();
    }
    kitolt(beall.kerek, beall);
    megjFul('a1');
    $('mAlap').onclick = function () { var g = JSON.parse(JSON.stringify(S.ALAP)); g.nyomtatas = {}; kitolt(g.kerek, g); };
    var kisbElotte = JSON.stringify([beall.kerek.asteroids, beall.kisb]), fszElotte = fszKulcs();
    d.returnValue = ''; d.showModal();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      var kr = beall.kerek;
      Array.prototype.forEach.call(d.querySelectorAll('input[data-k]'), function (c) { kr[c.getAttribute('data-k')] = c.checked; });
      Object.keys(MEGJ_LISTA).concat(['hazHatar', 'hazSzam', 'fszTipus', 'fszJel']).forEach(function (n) {
        var szam = n !== 'tengelyek' && n !== 'fszCsomo';
        kr[n] = Array.prototype.filter.call(d.querySelectorAll('input[data-tm="' + n + '"]'), function (c) { return c.checked; })
          .map(function (c) { return szam ? +c.value : c.value; });
      });
      var r = d.querySelector('input[name="mCsomo"]:checked'); if (r) beall.csomo = +r.value;
      r = d.querySelector('input[name="mEnMod"]:checked'); if (r) kr.enMod = +r.value;
      r = d.querySelector('input[name="mElhely"]:checked'); if (r) beall.osszElhely = r.value;
      var m = +String($('mMeret').value).replace(',', '.');
      kr.meret = isFinite(m) && m > 0 ? Math.round(Math.min(2, Math.max(0.5, m)) * 10) / 10 : 1;
      r = d.querySelector('input[name="mAsztroMod"]:checked'); if (r) kr.asztroMod = r.value;
      r = d.querySelector('input[name="mStilus"]:checked'); if (r) kr.stilus = r.value;
      r = d.querySelector('input[name="mAsztroKiterj"]:checked'); if (r) kr.asztroKiterj = r.value;
      m = +String($('mAsztroSav').value).replace(',', '.'); kr.asztroSav = isFinite(m) && m > 0 ? Math.round(Math.min(30, Math.max(1, m))) : 10;
      Array.prototype.forEach.call(d.querySelectorAll('input[data-b]'), function (c) { beall[c.getAttribute('data-b')] = c.checked; });
      beall.nyomtatas = beall.nyomtatas || {};
      Array.prototype.forEach.call(d.querySelectorAll('input[data-ny2]'), function (c) { beall.nyomtatas[c.getAttribute('data-ny2')] = c.checked; });
      // a kiválasztott kisbolygók a Windows-os lista sorrendjében
      beall.kisb = Array.prototype.filter.call(kb.querySelectorAll('input'), function (c) { return c.checked; })
        .map(function (c) { return +c.getAttribute('data-kisb'); });
      r = d.querySelector('input[name="mOsszMod"]:checked');
      beallMent();
      if (r && r.value !== (beall.osszevetesMod || 'egymason')) megjelenitesMod(r.value);
      if (JSON.stringify([beall.kerek.asteroids, beall.kisb]) !== kisbElotte || (beall.allo.megj && fszKulcs() !== fszElotte)) mindSzamol();
      render();
    };
  }
  var egyebHely = null, egyebKereso = null;
  /* ---------- Beállítások › Állócsillagok ---------- */
  var alloLista = null;   // név szerint rendezett [{ id, nev, nomen, latin, hun }]
  function alloKulcs() { var a = beall.allo; return JSON.stringify([a.megj, a.ids, a.orb, a.fsz, beall.kerek.asteroids, beall.kisb, beall.orb]); }

  /* ---------- Beállítások › Színek és szimbólumok (fBeallitasok_Szinek) ---------- */
  var STILUSOK = ['Sima', 'Szaggatott', 'Pettyezett'];
  // a fényszögek a program szokásos sorrendjében (a Windows-os ablak két oszlopa helyett soronként kettő)
  var SZIN_SORREND = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  function szinDlg() {
    var d = $('dlgSzin'), o = JSON.parse(JSON.stringify(beall.szin));
    function mintaVonal(st, szin) {
      var da = st === 1 ? '6 5' : st === 2 ? '1 3' : '';
      return '<svg class="szin-minta" viewBox="0 0 46 10" aria-hidden="true"><line x1="1" y1="5" x2="45" y2="5" stroke="' + szin + '" stroke-width="2"' +
        (da ? ' stroke-dasharray="' + da + '"' : '') + (st === 2 ? ' stroke-linecap="round"' : '') + '/></svg>';
    }
    $('szFsz').innerHTML = SZIN_SORREND.map(function (k) {
      return '<div class="szin-sor"><span>' + R.FENYSZOG[k][0] + ':</span><input type="color" data-fszszin="' + k + '" aria-label="' + R.FENYSZOG[k][0] + ' színe">' +
        '<select data-fszstil="' + k + '" aria-label="' + R.FENYSZOG[k][0] + ' vonala">' + STILUSOK.map(function (n, i) { return '<option value="' + i + '">' + n + '</option>'; }).join('') +
        '</select><span class="minta" data-minta="' + k + '"></span></div>';
    }).join('');
    $('szUranusz').innerHTML = URANUSZ_JEL.map(function (j, i) {
      return '<label><input type="radio" name="szUr" value="' + i + '"><span class="jel">' + j + '︎</span></label>';
    }).join('');
    $('szPluto').innerHTML = PLUTO_JEL.map(function (j, i) {
      return '<label><input type="radio" name="szPl" value="' + i + '"><span class="jel">' + j + '︎</span></label>';
    }).join('');
    function minta(k) { var m = d.querySelector('[data-minta="' + k + '"]'); m.innerHTML = mintaVonal(+d.querySelector('[data-fszstil="' + k + '"]').value, d.querySelector('[data-fszszin="' + k + '"]').value); }
    function kitolt(x) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-szin]'), function (c) { c.value = x[c.getAttribute('data-szin')]; });
      SZIN_SORREND.forEach(function (k) {
        d.querySelector('[data-fszszin="' + k + '"]').value = x.fsz[k];
        d.querySelector('[data-fszstil="' + k + '"]').value = String(x.stilus[k]);
        minta(k);
      });
      $('szVonal').value = x.vonal;
      Array.prototype.forEach.call(d.querySelectorAll('input[name="szUr"]'), function (r) { r.checked = +r.value === x.uranusz; });
      Array.prototype.forEach.call(d.querySelectorAll('input[name="szPl"]'), function (r) { r.checked = +r.value === x.pluto; });
    }
    kitolt(o);
    Array.prototype.forEach.call(d.querySelectorAll('[data-fszszin],[data-fszstil]'), function (c) {
      c.oninput = c.onchange = function () { minta(c.getAttribute('data-fszszin') || c.getAttribute('data-fszstil')); };
    });
    function ful(nev) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-szinful]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-szinful') === nev)); });
      Array.prototype.forEach.call(d.querySelectorAll('[data-szinlap]'), function (l) { l.hidden = l.getAttribute('data-szinlap') !== nev; });
    }
    Array.prototype.forEach.call(d.querySelectorAll('[data-szinful]'), function (b) { b.onclick = function () { ful(b.getAttribute('data-szinful')); }; });
    ful('szinek');
    $('szAlap').onclick = function () { kitolt(JSON.parse(JSON.stringify(S.ALAP.szin))); };
    d.returnValue = ''; d.showModal();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      Array.prototype.forEach.call(d.querySelectorAll('[data-szin]'), function (c) { o[c.getAttribute('data-szin')] = c.value; });
      SZIN_SORREND.forEach(function (k) {
        o.fsz[k] = d.querySelector('[data-fszszin="' + k + '"]').value;
        o.stilus[k] = +d.querySelector('[data-fszstil="' + k + '"]').value;
      });
      var v = parseInt($('szVonal').value, 10); o.vonal = isFinite(v) ? Math.max(1, Math.min(5, v)) : 1;
      var u = d.querySelector('input[name="szUr"]:checked'), pl = d.querySelector('input[name="szPl"]:checked');
      o.uranusz = u ? +u.value : 0; o.pluto = pl ? +pl.value : 0;
      beall.szin = o; beallMent(); szimbolumAlkalmaz();
      kepletek.forEach(function (k) { k.mini = miniSvg(k); });
      render();
    };
  }

  /* ---------- Beállítások › Fényszög orbisok (fOrbisSettings) ---------- */
  var ORB_SOROK = ['Nap', 'Hold', 'Merkúr', 'Vénusz', 'Mars', 'Jupiter', 'Szaturnusz', 'Uránusz', 'Neptunusz', 'Plútó', 'Asc', 'MC', 'Holdcsomó', 'Házsarkak'];
  function orbDlg() {
    var d = $('dlgOrb'), o = JSON.parse(JSON.stringify(beall.orb)), akt = 1, i, k;
    var szam = function (v) { var x = parseFloat(String(v).replace(',', '.')); return isFinite(x) && x >= 0 ? Math.min(x, 30) : 0; };
    var mezo = function (id, v, cimke) {
      return '<label class="orb-sor"><span>' + cimke + '</span><input type="number" min="0" max="30" step="0.5" inputmode="decimal" id="' + id + '" value="' + v + '"></label>';
    };
    // Egyszerű: fényszögenként egy érték (két oszlopban, mint a Windows-os ablakban)
    $('oEgyszeru').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (k) {
      return mezo('oS' + k, o.S[k], R.FENYSZOG[k][0] + ' (' + R.FENYSZOG[k][1] + '°)');
    }).join('');
    // Részletes: a kiválasztott fényszög 14 értéke
    $('oFsz').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (k) {
      return '<label class="pipa"><input type="radio" name="oFsz" value="' + k + '"' + (k === 1 ? ' checked' : '') + '> ' + R.FENYSZOG[k][0] + ' (' + R.FENYSZOG[k][1] + '°)</label>';
    }).join('');
    function reszletesBe() { for (i = 0; i < 14; i++) $('oD' + i).value = o.D[akt][i]; }
    function reszletesKi() { for (i = 0; i < 14; i++) o.D[akt][i] = szam($('oD' + i).value); }
    $('oErtekek').innerHTML = ORB_SOROK.map(function (n, i) { return mezo('oD' + i, 0, n); }).join('');
    reszletesBe();
    Array.prototype.forEach.call($('oFsz').querySelectorAll('input'), function (r) {
      r.onchange = function () { reszletesKi(); akt = +r.value; reszletesBe(); };
    });
    function ful(nev) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-orbful]'), function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-orbful') === nev)); });
      Array.prototype.forEach.call(d.querySelectorAll('[data-orblap]'), function (l) { l.hidden = l.getAttribute('data-orblap') !== nev; });
    }
    Array.prototype.forEach.call(d.querySelectorAll('[data-orbful]'), function (b) { b.onclick = function () { ful(b.getAttribute('data-orbful')); }; });
    // a mód választása a hozzá tartozó fület is megmutatja (rgpAspectTypeClick)
    Array.prototype.forEach.call(d.querySelectorAll('input[name="oMod"]'), function (r) {
      r.checked = r.value === o.mod; r.onchange = function () { ful(r.value); };
    });
    ful(o.mod);
    $('oAlap').onclick = function () {
      var g = S.ALAP.orb;
      for (k = 1; k <= 12; k++) { $('oS' + k).value = g.S[k]; o.D[k] = g.D[k].slice(); }
      reszletesBe();
    };
    d.returnValue = ''; d.showModal();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      reszletesKi();
      for (k = 1; k <= 12; k++) o.S[k] = szam($('oS' + k).value);
      var m = d.querySelector('input[name="oMod"]:checked'); o.mod = m ? m.value : 'egyszeru';
      var elotte = JSON.stringify(beall.orb);
      beall.orb = o; beallMent();
      if (JSON.stringify(o) !== elotte) mindSzamol();
      render();
    };
  }
  function alloDlg() {
    var d = $('dlgAllo'), A = R.Allo, tb = d.querySelector('#aLista tbody'), lista = $('aLista');
    if (!alloLista) {
      alloLista = A.mind().sort(function (x, y) { return x.nev.localeCompare(y.nev, 'hu'); });
      tb.innerHTML = alloLista.map(function (c, i) {
        return '<tr data-nofordit data-i="' + i + '" data-id="' + c.id + '" aria-selected="false"><td>' + R.esc(c.nev) + '</td><td>' + R.esc(c.nomen) +
          '</td><td>' + R.esc(c.latin) + '</td><td>' + R.esc(c.hun) + '</td></tr>';
      }).join('');
      $('aFsz').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (k) {
        return '<label class="pipa"><input type="checkbox" value="' + k + '"> ' + R.FENYSZOG[k][0] + '</label>';
      }).join('');
    }
    var a = beall.allo, kij = a.ids.slice(), akt = -1;
    var sorok = tb.querySelectorAll('tr');
    function frissit() {
      Array.prototype.forEach.call(sorok, function (tr) { tr.setAttribute('aria-selected', String(kij.indexOf(+tr.getAttribute('data-id')) >= 0)); });
      $('aDb').textContent = 'Kiválasztva: ' + kij.length + ' db';
      $('aDb').title = kij.map(A.nev).join(', ');
    }
    // „Csak a kiválasztottak”: a nem kijelölt sorok elrejtése. A szűrés a bekapcsoláskor / törléskor fut újra,
    // így a szűrt listában visszavont kijelölés sora látható marad (újra kijelölhető).
    function szur() {
      var csak = $('aCsakKij').checked;
      Array.prototype.forEach.call(sorok, function (tr) { tr.hidden = csak && kij.indexOf(+tr.getAttribute('data-id')) < 0; });
      if (akt >= 0 && sorok[akt].hidden) { sorok[akt].classList.remove('akt'); akt = -1; }
      if (akt < 0) aktival(lep(-1, 1), false);
      lista.scrollTop = 0;
    }
    function lathato(i) { return i >= 0 && i < sorok.length && !sorok[i].hidden; }
    /** a következő látható sor i-től irányba (d = ±1), n lépésnyit */
    function lep(i, d, n) {
      var j = i, utolso = -1; n = n || 1;
      while (n > 0) { j += d; if (j < 0 || j >= sorok.length) break; if (lathato(j)) { utolso = j; n--; } }
      return utolso;
    }
    function aktival(i, gorget) {
      if (!lathato(i)) return;
      if (akt >= 0) sorok[akt].classList.remove('akt');
      akt = i; sorok[i].classList.add('akt');
      if (gorget) {
        var t = sorok[i].offsetTop - lista.querySelector('thead').offsetHeight;
        if (t < lista.scrollTop || sorok[i].offsetTop + sorok[i].offsetHeight > lista.scrollTop + lista.clientHeight) lista.scrollTop = Math.max(0, t - 40);
      }
    }
    function valt(i) {
      if (i < 0) return;
      var id = alloLista[i].id, j = kij.indexOf(id);
      if (j >= 0) kij.splice(j, 1); else kij.push(id);
      frissit();
    }
    // keresés (GetFixedStarRecID): a megnevezés elejére, vagy a sor bármely részére – az első találatra ugrik
    function keres() {
      var q = $('aKeres').value.trim().toUpperCase(); if (!q) return;
      var csak = $('aCsakNev').checked;
      for (var i = 0; i < alloLista.length; i++) {
        if (!lathato(i)) continue;
        var c = alloLista[i];
        var ok = csak ? c.nev.toUpperCase().indexOf(q) === 0 : [c.nev, c.nomen, c.latin, c.hun].join(' ').toUpperCase().indexOf(q) >= 0;
        if (ok) { aktival(i, true); return; }
      }
    }
    $('aKeres').value = ''; $('aCsakNev').checked = true; $('aCsakKij').checked = false;
    $('aMegj').checked = !!a.megj; $('aMind').checked = !!a.mind; $('aOrb').value = a.orb;
    Array.prototype.forEach.call($('aFsz').querySelectorAll('input'), function (c) { c.checked = a.fsz.indexOf(+c.value) >= 0; });
    akt = -1; Array.prototype.forEach.call(sorok, function (tr) { tr.classList.remove('akt'); });
    frissit(); szur();
    $('aKeres').oninput = keres; $('aCsakNev').onchange = keres; $('aCsakKij').onchange = szur;
    tb.onclick = function (e) { var tr = e.target.closest('tr'); if (tr) aktival(+tr.getAttribute('data-i'), false); };
    tb.ondblclick = function (e) { var tr = e.target.closest('tr'); if (tr) { aktival(+tr.getAttribute('data-i'), false); valt(akt); } };
    lista.onkeydown = function (e) {
      var l = { ArrowDown: 1, ArrowUp: -1, PageDown: 12, PageUp: -12 }[e.key];
      if (l) {
        e.preventDefault();
        var c = lep(akt, l > 0 ? 1 : -1, Math.abs(l));
        aktival(c >= 0 ? c : lep(l > 0 ? sorok.length : -1, l > 0 ? -1 : 1), true);
      }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); valt(akt); }
      else if (e.key === 'Home') { e.preventDefault(); aktival(lep(-1, 1), true); }
      else if (e.key === 'End') { e.preventDefault(); aktival(lep(sorok.length, -1), true); }
    };
    $('aTorol').onclick = function () { kij = []; frissit(); szur(); };
    d.returnValue = ''; d.showModal(); $('aKeres').focus();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      var elotte = alloKulcs();
      var orb = parseFloat(String($('aOrb').value).replace(',', '.'));
      beall.allo = { megj: $('aMegj').checked, mind: $('aMind').checked, ids: kij, orb: isFinite(orb) && orb >= 0 ? orb : 2.5,
        fsz: Array.prototype.filter.call($('aFsz').querySelectorAll('input'), function (c) { return c.checked; }).map(function (c) { return +c.value; }) };
      beallMent();
      if (alloKulcs() !== elotte) mindSzamol();
      render();
    };
  }

  function egyebekDlg() {
    var d = $('dlgEgyeb'), h = beall.alapHely;
    egyebHely = JSON.parse(JSON.stringify(h));
    $('eTelep').value = h.telepulesKijelzes || h.telepules;
    $('eInfo').textContent = helyInfo(h);
    $('eFrissit').checked = beall.aktualisFrissit;
    if (!egyebKereso) egyebKereso = R.TelepulesKereso($('eTelep'), $('eTalalat'), function (t) {
      egyebHely = { telepules: t.adatNev || t.nev, telepulesKijelzes: t.nev, orszag: t.orszag, orszagKod: t.orszagKod, lat: t.lat, lon: t.lon, tz: t.tz };
      $('eInfo').textContent = helyInfo(egyebHely);
    });
    d.returnValue = ''; d.showModal();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      beall.alapHely = egyebHely; beall.aktualisFrissit = $('eFrissit').checked;
      beallMent(); render();
    };
  }
  function helyInfo(h) {
    return (h.telepulesKijelzes || h.telepules) + ', ' + h.orszag + ' – ' + R.fokStr(Math.abs(h.lat), false) + (h.lat >= 0 ? ' É' : ' D') + ', ' +
      R.fokStr(Math.abs(h.lon), false) + (h.lon >= 0 ? ' K' : ' Ny') + (h.tz ? ' · ' + h.tz : '');
  }
  function gyariBeall() {
    kerdez('Visszaállítod a program alapértelmezett beállításait?', false).then(function (v) {
      if (v !== 'igen') return;
      var h = beall.hsys, s = beall.sid, al = alloKulcs();
      beall = S.gyari(); szimbolumAlkalmaz(); kepletek.forEach(function (k) { k.mini = miniSvg(k); });
      if (beall.hsys !== h || beall.sid !== s || alloKulcs() !== al) mindSzamol();
      render(); uzen('Az alapértelmezések visszaálltak.');
    });
  }
  function beallLetolt() {
    letolt(new Blob([JSON.stringify(beall, null, 2)], { type: 'application/json' }), 'regiomontanus-beallitasok.json');
  }
  function beallBetolt() {
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = function () {
      var f = i.files[0]; if (!f) return;
      f.text().then(function (t) {
        var v = JSON.parse(t), h = beall.hsys, s = beall.sid, al = alloKulcs();
        S.beallitasMent(v); beall = S.beallitasok(); szimbolumAlkalmaz(); kepletek.forEach(function (k) { k.mini = miniSvg(k); });
        if (beall.hsys !== h || beall.sid !== s || alloKulcs() !== al) mindSzamol();
        render(); uzen('Beállítások betöltve.');
      }).catch(function (e) { uzen('A beállításfájl nem olvasható: ' + e.message); });
    };
    i.click();
  }

  /* ---------- üzenet, kérdés ---------- */
  var uzenIdo = null;
  function uzen(s) {
    var u = document.querySelector('.uzenet');
    if (!u) { u = document.createElement('div'); u.className = 'uzenet'; u.setAttribute('role', 'status'); document.body.appendChild(u); }
    u.textContent = s; u.hidden = false;
    clearTimeout(uzenIdo); uzenIdo = setTimeout(function () { u.hidden = true; }, 4500);
  }
  /** Promise<'igen' | 'nem' | ''> */
  function kerdez(html, harom) {
    var d = $('dlgKerdes');
    $('kerdesSzoveg').innerHTML = html;
    $('kerdesMegse').hidden = !harom;
    d.returnValue = '';
    d.showModal();
    $('kerdesIgen').focus();
    return new Promise(function (res) { d.onclose = function () { res(d.returnValue || (harom ? '' : 'nem')); }; });
  }

  /* ---------- munkamenet ---------- */
  function munkamenetMent() {
    if (!betoltve) return;
    S.munkamenetMent({
      kepletek: kepletek.map(function (k) {
        var m = { adat: k.eredeti, eltolas: k.eltolas, fajlnev: k.fajlnev, valtozott: k.valtozott, szemely: !!k.szemely };
        if (k.rogzitett) m.rogzitett = k.rogzitett;
        if (k.fajta) {
          var ks = k.kulso;
          m.ossz = { fajta: k.fajta, mod: k.mod, eredeti: ks.eredeti, eltolas: ks.eltolas, ph: ks.ph, pd: ks.pd, pdv: ks.pdv, sol: ks.sol, rev: ks.rev,
            konverz: ks.konverz, alap: ks.alap };
        }
        return m;
      }),
      aktiv: aktiv, nezet: nezet, ful: ful, lepNyitva: lepNyitva
    });
  }
  function munkamenetBetolt() {
    var m = S.munkamenet();
    if (!m || !Array.isArray(m.kepletek)) return;
    m.kepletek.forEach(function (x) {
      if (!x || !x.adat || typeof x.adat.ev !== 'number') return;
      var k = ujKepletObj(x.adat, x.fajlnev ? { nev: x.fajlnev } : null);
      k.valtozott = !!x.valtozott; k.szemely = !!x.szemely;
      if (x.rogzitett && x.rogzitett.poz && x.rogzitett.hz) k.rogzitett = x.rogzitett;
      if (Array.isArray(x.eltolas) && x.eltolas.length === 5) { k.eltolas = x.eltolas.map(function (v) { return +v || 0; }); k.adat = K.leptet(k.eredeti, k.eltolas); }
      var o = x.ossz;
      if (o && R.Idotech.NEV[o.fajta]) {
        k.fajta = o.fajta; k.mod = o.mod === 'egymasmellett' ? 'egymasmellett' : 'egymason';
        k.kulso = { eredeti: o.eredeti || null, adat: null, e: null, hiba: null, sorszam: 0, idozito: null,
          eltolas: Array.isArray(o.eltolas) && o.eltolas.length === 5 ? o.eltolas.map(function (v) { return +v || 0; }) : [0, 0, 0, 0, 0],
          ph: o.ph, pd: +o.pd || 0, pdv: o.pdv, sol: o.sol, rev: o.rev, konverz: !!o.konverz, alap: o.alap || {}, kulonNyitva: true };
        if (k.kulso.eredeti) k.kulso.adat = K.leptet(k.kulso.eredeti, k.kulso.eltolas);
        k.valtozott = false;
      }
      kepletek.push(k);
    });
    aktiv = Math.min(Math.max(0, +m.aktiv || 0), kepletek.length - 1);
    nezet = m.nezet === 'reszlet' ? 'reszlet' : 'mozaik';
    if (fulek().some(function (f) { return f[0] === m.ful; })) ful = m.ful;
    lepNyitva = !!m.lepNyitva;
  }

  /* ====================================================================== */
  /* Események                                                               */
  /* ====================================================================== */
  function beviteliMezo(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('dialog[open]')) return;
    var kod = e.code || '', betu = kod.indexOf('Key') === 0 ? kod.slice(3) : '';
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (betu === 'N') { e.preventDefault(); vegrehajt('uj'); return; }
      if (betu === 'W') { e.preventDefault(); vegrehajt('bezar'); return; }
      var d = /^Digit([1-9])$/.exec(kod);
      if (d) { e.preventDefault(); aktival(+d[1] - 1); return; }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      var t = { O: 'megnyit', S: 'ment', P: 'nyomtat', A: 'adatok', B: 'planetak', H: 'hazak', F: 'fenyszogek', J: 'eletstrat', E: 'enallapotok', L: 'lepteto', Q: 'olvaso' }[betu];
      if (!t) return;
      if ((betu === 'A' || betu === 'F') && beviteliMezo(e.target)) return;
      if (betu === 'A' && window.getSelection && String(window.getSelection()) && !vanAkt()) return;
      e.preventDefault();
      vegrehajt(t);
      return;
    }
    if (e.key === 'Escape') {
      if (eszkMenu) { eszkMenuZar(); return; }
      if (nyitottMenu !== null) { menuZar(); return; }
      if (!$('lista').hidden) { listaValt(false); $('listaGomb').focus(); return; }
      if (!beviteliMezo(e.target) && fokuszTorol()) return;
      if (document.body.classList.contains('kerek-max')) { nagyKerek(false); render(); return; }
      if (nezet === 'reszlet') { nezet = 'mozaik'; render(); }
    }
  });
  document.addEventListener('mousedown', function (e) {
    if (eszkMenu && !e.target.closest('.eszk-menu, button.legordulo')) eszkMenuZar();
    if (nyitottMenu !== null && !e.target.closest('.menusor')) menuZar();
    if (!$('lista').hidden && !e.target.closest('#lista, #listaGomb')) listaValt(false);
  });
  $('menusor').addEventListener('click', function (e) {
    var b = e.target.closest('.mf > button'); if (!b) return;
    var i = +b.parentNode.getAttribute('data-m');
    if (nyitottMenu === i) menuZar(); else menuNyit(i, e.detail === 0);
  });
  $('menusor').addEventListener('mouseover', function (e) {
    var b = e.target.closest('.mf > button'); if (!b || nyitottMenu === null) return;
    var i = +b.parentNode.getAttribute('data-m'); if (i !== nyitottMenu) menuNyit(i, false);
  });
  $('menusor').addEventListener('keydown', function (e) {
    var b = e.target.closest('.mf > button'); if (!b) return;
    var i = +b.parentNode.getAttribute('data-m');
    if (e.key === 'ArrowDown') { e.preventDefault(); menuNyit(i, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); $('menusor').querySelector('[data-m="' + ((i + 1) % MENU.length) + '"] > button').focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); $('menusor').querySelector('[data-m="' + ((i - 1 + MENU.length) % MENU.length) + '"] > button').focus(); }
  });
  // álló táblagépen (761–1000 px) a menüsor nem fér el a „Megnyitott képletek” és az „Elrendezés” mellett: ilyenkor az eszköztár
  // (amúgy is két sorba törő) végére kerülnek, így nem foglalnak külön sort
  var jobbHely = window.matchMedia ? window.matchMedia('(min-width: 761px) and (max-width: 1000px)') : null;
  function jobbAthelyez() {
    var j = document.querySelector('.fosor .jobb, #ikonok .jobb'); if (!j) return;
    var cel = jobbHely && jobbHely.matches ? $('ikonok') : document.querySelector('.fosor');
    if (j.parentNode !== cel) cel.appendChild(j);
  }
  if (jobbHely) { if (jobbHely.addEventListener) jobbHely.addEventListener('change', jobbAthelyez); else jobbHely.addListener(jobbAthelyez); }
  jobbAthelyez();
  $('ikonok').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-eszk]'); if (!b || b.disabled) return;
    var x = ESZKOZ[+b.getAttribute('data-eszk')];
    if (x[4]) { e.stopPropagation(); eszkMenuNyit(b, x[4]()); return; }
    vegrehajt(x[2]);
  });
  $('racs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-r]'); if (!b) return;
    beall.elrendezes = +b.getAttribute('data-r'); nezet = 'mozaik'; beallMent(); render();
  });
  $('listaGomb').addEventListener('click', function () { listaValt(); });
  // a felület nyelve (nyelv.js): váltáskor újratöltés ?lang= paraméterrel; a munkamenet megmarad
  if (R.Nyelv) {
    $('nyelvVal').value = R.Nyelv.kod;
    $('nyelvVal').addEventListener('change', function () { munkamenetMent(); R.Nyelv.valt(this.value); });
  }
  $('lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-valt]'); if (!b) return;
    listaValt(false); aktival(+b.getAttribute('data-valt'));
  });
  $('lista').addEventListener('keydown', function (e) {
    var l = Array.prototype.slice.call($('lista').querySelectorAll('button')), i = l.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && l.length) { e.preventDefault(); l[(i + 1) % l.length].focus(); }
    if (e.key === 'ArrowUp' && l.length) { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
  });
  $('asztal').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tett]');
    var cs = e.target.closest('.csempe');
    if (t) {
      var tt = t.getAttribute('data-tett');
      if (cs) {
        var i = +cs.getAttribute('data-i');
        if (tt === 'bezar') { bezar(i); return; }
        if (tt === 'nagyit') { aktival(i, true); return; }
      }
      vegrehajt(tt); return;
    }
    var v = e.target.closest('[data-valt]'); if (v) { aktival(+v.getAttribute('data-valt')); return; }
    var f = e.target.closest('[data-ful]');
    if (f) {
      ful = f.getAttribute('data-ful');
      Array.prototype.forEach.call(document.querySelectorAll('.fulek button'), function (b) { b.setAttribute('aria-selected', String(b === f)); });
      renderTabla($('tablaTart'), akt()); munkamenetMent(); return;
    }
    var lu = e.target.closest('[data-legutobbi]'); if (lu) { legutobbiNyit(+lu.getAttribute('data-legutobbi')); return; }
    var cso = e.target.closest('[data-csat]');
    if (cso) { var kc = akt(); if (kc) { kc.csatKijelolt = +cso.getAttribute('data-csat'); render(); var u = document.querySelector('[data-csat="' + kc.csatKijelolt + '"]'); if (u) u.focus(); } return; }
    var ksv = e.target.closest('.kerek svg');
    if (ksv) { var kf = cs ? kepletek[+cs.getAttribute('data-i')] : akt(); if (kf) fokuszKatt(kf, ksv, e.target); }
    if (cs && +cs.getAttribute('data-i') !== aktiv) aktival(+cs.getAttribute('data-i'));
  });
  $('asztal').addEventListener('dblclick', function (e) {
    var cso = e.target.closest('[data-csat]'); if (cso && akt()) { csatMegnyit(akt(), +cso.getAttribute('data-csat')); return; }
    var cs = e.target.closest('.csempe'); if (cs && !e.target.closest('button')) aktival(+cs.getAttribute('data-i'), true);
  });
  $('asztal').addEventListener('keydown', function (e) {
    var f = e.target.closest('.fulek [data-ful]'); if (!f) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var l = Array.prototype.slice.call(document.querySelectorAll('.fulek button')), i = l.indexOf(f);
    var u = l[(i + (e.key === 'ArrowRight' ? 1 : l.length - 1)) % l.length]; u.click(); u.focus();
  });
  $('lepteto').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lep]'); if (b) { lep(+b.getAttribute('data-lep'), +b.getAttribute('data-ir')); return; }
  });
  $('lepEredeti').addEventListener('click', lepEredeti);
  $('lepZar').addEventListener('click', function () { jatekAll(); lepNyitva = false; render(); });
  $('lepPlay').addEventListener('click', function () {
    var k = akt(); if (!k) return;
    if (jatek && jatek.k === k) jatekAll(); else jatekIndit(k);
  });
  // nagy ábra: a fejléc képletváltója
  $('asztal').addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('[data-kepvalto]')) aktival(+e.target.value, true);
  });
  $('lepPlayIv').addEventListener('change', function () {
    beall.jatekIv = +this.value; beallMent();
    if (jatek) jatekIndit(jatek.k);
  });
  $('fajlInput').addEventListener('change', function () { fajlokMegnyit(this.files); this.value = ''; });
  $('mgjInput').addEventListener('change', function () {
    var f = this.files && this.files[0], k = akt(); this.value = '';
    if (f && k) f.arrayBuffer().then(function (b) { R.Jegyzet.mgjImport(k, b, f.name); });
  });
  $('asztal').addEventListener('keydown', function (e) {
    var cso = e.target.closest && e.target.closest('[data-csat]'); if (!cso || !akt()) return;
    var i = +cso.getAttribute('data-csat'), n = (akt().adat.csatolmanyok || []).length;
    if (e.key === 'Enter') { e.preventDefault(); csatMegnyit(akt(), i); }
    else if (e.key === 'Delete') { e.preventDefault(); akt().csatKijelolt = i; csatTorol(); }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n) {
      e.preventDefault(); akt().csatKijelolt = (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; render();
      var u = document.querySelector('[data-csat="' + akt().csatKijelolt + '"]'); if (u) u.focus();
    }
  });
  /* jobb kattintás a kerék egy elemén: jegyzet az elemhez (D BSK 616–629); a fényképen: megnyitás nagyban */
  $('asztal').addEventListener('contextmenu', function (e) {
    if (e.target.closest('.oldalsav .foto')) { e.preventDefault(); kepMegnyit(); return; }
    if (!fk('jegyzet')) return;
    var el = e.target.closest('[data-olv],[data-megj]'); if (!el) return;
    var m = /^(pl|haz|jegy):(-?\d+)$/.exec(el.getAttribute('data-olv') || ''), t, id;
    if (m) { t = { pl: 'P', haz: 'H', jegy: 'J' }[m[1]]; id = +m[2]; }
    else if (/^P_-[12]$/.test(el.getAttribute('data-megj') || '')) { t = 'P'; id = +el.getAttribute('data-megj').slice(2); }
    else return;
    e.preventDefault();
    var cs = el.closest('.csempe'), i = cs ? +cs.getAttribute('data-i') : aktiv;
    if (el.closest('[data-kulso]')) { uzen('Összevetés képletekhez nem lehet megjegyzést adni!'); return; }
    if (i !== aktiv) aktival(i, false);
    R.Jegyzet.nyit(kepletek[i], t, id);
  });

  var ejtDb = 0, ejtJel = null;
  function ejtJelzo(be) {
    if (be && !ejtJel) { ejtJel = document.createElement('div'); ejtJel.className = 'ejt'; ejtJel.textContent = 'Engedd el a .szk fájlokat a megnyitáshoz'; document.body.appendChild(ejtJel); }
    if (!be && ejtJel) { ejtJel.remove(); ejtJel = null; }
  }
  window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); ejtDb++; ejtJelzo(true); } });
  window.addEventListener('dragleave', function () { if (--ejtDb <= 0) { ejtDb = 0; ejtJelzo(false); } });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault(); ejtDb = 0; ejtJelzo(false);
    if (!betoltve) { uzen('A számítómotor még töltődik, próbáld újra egy pillanat múlva.'); return; }
    if (e.dataTransfer && e.dataTransfer.files.length) fajlokMegnyit(e.dataTransfer.files);
  });
  window.addEventListener('beforeprint', nyomtatasElokeszit);
  window.addEventListener('beforeunload', function (e) {
    var valt = kepletek.some(function (k) { return k.valtozott && k.adat.tipus !== 'aktualis'; });
    var tarol = false;
    try { tarol = !!window.localStorage; } catch (x) { tarol = false; }
    if (valt && !tarol) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ====================================================================== */
  /* Indulás                                                                 */
  /* ====================================================================== */
  R.Jegyzet.init({
    akt: akt, uzen: uzen, kerdez: kerdez, beall: beall, letolt: letolt,
    valtozott: function (k, jelek) {
      k.valtozott = true;
      if (jelek) { k.jegyzetKulcsok = R.Jegyzet.jelek(k); render(); } else { renderCim(); munkamenetMent(); }
    }
  });
  R.Kartyak.init({ uzen: uzen, letolt: letolt });
  R.Kereses.init({
    se: function () { return se; }, beall: beall, uzen: uzen, kepletek: function () { return kepletek; },
    aktival: function (k) { var i = kepletek.indexOf(k); if (i >= 0) aktival(i); },
    megnyitFajl: function (nev, buf, handle) { if (fajlbolMegnyit(nev, buf, handle) && handle && !HOR.test(nev)) S.legutobbiHozzaad(akt().adat, nev); }
  });
  menuEpit(); eszkoztarEpit(); elvalasztoInit(); olvasoInit();
  munkamenetBetolt();
  render();
  fetch('../proba/tesztkepletek.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; })
    .then(function (l) { tesztek = Array.isArray(l) ? l.filter(function (t) { return t && t.cim && t.fajl; }) : []; })
    .catch(function () { tesztek = []; });
  SwissEph.load({ base: '../swe' }).then(function (s) {
    se = s; betoltve = true;
    $('ver').textContent = 'Swiss Ephemeris ' + se.version();
    mindSzamol();
    render();
    setInterval(aktualisFrissit, 180000);
  }).catch(function (e) {
    $('ver').textContent = 'hiba';
    $('asztal').innerHTML = '<div class="udv"><h1>Betöltési hiba</h1><p>' + R.esc(e.message) + '</p><p>Ellenőrizd, hogy a swe/ mappa feltöltődött-e a tárhelyre.</p></div>';
  });
})();
