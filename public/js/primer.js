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
  P.CARDAN = 59 / 60 + 12 / 3600;   // 0°59′12″
  P.KULCSOK = { ptolemaiosz: 'Ptolemaiosz (1° = 1 év)', cardan: 'Cardanus (0°59′12″ = 1 év)', naibod: 'Naibod (0°59′08″ = 1 év)',
    szulEgy: 'Születési napív az egyenlítőn', szulEkl: 'Születési napív az ekliptikán',
    napiv: 'Valós napív az egyenlítőn', napivEkl: 'Valós napív az ekliptikán', egyeni: 'Egyéni (fok / év)' };
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
   *        kulcsFv: P.kulcs(…) eredménye (ív ↔ kor) }
   * Visszaad: { sorok: [{ kor, iv, prom, fsz, oldal, szig, konverz }], kimaradt: [nevek] } kor szerint rendezve.
   */
  P.szamol = function (be, opt) {
    var sorok = [], kimaradt = {};
    var K = opt.kulcsFv || P.kulcs('ptolemaiosz', {}), kulcs = K.kor;
    var maxIv = (K.iv(opt.korMax || 100) || 120) * 1.05 + 2;
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

  /**
   * A kulcs: { kor: ív → kor (év), iv: kor → ív }.
   * k: ptolemaiosz | cardan | naibod | szulEgy | szulEkl | napiv | napivEkl | egyeni
   * ctx: { napRa(t), napLon(t) – a Nap rektaszcenziója / hossza a születés után t nappal (1 nap = 1 év); egyeni: fok/év }
   */
  P.kulcs = function (k, ctx) {
    var seb = null;
    if (k === 'ptolemaiosz') seb = 1;
    else if (k === 'cardan') seb = P.CARDAN;
    else if (k === 'naibod') seb = P.NAIBOD;
    else if (k === 'egyeni') seb = +ctx.egyeni > 0 ? +ctx.egyeni : 1;
    // születési napív: a Nap mozgása a születés napján (egyenlítőn: rektaszcenzióban, ekliptikán: hosszúságban)
    else if (k === 'szulEgy') seb = norm180(ctx.napRa(0.5) - ctx.napRa(-0.5));
    else if (k === 'szulEkl') seb = norm180(ctx.napLon(0.5) - ctx.napLon(-0.5));
    if (seb) return { kor: function (a) { return a / seb; }, iv: function (kor) { return kor * seb; } };
    // valós napív: a Nap tényleges (progresszív) útja a születés utáni napokban
    var f = k === 'napivEkl' ? ctx.napLon : ctx.napRa, tabla = [0];
    for (var t = 1; t <= 125; t++) tabla.push(tabla[t - 1] + norm180(f(t) - f(t - 1)));
    return {
      kor: function (iv) {
        for (var i = 1; i < tabla.length; i++) if (tabla[i] >= iv) return i - 1 + (iv - tabla[i - 1]) / (tabla[i] - tabla[i - 1]);
        return null;
      },
      iv: function (kor) {
        var i = Math.max(0, Math.min(tabla.length - 2, Math.floor(kor)));
        return tabla[i] + (kor - i) * (tabla[i + 1] - tabla[i]);
      }
    };
  };

  /** az a hosszúság (adott ekliptikai szélességgel), amelynek a radixban m a mundán helyzete; null, ha nincs ilyen */
  P.hosszMundan = function (m, lat, eps, armc, phi, kozel) {
    function g(l) { var p = P.pont(l, lat, eps, armc, phi); return p ? norm180(P.mundan(p.h, p) - m) : null; }
    var legjobb = null;
    for (var i = 0; i < 360; i++) {
      var a = norm(kozel - 180 + i), b = norm(a + 1), ga = g(a), gb = g(b);
      if (ga === null || gb === null) continue;
      // a mundán hely a hosszúsággal csökken (kelet felé): előjelváltás + → −, és nem a ±180°-os ugrás
      if (ga >= 0 && gb <= 0 && ga - gb < 90) {
        var lo = a, hi = a + 1;
        for (var j = 0; j < 50; j++) { var mid = (lo + hi) / 2, gm = g(norm(mid)); if (gm === null) break; if (gm >= 0) lo = mid; else hi = mid; }
        var gy = norm((lo + hi) / 2);
        if (legjobb === null || Math.abs(norm180(gy - kozel)) < Math.abs(norm180(legjobb - kozel))) legjobb = gy;
      }
    }
    return legjobb;
  };

  /**
   * Direkciós képlet (figura directionis) az ív szerint: az ég az ívvel elfordul – a tengelyek és a házak az ARMC ± ív-ből
   * (hazak(armc) → hz, a beállított házrendszerrel), a planéták ekliptikai helye marad. Az ekliptikai szélességgel bíró
   * planétát (eredeti szélesség) a direktált égen a Placidus-féle mundán helyén vetítjük az ekliptikára, ezért az kissé elmozdulhat.
   * A direktált MC/ASC (és házcsúcsok) akkor érik el a radix planétát, amikor a planéta MC-re / ASC-re direkciója pontos.
   * be: { armc, eps, phi, poz: { id: { lon, lat, speedLon } } }; visszaad: { hz, poz, kimaradt, armc }
   */
  P.direktalt = function (be, iv, konverz, hazak) {
    var armcD = norm(be.armc + (konverz ? -iv : iv)), poz = {}, kimaradt = [];
    Object.keys(be.poz).forEach(function (id) {
      var x = be.poz[id], u = {}, k;
      for (k in x) u[k] = x[k];
      poz[id] = u;
      if (!x.lat) return;
      var p = P.pont(x.lon, x.lat, be.eps, armcD, be.phi);
      if (!p) { kimaradt.push(+id); return; }
      var l = P.hosszMundan(P.mundan(p.h, p), 0, be.eps, armcD, be.phi, x.lon);
      if (l === null) kimaradt.push(+id); else u.lon = l;
    });
    return { hz: hazak(armcD), poz: poz, kimaradt: kimaradt, armc: armcD };
  };

})(typeof window !== 'undefined' ? window : globalThis);
