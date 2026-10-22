/*
 * nyomtatas.js – A4-es nyomtatási / exportálási lapkép SVG-ben, a Windows-os TDrawPrinterController.PaintInfoToPrintImage
 * (uAstro4AllPrinting.pas) képpontra azonos portja: a lap 1488×2105 képpont (a Windows-os előnézet és képexport mérete),
 * a betűméretek a Delphi pontértékei (GetFontSize = 23 ezen a lapon; 1 pt = 4/3 képpont), a szövegek bal felső
 * sarokhoz igazítva (TextOut), a sormagasság a Windows-os TextHeight (Arial: 1,117 em).
 * A RegiomontanusWIN szimbólumbetű helyett Unicode-jelek; az életstratégia saját jelei (kardinális, fix, változó) rajzolva.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, NS = 'http://www.w3.org/2000/svg';
  var W = 1488, H = 2105;
  var ARIAL = 'Arial, "Liberation Sans", Helvetica, sans-serif';
  var SYM = '"Regio Symbols", "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols", "Noto Sans Symbols 2", sans-serif';
  var NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  var FS = 23;                                   // GetFontSize a nyomtatási lapon (D DR 2408: 12 − (450 − 1092) div 55)
  var GAP = 3;                                   // iPlusGap
  var LEFT = Math.round(50 * (FS / 12));         // 96
  function div(a, b) { return Math.trunc(a / b); }

  /** A nyomtatási beállítások alapértékei (Beállítások › Megjelenítés › „Nyomtatás és Exportálás”, D K 727–758). */
  var ALAP = { fejlec: true, lablec: true, fenyszog: true, eletstrat: true, planetak: true, hazak: true, kerek: true,
    szines: false, inkognito: false };

  /* ---------- betűmetrika (Windows: TextHeight = ascent + descent = 1,117 em Arialnál és a RegiomontanusWIN-nél) ---------- */
  var mctx = null;
  function px(pt) { return pt * 4 / 3; }
  function th(pt) { return Math.round(px(pt) * 1.117); }
  function tw(s, pt, sym, bold) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = (bold ? 'bold ' : '') + px(pt) + 'px ' + (sym ? SYM : ARIAL);
    return Math.round(mctx.measureText(s).width);
  }

  function el(nev, attr, szulo, szoveg) {
    var e = document.createElementNS(NS, nev);
    for (var k in attr) if (attr[k] !== null && attr[k] !== undefined) e.setAttribute(k, attr[k]);
    if (szoveg !== undefined) e.textContent = szoveg;
    if (szulo) szulo.appendChild(e);
    return e;
  }
  /** TextOut: (x, y) a szöveg bal felső sarka; opt: { sym, bold, italic, jobb (x a jobb szél), kozep (x a közép) } */
  function out(g, x, y, s, pt, opt) {
    opt = opt || {};
    var em = px(pt);
    return el('text', { x: x.toFixed(1), y: (y + em * 0.905).toFixed(1), 'font-size': em.toFixed(2), 'font-family': opt.sym ? SYM : ARIAL,
      'font-weight': opt.bold ? 'bold' : null, 'font-style': opt.italic ? 'italic' : null, fill: '#000',
      'text-anchor': opt.jobb ? 'end' : opt.kozep ? 'middle' : null }, g, s);
  }
  function vonal(g, x1, y1, x2, y2, v) { el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: '#000', 'stroke-width': v || 1 }, g); }

  /* ---------- jelek ---------- */
  function plJel(id) {
    if (id === 16) return 'Ph';                                         // Pholus: nincs Unicode-jele
    return R.PLANETA[id] && R.PLANETA[id][1] ? R.PLANETA[id][1] + R.VS : R.nev(id).slice(0, 2);
  }
  function jegyJel(j) { return R.JEGYGLIF[j] + R.VS; }
  function fszJel(a) { var j = R.FENYSZOG[a][3]; return j.length === 1 ? j + R.VS : j; }

  /** Az életstratégia-tábla RegiomontanusWIN-jelei (#139 +, #142 −, #147 △, #148 ▽, #149 =, #150 kardinális, #151 fix, #153 Σ, #155 változó) */
  function lsJel(g, kod, cx, yTop, pt) {
    var em = px(pt), cy = yTop + em * 0.55, s = em * 0.32, sw = Math.max(1.5, em * 0.075);
    var p = { stroke: '#000', 'stroke-width': sw.toFixed(2), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    var pont = function (x, y) { el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: (sw * 0.9).toFixed(2), fill: '#000' }, g); };
    var u = function (d) { var q = {}; for (var k in p) q[k] = p[k]; q.d = d; el('path', q, g); };
    var f = function (v) { return v.toFixed(1); };
    switch (kod) {
      case 139: u('M' + f(cx - s) + ' ' + f(cy) + 'H' + f(cx + s) + 'M' + f(cx) + ' ' + f(cy - s) + 'V' + f(cy + s)); break;
      case 142: u('M' + f(cx - s) + ' ' + f(cy) + 'H' + f(cx + s)); break;
      case 149: u('M' + f(cx - s) + ' ' + f(cy - s * 0.35) + 'H' + f(cx + s) + 'M' + f(cx - s) + ' ' + f(cy + s * 0.35) + 'H' + f(cx + s)); break;
      case 147: u('M' + f(cx) + ' ' + f(cy - s) + 'L' + f(cx + s) + ' ' + f(cy + s * 0.8) + 'H' + f(cx - s) + 'Z'); break;
      case 148: u('M' + f(cx) + ' ' + f(cy + s) + 'L' + f(cx + s) + ' ' + f(cy - s * 0.8) + 'H' + f(cx - s) + 'Z'); break;
      case 150: u('M' + f(cx - s * 0.8) + ' ' + f(cy + s) + 'L' + f(cx) + ' ' + f(cy - s) + 'L' + f(cx + s * 0.8) + ' ' + f(cy + s)); pont(cx, cy + s * 0.45); break;
      case 151: u('M' + f(cx - s * 0.85) + ' ' + f(cy - s * 0.85) + 'H' + f(cx + s * 0.85) + 'V' + f(cy + s * 0.85) + 'H' + f(cx - s * 0.85) + 'Z'); pont(cx, cy); break;
      case 155: u('M' + f(cx - s * 0.75) + ' ' + f(cy + s) + 'V' + f(cy - s * 0.1) + 'A' + f(s * 0.75) + ' ' + f(s * 0.75) + ' 0 0 1 ' + f(cx + s * 0.75) + ' ' + f(cy - s * 0.1) + 'V' + f(cy + s)); pont(cx, cy + s * 0.35); break;
      case 153: u('M' + f(cx + s * 0.75) + ' ' + f(cy - s) + 'H' + f(cx - s * 0.75) + 'L' + f(cx + s * 0.2) + ' ' + f(cy) + 'L' + f(cx - s * 0.75) + ' ' + f(cy + s) + 'H' + f(cx + s * 0.75)); break;
      case 145: pont(cx, cy - s * 0.45); pont(cx, cy + s * 0.45); break;
      case 'pholus': // a RegiomontanusWIN Pholus-jele (horgonyszerű): karika, szár, keresztvonal, alul ív
        el('circle', { cx: f(cx), cy: f(cy - s * 0.75), r: f(s * 0.3), stroke: '#000', 'stroke-width': sw.toFixed(2), fill: 'none' }, g);
        u('M' + f(cx) + ' ' + f(cy - s * 0.45) + 'V' + f(cy + s) + 'M' + f(cx - s * 0.4) + ' ' + f(cy + s * 0.05) + 'H' + f(cx + s * 0.4) +
          'M' + f(cx - s * 0.65) + ' ' + f(cy + s * 0.45) + 'Q' + f(cx - s * 0.6) + ' ' + f(cy + s * 1.05) + ' ' + f(cx) + ' ' + f(cy + s) +
          'Q' + f(cx + s * 0.6) + ' ' + f(cy + s * 1.05) + ' ' + f(cx + s * 0.65) + ' ' + f(cy + s * 0.45));
        break;
    }
    return em * 0.7;
  }

  /* ---------- fejléc szövegei (PrintFejlec) ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function szulIdo(e) {
    var a = e.adat, nap = new Date(Date.UTC(a.ev, a.ho - 1, a.nap)).getUTCDay();
    var s = R.datumStr(a.ev, a.ho, a.nap) + ' - ' + (a.ismeretlen ? '12:00' : pad(a.ora) + ':' + pad(a.perc)) + '  (' + NAPOK[nap] + ')';
    if (a.tipus !== 'aktualis') { var ek = R.Keplet.eletkor(a); if (ek >= 0 && ek < 150) s += ' - ' + ek + 'é'; }
    return s;
  }
  function szulHely(e) { return [R.Keplet.helyNev(e.adat), e.adat.orszag].filter(Boolean).join(', '); }
  function zona(e) {
    var z = e.zona, a = e.adat, o = Math.trunc(z.orak), p = Math.round(Math.abs(z.orak - o) * 60);
    var hm = (z.orak >= 0 ? '+' : '-') + Math.abs(o) + ':' + pad(p);
    if (z.kod === 'LMT') return 'Időzóna: LMT [Helyi középidő]';
    var kod = a.zonaMod === 'kezi' && !a.tzKod ? '' : (z.kod || a.tzKod || '');
    if (!kod) return 'Időzóna:  [Kézi zónaidő = ' + hm + ']';
    return 'Időzóna: ' + kod + ' [' + hm + ']';
  }
  function koord(e) {
    var a = e.adat;
    var fp = function (x) { var v = Math.abs(x), f = Math.floor(v), m = Math.round((v - f) * 60); if (m === 60) { f++; m = 0; } return f + '°' + pad(m) + '\''; };
    return (a.lat < 0 ? '-' : '') + fp(a.lat) + ' ' + (a.lat < 0 ? 'D' : 'É') + '  ' + (a.lon < 0 ? '-' : '') + fp(a.lon) + ' ' + (a.lon < 0 ? 'Ny' : 'K');
  }
  function hms(h) {
    var t = Math.floor(((h % 24) + 24) % 24 * 3600 + 1e-6);
    return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor(t % 3600 / 60)) + ':' + pad(t % 60);
  }
  function ut(e) { var u = e.ut; return 'UT: ' + R.datumStr(u.year, u.month, u.day) + ' - ' + hms(u.hour); }
  // a Windows-os nyomtatás percre kerekített csillagidőt ír (hh:nn:00) – a 60 perces átfordulás itt javítva
  function st(e) { return 'ST: ' + hms(Math.round(e.csillagido * 60) / 60); }
  function hazrendszer(e) { return e.hz.persp !== undefined ? R.HAZRENDSZER.A : R.HAZRENDSZER[e.hsys] || e.hsys; }
  function zodiakus(e) { return e.sid ? 'Sziderikus' : 'Tropikus'; }

  function fejlec(g, d, o) {
    var top = LEFT, s;
    out(g, LEFT, top, d.cim, FS);
    out(g, W - LEFT, top + 3, d.tipus, FS, { jobb: true });
    top += th(FS) + GAP * 4;
    top += GAP * 4;                                    // (a Windows-os csík nem látszik a lapon)
    var f = Math.round(FS * 0.8), lep = th(f) + GAP;
    if (!d.kulso) {
      var e = d.e;
      if (!o.inkognito) {
        out(g, LEFT, top, szulIdo(e), f); out(g, W - LEFT, top, szulHely(e), f, { jobb: true }); top += lep;
        out(g, LEFT, top, zona(e), f); out(g, W - LEFT, top, koord(e), f, { jobb: true }); top += lep;
        out(g, LEFT, top, ut(e), f); top += lep;
        out(g, LEFT, top, st(e), f);
      }
      out(g, W - LEFT, top, hazrendszer(e), f, { jobb: true }); top += lep;
      out(g, W - LEFT, top, zodiakus(e), f, { jobb: true }); top += lep;
      if (!o.inkognito && e.zona.nyari) out(g, LEFT, top, 'Nyári időszámítás', f);
      return;
    }
    // két képlet: balra a belső, jobbra a külső kör (D P 362–507)
    [[d.e, 'Belső kör:', d.belsoNev, false], [d.kulso.e, 'Külső kör:', d.kulsoNev, true]].forEach(function (k) {
      var y = top, e = k[0], j = k[3], x = j ? W - LEFT : LEFT, op = { jobb: j };
      out(g, x, y, k[1], f, op); y += lep;
      out(g, x, y, k[2], f, op); y += lep;
      if (!e) return;
      if (j && (d.fajta === 'pd' || d.fajta === 'ph')) { if (d.kulsoMikor) out(g, x, y, d.kulsoMikor, f, op); return; }
      if (o.inkognito) return;
      [szulIdo(e), szulHely(e), zona(e), koord(e), hazrendszer(e), zodiakus(e)].forEach(function (t) { out(g, x, y, t, f, op); y += lep; });
    });
  }

  /* ---------- lábléc (PrintLablec) ---------- */
  function lablec(g) {
    var f = div(FS, 5) * 3, top = H - Math.round(LEFT * 1.55);
    top += th(f) + GAP;
    out(g, LEFT, top, 'Regiomontanus web - Nemes Balázs 2009 - ' + new Date().getFullYear(), f);
    out(g, W - LEFT, top, 'Regisztrálva: Humanisztikus Asztrológia Iskola', f, { jobb: true });
    top += th(f) + GAP;
    out(g, LEFT, top, 'http://www.regiomontanus.hu     info@regiomontanus.hu     http://www.facebook.com/regiomontanus.astrology', f);
    out(g, W - LEFT, top, 'Swiss Ephemeris inside', f, { jobb: true });
  }

  /* ---------- fényszögek (PrintFenyszogek, D P 810–1073) ---------- */
  function fenyszogek(g, e, radix, b) {
    var csomo = b && b.csomo === 10 ? 10 : 11;
    var max = radix ? 13 : 20, top = radix ? H - Math.round(LEFT * 1.5) - Math.round(22.5 * (th(FS) + GAP)) : Math.round(8 * (th(FS) + GAP));
    var bw = tw('MMXIII', div(FS, 4) * 3), magas = Math.round(th(FS) * 1.7), lep = magas + GAP;
    // sorok: Nap..Plútó, holdcsomó; táblázatos módban még Lilith, Chiron..Vesta; végül AC, MC
    var elemek = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (!radix) elemek = elemek.concat([12, 15, 16, 17, 18, 19, 20]);
    elemek = elemek.concat(['AC', 'MC']);
    var idx = {};
    elemek.forEach(function (id, i) { idx[id] = i; });
    var poz = function (id) { return id === csomo || id === 10 ? 10 : id; };
    elemek.forEach(function (id, n) {
      var iIdx = n + 1, x, y;
      var oszl = Math.min(max - 2, iIdx - 1);
      if (id === 'AC' || id === 'MC') {
        out(g, LEFT + oszl * bw + 3, top + lep * (iIdx - 1) + div(FS, 10) * 5, id, div(FS, 5) * 4, { bold: true });
      } else if (id === 16) {
        lsJel(g, 'pholus', LEFT + oszl * bw + Math.round(px(FS) * 0.75), top + lep * (iIdx - 1) + div(FS, 10) * 3, Math.round(FS * 1.3));
      } else {
        var jel = plJel(id === 10 ? csomo : id), w = tw(jel, FS, true), tx = Math.round(div(w, 2) * 1.05);
        out(g, LEFT + oszl * bw + tx, top + lep * (iIdx - 1) + div(FS, 10) * 3, jel, Math.round(FS * 1.3), { sym: true });
      }
      // rácsozás
      if (iIdx === 1) {
        vonal(g, LEFT - 3, top + lep, LEFT - 3, top + lep * max);
        vonal(g, LEFT - 3, top + lep, LEFT + bw - 3, top + lep);
      }
      if (iIdx <= max - 1) {
        x = LEFT + Math.min(max - 2, iIdx) * bw - 3;
        vonal(g, x, top + lep * iIdx, x, top + lep * max);
        if (!(!radix && iIdx >= max)) {
          y = top + lep * (iIdx + 1);
          vonal(g, LEFT + Math.min(max - 2, iIdx + 1) * bw - 3, y, LEFT - 3, y);
        }
      }
    });
    // a fényszögek a cellákban: jel + orbis
    // a Windows-os csak a „fényszögelt” (megjelenített) planétákra számol fényszöget: Lilith és a kisbolygók sora
    // táblázatos módban is üres, ha a kisbolygók nincsenek bekapcsolva
    var kisb = !!(b && b.kerek && b.kerek.asteroids);
    var engedett = function (id) { return (id >= 0 && id <= 9) || id === csomo || (!radix && kisb && (id === 12 || (id >= 15 && id <= 20))); };
    var sorIdx = function (id) { return id === csomo ? 10 : id === 12 ? 11 : id >= 15 ? id - 3 : id; };
    var fszPt = div(FS, 5) * 5, orbPt = div(FS, 4) * 3;
    ((e.elemzes && e.elemzes.aspects) || []).forEach(function (a) {
      if (a.a[0] !== 'P' || !engedett(a.a[1])) return;
      var i1 = sorIdx(a.a[1]), i2;
      if (a.b[0] === 'P' && engedett(a.b[1])) i2 = sorIdx(a.b[1]);
      else if (a.b[0] === 'A' && (a.b[1] === 0 || a.b[1] === 1)) i2 = a.b[1] + max - 2;
      else return;
      if (i1 === i2) return;
      var c = Math.min(i1, i2), r = Math.max(i1, i2), cx = LEFT + c * bw + bw / 2;
      out(g, cx, top + lep * r + div(FS, 10) * 3 - Math.round(th(fszPt) * 0.2), fszJel(a.aspect), fszPt, { sym: R.FENYSZOG[a.aspect][3].length === 1, kozep: true });
      out(g, cx, top + lep * r + div(FS, 10) * 3 + Math.round(th(orbPt) * 1.1), R.fokStr(a.orb, false), orbPt, { kozep: true });
    });
  }

  /* ---------- kereszt-fényszögek két képletnél (PrintFenyszogOsszevetes, D P 1271–1495) ---------- */
  function keresztFenyszogek(g, d, radix, kepExport) {
    var bal = Math.round(65 * (FS / 12)), egy = th(FS) + GAP;
    var top = radix ? H - bal - Math.round((kepExport ? 14.2 : 16) * egy) : Math.round((kepExport ? 14.2 : 16) * egy);
    var bw = div(W - 2 * bal - tw('MMXIII', div(FS, 4) * 3), 11);
    var magas = Math.round(th(div(FS, 5) * 4) * 1.6), lep = magas + GAP;
    for (var i = 1; i <= 11; i++) {
      var tx, plus, s, opt;
      if (i <= 10) {
        s = plJel(i - 1); tx = Math.round(div(tw(s, div(FS, 5) * 4, true), 2) * 1.05); plus = div(FS, 10) * 3; opt = { sym: true };
        out(g, bal + tx, top + lep * (i - 1) + plus, s, FS, opt);
        out(g, bal + Math.min(11, i) * bw + tx - div(bw, 4), top + lep * 11 + plus, s, FS, opt);
      } else {
        tx = 3; plus = div(FS, 10) * 5;
        out(g, bal + tx, top + lep * (i - 1) + plus, 'AC', div(FS, 5) * 4, { bold: true });
        out(g, bal + Math.min(11, i) * bw + tx - div(bw, 4), top + lep * 11 + plus, 'AC', div(FS, 5) * 4, { bold: true });
      }
    }
    for (i = 1; i <= 12; i++) {
      var x = bal + Math.min(12, i) * bw - 3 - div(bw, 5) * 3;
      vonal(g, x, top, x, top + lep * 12);
      var y = top + lep * (i - 1);
      vonal(g, bal + 12 * bw - 3 - div(bw, 5) * 3, y, bal - 3, y);
    }
    var nf = div(FS, 4) * 3, wb = tw(d.belsoNev, nf), wk = tw(d.kulsoNev, nf);
    var ny = top + wb + div(lep * 12 - wb, 2), nx = Math.round(50 * (FS / 12));
    var gt = el('g', { transform: 'rotate(-90 ' + nx + ' ' + ny + ')' }, g);
    out(gt, nx, ny, d.belsoNev, nf);
    out(g, bal + div(12 * bw - wk, 2), top + lep * 12 + div(magas, 3), d.kulsoNev, nf);
    ((d.kereszt && d.kereszt.aspects) || []).forEach(function (a) {
      var i1 = a.a[0] === 'P' && a.a[1] <= 9 ? a.a[1] : a.a[0] === 'A' && a.a[1] === 0 ? 10 : -1;
      var i2 = a.b[0] === 'P' && a.b[1] <= 9 ? a.b[1] : a.b[0] === 'A' && a.b[1] === 0 ? 10 : -1;
      if (i1 < 0 || i2 < 0 || (i1 === 10 && i2 === 10)) return;
      var jel = fszJel(a.aspect), fp = div(FS, 5) * 5, op = div(FS, 4) * 3;
      out(g, bal + bw * (i2 + 1) - div(bw, 5) * 2, top + lep * i1 + div(magas - th(fp), 2), jel, fp, { sym: R.FENYSZOG[a.aspect][3].length === 1 });
      out(g, bal + bw * (i2 + 1) - div(bw, 5), top + lep * i1 + div(magas - th(op), 2), R.fokStr(a.orb, false), op);
    });
  }

  /* ---------- planéták (PrintBolygok, D P 602–748) ---------- */
  function urSzoveg(p) {
    var l = [];
    for (var h = 1; h <= 12; h++) {
      if ((p.closedLordOf || []).indexOf(h) >= 0) l.push('(' + h + ')');
      else if ((p.lordOf || []).indexOf(h) >= 0) l.push(String(h));
    }
    return l.join(',');
  }
  function planetak(g, e, radix, b) {
    var f = Math.round(FS * 0.8), cw = 'OR18°47,K1212,(11),', cim = 'Planéták', x0, top;
    var bw = Math.round(tw('MI', f) * 1.1);
    if (radix) {
      top = H - LEFT - Math.round(15.5 * (th(f) + GAP));
      x0 = W - LEFT - Math.round(tw(cw, f) * 2.3);
      out(g, x0, top, cim, f);
      top += GAP + th(f);
      vonal(g, x0, top, W - LEFT - Math.round(tw(cw, f)), top);
    } else {
      top = LEFT + Math.round(8 * (th(f) + GAP));
      x0 = W - Math.round(tw(cim, f) * 7);
      out(g, x0, top, cim, f);
      top += GAP + th(f);
      vonal(g, x0, top, x0 + Math.round(tw(cw, f)), top);
    }
    top += GAP;
    var kis = div(FS, 4) * 3, lep = th(kis) + GAP;
    var ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (b && b.kerek && (b.kerek.nodes || b.kerek.nodesDown)) ids.push(b.csomo === 10 ? 10 : 11);
    ids.forEach(function (id) {
      if (!e.poz[id]) return;
      var p = e.elemPl[id] || {}, jf = R.jegyben(e.poz[id].lon), jel = '';
      out(g, x0, top - 2, plJel(id), FS, { sym: true });
      if (e.poz[id].speedLon < 0) jel = 'R';
      if (p.stationary) jel = 'S';
      if (p.feral) jel += (jel ? ',' : '') + 'F';
      if (p.isolated) jel += (jel ? ',' : '') + 'i';
      if (jel) out(g, x0 + bw, top + FS - div(FS, 2), jel, div(FS, 2));
      out(g, x0 + bw * 5, top, R.fokStr(jf.fok), kis, { jobb: true });
      out(g, x0 + Math.round(bw * 5.5), top - 2, jegyJel(jf.j), FS, { sym: true });
      if (p.house) out(g, x0 + bw * 7, top, String(p.house), kis);
      out(g, x0 + Math.round(bw * 8.5), top, urSzoveg(p), kis);
      top += lep;
    });
    [['AC', e.hz.asc], ['MC', e.hz.mc]].forEach(function (t) {
      var jf = R.jegyben(t[1]);
      out(g, x0, top, t[0], kis);
      out(g, x0 + bw * 5, top, R.fokStr(jf.fok), kis, { jobb: true });
      out(g, x0 + Math.round(bw * 5.5), top - 2, jegyJel(jf.j), FS, { sym: true });
      top += lep;
    });
  }

  /* ---------- házak (PrintHazak, D P 750–808) ---------- */
  function hazak(g, e, radix) {
    var f = Math.round(FS * 0.8), cim = 'Házak', x0, top;
    var bw = Math.round(tw('MI', f) * 1.1);
    if (radix) {
      top = H - LEFT - Math.round(14.5 * (th(f) + GAP));
      x0 = W - LEFT - Math.round(tw(cim, f) * 2.6);
    } else {
      top = LEFT + Math.round(8 * (th(f) + GAP));
      x0 = W - Math.round(tw(cim, f) * 4);
    }
    out(g, x0, top, cim, f);
    top += GAP + th(f);
    vonal(g, x0, top, x0 + Math.round(tw('OO   18°47, K', f) * 1.1), top);
    top += GAP;
    var kis = div(FS, 4) * 3, lep = th(kis) + GAP;
    for (var h = 1; h <= 12; h++) {
      var jf = R.jegyben(e.hz.cusps[h]);
      out(g, x0, top, String(h), kis);
      out(g, x0 + Math.round(bw * 4.5), top, R.fokStr(jf.fok), kis, { jobb: true });
      out(g, x0 + Math.round(bw * 5.2), top - 2, jegyJel(jf.j), FS, { sym: true });
      top += lep;
    }
  }

  /* ---------- életstratégia (PrintEletstrategiaTablazat, D P 1075–1269) ---------- */
  function eletstrat(g, e, radix) {
    if (!e.elemzes) return;
    var es = e.elemzes.lifeStrategy, cell = tw('MMII', div(FS, 4) * 3), f = Math.round(FS * 0.8), cim = 'Életstratégia', x0, top;
    if (radix) {
      x0 = W - LEFT - 5 * cell;
      top = H - div(x0, 7) - 24 * (th(f) + GAP);
    } else {
      top = LEFT + Math.round(25 * (th(f) + GAP));
      x0 = W - Math.round(tw(cim, f) * 2.5);
    }
    out(g, x0 + cell, top, cim, f);
    top += GAP + th(f);
    top += GAP * 7;
    var ment = top, sor = th(FS) + GAP;
    [150, 151, 155, 153].forEach(function (k, i) { lsJel(g, k, x0 + (i + 1) * cell + cell / 2, top, div(FS, 4) * 5); });
    top += sor;
    [147, 139, 149, 148, 153].forEach(function (k) { lsJel(g, k, x0 + cell / 2, top, FS); top += sor; });
    top = ment;
    var i;
    for (i = 0; i <= 6; i++) {
      vonal(g, i === 0 ? x0 + cell : x0, top - 2, x0 + cell * 5, top - 2, i === 5 ? 3 : 1);
      top += sor;
    }
    var also = top - GAP * 2 - th(FS);
    for (i = 0; i <= 5; i++) vonal(g, x0 + i * cell, i === 0 ? ment + sor : ment, x0 + i * cell, also, i === 4 ? 3 : 1);
    var kis = div(FS, 4) * 3, sorM = th(FS);
    for (i = 1; i <= 4; i++) {
      for (var j = 1; j <= 5; j++) {
        out(g, x0 + i * cell + cell / 2, ment + j * (GAP + sorM) + div(sorM - th(kis), 2), String(es.matrix[j - 1][i - 1]), kis, { kozep: true });
      }
    }
    top -= GAP * 15;
    [[139, es.walked], [142, es.unwalked]].forEach(function (t, n) {
      var x = x0;
      // a Windows-os: #139/#142 + '‘ ' (kettőspont + szóköz a jelfontban) → a jegy kb. 1,75 em-mel beljebb kezdődik
      lsJel(g, t[0], x + px(FS) * 0.35, top, FS);
      lsJel(g, 145, x + px(FS) * 0.95, top, FS);
      x += Math.round(px(FS) * 1.75);
      t[1].forEach(function (jj, k) {
        var s = jegyJel(jj);
        out(g, x, top, s, FS, { sym: true }); x += tw(s, FS, true) + 2;
        var z = ' / ' + (jj + 1) + (k < t[1].length - 1 ? ', ' : '');
        out(g, x, top + div(th(kis), 5), z, kis); x += tw(z, kis) + 2;
      });
      if (n === 0) top += GAP + div(th(FS), 3) * 2;
    });
  }

  /**
   * A lapkép. d: { e, cim, tipus, kerekek: [svgElem…], kulso?: {e}, fajta?, kereszt?, belsoNev, kulsoNev, kulsoMikor }
   * opt: ALAP szerinti kapcsolók (+ kepExport); b: a program beállításai (csomó, kerék). Visszaad: <svg> elem (210×297 mm).
   */
  function lap(d, opt, b) {
    var o = {}, k;
    for (k in ALAP) o[k] = ALAP[k];
    for (k in (opt || {})) o[k] = opt[k];
    var svg = el('svg', { xmlns: NS, viewBox: '0 0 ' + W + ' ' + H, width: '210mm', height: '297mm', 'font-family': ARIAL });
    el('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, svg);
    var radix = !!(o.kerek && d.kerekek && d.kerekek.length);
    // kerék: a Windows-os nyomtatási négyzet (margó = min(W,H) div 15 · 2 = 198, átmérő 1092, felső eltolás 1092 div 20)
    if (radix) {
      var margo = div(Math.min(W, H), 15) * 2, D = Math.min(W - 2 * margo, H - 2 * margo), cx = margo + D / 2, cy = margo + div(D, 20) + D / 2;
      if (d.kerekek.length === 1) {
        var sv = d.kerekek[0], vb = (sv.getAttribute('viewBox') || '-480 -480 960 960').split(/\s+/).map(Number);
        // a kerek.js-ben r = 400 a zodiákus-sáv külső sugara; a viewBox ±R
        var meret = vb[2] * (D / 2) / 400;
        sv.setAttribute('x', (cx - meret / 2).toFixed(1)); sv.setAttribute('y', (cy - meret / 2).toFixed(1));
        sv.setAttribute('width', meret.toFixed(1)); sv.setAttribute('height', meret.toFixed(1)); sv.removeAttribute('style');
        svg.appendChild(sv);
      } else {
        var szel = (W - 2 * LEFT - 40) / 2;
        d.kerekek.forEach(function (s2, i) {
          s2.setAttribute('x', (LEFT + i * (szel + 40)).toFixed(1)); s2.setAttribute('y', (cy - szel / 2).toFixed(1));
          s2.setAttribute('width', szel.toFixed(1)); s2.setAttribute('height', szel.toFixed(1)); s2.removeAttribute('style');
          svg.appendChild(s2);
        });
      }
    }
    var g = el('g', {}, svg);
    if (o.fejlec) fejlec(g, d, o);
    if (o.lablec) lablec(g);
    if (d.kulso) {
      if (o.fenyszog) keresztFenyszogek(g, d, radix, !!o.kepExport);
      return svg;
    }
    var e = d.e;
    if (!e) return svg;
    if (o.fenyszog) fenyszogek(g, e, radix, b);
    if (o.planetak) planetak(g, e, radix, b);
    if (o.hazak) hazak(g, e, radix);
    if (o.eletstrat) eletstrat(g, e, radix);
    return svg;
  }

  R.Nyomtatas = { lap: lap, ALAP: ALAP, W: W, H: H };
})(typeof window !== 'undefined' ? window : globalThis);
