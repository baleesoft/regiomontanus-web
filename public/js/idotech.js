/*
 * idotech.js – időbeli technikák: tranzit, progressziós Hold (szekunder direkció), primer direkció,
 * szolár-képlet és revolúciók (bolygó-visszatérés keresése), a Windows-os program (uAstro4AllMain,
 * TSegedabraCalculator) szerint.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var K = R.Keplet;
  var I = R.Idotech = {};

  /* Előtagok a képletnevekben – mint a Windows-os fülek feliratában */
  I.ELOTAG = { tranzit: 'Tr>', ph: 'PH>', pd: 'Pd>', sol: 'Sol>', rev: 'Rev>', szin: '' };
  I.NEV = { tranzit: 'Tranzit', ph: 'Progressziós Hold', pd: 'Primer direkció', sol: 'Szolár-képlet', rev: 'Revolúció', szin: 'Összevetés' };

  function fokNorm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  /** swe_difdeg2n: a - b, −180..+180 */
  function kul(a, b) { var d = fokNorm(a - b); return d >= 180 ? d - 360 : d; }
  I.kul = kul;

  /** UT Julián-dátum -> helyi idő (óra eltolással) mezőkre bontva */
  function jdBol(se, jd, orak) {
    var r = se.revjul(jd + orak / 24), h = r.hour, ora = Math.floor(h), perc = Math.floor((h - ora) * 60),
      mp = Math.round(((h - ora) * 60 - perc) * 60);
    if (mp === 60) { mp = 0; perc++; }
    if (perc === 60) { perc = 0; ora++; }
    var d = new Date(0); d.setUTCFullYear(r.year, r.month - 1, r.day); d.setUTCHours(ora, perc, mp, 0);
    return { ev: d.getUTCFullYear(), ho: d.getUTCMonth() + 1, nap: d.getUTCDate(), ora: d.getUTCHours(), perc: d.getUTCMinutes(), mp: d.getUTCSeconds() };
  }
  I.jdBol = jdBol;

  /** A képlet UT Julián-dátuma */
  I.jd = function (se, a) {
    var z = K.zona(a), h = a.ismeretlen ? 12 : a.ora, mi = a.ismeretlen ? 0 : a.perc, s = a.ismeretlen ? 0 : (a.mp || 0);
    return se.julday(a.ev, a.ho, a.nap, h + mi / 60 + s / 3600 - z.orak);
  };

  /**
   * Adott UT időpont képletadata egy helyen. A zóna: a hely IANA-zónája (ha van), különben a megadott
   * (kézi) eltolás – így a Windows-os programhoz hasonlóan a helyi idő és a zónakód is kiíródik.
   */
  I.adatJd = function (se, jd, hely, alap) {
    var a = K.masol(alap || K.ures());
    delete a.eredeti;
    ['telepules', 'telepulesKijelzes', 'orszag', 'orszagKod', 'lat', 'lon', 'tz'].forEach(function (k) {
      if (hely && hely[k] !== undefined) a[k] = hely[k];
    });
    a.ismeretlen = false; a.jegyzet = ''; a.cimkek = [];
    var orak;
    if (a.tz && R.zonaErvenyes(a.tz)) {
      // a zóna eltolása pontosan ebben a pillanatban (nyári időszámítás váltásánál is jó)
      orak = R.zonaEltolasUtc((jd - 2440587.5) * 86400000, a.tz) / 60;
      a.zonaMod = 'iana';
    } else {
      orak = hely && hely.eltolas !== undefined ? +hely.eltolas : K.zona(a).orak;
      a.zonaMod = 'kezi'; a.eltolas = orak; a.tzKod = hely && hely.tzKod !== undefined ? hely.tzKod : a.tzKod;
    }
    var l = jdBol(se, jd, orak);
    a.ev = l.ev; a.ho = l.ho; a.nap = l.nap; a.ora = l.ora; a.perc = l.perc; a.mp = l.mp;
    return a;
  };

  /* ---------- Progressziós Hold (szekunder direkció): 1 nap = 1 év, 2 óra = 1 hónap ---------- */
  /**
   * A Windows-os Progressziok_SzekunderDirekcio: ha az érték > 200, évszám (életkor = év − születési év),
   * a hónap ekkor naptári hónap (eltérés a születési hónaptól); különben életkor és +hónap.
   */
  I.phEltolas = function (a, ertek, honap) {
    var napok, orak = 0;
    if (ertek > 200) {
      napok = Math.abs(a.ev - ertek);
      if (honap) orak = (honap - a.ho) * 2;
    } else {
      napok = ertek;
      if (honap) orak = honap * 2;
    }
    return { napok: napok, orak: orak };
  };
  /**
   * A progressziós képlet: a születés UT-ja + napok + órák; a helyi idő a születési zónaeltolással
   * (a Windows-os program a képletfájl zónaadatával számol, ld. GetGMTFromBirthDateTime).
   */
  I.progr = function (se, a, napok, orak) {
    var jd0 = I.jd(se, a), z = K.zona(a), jd = jd0 + napok + orak / 24;
    var u = K.masol(a); delete u.eredeti;
    var l = jdBol(se, jd, z.orak);
    u.ev = l.ev; u.ho = l.ho; u.nap = l.nap; u.ora = l.ora; u.perc = l.perc; u.mp = l.mp;
    if (u.zonaMod !== 'lmt') { u.zonaMod = 'kezi'; u.eltolas = z.orak; u.tzKod = z.kod; u.nyari = z.nyari; }
    u.ismeretlen = false; u.jegyzet = ''; u.cimkek = [];
    return u;
  };
  /** Napok (törttel) -> „27 év 3 hó” (Get_SecDirHold_StrValue) */
  function evHo(napok) {
    var ev = Math.trunc(napok), ho = Math.round((napok - ev) * 12);
    if (ho === 12) { ev++; ho = 0; }
    return ev + ' év' + (ho ? ' ' + ho + ' hó' : '');
  }
  I.evHo = evHo;
  /**
   * A progressziós Hold ugyanezen a helyen (±2°): a következő és a két előző Hold-ciklus
   * (DoCalculateSecDirHold: +27 nap, −27 nap, −54 nap, 2 órás lépésekkel).
   * Visszaad: [{ napok, datum: Date (a valódi életben), szoveg }], időrendben.
   */
  I.progrHold = function (se, szul, progr, flag) {
    var jdSzul = I.jd(se, szul), jdAkt = I.jd(se, progr);
    var hold = se.calcUt(jdAkt, 1, flag).lon, ki = [];
    function keres(kezd, lepes) {
      var jd = jdAkt + kezd, n = 0;
      if (jd < jdSzul) return;
      while (Math.abs(kul(se.calcUt(jd, 1, flag).lon, hold)) > 2 && n++ < 2000) jd += lepes / 24;
      ki.push(jd);
    }
    keres(27, 2); ki.push(jdAkt); keres(-27, -2); keres(-54, -2);
    var szulDatum = new Date(Date.UTC(szul.ev, szul.ho - 1, szul.nap));
    return ki.map(function (jd) {
      var napok = jd - jdSzul, d = new Date(szulDatum.getTime());
      d.setUTCMonth(d.getUTCMonth() + Math.round(napok * 12));
      return { napok: napok, aktualis: jd === jdAkt, ev: d.getUTCFullYear(), ho: d.getUTCMonth() + 1,
        szoveg: d.getUTCFullYear() + '. év ' + (d.getUTCMonth() + 1) + ' hó – ' + evHo(napok) };
    }).sort(function (x, y) { return x.napok - y.napok; });
  };

  /* ---------- Primer direkció: 1° = 1 év, minden elem elfordul ---------- */
  /** n fok (konverz iránynál negatív) – a Windows-os DoCalculatePrimerDirekcio */
  I.primer = function (e, n) {
    var u = {}, k;
    for (k in e) u[k] = e[k];
    u.poz = {};
    Object.keys(e.poz).forEach(function (id) {
      var x = {}, kk; for (kk in e.poz[id]) x[kk] = e.poz[id][kk];
      x.lon = fokNorm(x.lon + n); u.poz[id] = x;
    });
    var hz = {}; for (k in e.hz) hz[k] = e.hz[k];
    hz.cusps = e.hz.cusps.map(function (c, i) { return i === 0 ? c : fokNorm(c + n); });
    ['asc', 'mc', 'armc', 'vertex', 'equAsc', 'coAscKoch', 'coAscMunkasey', 'polarAsc'].forEach(function (t) {
      if (typeof hz[t] === 'number') hz[t] = fokNorm(hz[t] + n);
    });
    u.hz = hz;
    if (e.elemzes) {
      var el = JSON.parse(JSON.stringify(e.elemzes));
      el.planets.forEach(function (p) { p.lon = fokNorm(p.lon + n); p.sign = Math.floor(p.lon / 30); });
      el.cusps.forEach(function (c) { c.lon = fokNorm(c.lon + n); c.sign = Math.floor(c.lon / 30); });
      (el.selfMarkers || []).forEach(function (m) { if (typeof m.lon === 'number') m.lon = fokNorm(m.lon + n); });
      u.elemzes = el; u.elemPl = {};
      el.planets.forEach(function (p) { u.elemPl[p.id] = p; });
    }
    u.primer = n;
    return u;
  };

  /* ---------- Bolygó-visszatérés (revolúció) keresése ---------- */
  /**
   * Az első időpont jdKezd után (elore = false: előtte), amikor az ipl planéta hossza eléri a cel fokot.
   * Lépés: Hold 0,25 nap, a többi 1 nap; előjelváltásnál felezés másodperc pontosságig.
   * Visszaad: UT Julián-dátum, vagy null (nincs találat ~400 éven belül).
   */
  I.atmenet = function (se, ipl, cel, jdKezd, elore, flag) {
    var lepes = (ipl === 1 ? 0.25 : 1) * (elore === false ? -1 : 1);
    var f = function (jd) { return kul(se.calcUt(jd, ipl, flag).lon, cel); };
    var t0 = jdKezd, d0 = f(t0), max = Math.ceil(400 * 365.25 / Math.abs(lepes));
    for (var i = 0; i < max; i++) {
      var t1 = t0 + lepes, d1 = f(t1);
      if (d1 === 0) return t1;
      if ((d0 < 0) !== (d1 < 0) && Math.abs(d1) < 30 && Math.abs(d0) < 30) {
        var a = t0, b = t1, da = d0;
        for (var j = 0; j < 50 && Math.abs(b - a) > 0.5 / 86400; j++) {
          var m = (a + b) / 2, dm = f(m);
          if ((dm < 0) === (da < 0)) { a = m; da = dm; } else b = m;
        }
        return (a + b) / 2;
      }
      t0 = t1; d0 = d1;
    }
    return null;
  };

  /**
   * Szolár-képlet az adott évre: a Nap visszatérése a születési helyére. A keresés a születésnap előtt
   * 2 nappal indul (GetUpdate_SolarRevolucioValue). Ha az év kisebb a születési évnél, életkornak veszi.
   */
  I.szolarEv = function (szul, ev) { return ev < szul.ev ? szul.ev + ev : ev; };
  I.szolar = function (se, szul, napHossz, ev, flag) {
    var jdSzul = I.jd(se, szul), r = se.revjul(jdSzul);
    var kezd = se.julday(ev, r.month, Math.min(r.day, 28), r.hour) - 2;
    if (r.day > 28) kezd += r.day - 28;
    return I.atmenet(se, 0, napHossz, kezd, true, flag);
  };

  /** A képletadatok összehasonlítható kulcsa (egy személyhez tartozó képletek felismerése) */
  I.szemelyKulcs = function (a) { return [a.nev, a.ev, a.ho, a.nap, a.ora, a.perc].join('|'); };
})(typeof window !== 'undefined' ? window : globalThis);
