/*
 * nyomtatas.js – A4-es nyomtatási / exportálási lapkép SVG-ben (a Windows-os TDrawPrinterController.PaintInfoToPrintImage,
 * uAstro4AllPrinting.pas szerint): fejléc, kerék, táblák (fényszögek, planéták, házak, életstratégia), lábléc.
 * Egység: mm (viewBox 0 0 210 297). Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, NS = 'http://www.w3.org/2000/svg';
  var W = 210, H = 297, M = 13.5;                       // lapméret, bal/jobb margó (L ≈ 13,5 mm)
  var TXT = 'Arial, Helvetica, "Liberation Sans", sans-serif';
  var SYM = '"Regio Symbols", "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols", "Noto Sans Symbols 2", sans-serif';
  var NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

  /** A nyomtatási beállítások alapértékei (Beállítások › Megjelenítés › „Nyomtatás és Exportálás”, D K 727–758). */
  var ALAP = { fejlec: true, lablec: true, fenyszog: true, eletstrat: true, planetak: true, hazak: true, kerek: true,
    szines: false, inkognito: false };

  function el(nev, attr, szulo, szoveg) {
    var e = document.createElementNS(NS, nev);
    for (var k in attr) if (attr[k] !== null && attr[k] !== undefined) e.setAttribute(k, attr[k]);
    if (szoveg !== undefined) e.textContent = szoveg;
    if (szulo) szulo.appendChild(e);
    return e;
  }
  function txt(szulo, x, y, s, meret, opt) {
    opt = opt || {};
    return el('text', { x: x.toFixed(2), y: y.toFixed(2), 'font-size': meret, 'font-family': opt.sym ? SYM : TXT,
      'font-weight': opt.b ? 'bold' : null, 'text-anchor': opt.a || 'start', fill: opt.szin || '#000',
      'dominant-baseline': opt.kozep ? 'central' : null }, szulo, s);
  }
  function vonal(szulo, x1, y1, x2, y2, v) {
    return el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: '#000', 'stroke-width': v || 0.25 }, szulo);
  }
  function hm(h) {
    var t = Math.round(((h % 24) + 24) % 24 * 3600), o = Math.floor(t / 3600) % 24, p = Math.floor((t % 3600) / 60), s = t % 60;
    return R.pad(o) + ':' + R.pad(p) + ':' + R.pad(s);
  }
  function fokPerc(x, poz, neg) {
    var a = Math.abs(x), f = Math.floor(a), p = Math.round((a - f) * 60);
    if (p === 60) { f++; p = 0; }
    return f + '°' + R.pad(p) + '\' ' + (x < 0 ? neg : poz);
  }
  function jegyFok(lon) { var j = R.jegyben(lon); return { j: j.j, s: R.fokStr(j.fok, false) }; }
  function eltolasStr(orak) {
    var p = Math.round(Math.abs(orak) * 60);
    return (orak < 0 ? '-' : '+') + Math.floor(p / 60) + ':' + R.pad(p % 60);
  }

  /* ---------- fejléc (D P 199–561) ---------- */
  /** Egy képlet adatsorai: [[bal, jobb], …] */
  function adatSorok(e, opt) {
    if (opt.inkognito) return [];
    var a = e.adat, K = R.Keplet, z = e.zona, sorok = [];
    var nap = new Date(Date.UTC(a.ev, a.ho - 1, a.nap)).getUTCDay();
    var ido = R.datumStr(a.ev, a.ho, a.nap) + ' - ' + (a.ismeretlen ? '12:00' : R.pad(a.ora) + ':' + R.pad(a.perc)) + '  (' + NAPOK[nap] + ')';
    if (a.tipus !== 'aktualis') { var ek = K.eletkor(a); if (ek >= 0 && ek < 150) ido += ' - ' + ek + 'é'; }
    sorok.push([ido, [K.helyNev(a), a.orszag].filter(Boolean).join(', ')]);
    var zs = z.kod === 'LMT' ? '[Helyi középidő]' : a.zonaMod === 'kezi' && !a.tzKod ? '[Kézi zónaidő = ' + eltolasStr(z.orak) + ']'
      : 'Időzóna: ' + (a.tzKod || a.tz || '') + ' ' + eltolasStr(z.orak);
    sorok.push([zs, fokPerc(a.lat, 'É', 'D') + '  ' + fokPerc(a.lon, 'K', 'Ny')]);
    sorok.push(['UT: ' + hm(e.ut.hour), e.hz.kos0 ? 'Kos 0° házak' : e.hz.persp !== undefined ? 'Egyenlő házak' : R.HAZRENDSZER[e.hsys] || e.hsys]);
    sorok.push(['ST: ' + hm(e.csillagido), e.sid ? 'Sziderikus' : 'Tropikus']);
    if (z.nyari) sorok.push(['Nyári időszámítás', '']);
    return sorok;
  }
  function fejlec(g, d, opt) {
    var fs = 3.4, fs2 = 2.75, y = 14;
    txt(g, M, y, d.cim, fs * 1.15, { b: true });
    txt(g, W - M, y, d.tipus, fs, { a: 'end' });
    vonal(g, M, y + 2.2, W - M, y + 2.2, 0.3);
    y += 6.6;
    if (!d.kulso) {
      adatSorok(d.e, opt).forEach(function (s) {
        if (s[0]) txt(g, M, y, s[0], fs2);
        if (s[1]) txt(g, W - M, y, s[1], fs2, { a: 'end' });
        y += 3.9;
      });
      return y;
    }
    // két képlet: balra a belső, jobbra a külső kör (D P 362–507)
    txt(g, M, y, 'Belső kör: ' + d.belsoNev, fs2, { b: true });
    txt(g, W - M, y, 'Külső kör: ' + d.kulsoNev, fs2, { b: true, a: 'end' });
    var y0 = y + 3.9, yb = y0, yj = y0;
    adatSorok(d.e, opt).forEach(function (s) { if (s[0]) { txt(g, M, yb, s[0], fs2); yb += 3.6; } });
    if (d.kulsoMikor) { txt(g, W - M, yj, d.kulsoMikor, fs2, { a: 'end' }); yj += 3.6; }
    if (d.kulso.e && d.fajta !== 'pd') adatSorok(d.kulso.e, opt).forEach(function (s) { if (s[0]) { txt(g, W - M, yj, s[0], fs2, { a: 'end' }); yj += 3.6; } });
    return Math.max(yb, yj);
  }

  /* ---------- lábléc (D P 563–600) ---------- */
  function lablec(g) {
    var y = H - 21, fs = 2.1;
    vonal(g, M, y, W - M, y, 0.3);
    txt(g, M, y + 3.6, 'Regiomontanus (webes változat) - Nemes Balázs 2009 - ' + new Date().getFullYear(), fs);
    txt(g, W - M, y + 3.6, 'Humanisztikus Asztrológia Iskola', fs, { a: 'end' });
    txt(g, M, y + 7.2, 'https://www.regiomontanus.hu     info@regiomontanus.hu     http://www.facebook.com/regiomontanus.astrology', fs);
    txt(g, W - M, y + 7.2, 'Swiss Ephemeris inside', fs, { a: 'end' });
  }

  /* ---------- táblák ---------- */
  function cimsor(g, x, y, s) { txt(g, x, y, s, 2.9, { b: true }); }
  function glifSzoveg(id) { return R.PLANETA[id] && R.PLANETA[id][1] ? R.PLANETA[id][1] + R.VS : R.nev(id).slice(0, 3); }

  /** Fényszögek háromszög-rácsa (D P 810–1073): Nap..Plútó, csomó, AC, MC */
  function fenyszogTabla(g, e, x0, y0, cella, b) {
    var cs = b && b.csomo === 10 ? 10 : 11;
    var ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, cs].filter(function (id) { return e.poz[id]; }).concat([998, 999]);
    var idx = {}; ids.forEach(function (id, i) { idx[id] = i; });
    var cellak = {};
    (e.elemzes ? e.elemzes.aspects : []).forEach(function (a) {
      if (a.a[0] !== 'P') return;
      var i1 = a.a[1], i2;
      if (a.b[0] === 'P') { i2 = a.b[1]; if (a.aspect === 1 && (i1 === 10 || i1 === 11) && (i2 === 10 || i2 === 11)) return; }
      else if (a.b[0] === 'A' && (a.b[1] === 0 || a.b[1] === 1)) i2 = a.b[1] === 0 ? 998 : 999;
      else return;
      if (idx[i1] === undefined || idx[i2] === undefined) return;
      var r = Math.max(idx[i1], idx[i2]), c = Math.min(idx[i1], idx[i2]);
      (cellak[r + '_' + c] = cellak[r + '_' + c] || []).push(a);
    });
    cimsor(g, x0, y0 - 1.5, 'Fényszögek');
    for (var r = 0; r < ids.length; r++) {
      for (var c = 0; c <= r; c++) {
        var x = x0 + c * cella, y = y0 + r * cella;
        el('rect', { x: x, y: y, width: cella, height: cella, fill: c === r ? '#f2f2f2' : '#fff', stroke: '#000', 'stroke-width': 0.15 }, g);
        if (c === r) {
          var id = ids[r];
          if (id >= 998) txt(g, x + cella / 2, y + cella / 2, id === 998 ? 'AC' : 'MC', cella * 0.42, { a: 'middle', kozep: true, b: true });
          else txt(g, x + cella / 2, y + cella / 2, glifSzoveg(id), cella * 0.62, { a: 'middle', kozep: true, sym: true });
          continue;
        }
        var l = cellak[r + '_' + c]; if (!l) continue;
        var a = l[0], jel = R.FENYSZOG[a.aspect][3];
        txt(g, x + cella / 2, y + cella * 0.38, jel + (jel.length === 1 ? R.VS : ''), cella * (jel.length > 1 ? 0.36 : 0.5), { a: 'middle', kozep: true, sym: jel.length === 1 });
        txt(g, x + cella / 2, y + cella * 0.82, R.fokStr(a.orb, false).replace(/'$/, '\''), cella * 0.26, { a: 'middle', kozep: true });
      }
    }
    return { w: ids.length * cella, h: ids.length * cella };
  }
  /** Kereszt-fényszögek rácsa két képletnél (D P 1271–1495): belső × külső, Nap..Plútó + ASC */
  function keresztTabla(g, d, x0, y0, cella) {
    var ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 998];
    var cellak = {};
    ((d.kereszt && d.kereszt.aspects) || []).forEach(function (a) {
      var i1 = a.a[0] === 'P' ? a.a[1] : a.a[0] === 'A' && a.a[1] === 0 ? 998 : null;
      var i2 = a.b[0] === 'P' ? a.b[1] : a.b[0] === 'A' && a.b[1] === 0 ? 998 : null;
      if (i1 === null || i2 === null || ids.indexOf(i1) < 0 || ids.indexOf(i2) < 0) return;
      if (!cellak[i1 + '_' + i2]) cellak[i1 + '_' + i2] = a;
    });
    cimsor(g, x0, y0 - 6.5, 'Kereszt-fényszögek');
    txt(g, x0 + cella * 6.5, y0 - 2.6, 'Külső kör: ' + d.kulsoNev, 2.4, { a: 'middle' });
    var gb = el('g', { transform: 'translate(' + (x0 - 2.2) + ' ' + (y0 + cella * 6.5) + ') rotate(-90)' }, g);
    txt(gb, 0, 0, 'Belső kör: ' + d.belsoNev, 2.4, { a: 'middle' });
    ids.forEach(function (id, j) {
      var lab = id === 998 ? 'AC' : glifSzoveg(id);
      txt(g, x0 + (j + 1) * cella + cella / 2, y0 + cella / 2, lab, cella * (id === 998 ? 0.4 : 0.6), { a: 'middle', kozep: true, sym: id !== 998, b: id === 998 });
      txt(g, x0 + cella / 2, y0 + (j + 1) * cella + cella / 2, lab, cella * (id === 998 ? 0.4 : 0.6), { a: 'middle', kozep: true, sym: id !== 998, b: id === 998 });
    });
    ids.forEach(function (ib, r) {
      ids.forEach(function (ik, c) {
        var x = x0 + (c + 1) * cella, y = y0 + (r + 1) * cella, a = cellak[ib + '_' + ik];
        el('rect', { x: x, y: y, width: cella, height: cella, fill: '#fff', stroke: '#000', 'stroke-width': 0.15 }, g);
        if (!a) return;
        var jel = R.FENYSZOG[a.aspect][3];
        txt(g, x + cella / 2, y + cella * 0.38, jel + (jel.length === 1 ? R.VS : ''), cella * (jel.length > 1 ? 0.36 : 0.5), { a: 'middle', kozep: true, sym: jel.length === 1 });
        txt(g, x + cella / 2, y + cella * 0.82, R.fokStr(a.orb, false), cella * 0.26, { a: 'middle', kozep: true });
      });
    });
  }
  /** Planéták táblája (D P 602–748) */
  function planetaTabla(g, e, x0, y0, sor, b) {
    var cs = b && b.csomo === 10 ? 10 : 11, csLat = !!(b && b.kerek && b.kerek.nodes);
    var ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].concat(csLat ? [cs] : []).filter(function (id) { return e.poz[id]; });
    cimsor(g, x0, y0 - 1.5, 'Planéták');
    var y = y0 + sor * 0.75, fs = sor * 0.62;
    ids.forEach(function (id) {
      var p = e.elemPl[id] || {}, jf = jegyFok(e.poz[id].lon), jel = [];
      if (e.poz[id].speedLon < 0) jel.push('R');
      if (p.feral) jel.push('F');
      if (p.isolated) jel.push('i');
      txt(g, x0 + 2, y, glifSzoveg(id), fs * 1.2, { a: 'middle', sym: true, kozep: true });
      txt(g, x0 + 5, y, jel.join(''), fs * 0.85, { b: true, kozep: true });
      txt(g, x0 + 22, y, jf.s, fs, { a: 'end', kozep: true });
      txt(g, x0 + 25.5, y, R.JEGYGLIF[jf.j] + R.VS, fs * 1.1, { a: 'middle', sym: true, kozep: true });
      txt(g, x0 + 31, y, p.house ? String(p.house) : '', fs, { a: 'end', kozep: true });
      var ur = (p.lordOf || []).join(',') + (p.closedLordOf && p.closedLordOf.length ? ((p.lordOf || []).length ? ' ' : '') + '(' + p.closedLordOf.join(',') + ')' : '');
      txt(g, x0 + 33.5, y, ur, fs * 0.9, { kozep: true });
      y += sor;
    });
    [['AC', e.hz.asc], ['MC', e.hz.mc]].forEach(function (t) {
      var jf = jegyFok(t[1]);
      txt(g, x0 + 2, y, t[0], fs * 0.85, { a: 'middle', b: true, kozep: true });
      txt(g, x0 + 22, y, jf.s, fs, { a: 'end', kozep: true });
      txt(g, x0 + 25.5, y, R.JEGYGLIF[jf.j] + R.VS, fs * 1.1, { a: 'middle', sym: true, kozep: true });
      y += sor;
    });
  }
  /** Házak táblája (D P 750–808) */
  function hazTabla(g, e, x0, y0, sor) {
    cimsor(g, x0, y0 - 1.5, 'Házak');
    var y = y0 + sor * 0.75, fs = sor * 0.68;
    for (var h = 1; h <= 12; h++) {
      var jf = jegyFok(e.hz.cusps[h]);
      txt(g, x0 + 4, y, String(h), fs, { a: 'end', kozep: true });
      txt(g, x0 + 18, y, jf.s, fs, { a: 'end', kozep: true });
      txt(g, x0 + 21.5, y, R.JEGYGLIF[jf.j] + R.VS, fs * 1.1, { a: 'middle', sym: true, kozep: true });
      y += sor;
    }
  }
  /** Életstratégia (D P 1075–1269): 4×4+összeg mátrix, alatta az életstratégia és a járatlan út */
  function eletstratTabla(g, e, x0, y0) {
    if (!e.elemzes) return;
    var es = e.elemzes.lifeStrategy, cw = 9, rh = 4.4, fs = 2.5;
    cimsor(g, x0, y0 - 1.5, 'Életstratégia');
    var fej = ['', 'Kard.', 'Fix', 'Lab.', 'Össz.'], sorok = ['Tűz', 'Föld', 'Lev.', 'Víz', 'Össz.'];
    fej.forEach(function (f, c) { if (f) txt(g, x0 + 9 + (c - 1) * cw + cw / 2, y0 + 2.8, f, fs * 0.9, { a: 'middle', b: true }); });
    es.matrix.forEach(function (s, r) {
      var y = y0 + 4 + r * rh;
      txt(g, x0, y + rh * 0.62, sorok[r], fs * 0.9, { b: true });
      s.forEach(function (v, c) {
        var x = x0 + 9 + c * cw;
        el('rect', { x: x, y: y, width: cw, height: rh, fill: r === 4 || c === 3 ? '#f2f2f2' : '#fff', stroke: '#000', 'stroke-width': 0.15 }, g);
        txt(g, x + cw / 2, y + rh / 2, String(v), fs, { a: 'middle', kozep: true });
      });
    });
    var y2 = y0 + 4 + 5 * rh + 5;
    function ut(l) { return l.map(function (j) { return R.JEGYGLIF[j] + R.VS + ' ' + R.JEGYEK[j] + ' / ' + (j + 1); }); }
    txt(g, x0, y2, 'Életstratégia:', fs, { b: true });
    ut(es.walked).forEach(function (s, i) { txt(g, x0 + 22, y2 + i * 3.6, s, fs, { sym: false }); });
    var y3 = y2 + Math.max(1, es.walked.length) * 3.6 + 1.5;
    txt(g, x0, y3, 'Járatlan út:', fs, { b: true });
    ut(es.unwalked).forEach(function (s, i) { txt(g, x0 + 22, y3 + i * 3.6, s, fs); });
  }

  /**
   * A lapkép. d: { e, cim, tipus, kerekek: [svgElem…] (a kész kerék/kerekek), kulso?: {e}, fajta?, kereszt?, belsoNev, kulsoNev, kulsoMikor }
   * opt: ALAP szerinti kapcsolók; b: a program beállításai (csomó, kerék). Visszaad: <svg> elem.
   */
  function lap(d, opt, b) {
    var o = {}, k;
    for (k in ALAP) o[k] = ALAP[k];
    for (k in (opt || {})) o[k] = opt[k];
    var svg = el('svg', { xmlns: NS, viewBox: '0 0 ' + W + ' ' + H, width: W + 'mm', height: H + 'mm', 'font-family': TXT });
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, svg);
    var g = el('g', {}, svg);
    var fent = o.fejlec ? fejlec(g, d, o) + 1 : 10;
    if (o.lablec) lablec(g);
    var vanTabla = d.kulso ? o.fenyszog : (o.fenyszog || o.planetak || o.hazak || o.eletstrat);
    var tablaY;
    // kerék: a táblák fölött ≈ 66 mm-es zodiákus-sugárral, táblák nélkül nagyobb
    if (o.kerek && d.kerekek && d.kerekek.length) {
      var also = vanTabla ? 194 : (o.lablec ? H - 24 : H - 10);
      var hely = also - Math.max(fent, 22);
      if (d.kerekek.length === 1) {
        var sv = d.kerekek[0], vb = (sv.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        var arany = vb.length === 4 ? vb[2] / vb[3] : 1, mag = Math.min(hely, (W - 2 * M) / arany);
        var sz = mag * arany;
        sv.setAttribute('x', ((W - sz) / 2).toFixed(2)); sv.setAttribute('y', (Math.max(fent, 22) + (hely - mag) / 2).toFixed(2));
        sv.setAttribute('width', sz.toFixed(2)); sv.setAttribute('height', mag.toFixed(2)); sv.removeAttribute('style');
        svg.insertBefore(sv, g);   // a kerék a feliratok és táblák alá kerül
      } else {
        var szel = (W - 2 * M - 6) / 2, m2 = Math.min(hely, szel);
        d.kerekek.forEach(function (s2, i) {
          s2.setAttribute('x', (M + i * (szel + 6) + (szel - m2) / 2).toFixed(2)); s2.setAttribute('y', (Math.max(fent, 22) + (hely - m2) / 2).toFixed(2));
          s2.setAttribute('width', m2.toFixed(2)); s2.setAttribute('height', m2.toFixed(2)); s2.removeAttribute('style');
          svg.insertBefore(s2, g);
          txt(g, M + i * (szel + 6) + szel / 2, Math.max(fent, 22) + (hely + m2) / 2 + 3, i ? 'Külső kör – ' + d.kulsoNev : 'Belső kör – ' + d.belsoNev, 2.6, { a: 'middle' });
        });
      }
      tablaY = 200;
    } else tablaY = Math.max(fent, 22) + 8;

    if (d.kulso) {
      if (o.fenyszog) keresztTabla(g, d, M + 4, tablaY + 5, 5.4);
      return svg;
    }
    var e = d.e;
    if (!e) return svg;
    if (o.fenyszog) fenyszogTabla(g, e, M, tablaY, 5.1, b);
    if (o.eletstrat) eletstratTabla(g, e, 86, tablaY);
    if (o.planetak) planetaTabla(g, e, W - M - 47, tablaY, 4.5, b);
    if (o.hazak) {
      // kerékkel a jobb felső sarokban (a fejléc alatt), kerék nélkül a planéták mellett
      if (o.kerek && d.kerekek && d.kerekek.length) hazTabla(g, e, W - M - 24, Math.max(fent, 22) + 5, 3.5);
      else hazTabla(g, e, W - M - 24, tablaY + 72, 4.2);
    }
    return svg;
  }

  R.Nyomtatas = { lap: lap, ALAP: ALAP, W: W, H: H };
})(typeof window !== 'undefined' ? window : globalThis);
