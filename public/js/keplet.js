/*
 * keplet.js – a képlet adatmodellje és számítása:
 * pozíciók a böngészőben (Swiss Ephemeris / WebAssembly), képlet-elemzés a szerveren (api/szamol.php).
 * Licenc: AGPL-3.0.
 *
 * Képletadat (a .szk [BirthInfo] megfelelője):
 *   { nev, ev, ho, nap, ora, perc, mp, ismeretlen, telepules (adatbázis-név → .szk LocCity),
 *     telepulesKijelzes (pl. „Bécs (Wien)”), orszag, orszagKod, lat, lon,
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
  /** A település megjelenített neve (magyar név, ha van) */
  K.helyNev = function (a) { return a.telepulesKijelzes || a.telepules || ''; };

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

  /**
   * Planéta-perspektíva (DoCalculatePlanetaPerspektiva): a planéta az ASC-n, egyenlő házak tőle,
   * MC = +270°; a többi tengely marad, az eredeti ASC/MC megőrizve (a keréken AC/MC jelként látszik).
   */
  function perspektiva(hz, lon, id) {
    var u = {}; for (var k in hz) u[k] = hz[k];
    u.cusps = [0]; for (var i = 1; i <= 12; i++) u.cusps.push(((lon + (i - 1) * 30) % 360 + 360) % 360);
    u.origAsc = hz.asc; u.origMc = hz.mc;
    u.asc = lon; u.mc = (lon + 270) % 360; u.persp = id;
    return u;
  }
  K.PERSP_NEV = function (id) { return id === 10 ? 'Drakonikus perspektíva' : R.nev(id); };
  K.perspCim = function (a, id) { return 'p< ' + K.PERSP_NEV(id) + ' ' + a.nev; };

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
    // a kiválasztott kisbolygók közül azok, amelyek nincsenek az alaplistában (Eris, üstökösök, Magellán) – saját adatfájllal
    var kisb = opt.kisb && opt.kisb.be ? (opt.kisb.ids || []).filter(function (id) { return R.SZAMOLT.indexOf(id) < 0 && R.kisbolygo(id); }) : [];
    var kisbFajlok = [];
    kisb.forEach(function (id) { kisbFajlok = kisbFajlok.concat(R.kisbolygo(id)[3] || []); });
    return Promise.all([se.ensureEphe([ut.year]), kisb.length ? se.ensureFiles(kisbFajlok) : null]).then(function (r) {
      var eph = r[0];
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
      // Eris, üstökösök, Magellán: swe_calc efemerisz-idővel, mint a Windows-os; ha nincs adat az időpontra, kimarad
      kisb.forEach(function (id) {
        var x = se.calc(jd + se.deltat(jd), id, flag);
        if (x.flag >= 0) poz[id] = x;
      });
      if (a.tipus === 'persp' && !K.kos0e(a) && poz[a.perspId]) hz = perspektiva(hz, poz[a.perspId].lon, a.perspId);
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
      // Állócsillagok (CalcFixedStarPositions): a kijelöltek ekliptikai hossza, ha a megjelenítésük be van kapcsolva.
      // opt.allo = { megj, ids, orb, fsz } – a fényszögeket a szerver számolja (csillag × planéta/tengely/házcsúcs).
      var al = opt.allo, csillagok = [];
      if (al && al.megj && al.ids && al.ids.length && R.Allo) {
        al.ids.forEach(function (id) {
          var x = se.fixstar2Ut(R.Allo.kulcs(id), jd, flag);
          if (x.flag >= 0) csillagok.push({ id: id, lon: x.lon, speed: x.speedLon });
        });
        kuld.fixedStars = csillagok;
        kuld.settings = { showFixedStars: true, fixedStarIds: csillagok.map(function (c) { return c.id; }), fixedStarOrb: +al.orb || 0,
          fixedStarAspects: al.fsz || [], aspectPlanetSet: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
      }
      // „Aszteroidák megjelenítése” (chkbKellAsteroidak): kikapcsolva a kisbolygók nem vesznek részt a fényszög-számításban
      if (opt.kisb) { kuld.settings = kuld.settings || {}; kuld.settings.showAsteroids = !!opt.kisb.be; }
      if (!opt.csakPoz) { try { eredmeny.egyeb = egyebAdatok(se, jd, a, z, hz, poz); } catch (e) { eredmeny.egyeb = null; } }
      kuld.settings = alapBeall(kuld.settings);
      eredmeny.csillagok = csillagok;
      eredmeny.kuld = kuld;
      if (opt.csakPoz) return eredmeny;     // keresés: a pozíciók elegendők (az elemzés kötegelve, api/kereses.php)
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

  K.API_OSSZ = '../api/osszevet.php';
  /**
   * A program beállításaiból a szerver felé menő közös rész (orbisok, aszteroidák) – az alkalmazás állítja be:
   * K.apiBeall = function () { return { orbMode, orbs, showAsteroids }; }
   */
  K.apiBeall = null;
  function alapBeall(felul) {
    var b = typeof K.apiBeall === 'function' ? (K.apiBeall() || {}) : {}, u = {}, k;
    for (k in b) u[k] = b[k];
    for (k in (felul || {})) u[k] = felul[k];
    return u;
  }
  function kuldes(e) {
    return {
      settings: alapBeall(),
      planets: Object.keys(e.poz).map(function (id) { var x = e.poz[id]; return { id: +id, lon: x.lon, lat: x.lat, speed: x.speedLon }; }),
      cusps: e.hz.cusps.slice(1, 13),
      ascmc: [e.hz.asc, e.hz.mc, e.hz.armc, e.hz.vertex, e.hz.equAsc, e.hz.coAscKoch, e.hz.coAscMunkasey, e.hz.polarAsc]
    };
  }
  /**
   * Összevetés (keresztkapcsolati fényszögek) a szervertől: belső × külső kör.
   * Promise<{ aspects: [{a:[típus,id] (belső), b:[típus,id] (külső), aspect, exact, orb, maxOrb}], kulsoHaz: {id: ház} }>
   */
  K.osszevet = function (eBelso, eKulso, api) {
    return apiHivas(api || K.API_OSSZ, { belso: kuldes(eBelso), kulso: kuldes(eKulso), settings: alapBeall() });
  };

  K.API_KER = '../api/kereses.php';
  /** Kötegelt keresés: feltetel { mod, planeta, jegyek, hazak }, kepletek [{ id, planets, cusps, ascmc }] (≤ 25) */
  K.kereses = function (feltetel, kepletek, api) { return apiHivas(api || K.API_KER, { feltetel: feltetel, kepletek: kepletek, settings: alapBeall() }); };

  K.API_JJ = '../api/jj.php';
  /** A „Jegyek és játszmák” kártya adatai (Promise<{ enallapotok, trikofeliratok, szuloiProgramok, idoNelkul }>) */
  K.jj = function (e, idoNelkul, api) { var x = kuldes(e); x.idoNelkul = !!idoNelkul; return apiHivas(api || K.API_JJ, x); };

  K.API_OLV = '../api/olvaso.php';
  /** A horoszkópolvasó szövegei egy képlethez (Promise<{ signs, houses, planets, houseLords, selfMarkers }>) */
  K.olvaso = function (e, api) { return apiHivas(api || K.API_OLV, kuldes(e)); };

  /** A képlet megjelenített neve (Kos 0° előtaggal, ahogy a Windows-os program teszi) */
  K.cim = function (a) {
    if (K.kos0e(a) && a.nev.indexOf('Kos 0°<') !== 0) return 'Kos 0°< ' + a.nev;
    return a.nev;
  };
  K.tipusNev = function (a) {
    return a.tipus === 'aktualis' ? 'Akt. égi állás' : K.kos0e(a) ? 'Kos 0°' : a.tipus === 'persp' ? 'Planétaperspektíva' : 'Radix';
  };
  /** Életkor években (a Windows-os státuszsor „NN é” mezője) */
  /** Pontos életkor: év, hónap, nap (a mai naptári dátumig). null, ha a dátum a jövőben van. */
  K.eletkorReszletes = function (a, most) {
    most = most || new Date();
    var ev = most.getFullYear() - a.ev, ho = most.getMonth() + 1 - a.ho, nap = most.getDate() - a.nap;
    if (nap < 0) { ho--; nap += new Date(most.getFullYear(), most.getMonth(), 0).getDate(); }
    if (ho < 0) { ev--; ho += 12; }
    return ev < 0 ? null : { ev: ev, ho: ho, nap: nap };
  };

  /**
   * Az „Egyéb” fül kiegészítő adatai – csak amit a Swiss Ephemeris pontosan ad:
   * helyi közép- és látszólagos idő, Greenwich-i csillagidő, ARMC, nutáció, ajánamsa (Fagan/Bradley, mint a Windows-os),
   * Hold fázisa (swe_pheno_ut), Nap–Hold hosszkülönbség, holdkor (az előző újholdtól), napkelte/-nyugta (swe_rise_trans,
   * a korong felső széle, normál fénytöréssel), a planetáris nap és óra (káldeus sorrend, napkeltétől).
   */
  function egyebAdatok(se, jd, a, z, hz, poz) {
    var SE = SwissEph.SE, x = {}, nap = 1 / 24, i;
    var fok = function (v) { v %= 360; return v < 0 ? v + 360 : v; };
    x.lmt = jd + a.lon / 360;                         // helyi középidő (UT + hosszúság/15 óra)
    var te = se.timeEqu ? se.timeEqu(jd) : null;
    if (te !== null) x.lat = x.lmt + te;              // helyi látszólagos idő
    x.gst = ((se.sidtime(jd) % 24) + 24) % 24;        // Greenwich-i (látszólagos) csillagidő, óra
    x.armc = hz.armc;
    var nut = se.calc(jd + se.deltat(jd), -1, 0);
    x.nutacio = nut.dist;                             // nutáció hosszúságban, fok
    if (se.ayanamsaUt) x.ayanamsa = se.ayanamsaUt(jd);
    if (poz[0] && poz[1]) {
      x.napHold = fok(poz[1].lon - poz[0].lon);       // a Hold hosszúsága a Napétól
      var ph = se.phenoUt ? se.phenoUt(jd, 1, SE.FLG_SWIEPH) : null;
      if (ph) x.holdFazis = ph.fazis;
      // holdkor: az előző újhold (Hold − Nap hosszkülönbség = 0) óta, Newton-lépésekkel
      var t = jd - x.napHold / 12.19;
      for (i = 0; i < 6; i++) {
        var h = se.calcUt(t, 1, SE.FLG_SWIEPH | SE.FLG_SPEED), n = se.calcUt(t, 0, SE.FLG_SWIEPH | SE.FLG_SPEED);
        var d = fok(h.lon - n.lon); if (d > 180) d -= 360;
        t -= d / (h.speedLon - n.speedLon);
      }
      if (t <= jd && jd - t < 30) x.holdkor = jd - t;
    }
    if (se.riseTrans && Math.abs(a.lat) < 89.9) {
      var kel = function (j) { return se.riseTrans(j, 0, 1, a.lon, a.lat, 0); };
      var nyug = function (j) { return se.riseTrans(j, 0, 2, a.lon, a.lat, 0); };
      var ejfel = se.julday(a.ev, a.ho, a.nap, 0) - z.orak * nap;   // a születési nap helyi éjfele
      x.napkelte = kel(ejfel); x.napnyugta = nyug(ejfel);
      if (x.napkelte !== null && x.napkelte >= ejfel + 1) x.napkelte = null;   // aznap nem kel fel
      if (x.napnyugta !== null && x.napnyugta >= ejfel + 1) x.napnyugta = null;
      // planetáris nap és óra: az utolsó napkeltétől (12 nappali + 12 éjszakai „óra”)
      var r = kel(jd - 1.5), k2;
      for (i = 0; r !== null && i < 3; i++) { k2 = kel(r + 0.01); if (k2 === null || k2 > jd) break; r = k2; }
      var sz = r !== null ? nyug(r) : null, kov = r !== null ? kel(r + 0.01) : null;
      if (r !== null && sz !== null && kov !== null && r <= jd && kov > jd && sz > r && sz < kov) {
        var ora = jd < sz ? Math.floor((jd - r) / ((sz - r) / 12)) : 12 + Math.floor((jd - sz) / ((kov - sz) / 12));
        // a planetáris nap a napkelte helyi naptári napja; vasárnap: Nap, hétfő: Hold, …
        var dt = se.revjul(r + z.orak * nap), het = new Date(Date.UTC(dt.year, dt.month - 1, dt.day)).getUTCDay();
        var NAPUR = [0, 1, 4, 2, 5, 3, 6], KALDEUS = [6, 5, 4, 0, 3, 2, 1];
        x.planNap = NAPUR[het];
        x.planOra = KALDEUS[(KALDEUS.indexOf(x.planNap) + Math.min(23, ora)) % 7];
      }
    }
    // naptári alak (revjul): { year, month, day, hour }
    x.lmtIdo = se.revjul(x.lmt);
    if (x.lat !== undefined) x.latIdo = se.revjul(x.lat);
    if (x.napkelte) x.napkelteIdo = se.revjul(x.napkelte + z.orak * nap);
    if (x.napnyugta) x.napnyugtaIdo = se.revjul(x.napnyugta + z.orak * nap);
    return x;
  }

  K.eletkor = function (a, most) {
    most = most || new Date();
    var k = most.getFullYear() - a.ev;
    if (most.getMonth() + 1 < a.ho || (most.getMonth() + 1 === a.ho && most.getDate() < a.nap)) k--;
    return k;
  };
})(typeof window !== 'undefined' ? window : globalThis);
