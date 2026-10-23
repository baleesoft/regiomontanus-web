/*
 * egbolt.js – az égbolt-nézet („mini Stellarium”): a képlet planétái a valódi égen, forgatható gömbön.
 * A néző a gömb közepén áll (geocentrikusan a Föld, heliocentrikusan a Nap, vagy egy planéta); körülötte a csillagok,
 * a csillagképek, a Tejút, az ekliptika a zodiákus jeleivel, horizont-keretben a születési hely horizontja.
 * Vetítés: sztereografikus (mint a Stellariumban), Canvas 2D – külső könyvtár nélkül, telefonon is folyamatos.
 * Adatok: Regio.EGBOLT (egbolt-adat.js, J2000 ekliptikai), Regio.CSILLAGKEPEK (magyar nevek).
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var SYM = '"Regio Symbols", "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols", sans-serif';
  var TXT = 'Arial, "Liberation Sans", sans-serif';
  var JEGY = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  var VS = '︎';
  /** planéták színei a sötét égen */
  var SZIN = { 0: '#ffd34d', 1: '#e8ecf5', 2: '#c9b6ff', 3: '#7cf0b0', 4: '#ff6b5b', 5: '#ffb05c', 6: '#d9c38c', 7: '#6fe3ff',
    8: '#7f9cff', 9: '#d07cff', 10: '#b8c4d8', 11: '#b8c4d8', 14: '#5fb3ff', 24: '#b8c4d8', 25: '#b8c4d8' };

  function fokNorm(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function vekt(l, b) { var cl = Math.cos(l * RAD), sl = Math.sin(l * RAD), cb = Math.cos(b * RAD), sb = Math.sin(b * RAD); return [cb * cl, cb * sl, sb]; }
  function mxv(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; }
  function kereszt(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
  function skalar(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function fokPerc(l) {
    var j = Math.floor(fokNorm(l) / 30), f = fokNorm(l) - j * 30, fo = Math.floor(f), p = Math.floor((f - fo) * 60);
    return fo + '°' + (p < 10 ? '0' : '') + p + '′ ' + (R.JEGYEK ? R.JEGYEK[j] : JEGY[j]);
  }
  /** csillagszín a B−V színindexből */
  function bvSzin(bv) {
    return bv < 0 ? '#a9c4ff' : bv < 0.3 ? '#d6e2ff' : bv < 0.6 ? '#fff6e8' : bv < 1.0 ? '#ffe1b0' : bv < 1.4 ? '#ffc58a' : '#ffad7a';
  }

  /**
   * Megnyitás.
   * @param {Object} o – { cim, alcim, pontok: [{id, jel, nev, L, B, retro, haz}], tengelyek: {asc, mc} | null, eltolas (J2000 → képlet
   *   ekliptikai hosszúság), ayan (a képlet hosszúsága + ayan = tropikus), eps, armc, phi (földrajzi szélesség), fszek: [{a, b, fsz, szin}],
   *   nezopontok: [[id, név]], nezopont: id (−1 = Föld), nezopontFv(id) → [{id, jel, nev, L, B}], kozep: id (kezdőnézet),
   *   beall: { keret, vonal, hatar, nevek, cskNev, tejut, fsz, egyenlito }, ment(beall) }
   */
  function nyit(o) {
    var E = R.EGBOLT; if (!E) return null;
    var b = o.beall || {};
    var ab = document.createElement('div');
    ab.className = 'egb-ablak'; ab.setAttribute('role', 'dialog'); ab.setAttribute('aria-label', 'Égbolt-nézet');
    ab.innerHTML = '<div class="egb-fej"><b>Égbolt-nézet</b><span class="egb-cim"></span><span class="tolt"></span>' +
      '<button type="button" class="kisgomb" data-egb="zar" aria-label="Bezárás" title="Bezárás (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="egb-eszk">' +
      '<label>Nézőpont <select data-egb="nezo"></select></label>' +
      '<label>Keret <select data-egb="keret"><option value="ekl">Ekliptika (zodiákus)</option><option value="hor">Horizont (a képlet helye)</option></select></label>' +
      '<label>Középre <select data-egb="kozep"><option value="">–</option></select></label>' +
      '<details class="egb-retegek"' + (global.innerWidth > 760 ? ' open' : '') + '><summary>Rétegek</summary><span class="egb-pipak">' +
      '<label><input type="checkbox" data-egbk="vonal"> Csillagképek</label>' +
      '<label><input type="checkbox" data-egbk="cskNev"> Nevek</label>' +
      '<label><input type="checkbox" data-egbk="hatar"> Határok</label>' +
      '<label><input type="checkbox" data-egbk="nevek"> Csillagnevek</label>' +
      '<label><input type="checkbox" data-egbk="tejut"> Tejút</label>' +
      '<label><input type="checkbox" data-egbk="egyenlito"> Égi egyenlítő</label>' +
      '<label><input type="checkbox" data-egbk="fsz"> Fényszögek</label></span></details>' +
      '<button type="button" class="gomb" data-egb="alap" title="Alaphelyzet (dupla kattintás az égen)">Alaphelyzet</button></div>' +
      '<div class="egb-vaszon"><canvas></canvas><div class="egb-tip" hidden></div></div>' +
      '<div class="egb-lab"><span class="egb-info"></span><span class="tolt"></span>' +
      '<span class="egb-sugo">Húzd: forgatás · görgő / két ujj: nagyítás · kattintás a planétán: középre · dupla kattintás: alaphelyzet</span></div>';
    document.body.appendChild(ab);
    var cv = ab.querySelector('canvas'), ctx = cv.getContext('2d'), tip = ab.querySelector('.egb-tip');
    var q = function (s) { return ab.querySelector(s); };
    ab.querySelector('.egb-cim').textContent = ' – ' + o.cim + (o.alcim ? ' (' + o.alcim + ')' : '');

    /* ---------- állapot ---------- */
    var A = { keret: b.keret === 'hor' && o.tengelyek ? 'hor' : 'ekl', yaw: 0, pitch: 0, fov: 110, nezo: o.nezopont === undefined ? -1 : o.nezopont };
    ['vonal', 'cskNev', 'hatar', 'nevek', 'tejut', 'egyenlito', 'fsz'].forEach(function (k) {
      A[k] = b[k] !== undefined ? !!b[k] : { vonal: true, cskNev: true, hatar: false, nevek: true, tejut: true, egyenlito: false, fsz: false }[k];
    });
    var pontok = o.pontok;
    var nezoSel = q('[data-egb="nezo"]');
    nezoSel.innerHTML = (o.nezopontok || [[-1, 'Föld (geocentrikus)']]).map(function (x) {
      return '<option value="' + x[0] + '">' + x[1] + '</option>';
    }).join('');
    nezoSel.value = String(A.nezo);
    q('[data-egb="keret"]').value = A.keret;
    Array.prototype.forEach.call(ab.querySelectorAll('[data-egbk]'), function (c) { c.checked = !!A[c.getAttribute('data-egbk')]; });

    /* ---------- keretek: a képlet ekliptikai hosszúsága (L, B) → egységvektor a nézet keretében ---------- */
    var Mhor = null;
    function horMatrix() {
      // ekliptikai (képlet) → tropikus → egyenlítői (valódi ferdeség) → horizontális (K, É, fel) a helyi csillagidővel (ARMC)
      var f = function (v) {
        var l = Math.atan2(v[1], v[0]) * DEG + (o.ayan || 0), bb = Math.asin(Math.max(-1, Math.min(1, v[2]))) * DEG;
        var w = vekt(l, bb), e = o.eps * RAD;
        var x = w[0], y = w[1] * Math.cos(e) - w[2] * Math.sin(e), z = w[1] * Math.sin(e) + w[2] * Math.cos(e);
        var ra = Math.atan2(y, x), de = Math.asin(Math.max(-1, Math.min(1, z))), h = o.armc * RAD - ra, fi = o.phi * RAD;
        return [-Math.cos(de) * Math.sin(h), Math.cos(fi) * Math.sin(de) - Math.sin(fi) * Math.cos(de) * Math.cos(h),
          Math.sin(fi) * Math.sin(de) + Math.cos(fi) * Math.cos(de) * Math.cos(h)];
      };
      var ex = f([1, 0, 0]), ey = f([0, 1, 0]), ez = f([0, 0, 1]);
      return [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]];
    }
    function keretV(v) { return A.keret === 'hor' ? mxv(Mhor || (Mhor = horMatrix()), v) : v; }
    function lb(L, B) { return keretV(vekt(L, B)); }
    /** a nézet iránya (yaw, pitch) a keretben → egy pont iránya */
    function irany(v) { return [Math.atan2(v[1], v[0]) * DEG, Math.asin(Math.max(-1, Math.min(1, v[2]))) * DEG]; }

    /* ---------- vetítés ---------- */
    var W = 0, H = 0, dpr = 1, F, Rr, U, skala;
    function kamera() {
      var cy = Math.cos(A.yaw * RAD), sy = Math.sin(A.yaw * RAD), cp = Math.cos(A.pitch * RAD), sp = Math.sin(A.pitch * RAD);
      F = [cp * cy, cp * sy, sp];
      Rr = norm(kereszt(F, [0, 0, 1])); U = kereszt(Rr, F);
      skala = (Math.min(W, H) / 2) / (2 * Math.tan(A.fov * RAD / 4));
    }
    function vetit(v) {
      var c = skalar(v, F);
      if (c < -0.35) return null;
      var k = 2 / (1 + c);
      return [W / 2 + k * skalar(v, Rr) * skala, H / 2 - k * skalar(v, U) * skala, c];
    }
    function lanc(t, eltol, vastag, szin, szaggat) {
      ctx.beginPath();
      var elozo = null;
      for (var i = 0; i < t.length; i += 2) {
        var p = vetit(lb(t[i] + eltol, t[i + 1]));
        if (p && elozo && Math.abs(p[0] - elozo[0]) + Math.abs(p[1] - elozo[1]) < Math.max(W, H)) ctx.lineTo(p[0], p[1]);
        else if (p) ctx.moveTo(p[0], p[1]);
        elozo = p;
      }
      ctx.strokeStyle = szin; ctx.lineWidth = vastag; ctx.setLineDash(szaggat || []); ctx.stroke(); ctx.setLineDash([]);
    }
    /** gömbi főkör-ív két pont között (fényszögek) */
    function iv(a, b2, szin) {
      var va = vekt(a.L, a.B), vb = vekt(b2.L, b2.B), om = Math.acos(Math.max(-1, Math.min(1, skalar(va, vb)))), t = [];
      var n = Math.max(2, Math.ceil(om * DEG / 2));
      for (var i = 0; i <= n; i++) {
        var s = i / n, w1 = om ? Math.sin((1 - s) * om) / Math.sin(om) : 1 - s, w2 = om ? Math.sin(s * om) / Math.sin(om) : s;
        var v = [va[0] * w1 + vb[0] * w2, va[1] * w1 + vb[1] * w2, va[2] * w1 + vb[2] * w2], d = irany(v);
        t.push(d[0], d[1]);
      }
      lanc(t, 0, 1.4 * dpr, szin);
    }

    /* ---------- rajzolás ---------- */
    var cs = E.csillag, csV = [], i;
    for (i = 0; i < cs.length; i += 4) csV.push([cs[i] / 100, cs[i + 1] / 100, cs[i + 2] / 100, bvSzin(cs[i + 3] / 100)]);
    var cskNev = (R.CSILLAGKEPEK && R.CSILLAGKEPEK.nev) || {};
    var kijelolt = null, talalat = [];
    var keres = false;
    function rajzol() {
      keres = false;
      kamera();
      var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, '#16213d'); g.addColorStop(1, '#070b16');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var el = o.eltolas || 0, px = dpr;
      // Tejút: a galaktikus egyenlítő mentén széles, halvány sáv
      if (A.tejut) {
        var szel = 20 * RAD * skala;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        lanc(E.tejut[0], el, szel, 'rgba(160,175,215,0.10)');
        lanc(E.tejut[0], el, szel * 0.45, 'rgba(170,185,225,0.08)');
        ctx.restore();
      }
      if (A.hatar) E.hatar.forEach(function (t) { lanc(t, el, 0.8 * px, 'rgba(120,140,190,0.35)', [3 * px, 4 * px]); });
      if (A.vonal) E.vonal.forEach(function (t) { lanc(t, el, 1 * px, 'rgba(110,150,230,0.55)'); });
      // égi egyenlítő (az ekliptikából a ferdeséggel)
      if (A.egyenlito) {
        var t = [];
        for (var ra = 0; ra <= 360; ra += 3) {
          var e2 = o.eps * RAD, x = Math.cos(ra * RAD), y = Math.sin(ra * RAD) * Math.cos(e2), z = -Math.sin(ra * RAD) * Math.sin(e2);
          t.push(fokNorm(Math.atan2(y, x) * DEG - (o.ayan || 0)), Math.asin(z) * DEG);
        }
        lanc(t, 0, 1 * px, 'rgba(120,220,200,0.55)', [6 * px, 5 * px]);
      }
      // csillagok
      csV.forEach(function (s) {
        var p = vetit(lb(s[0] + el, s[1])); if (!p) return;
        var r = Math.max(0.5, (6.3 - s[2]) * 0.42) * px * Math.min(1.6, Math.max(0.8, 90 / A.fov));
        ctx.globalAlpha = Math.min(1, 0.35 + (6.3 - s[2]) * 0.16) * halvany(p);
        ctx.fillStyle = s[3]; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (A.nevek) {
        ctx.font = (10.5 * px) + 'px ' + TXT; ctx.fillStyle = 'rgba(220,226,240,0.75)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        E.nevek.forEach(function (n) {
          if (n[3] > (A.fov > 120 ? 1.3 : A.fov > 70 ? 2.0 : 2.6)) return;
          var p = vetit(lb(n[0] + el, n[1])); if (p) ctx.fillText(n[2], p[0] + 5 * px, p[1] - 5 * px);
        });
      }
      if (A.cskNev) {
        ctx.font = (11 * px) + 'px ' + TXT; ctx.fillStyle = 'rgba(140,170,240,0.85)'; ctx.textAlign = 'center';
        E.cnev.forEach(function (c) {
          var p = vetit(lb(c[1] + el, c[2])); if (!p || p[2] < 0.1) return;
          ctx.fillText((cskNev[c[0]] || (c[0] === 'Ser' ? 'Kígyó' : c[0])).toUpperCase(), p[0], p[1]);
        });
      }
      ekliptika();
      if (A.keret === 'hor') horizont();
      if (A.fsz && A.nezo === -1 && o.fszek) {
        var pi = {}; pontok.forEach(function (x) { pi[x.id] = x; });
        o.fszek.forEach(function (f) { if (pi[f.a] && pi[f.b]) iv(pi[f.a], pi[f.b], f.szin || 'rgba(255,255,255,0.6)'); });
      }
      if (A.nezo === -1 && o.tengelyek) tengelyek();
      planetak();
    }
    /** horizont-keretben a horizont alatti rész halványabb */
    function halvany(p) { return 1; }
    function ekliptika() {
      var t = [], px = dpr, L;
      for (L = 0; L <= 360; L += 2) t.push(L, 0);
      lanc(t, 0, 1.6 * px, 'rgba(255,205,90,0.85)');
      // zodiákus-sáv (±8°) halványan
      var t1 = [], t2 = [];
      for (L = 0; L <= 360; L += 3) { t1.push(L, 8); t2.push(L, -8); }
      lanc(t1, 0, 0.7 * px, 'rgba(255,205,90,0.18)'); lanc(t2, 0, 0.7 * px, 'rgba(255,205,90,0.18)');
      ctx.strokeStyle = 'rgba(255,205,90,0.85)';
      for (L = 0; L < 360; L += 5) {
        var hossz = L % 30 === 0 ? 8 : L % 10 === 0 ? 2.2 : 1.1;
        var a = vetit(lb(L, -hossz)), b2 = vetit(lb(L, hossz));
        if (a && b2) { ctx.lineWidth = (L % 30 === 0 ? 1.4 : 1) * px; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); }
      }
      ctx.font = (20 * px) + 'px ' + SYM; ctx.fillStyle = 'rgba(255,215,120,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var j = 0; j < 12; j++) { var p = vetit(lb(j * 30 + 15, -4.5)); if (p) ctx.fillText(JEGY[j] + VS, p[0], p[1]); }
    }
    /** vetítés levágás nélkül (a horizont-kör pontos képéhez) */
    function vetitTeljes(v) {
      var c = skalar(v, F); if (c < -0.9995) return null;
      var k = 2 / (1 + c);
      return [W / 2 + k * skalar(v, Rr) * skala, H / 2 - k * skalar(v, U) * skala, c];
    }
    /** a horizont alatti félgömb: a sztereografikus vetítés kört körbe visz – a horizont képe kör (vagy egyenes) */
    function fold() {
      var pk = [];
      for (var az = 0; az < 360; az += 30) { var p = vetitTeljes([Math.sin(az * RAD), Math.cos(az * RAD), 0]); if (p) pk.push(p); }
      pk.sort(function (x, y) { return y[2] - x[2]; });
      if (pk.length < 3) return;
      var a = pk[0], b2 = pk[Math.floor(pk.length / 3)], c = pk[Math.floor(2 * pk.length / 3)];
      var d = 2 * (a[0] * (b2[1] - c[1]) + b2[0] * (c[1] - a[1]) + c[0] * (a[1] - b2[1]));
      ctx.save(); ctx.fillStyle = 'rgba(14,38,20,0.62)';
      if (Math.abs(d) < 1e-6) { ctx.restore(); return; }
      var ux = ((a[0] * a[0] + a[1] * a[1]) * (b2[1] - c[1]) + (b2[0] * b2[0] + b2[1] * b2[1]) * (c[1] - a[1]) + (c[0] * c[0] + c[1] * c[1]) * (a[1] - b2[1])) / d;
      var uy = ((a[0] * a[0] + a[1] * a[1]) * (c[0] - b2[0]) + (b2[0] * b2[0] + b2[1] * b2[1]) * (a[0] - c[0]) + (c[0] * c[0] + c[1] * c[1]) * (b2[0] - a[0])) / d;
      var r = Math.hypot(a[0] - ux, a[1] - uy), n = vetitTeljes([0, 0, -1]);
      var belul = n ? Math.hypot(n[0] - ux, n[1] - uy) < r : false;
      ctx.beginPath();
      if (belul) ctx.arc(ux, uy, r, 0, 2 * Math.PI);
      else { ctx.rect(0, 0, W, H); ctx.arc(ux, uy, r, 0, 2 * Math.PI, true); }
      ctx.fill('evenodd'); ctx.restore();
    }
    function horizont() {
      var px = dpr, t = [], az;
      fold();
      // a horizont: a keret „egyenlítője” – közvetlenül vetítve (a lanc() ekliptikai pontokat vár)
      ctx.beginPath(); var elozo = null;
      for (az = 0; az <= 360; az += 2) {
        var p = vetit([Math.sin(az * RAD), Math.cos(az * RAD), 0]);
        if (p && elozo) ctx.lineTo(p[0], p[1]); else if (p) ctx.moveTo(p[0], p[1]);
        elozo = p;
      }
      ctx.strokeStyle = 'rgba(120,230,140,0.9)'; ctx.lineWidth = 2 * px; ctx.stroke();
      ctx.font = 'bold ' + (14 * px) + 'px ' + TXT; ctx.fillStyle = 'rgba(150,240,160,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [['É', 0], ['K', 90], ['D', 180], ['Ny', 270]].forEach(function (x) {
        var p = vetit([Math.sin(x[1] * RAD), Math.cos(x[1] * RAD), 0]); if (p) ctx.fillText(x[0], p[0], p[1] + 14 * px);
      });
      void t;
    }
    function tengelyek() {
      var px = dpr, T = o.tengelyek;
      ctx.font = 'bold ' + (12 * px) + 'px ' + TXT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [['AC', T.asc], ['DC', fokNorm(T.asc + 180)], ['MC', T.mc], ['IC', fokNorm(T.mc + 180)]].forEach(function (x) {
        var p = vetit(lb(x[1], 0)); if (!p) return;
        ctx.fillStyle = x[0] === 'AC' || x[0] === 'MC' ? '#ffffff' : 'rgba(255,255,255,0.65)';
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.2 * px, 0, 2 * Math.PI); ctx.fill();
        ctx.fillText(x[0], p[0], p[1] + 13 * px);
      });
    }
    function foldJel(x, y, r) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    }
    function planetak() {
      var px = dpr, foglalt = []; talalat = [];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // feliratok ütközés nélkül: ha egy felirat egy korábbira esne, lejjebb kerül
      var hely = function (x, y, w, h) {
        for (var n = 0; n < 6; n++, y += h * 1.05) {
          var ok = foldVizsgal(x, y, w, h);
          if (ok) { foglalt.push([x - w / 2, y - h / 2, w, h]); return y; }
        }
        return y;
      };
      var foldVizsgal = function (x, y, w, h) {
        return foglalt.every(function (r) { return x + w / 2 < r[0] || x - w / 2 > r[0] + r[2] || y + h / 2 < r[1] || y - h / 2 > r[1] + r[3]; });
      };
      pontok.slice().sort(function (a, b2) { return (a.id === 0 || a.id === 1 ? 0 : 1) - (b2.id === 0 || b2.id === 1 ? 0 : 1); }).forEach(function (x) {
        var v = lb(x.L, x.B), p = vetit(v); if (!p) return;
        ctx.globalAlpha = A.keret === 'hor' && v[2] < 0 ? 0.55 : 1;
        var sz = SZIN[x.id] || '#ffffff', r = (x.id === 0 || x.id === 1 ? 7 : 5) * px, fo = kijelolt === x.id;
        var halo = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 3.2);
        halo.addColorStop(0, sz); halo.addColorStop(0.35, sz + '55'); halo.addColorStop(1, sz + '00');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p[0], p[1], r * 3.2, 0, 2 * Math.PI); ctx.fill();
        if (fo) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * px; ctx.beginPath(); ctx.arc(p[0], p[1], r * 2.6, 0, 2 * Math.PI); ctx.stroke(); }
        var gy = hely(p[0], p[1] - r * 2.6 - 9 * px, 20 * px, 20 * px);
        ctx.fillStyle = sz; ctx.strokeStyle = sz;
        if (x.id === 14) { ctx.lineWidth = 1.6 * px; foldJel(p[0], gy, 7 * px); }
        else { ctx.font = (20 * px) + 'px ' + SYM; ctx.fillText(x.jel, p[0], gy); }
        ctx.font = (10.5 * px) + 'px ' + TXT; ctx.fillStyle = 'rgba(235,240,250,0.85)';
        var fel = x.nev + (x.retro ? ' R' : ''), fw = ctx.measureText(fel).width;
        ctx.fillText(fel, p[0], hely(p[0], p[1] + r * 2.4 + 7 * px, fw + 4 * px, 13 * px));
        talalat.push({ x: p[0], y: p[1], gy: gy, p: x });
      });
      ctx.globalAlpha = 1;
    }

    /* ---------- méret, információs sor ---------- */
    function meretez() {
      var d = q('.egb-vaszon').getBoundingClientRect();
      dpr = Math.min(2, global.devicePixelRatio || 1);
      W = Math.max(100, Math.round(d.width * dpr)); H = Math.max(100, Math.round(d.height * dpr));
      cv.width = W; cv.height = H; cv.style.width = d.width + 'px'; cv.style.height = d.height + 'px';
      kell();
    }
    function kell() { if (!keres) { keres = true; global.requestAnimationFrame(rajzol); } info(); }
    function info() {
      var d = A.keret === 'hor' ? 'irány: ' + Math.round(fokNorm(90 - A.yaw)) + '° (É = 0°, K = 90°), magasság ' + Math.round(A.pitch) + '°'
        : 'irány: ' + fokPerc(A.yaw) + ', ekliptikai szélesség ' + Math.round(A.pitch) + '°';
      var n = nezoSel.options[nezoSel.selectedIndex];
      q('.egb-info').textContent = 'Nézőpont: ' + (n ? n.textContent : '') + ' · ' + d + ' · látómező ' + Math.round(A.fov) + '°';
    }
    function kozepre(id) {
      var x = null; pontok.forEach(function (p) { if (p.id === id) x = p; });
      if (!x) return;
      var d = irany(lb(x.L, x.B)); A.yaw = d[0]; A.pitch = Math.max(-85, Math.min(85, d[1])); kijelolt = id; kell();
    }
    function kozepLista() {
      var s = q('[data-egb="kozep"]');
      s.innerHTML = '<option value="">–</option>' + pontok.map(function (x) { return '<option value="' + x.id + '">' + x.nev + '</option>'; }).join('') +
        (A.nezo === -1 && o.tengelyek ? '<option value="AC">Ascendens</option><option value="MC">Medium Coeli</option>' : '');
    }
    function alap() {
      A.fov = 110; kijelolt = null;
      if (A.keret === 'hor') { A.yaw = -90; A.pitch = 25; }   // dél felé, kissé felfelé
      else { A.yaw = 0; A.pitch = 0; }
      if (o.kozep !== undefined && o.kozep !== null) kozepre(o.kozep);
      else if (A.keret === 'ekl') {
        // geocentrikusan a Nap felé, más nézőpontból a Föld felé
        var cel = pontok.filter(function (x) { return x.id === (A.nezo === -1 ? 0 : 14); })[0]; if (cel) { A.yaw = cel.L; }
      }
      kell();
    }
    function ment() {
      if (!o.ment) return;
      o.ment({ keret: A.keret, vonal: A.vonal, cskNev: A.cskNev, hatar: A.hatar, nevek: A.nevek, tejut: A.tejut, egyenlito: A.egyenlito, fsz: A.fsz });
    }
    function nezopontAllit(id) {
      A.nezo = id;
      pontok = id === -1 ? o.pontok : (o.nezopontFv ? o.nezopontFv(id) : o.pontok);
      var hor = q('[data-egb="keret"] option[value="hor"]');
      hor.disabled = id !== -1 || !o.tengelyek;
      if (hor.disabled && A.keret === 'hor') { A.keret = 'ekl'; q('[data-egb="keret"]').value = 'ekl'; }
      q('[data-egbk="fsz"]').disabled = id !== -1;
      kozepLista(); kell();
    }

    /* ---------- események ---------- */
    var mutatok = {}, huz = null, csip = null, mozdult = false;
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId); mutatok[e.pointerId] = [e.clientX, e.clientY]; mozdult = false;
      var k = Object.keys(mutatok);
      if (k.length === 1) huz = { x: e.clientX, y: e.clientY, yaw: A.yaw, pitch: A.pitch };
      else if (k.length === 2) { var a = mutatok[k[0]], b2 = mutatok[k[1]]; csip = { d: Math.hypot(a[0] - b2[0], a[1] - b2[1]), fov: A.fov }; huz = null; }
    });
    cv.addEventListener('pointermove', function (e) {
      if (mutatok[e.pointerId]) mutatok[e.pointerId] = [e.clientX, e.clientY];
      var k = Object.keys(mutatok);
      if (csip && k.length === 2) {
        var a = mutatok[k[0]], b2 = mutatok[k[1]], d = Math.hypot(a[0] - b2[0], a[1] - b2[1]);
        A.fov = Math.max(15, Math.min(175, csip.fov * csip.d / Math.max(1, d))); mozdult = true; kell(); return;
      }
      if (huz) {
        var dx = e.clientX - huz.x, dy = e.clientY - huz.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) mozdult = true;
        var fokPx = A.fov / (Math.min(W, H) / dpr);
        A.yaw = huz.yaw + dx * fokPx; A.pitch = Math.max(-89, Math.min(89, huz.pitch + dy * fokPx));
        tip.hidden = true; kell(); return;
      }
      buborek(e);
    });
    function fel(e) {
      delete mutatok[e.pointerId];
      if (Object.keys(mutatok).length < 2) csip = null;
      if (!Object.keys(mutatok).length) {
        if (huz && !mozdult) { var t = legkozelebbi(e); if (t) { kozepre(t.p.id); q('[data-egb="kozep"]').value = String(t.p.id); } }
        huz = null;
      }
    }
    cv.addEventListener('pointerup', fel);
    cv.addEventListener('pointercancel', fel);
    cv.addEventListener('pointerleave', function () { tip.hidden = true; });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      A.fov = Math.max(15, Math.min(175, A.fov * Math.pow(1.0015, e.deltaY))); kell();
    }, { passive: false });
    cv.addEventListener('dblclick', alap);
    function legkozelebbi(e) {
      var d = cv.getBoundingClientRect(), x = (e.clientX - d.left) * dpr, y = (e.clientY - d.top) * dpr, jo = null, min = 22 * dpr;
      talalat.forEach(function (t) {
        var m = Math.min(Math.hypot(t.x - x, t.y - y), Math.hypot(t.x - x, t.gy - y));
        if (m < min) { min = m; jo = t; }
      });
      return jo;
    }
    function buborek(e) {
      var t = legkozelebbi(e);
      if (!t) { tip.hidden = true; return; }
      var p = t.p, s = p.nev + ': ' + fokPerc(p.L) + (Math.abs(p.B) >= 0.05 ? ', szélesség ' + p.B.toFixed(1).replace('.', ',') + '°' : '') +
        (p.haz ? ', ' + p.haz + '. ház' : '') + (p.retro ? ', retrográd' : '');
      if (A.keret === 'hor') {
        var v = lb(p.L, p.B), alt = Math.asin(v[2]) * DEG, az = fokNorm(Math.atan2(v[0], v[1]) * DEG);
        s += '\nMagasság ' + alt.toFixed(1).replace('.', ',') + '°' + (alt < 0 ? ' (a horizont alatt)' : '') + ', azimut ' + Math.round(az) + '°';
      }
      tip.textContent = s; tip.hidden = false;
      var d = q('.egb-vaszon').getBoundingClientRect();
      tip.style.left = Math.min(d.width - tip.offsetWidth - 6, e.clientX - d.left + 14) + 'px';
      tip.style.top = Math.max(6, e.clientY - d.top - tip.offsetHeight - 10) + 'px';
    }
    nezoSel.addEventListener('change', function () { nezopontAllit(+this.value); alap(); });
    q('[data-egb="keret"]').addEventListener('change', function () { A.keret = this.value; ment(); alap(); });
    q('[data-egb="kozep"]').addEventListener('change', function () {
      var v = this.value; if (!v) return;
      if (v === 'AC' || v === 'MC') {
        var d = irany(lb(v === 'AC' ? o.tengelyek.asc : o.tengelyek.mc, 0)); A.yaw = d[0]; A.pitch = Math.max(-85, Math.min(85, d[1])); kijelolt = null; kell();
      } else kozepre(+v);
    });
    Array.prototype.forEach.call(ab.querySelectorAll('[data-egbk]'), function (c) {
      c.addEventListener('change', function () { A[c.getAttribute('data-egbk')] = c.checked; ment(); kell(); });
    });
    q('[data-egb="alap"]').addEventListener('click', alap);
    function zar() { if (ro) ro.disconnect(); global.removeEventListener('resize', meretez); document.removeEventListener('keydown', bill, true); ab.remove(); if (o.bezarva) o.bezarva(); }
    function bill(e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); zar(); } }
    q('[data-egb="zar"]').addEventListener('click', zar);
    document.addEventListener('keydown', bill, true);
    global.addEventListener('resize', meretez);

    var ro = global.ResizeObserver ? new global.ResizeObserver(meretez) : null;
    if (ro) ro.observe(q('.egb-vaszon'));
    nezopontAllit(A.nezo);
    meretez(); alap();
    q('[data-egb="zar"]').focus();
    return { ablak: ab, zar: zar, allapot: A, kozepre: kozepre, rajzol: rajzol };
  }

  R.Egbolt = { nyit: nyit };
})(typeof window !== 'undefined' ? window : globalThis);
