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
  var FSZ = { 1: '☌', 2: '☍', 3: '□', 4: '∠', 5: '⚼', 6: '△', 7: '⚹', 8: '⚺', 9: '⚻', 10: 'Q', 11: '⊥', 12: 'bQ' };
  var FSZNEV = { 1: 'Együttállás', 2: 'Szembenállás', 3: 'Negyedfény', 4: 'Nyolcadfény', 5: 'Három-nyolcadfény',
    6: 'Harmadfény', 7: 'Hatodfény', 8: 'Tizenkettedfény', 9: 'Öt-tizenkettedfény', 10: 'Ötödfény', 11: 'Tizedfény', 12: 'Két-ötödfény' };

  /* A Windows-os program gyári beállításai (uAstro4AllMain: alapértelmezések visszaállítása) */
  var ALAP = {
    planets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],          // chkbBolygok; holdcsomó és kisbolygó alapból nincs
    aspectTypes: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // chkbFenyszogek: együttállás-vonal nincs
    aspectSymbols: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    aspectPlanets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],     // chkbFenyszogeltBolygok
    dashed: [6, 7, 8, 9, 10, 11, 12],                  // chkbFenyszogStyle: harmadfénytől szaggatott
    houseLords: true, feral: true, retrograde: false, stationary: false,
    selfMarkers: true, selfMarkerAtOrigPlace: true, cuspLabels: true,
    colors: { fire: '#FB031B', earth: '#0BCA02', air: '#FFFF55', water: '#2A6AFF', aspectBg: '#FFFFFF', aspect: '#000000' }
  };

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
    for (kk in (beall || {})) o[kk] = beall[kk];
    if (kulso) { o.selfMarkers = false; o.cuspLabels = false; o.outerTicks = true; }

    var r = 400, R = r * (kulso ? 1.3 : 1.2);
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

    // Sugarak (r arányában) – GetInnerZodiacBorderGap stb.
    var R_ZOD_SAV = r - Math.round(r / 6 * 0.8);     // 0,867 r – a színes sáv belső széle
    var R_ZOD_BELSO = r - r / 6;                      // 0,833 r – fokbeosztás alapja, vezetővonalak célja
    var R_PLANETA = r - 0.2833 * r;                   // 0,717 r – planéta-jelek
    var R_HAZ_KULSO = r - (0.575 * 0.85 * r + 3);     // ≈0,511 r – házszám-gyűrű külső köre
    var R_HAZSZAM = r - 0.575 * 0.93 * r;             // 0,465 r – házszámok
    var R_FSZ = r - 0.575 * r;                        // 0,425 r – fényszögkör

    // Betűméretek (GetFontSize = 12 - (450 - D) div 55, D = 2r; pt -> px)
    var F = (12 - Math.trunc((450 - 2 * r) / 55)) * 4 / 3;
    var pxPlaneta = F * 1.25, pxJegy = F * 1.3, pxHazszam = (F * 3 / 4 - 6) * 4 / 3;
    var pxKicsi = F * 0.62, pxFsz = F * 0.72, pxJelolo = F * 1.05;

    var svg = el('svg', { viewBox: [-R, -R, 2 * R, 2 * R].join(' '), xmlns: NS, role: 'img',
      'aria-label': 'Képletkerék', 'font-family': TXT, style: 'width:100%;height:auto;display:block' });
    el('rect', { x: -R, y: -R, width: 2 * R, height: 2 * R, fill: '#fff' }, svg);

    /* ---------- zodiákus-sáv ---------- */
    var gZod = el('g', {}, svg);
    for (var j = 0; j < 12; j++) {
      var a0 = j * 30, a1 = j * 30 + 30;
      var p0 = pont(a0, r), p1 = pont(a1, r), q1 = pont(a1, R_ZOD_SAV), q0 = pont(a0, R_ZOD_SAV);
      el('path', { d: 'M' + p0 + 'A' + r + ',' + r + ' 0 0 0 ' + p1 + 'L' + q1 + 'A' + R_ZOD_SAV + ',' + R_ZOD_SAV + ' 0 0 1 ' + q0 + 'Z',
        fill: elemSzin(j, o.colors), stroke: 'none' }, gZod);
      var pj = pont(j * 30 + 15, (r + R_ZOD_SAV) / 2);
      cim(szoveg(JEGY[j] + VS, { x: pj[0], y: pj[1], 'font-size': pxJegy, 'font-family': SYM, 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: '#000', 'data-olv': 'jegy:' + j }, gZod), JNEV[j]);
    }
    var gVonal = el('g', { stroke: '#000', fill: 'none', 'stroke-width': 1 }, svg);
    [r, R_ZOD_SAV, R_ZOD_BELSO, R_HAZ_KULSO].forEach(function (rr) { el('circle', { r: rr }, gVonal); });
    el('circle', { r: R_FSZ, fill: o.colors.aspectBg }, gVonal);
    // fokbeosztás: 30° teljes, 10° r/48, 5° r/72, 1° r/96 (a 0,833 r körről kifelé)
    var tick = '';
    for (var d = 0; d < 360; d++) {
      var h = d % 30 === 0 ? r - R_ZOD_BELSO : d % 10 === 0 ? r / 48 : d % 5 === 0 ? r / 72 : r / 96;
      var t1 = pont(d, R_ZOD_BELSO), t2 = pont(d, R_ZOD_BELSO + h);
      tick += 'M' + t1[0].toFixed(2) + ',' + t1[1].toFixed(2) + 'L' + t2[0].toFixed(2) + ',' + t2[1].toFixed(2);
    }
    el('path', { d: tick, 'stroke-width': 0.8 }, gVonal);
    // több képletnél a sáv külső szélén is fokbeosztás, befelé (DrawDegreeLines(0, −iSub), D 1033–1045, 1137–1155)
    if (o.outerTicks) {
      var tickK = '';
      for (var dk = 0; dk < 360; dk++) {
        if (dk % 30 === 0) continue;
        var hk = dk % 10 === 0 ? r / 48 : dk % 5 === 0 ? r / 72 : r / 96;
        var u1 = pont(dk, r), u2 = pont(dk, r - hk);
        tickK += 'M' + u1[0].toFixed(2) + ',' + u1[1].toFixed(2) + 'L' + u2[0].toFixed(2) + ',' + u2[1].toFixed(2);
      }
      el('path', { d: tickK, 'stroke-width': 0.8 }, gVonal);
    }

    /* ---------- planéták elhelyezése (DrawPlanets + ReArrangePlanets) ---------- */
    var cs = k.cusps;
    var lathato = k.planets.filter(function (p) { return o.planets.indexOf(p.id) >= 0 && PLANETA[p.id] !== undefined; });
    if (o.szemely) lathato = szemelyisegrajz(k, o);
    var urSzoveg = function (p) {
      if (!o.houseLords || !p.lordOf) return '';
      var s = p.lordOf.join(',');
      if (p.closedLordOf && p.closedLordOf.length) s += (s ? ' ' : '') + '(' + p.closedLordOf.join(',') + ')';
      return s;
    };
    var W = pxPlaneta * 1.05;
    var elemek = lathato.map(function (p) {
      var lon = p.lon, h = p.house;
      // házhatár melletti planéták 3°-kal beljebb (csak a kezdő elhelyezésnél)
      if (h) {
        var hk = cs[h], hv = cs[h % 12 + 1];
        if (lon >= hk && lon <= fokNorm(hk + 3)) lon = fokNorm(lon + 3);
        else if (lon <= hv && lon >= fokNorm(hv - 3)) lon = fokNorm(lon - 3);
      }
      var ur = urSzoveg(p);
      // a doboz a házúr-feliratot is magában foglalja (a Windows-os vezérlő mérete is így számol)
      var e = { p: p, orig: p.lon, uj: p.lon, ur: ur, w: Math.max(W, ur.length * pxKicsi * 0.56),
        h: W + (ur ? pxKicsi * 1.15 : 0) };
      helyez(e, lon);
      return e;
    });
    function helyez(e, lon) { var q = pont(lon, R_PLANETA); e.x = q[0]; e.y = q[1]; e.bal = q[0] - e.w / 2; e.fent = q[1] - e.w / 2; }
    function atfed(a, b) {
      return a.bal < b.bal + b.w && b.bal < a.bal + a.w && a.fent < b.fent + b.h && b.fent < a.fent + a.h;
    }
    // planétaperspektívánál az eredeti ASC és MC jele a planéták között; nem mozdul (D 1841–1845, 2603–2609)
    (k.tengelyJelek || []).forEach(function (t) {
      if (typeof t[1] !== 'number') return;
      var e = { tengely: t[0], nev: t[2], orig: t[1], uj: t[1], ur: '', w: W, h: W, fix: true };
      helyez(e, t[1]); elemek.push(e);
    });
    var biztonsag = 0, rendben;
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
    } while (!rendben && biztonsag <= 250);

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
    for (var hz = 1; hz <= 12; hz++) {
      var vast = (hz === 1 || hz === 4 || hz === 7 || hz === 10) ? 2.2 : 1;
      if (cikk[hz]) {
        vonal(cs[hz], R_ZOD_BELSO, R_HAZ_KULSO, { 'stroke-width': 1, 'stroke-dasharray': '1.5 3' }, gHaz);
        vonal(cs[hz], R_HAZ_KULSO, R_FSZ, { 'stroke-width': vast }, gHaz);
      } else {
        vonal(cs[hz], R_ZOD_BELSO, R_FSZ, { 'stroke-width': vast }, gHaz);
      }
      // házszám a ház közepén
      var kezd = cs[hz], veg = cs[hz % 12 + 1];
      if (veg < kezd) veg += 360;
      var hp = pont(kezd + (veg - kezd) / 2, R_HAZSZAM);
      szoveg(String(hz), { x: hp[0], y: hp[1], 'font-size': pxHazszam, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        fill: '#000', stroke: 'none', 'data-olv': 'haz:' + hz }, gHaz);
    }

    /* ---------- fényszögek (DrawAspects) ---------- */
    var gFsz = el('g', { stroke: o.colors.aspect, 'stroke-width': 1 }, svg);
    var hely = {}; elemek.forEach(function (e) { if (!e.tengely) hely[e.p.id] = e.uj; });
    (k.aspects || []).forEach(function (a) {
      if (a.a[0] !== 'P' || a.b[0] !== 'P') return;            // tengely/házcsúcs-fényszögek alapból nem látszanak
      var id1 = a.a[1], id2 = a.b[1];
      if (hely[id1] === undefined || hely[id2] === undefined) return;
      if (o.aspectTypes.indexOf(a.aspect) < 0) return;
      if (o.aspectPlanets.indexOf(id1) < 0 && o.aspectPlanets.indexOf(id2) < 0) return;
      var p = pont(hely[id1], R_FSZ), q = pont(hely[id2], R_FSZ);
      var vonalE = el('line', { x1: p[0].toFixed(2), y1: p[1].toFixed(2), x2: q[0].toFixed(2), y2: q[1].toFixed(2),
        'stroke-dasharray': o.dashed.indexOf(a.aspect) >= 0 ? '6 5' : null }, gFsz);
      var leiras = PNEV[id1] + ' – ' + PNEV[id2] + ': ' + FSZNEV[a.aspect] + ' (' + fokStr(a.orb).replace(/\d+"$/, '') + ')';
      cim(vonalE, leiras);
      if (o.aspectSymbols.indexOf(a.aspect) >= 0) {
        var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        cim(szoveg(FSZ[a.aspect] + (FSZ[a.aspect].length === 1 ? VS : ''), { x: mx, y: my,
          'font-size': FSZ[a.aspect].length > 1 || a.aspect === 10 ? pxFsz * 0.75 : pxFsz,
          'font-family': a.aspect >= 10 ? TXT : SYM, 'font-weight': a.aspect >= 10 ? 'bold' : null,
          'text-anchor': 'middle', 'dominant-baseline': 'central', fill: o.colors.aspect, stroke: 'none' }, gFsz), leiras);
      }
    });

    /* ---------- planéták: fehér doboz, jel, házúr, vezetővonal, F/i ---------- */
    var gPl = el('g', {}, svg);
    elemek.forEach(function (e) {
      if (e.tengely) {
        var gt = el('g', { 'class': 'tengelyjel', 'data-tengely': e.tengely }, gPl), jt = jegy(e.orig);
        cim(gt, e.nev + ': ' + JNEV[jt] + ' ' + fokStr(fokNorm(e.orig) - jt * 30));
        el('rect', { x: e.bal, y: e.fent, width: e.w, height: e.w, fill: '#fff' }, gt);
        szoveg(e.tengely, { x: e.x, y: e.y, 'font-size': pxKicsi * 1.25, 'font-weight': 'bold', 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000' }, gt);
        var zt = pont(e.orig, R_ZOD_BELSO), dxt = zt[0] - e.x, dyt = zt[1] - e.y, tt = Infinity;
        if (dxt !== 0) tt = Math.min(tt, Math.abs((e.w / 2) / dxt));
        if (dyt !== 0) tt = Math.min(tt, Math.abs((e.w / 2) / dyt));
        if (tt < 1) el('line', { x1: (e.x + dxt * tt).toFixed(2), y1: (e.y + dyt * tt).toFixed(2), x2: zt[0].toFixed(2), y2: zt[1].toFixed(2),
          stroke: '#000', 'stroke-width': 0.8 }, gt);
        return;
      }
      var p = e.p, g = el('g', { 'class': 'planeta', 'data-id': p.id, 'data-olv': 'pl:' + p.id }, gPl);
      var j = jegy(p.lon), fj = fokNorm(p.lon) - j * 30;
      cim(g, PNEV[p.id] + ': ' + JNEV[j] + ' ' + fokStr(fj) + (p.house ? ', ' + p.house + '. ház' : '') +
        (p.speed < 0 ? ', retrográd' : '') + (p.feral ? ', ferális' : '') + (p.isolated ? ', izolált' : ''));
      el('rect', { x: e.bal, y: e.fent, width: e.w, height: e.h, fill: '#fff' }, g);
      szoveg(PLANETA[p.id] + VS, { x: e.x, y: e.y, 'font-size': pxPlaneta, 'font-family': SYM, 'text-anchor': 'middle',
        'dominant-baseline': 'central', fill: '#000' }, g);
      if (e.ur) {
        // házúr-számok: számonként külön elem (a horoszkópolvasó mindegyikhez külön szöveget ad)
        var tu = el('text', { x: e.x, y: e.fent + e.w + pxKicsi * 0.45, 'font-size': pxKicsi, 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000' }, g);
        var darab = function (t, kulcs) { var ts = el('tspan', kulcs ? { 'data-olv': kulcs } : {}, tu); ts.textContent = t; };
        (p.lordOf || []).forEach(function (n, i) { if (i) darab(','); darab(String(n), 'ur:' + p.id + ':' + n); });
        if (p.closedLordOf && p.closedLordOf.length) {
          darab(((p.lordOf || []).length ? ' ' : '') + '(');
          p.closedLordOf.forEach(function (n, i) { if (i) darab(','); darab(String(n), 'ur:' + p.id + ':(' + n + ')'); });
          darab(')');
        }
      }
      // vezetővonal: a doboz szélétől a valódi pozícióig (0,833 r)
      var z = pont(e.orig, R_ZOD_BELSO), cx = e.bal + e.w / 2, cy = e.fent + e.h / 2;
      var dx = z[0] - cx, dy = z[1] - cy, tMin = Infinity;
      if (dx !== 0) { tMin = Math.min(tMin, Math.abs((e.w / 2) / dx)); }
      if (dy !== 0) { tMin = Math.min(tMin, Math.abs((e.h / 2) / dy)); }
      if (tMin < 1) {
        el('line', { x1: (cx + dx * tMin).toFixed(2), y1: (cy + dy * tMin).toFixed(2), x2: z[0].toFixed(2), y2: z[1].toFixed(2),
          stroke: '#000', 'stroke-width': 0.8 }, g);
      }
      // R / S / F / i betűk a házszám-gyűrű mellett (PrintRetrograde)
      var jel = [];
      if (o.retrograde && p.speed < 0) jel.push('R');
      if (o.stationary && p.stationary) jel = ['S'];
      if (o.feral && p.feral) jel.push('F');
      if (o.feral && p.isolated) jel.push('i');
      if (jel.length) {
        var fp = pont(e.uj, r - (0.575 * 0.85 * r) * 0.95 + pxKicsi * 1.35);
        szoveg(jel.join(', '), { x: fp[0], y: fp[1], 'font-size': pxKicsi * 0.9, 'font-weight': 'bold', 'text-anchor': 'middle',
          'dominant-baseline': 'central', fill: '#000' }, g);
      }
    });

    /* ---------- házcsúcs-feliratok a kerék körül (fok, jegy, perc) ---------- */
    if (o.cuspLabels) {
      var gCim = el('g', { fill: '#000' }, svg);
      for (var hc = 1; hc <= 12; hc++) {
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
        var ra, sz, rr = r + pxJelolo * 1.85, nev;
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
          ra = Math.round(m.lon); sz = jegy(m.lon); rr += pxJelolo * 0.8;
          if (+m.house !== 1) { ra += 10; nev = m.house + '. ház'; } else nev = 'Ascendens';  // házközép (D)
        } else {
          ra = Math.round(m.lon); sz = m.sign; nev = JNEV[m.sign] + ' (az 1. házba bezárt jegy)'; rr += pxJelolo * 0.8;
        }
        var c = pont(ra, rr), cel = pont(ra, R_PLANETA), dx = cel[0] - c[0], dy = cel[1] - c[1], l = Math.hypot(dx, dy);
        var ux = dx / l, uy = dy / l, s = pxJelolo * 0.62;
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
        return o.planets.indexOf(p.id) >= 0 && PLANETA[p.id] !== undefined && (!kulso.csakHold || p.id === 1);
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
        cim(g, 'Külső kör – ' + PNEV[p.id] + ': ' + JNEV[jk] + ' ' + fokStr(fjk) + (p.house ? ', ' + p.house + '. ház (saját képletében)' : '') +
          (p.speed < 0 ? ', retrográd' : '') + (p.feral ? ', ferális' : '') + (p.isolated ? ', izolált' : '') + (kulso.cimKieg && kulso.cimKieg[p.id] ? '\n' + kulso.cimKieg[p.id] : ''));
        szoveg(PLANETA[p.id] + VS, { x: e.x, y: e.y, 'font-size': pxPlaneta, 'font-family': SYM, 'text-anchor': 'middle',
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

  /** Összevetés egymáson: a belső képlet a megszokott módon, a külső kör a zodiákus-sávon kívül */
  function rajzolDupla(hova, belso, kulso, beall) { return rajzol(hova, belso, beall, kulso); }

  global.RegioKerek = { rajzol: rajzol, rajzolDupla: rajzolDupla, ALAP: ALAP };
})(typeof window !== 'undefined' ? window : globalThis);
