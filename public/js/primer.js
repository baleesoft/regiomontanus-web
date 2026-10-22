/*
 * primer.js – valódi primer direkciók (a Föld napi forgásán alapuló, „Placidus-féle félív” módszer).
 *
 * A régi, Windows-os „primer direkció” (minden pont + 1°/év) a „Primer (1° = 1 év) direkciók” menüpont maradt;
 * ez a modul a hagyományos számítást végzi:
 *   - minden pont (promisszor, szignifikátor) egyenlítői koordinátái: rektaszcenzió, deklináció;
 *   - óraszög H = ARMC − RA (nyugat felé pozitív), félívek: nappali DSA = 90° + AD, éjszakai NSA = 90° − AD,
 *     ahol AD = asin(tg φ · tg δ) az aszcenziós differencia (φ a születési hely földrajzi szélessége);
 *   - mundán helyzet (a pont arányos helye a félívén): m = 90°·H/DSA a horizont felett (MC = 0°, ASC = −90°, DSC = +90°),
 *     a horizont alatt a NSA szerint ±180°-ig (IC);
 *   - az ív az az elfordulás (ARMC-növekmény), amely a promisszort (zodiákális módszernél a fényszögpontját) a szignifikátor
 *     mundán helyére viszi – direkt: előre forgatva, konverz: visszafelé forgatva;
 *   - az ív évekre váltása kulccsal: Ptolemaiosz (1° = 1 év), Naibod (0°59′08″ = 1 év), vagy a valódi napív
 *     (a Nap rektaszcenziós mozgása a születés utáni napokban, 1 nap = 1 év).
 * Ellenőrzés: az MC-re irányított pont íve RA − ARMC, az ASC-re irányítotté OA − (ARMC + 90°) – a klasszikus képletek.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var D = Math.PI / 180;
  function norm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function norm180(x) { x = norm(x); return x > 180 ? x - 360 : x; }

  var P = R.Primer = {};
  P.NAIBOD = 0.98564733;            // 0°59′08,33″ – a Nap közepes napi mozgása
  P.KULCSOK = { ptolemaiosz: 'Ptolemaiosz (1° = 1 év)', naibod: 'Naibod (0°59′08″ = 1 év)', napiv: 'Valódi napív (a Nap rektaszcenziója)' };
  P.MODOK = { zod: 'Placidus-félív, zodiákális (in zodiaco)', mund: 'Placidus-félív, mundán (in mundo)' };

  /** ekliptikai (λ, β) → egyenlítői (RA, δ), fokban */
  P.egyenlitoi = function (lon, lat, eps) {
    var l = lon * D, b = lat * D, e = eps * D;
    var sd = Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l);
    var ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
    return { ra: norm(ra / D), dec: Math.asin(Math.max(-1, Math.min(1, sd))) / D };
  };
  /** egy pont a forgó égen: óraszög és félívek; cirkumpoláris pontnál null */
  P.pont = function (lon, lat, eps, armc, phi) {
    var q = P.egyenlitoi(lon, lat, eps), x = Math.tan(phi * D) * Math.tan(q.dec * D);
    if (Math.abs(x) >= 1) return null;
    var ad = Math.asin(x) / D;
    return { ra: q.ra, dec: q.dec, ad: ad, dsa: 90 + ad, nsa: 90 - ad, h: norm180(armc - q.ra) };
  };
  /** mundán helyzet az óraszögből (−180…180; MC 0, ASC −90, DSC 90, IC ±180) */
  P.mundan = function (h, p) {
    if (h >= -p.dsa && h <= p.dsa) return 90 * h / p.dsa;
    if (h > p.dsa) return 90 + 90 * (h - p.dsa) / p.nsa;
    return -90 - 90 * (-p.dsa - h) / p.nsa;
  };
  /** a mundán helyzethez tartozó óraszög (a fenti inverze) */
  P.oraszog = function (m, p) {
    m = norm180(m);
    if (Math.abs(m) <= 90) return m * p.dsa / 90;
    if (m > 90) return p.dsa + (m - 90) * p.nsa / 90;
    return -p.dsa - (-90 - m) * p.nsa / 90;
  };
  /** az ív: mennyit kell forognia az égnek (direkt: előre, konverz: vissza), hogy a pont a cél mundán helyre érjen */
  P.iv = function (p, celM, konverz) {
    var h = P.oraszog(celM, p);
    return konverz ? norm(p.h - h) : norm(h - p.h);
  };

  /**
   * A direkciók listája.
   * be: { armc, eps, phi (földrajzi szélesség), elemek: { id: { lon, lat, nev, jel } }, asc, mc }
   * opt: { mod: 'zod'|'mund', szel: bool (a promisszor ekliptikai szélességével), kulcs, irany: 'direkt'|'konverz'|'mindketto',
   *        szig: [id | 'AC' | 'MC'], prom: [id], fsz: [fényszög-azonosítók, R.FENYSZOG], korMin, korMax,
   *        napiv: function (ív) → kor években (csak a „napiv” kulcshoz) }
   * Visszaad: { sorok: [{ kor, iv, prom, fsz, oldal, szig, konverz }], kimaradt: [nevek] } kor szerint rendezve.
   */
  P.szamol = function (be, opt) {
    var sorok = [], kimaradt = {};
    var kulcs = opt.kulcs === 'naibod' ? function (a) { return a / P.NAIBOD; }
      : opt.kulcs === 'napiv' && opt.napiv ? opt.napiv : function (a) { return a; };
    var maxIv = (opt.korMax || 100) * (opt.kulcs === 'naibod' ? P.NAIBOD : 1) * 1.1 + 2;
    var iranyok = opt.irany === 'konverz' ? [true] : opt.irany === 'mindketto' ? [false, true] : [false];
    // szignifikátorok mundán helye
    var szigek = [];
    (opt.szig || []).forEach(function (s) {
      if (s === 'AC') { szigek.push({ id: 'AC', nev: 'Ascendens', jel: 'AC', m: -90 }); return; }
      if (s === 'MC') { szigek.push({ id: 'MC', nev: 'Medium Coeli', jel: 'MC', m: 0 }); return; }
      var el = be.elemek[s]; if (!el) return;
      var p = P.pont(el.lon, el.lat || 0, be.eps, be.armc, be.phi);
      if (!p) { kimaradt[el.nev] = 1; return; }
      szigek.push({ id: s, nev: el.nev, jel: el.jel, m: P.mundan(p.h, p) });
    });
    (opt.prom || []).forEach(function (pid) {
      var pe = be.elemek[pid]; if (!pe) return;
      (opt.fsz || []).forEach(function (f) {
        var szog = R.FENYSZOG[f] ? R.FENYSZOG[f][1] : null;
        if (szog === null) return;
        // együttállás és szembenállás egyszer, a többi fényszög mindkét oldalra (+: az állatövben előre, −: hátra)
        var oldalak = szog === 0 || szog === 180 ? [1] : [1, -1];
        oldalak.forEach(function (o) {
          var pz = null, eltolas = 0;
          if (opt.mod === 'mund') {
            pz = P.pont(pe.lon, pe.lat || 0, be.eps, be.armc, be.phi);       // a promisszor maga, mundán fényszöggel
            eltolas = o * szog;
          } else {
            pz = P.pont(norm(pe.lon + o * szog), opt.szel ? (pe.lat || 0) : 0, be.eps, be.armc, be.phi);  // a fényszögpont
          }
          if (!pz) { kimaradt[pe.nev] = 1; return; }
          szigek.forEach(function (s) {
            if (s.id === pid) return;
            iranyok.forEach(function (konv) {
              // mundán módszernél a promisszor a szignifikátortól „szog” mundán fokra kerül
              var cel = opt.mod === 'mund' ? s.m - eltolas : s.m;
              var iv = P.iv(pz, cel, konv);
              if (iv > maxIv || iv < 1e-9) return;
              var kor = kulcs(iv);
              if (kor === null || kor === undefined || !isFinite(kor)) return;
              if (kor < (opt.korMin || 0) || kor > (opt.korMax || 100)) return;
              sorok.push({ kor: kor, iv: iv, prom: pe, promId: pid, fsz: f, oldal: szog === 0 || szog === 180 ? '' : (o > 0 ? '+' : '−'),
                szig: s, konverz: konv });
            });
          });
        });
      });
    });
    sorok.sort(function (a, b) { return a.kor - b.kor; });
    return { sorok: sorok, kimaradt: Object.keys(kimaradt) };
  };

  /** a valódi napív kulcs: ív (RA-fok) → kor (év); napRa(t) a Nap rektaszcenziója a születés után t nappal */
  P.napivKulcs = function (napRa, maxNap) {
    var tabla = [0];
    for (var t = 1; t <= maxNap; t++) tabla.push(tabla[t - 1] + norm180(napRa(t) - napRa(t - 1)));
    return function (iv) {
      for (var i = 1; i < tabla.length; i++) {
        if (tabla[i] >= iv) return i - 1 + (iv - tabla[i - 1]) / (tabla[i] - tabla[i - 1]);
      }
      return null;
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
