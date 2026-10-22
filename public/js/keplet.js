/*
 * keplet.js – a képlet adatmodellje és számítása:
 * pozíciók a böngészőben (Swiss Ephemeris / WebAssembly), képlet-elemzés a szerveren (api/szamol.php).
 * Licenc: AGPL-3.0.
 *
 * Képletadat (a .szk [BirthInfo] megfelelője):
 *   { nev, ev, ho, nap, ora, perc, mp, ismeretlen, telepules, orszag, orszagKod, lat, lon,
 *     zonaMod: 'iana' | 'lmt' | 'kezi', tz, eltolas, tzKod, nyari, jegyzet, cimkek: [], tipus: 'radix' | 'kos0' | 'aktualis' }
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var K = R.Keplet = {};

  K.API = '../api/szamol.php';

  K.ures = function () {
    return { nev: '', ev: 2000, ho: 1, nap: 1, ora: 12, perc: 0, mp: 0, ismeretlen: false,
      telepules: 'Budapest', orszag: 'Hungary', orszagKod: 'H', lat: 47.5, lon: 19.0666667,
      zonaMod: 'iana', tz: 'Europe/Budapest', eltolas: 1, tzKod: '', nyari: false, jegyzet: '', cimkek: [], tipus: 'radix' };
  };
  K.masol = function (a) { return JSON.parse(JSON.stringify(a)); };

  /** Kos 0° képlet: ismeretlen születési időnél automatikusan, vagy a Speciális menüből bármely képletre. */
  K.kos0e = function (a) { return !!(a.ismeretlen || a.tipus === 'kos0'); };

  /** A léptető eltolása (év, hó, nap, óra, perc) a helyi időn, naptárhelyesen. */
  K.leptet = function (a, l) {
    if (!l || !(l[0] || l[1] || l[2] || l[3] || l[4])) return a;
    var u = K.masol(a), d = new Date(0);
    d.setUTCFullYear(a.ev + l[0], a.ho - 1 + l[1], a.nap + l[2]);
    d.setUTCHours(a.ora + l[3], a.perc + l[4], a.mp || 0, 0);
    u.ev = d.getUTCFullYear(); u.ho = d.getUTCMonth() + 1; u.nap = d.getUTCDate();
    u.ora = d.getUTCHours(); u.perc = d.getUTCMinutes(); u.mp = d.getUTCSeconds();
    if (u.zonaMod === 'kezi' && u.tz && R.zonaErvenyes(u.tz)) u.zonaMod = 'iana'; // léptetve a valódi zónaszabály érvényes
    return u;
  };

  /** Zónaeltolás órában + leírás. LMT: a Windows-os program szerint egész percre kerekítve. */
  K.zona = function (a) {
    var h = a.ismeretlen ? 12 : a.ora, mi = a.ismeretlen ? 0 : a.perc, s = a.ismeretlen ? 0 : (a.mp || 0);
    if (a.zonaMod === 'lmt') {
      var fok = Math.trunc(Math.abs(a.lon)), perc = Math.round((Math.abs(a.lon) - fok) * 60);
      var pp = Math.round(4 * fok + (4 / 60) * perc), o = (a.lon < 0 ? -pp : pp) / 60;
      return { orak: o, kod: 'LMT', nyari: false, info: 'LMT (helyi középidő) → ' + R.oraStr(o) };
    }
    if (a.zonaMod === 'kezi' || !a.tz || !R.zonaErvenyes(a.tz)) {
      var e = +a.eltolas || 0;
      return { orak: e, kod: a.tzKod || R.oraStr(e).replace('−', '-'), nyari: !!a.nyari,
        info: (a.tzKod ? a.tzKod + ' – ' : 'Kézi – ') + R.oraStr(e) + (a.nyari ? ' (nyári időszámítás)' : '') };
    }
    var z = R.helyiZona(a.ev, a.ho, a.nap, h, mi, s, a.tz), orak = z.percek / 60;
    return { orak: orak, kod: R.zonaKod(z.utcMs, a.tz, orak), nyari: z.nyari,
      info: a.tz + ' → ' + R.oraStr(orak) + (z.nyari ? ' (nyári időszámítás)' : '') };
  };

  function kos0(hz) {
    var u = {}; for (var k in hz) u[k] = hz[k];
    u.cusps = [0]; for (var i = 1; i <= 12; i++) u.cusps.push((i - 1) * 30);
    u.asc = 0; u.mc = 270; u.kos0 = true;
    return u;
  }

  function apiHivas(url, kuld) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kuld) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { /* nem JSON */ }
          if (!r.ok || !j) throw new Error((j && j.error) || ('HTTP ' + r.status + (j ? '' : ', nem JSON-válasz')));
          return j;
        });
      });
  }

  /**
   * Teljes számítás. opt: { hsys: 'P', sid: false, api: K.API }
   * Promise<{ adat, zona, jd, ut, hz, poz, elemzes, eps, figyelmeztetes: [] }>
   */
  K.szamol = function (se, a, opt) {
    opt = opt || {};
    var SE = SwissEph.SE, hsys = opt.hsys || 'P', sid = !!opt.sid;
    if (a.ev < 1 || a.ev > 2999) return Promise.reject(new Error('Az év 1 és 2999 között lehet.'));
    var z = K.zona(a);
    var h = a.ismeretlen ? 12 : a.ora, mi = a.ismeretlen ? 0 : a.perc, s = a.ismeretlen ? 0 : (a.mp || 0);
    var jd = se.julday(a.ev, a.ho, a.nap, h + mi / 60 + s / 3600 - z.orak);
    var ut = se.revjul(jd);
    return se.ensureEphe([ut.year]).then(function (eph) {
      var flag = SE.FLG_SWIEPH | SE.FLG_SPEED | (sid ? SE.FLG_SIDEREAL : 0);
      var hz = se.housesEx(jd, sid ? SE.FLG_SIDEREAL : 0, a.lat, a.lon, hsys);
      if (K.kos0e(a)) hz = kos0(hz);
      var poz = {}, fig = [], moshier = false, hianyzo = [];
      R.SZAMOLT.forEach(function (id) {
        var x = se.calcUt(jd, id, flag);
        if (x.flag < 0) { hianyzo.push(R.nev(id)); return; }
        if (x.flag & SE.FLG_MOSEPH) moshier = true;
        poz[id] = x;
      });
      if (moshier) fig.push('Egyes testek Moshier-módban számolódtak (hiányzó adatfájl: ' + eph.missing.join(', ') + ').');
      if (hianyzo.length) fig.push('Erre az időpontra nincs adat: ' + hianyzo.join(', ') + '.');
      var eps = se.calc(jd + se.deltat(jd), -1, 0).lon; // SE_ECL_NUT: valódi ferdeség
      var eredmeny = { adat: a, zona: z, jd: jd, ut: ut, hz: hz, poz: poz, elemzes: null, elemPl: {}, eps: eps,
        hsys: hsys, sid: sid, deltaT: se.deltat(jd) * 86400,
        csillagido: (((se.sidtime(jd) + a.lon / 15) % 24) + 24) % 24, figyelmeztetes: fig };
      var kuld = {
        planets: Object.keys(poz).map(function (id) { var x = poz[id]; return { id: +id, lon: x.lon, lat: x.lat, speed: x.speedLon }; }),
        cusps: hz.cusps.slice(1, 13),
        ascmc: [hz.asc, hz.mc, hz.armc, hz.vertex, hz.equAsc, hz.coAscKoch, hz.coAscMunkasey, hz.polarAsc]
      };
      return apiHivas(opt.api || K.API, kuld).then(function (el) {
        eredmeny.elemzes = el;
        el.planets.forEach(function (p) { eredmeny.elemPl[p.id] = p; });
        return eredmeny;
      }, function (e) {
        fig.push('A képlet-elemzés nem érhető el: ' + e.message);
        return eredmeny;
      });
    });
  };

  /** A képlet megjelenített neve (Kos 0° előtaggal, ahogy a Windows-os program teszi) */
  K.cim = function (a) {
    if (K.kos0e(a) && a.nev.indexOf('Kos 0°<') !== 0) return 'Kos 0°< ' + a.nev;
    return a.nev;
  };
  K.tipusNev = function (a) {
    return a.tipus === 'aktualis' ? 'Akt. égi állás' : K.kos0e(a) ? 'Kos 0°' : 'Radix';
  };
  /** Életkor években (a Windows-os státuszsor „NN é” mezője) */
  K.eletkor = function (a, most) {
    most = most || new Date();
    var k = most.getFullYear() - a.ev;
    if (most.getMonth() + 1 < a.ho || (most.getMonth() + 1 === a.ho && most.getDate() < a.nap)) k--;
    return k;
  };
})(typeof window !== 'undefined' ? window : globalThis);
