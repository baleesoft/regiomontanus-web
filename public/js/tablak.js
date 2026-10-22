/*
 * tablak.js – a Windows-os Táblázatok menü táblái (HTML), a Regio.Keplet.szamol() eredményéből.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var T = R.Tablak = {};

  function cella(v) { return '<div>' + v + '</div>'; }
  function nincsElemzes(e) {
    return e.elemzes ? '' : '<p class="t-hint">A képlet-elemzés (házurak, fényszögek, énjelölők) most nem érhető el.</p>';
  }

  /** „Chiron és a kisbolygók” bekapcsolva? (b = a program beállításai; ha nincs megadva: igen, a régi viselkedés) */
  T.kisbLathato = function (b) { return !b || !b.kerek || !!b.kerek.asteroids; };
  /** Csomópont: a beállítás szerinti (közepes 10 / valódi 11) */
  T.csomo = function (b) { return b && b.csomo === 10 ? 10 : 11; };

  /* ---------- Planéták (Ctrl+B) ---------- */
  T.planetak = function (e, b) {
    var cs = T.csomo(b);
    // kisbolygók csak bekapcsolt „Aszteroidák megjelenítése” mellett (GetShownPlanetSet(true)); a jel nélküliek (Eris, üstökösök) a végén
    var kisb = T.kisbLathato(b);
    var ids = R.SZAMOLT.filter(function (id) { return e.poz[id] && (id < 10 || id === cs || (kisb && id >= 12)); });
    if (kisb) R.KISBOLYGOK.forEach(function (k) { if (ids.indexOf(k[0]) < 0 && e.poz[k[0]]) ids.push(k[0]); });
    var sor = ids.map(function (id) {
      var x = e.poz[id], j = R.jegyben(x.lon), p = e.elemPl[id], urak = '', jel = [];
      if (p) {
        urak = p.lordOf.join(',');
        if (p.closedLordOf.length) urak += (urak ? ' ' : '') + '(' + p.closedLordOf.join(',') + ')';
        if (p.feral) jel.push('<span class="t-flag" title="ferális">F</span>');
        if (p.isolated) jel.push('<span class="t-flag" title="izolált">i</span>');
        if (p.stationary) jel.push('<span class="t-flag" title="stacioner">S</span>');
        if (p.selfMarker) jel.push('<span class="t-em" title="énjelölő">●</span>');
      }
      if (x.speedLon < 0) jel.unshift('<span class="t-r" title="retrográd">R</span>');
      return '<tr><td class="t-gl">' + R.glif(id) + '</td><td>' + R.nev(id) + '</td>' +
        '<td class="t-gl">' + R.jegyGlif(j.j) + '</td><td>' + R.JEGYEK[j.j] + '</td>' +
        '<td class="t-num">' + R.fokStr(j.fok) + '</td><td class="t-num">' + (p ? p.house : '') + '</td>' +
        '<td>' + urak + '</td><td>' + jel.join(' ') + '</td>' +
        '<td class="t-num">' + x.speedLon.toFixed(4) + '</td></tr>';
    });
    return nincsElemzes(e) + '<table class="t t-pl"><thead><tr><th></th><th>Planéta</th><th></th><th>Jegy</th><th>Pozíció</th>' +
      '<th>Ház</th><th>Házúr</th><th>Jelölés</th><th>Seb. (°/nap)</th></tr></thead><tbody>' + sor.join('') + '</tbody></table>';
  };

  /* ---------- Állócsillagok (Táblázatok › Állócsillagok, fAspectsForFixedStars) ---------- */
  /**
   * A kijelölt csillagok név szerint rendezve: megnevezés, jele (4 betű), fényszögek, nómenklatúra, csillagkép (latin, magyar),
   * jegy, pozíció, ház. A fényszögek a csillagoknál beállított fajták (b.allo.fsz) a Nap..Plútóval
   * (GetAspectDetailsForPlanetId; a fényszögelt tengelyek és házcsúcsok gyárilag nincsenek bekapcsolva).
   */
  T.allocsillagok = function (e, b) {
    var A = R.Allo, al = (b && b.allo) || {}, fsz = al.fsz || [];
    if (!A || !e.csillagok || !e.csillagok.length) return '<p class="t-hint">Nincs kijelölt állócsillag (Beállítások › Állócsillagok).</p>';
    if (!e.elemzes) return nincsElemzes(e);
    var fsz1 = {};
    e.elemzes.aspects.forEach(function (a) {
      if (a.a[0] !== 'P' || a.b[0] !== 'P' || fsz.indexOf(a.aspect) < 0) return;
      var cs, mas;
      if (A.csillag(a.a[1]) && !A.csillag(a.b[1])) { cs = a.a[1]; mas = a.b[1]; }
      else if (A.csillag(a.b[1]) && !A.csillag(a.a[1])) { cs = a.b[1]; mas = a.a[1]; }
      else return;
      if (mas > 9) return;
      (fsz1[cs] = fsz1[cs] || []).push(R.FENYSZOG[a.aspect][0] + ' ' + R.nev(mas) + ' [' + R.fokStr(a.orb, false) + ']');
    });
    var sorok = e.csillagok.map(function (c) { return c.id; }).filter(function (id) { return e.elemPl[id]; })
      .sort(function (x, y) { return A.nev(x).localeCompare(A.nev(y), 'hu'); });
    var esc = R.esc || function (s) { return s; };
    var sor = sorok.map(function (id) {
      var p = e.elemPl[id], d = A.adat(id), j = R.jegyben(p.lon), l = fsz1[id] || [];
      return '<tr data-allo="' + id + '"><td>' + esc(d[0]) + '</td><td>' + esc(A.jele(id)) + '</td>' +
        '<td class="t-allo-fsz">' + l.map(esc).join('<br>') + '</td>' +
        '<td>' + esc(d[1]) + '</td><td>' + esc(d[2]) + '</td><td>' + esc(d[3]) + '</td>' +
        '<td>' + R.JEGYEK[j.j] + '</td><td class="t-gl">' + R.jegyGlif(j.j) + '</td>' +
        '<td class="t-num">' + R.fokStr(j.fok) + '</td><td class="t-num">' + (p.house || '') + '</td></tr>';
    });
    return '<table class="t t-allo"><thead><tr><th>Megnevezés</th><th>Jele</th><th>Fényszögek</th><th>Nómenklatúra</th>' +
      '<th>Csillagkép</th><th>Csillagkép magyarul</th><th>Jegyben</th><th>Jele</th><th>Pozíció</th><th>Ház</th></tr></thead><tbody>' +
      sor.join('') + '</tbody></table>';
  };

  /* ---------- Házak (Ctrl+H) ---------- */
  T.hazak = function (e) {
    var hz = e.hz, sor = [];
    for (var i = 1; i <= 12; i++) {
      var j = R.jegyben(hz.cusps[i]);
      sor.push('<tr><td>' + i + '. ház</td><td class="t-gl">' + R.jegyGlif(j.j) + '</td><td>' + R.JEGYEK[j.j] +
        '</td><td class="t-num">' + R.fokStr(j.fok) + '</td></tr>');
    }
    sor.push('<tr class="t-sep"><td colspan="4"></td></tr>');
    [['Ascendens', hz.asc], ['Medium Coeli', hz.mc], ['Vertex', hz.vertex], ['Keleti pont (ekv. ASC)', hz.equAsc],
      ['Co-ASC (Koch)', hz.coAscKoch], ['Poláris ASC', hz.polarAsc]].forEach(function (a) {
      var j = R.jegyben(a[1]);
      sor.push('<tr><td>' + a[0] + '</td><td class="t-gl">' + R.jegyGlif(j.j) + '</td><td>' + R.JEGYEK[j.j] +
        '</td><td class="t-num">' + R.fokStr(j.fok) + '</td></tr>');
    });
    var cim = hz.kos0 ? 'Kos 0° – egyenlő házak a Kostól' : hz.persp !== undefined ? 'Egyenlő – ' + R.Keplet.PERSP_NEV(hz.persp) + ' az ASC-n'
      : R.HAZRENDSZER[e.hsys] || e.hsys;
    return '<table class="t"><thead><tr><th>' + cim + '</th><th></th><th>Jegy</th><th>Pozíció</th></tr></thead><tbody>' +
      sor.join('') + '</tbody></table>';
  };

  /* ---------- Fényszög-információk (Ctrl+F): alsó háromszög + részletek ---------- */
  /** pozíció a jegyben: „18°47′ ♈” (fok + perc, a jegy jelével) */
  function pozHtml(lon) {
    if (typeof lon !== 'number') return '';
    var j = R.jegyben(lon);
    return '<span class="t-poz">' + R.fokStr(j.fok, false) + '<span class="t-pozj">' + R.jegyGlif(j.j) + '</span></span>';
  }
  /** fejléc-cella: jel (vagy rövid név) + alatta a pozíció */
  function fejCella(jel, ax, nev, lon, extra) {
    return '<th class="t-fej' + (ax ? ' t-ax' : '') + (extra || '') + '" title="' + R.esc(nev) + '"><span class="t-fejjel">' + jel + '</span>' + pozHtml(lon) + '</th>';
  }
  /** fényszög-cella: jel + aktuális orbis (fok, perc), több fényszögnél egymás alatt */
  function fszCella(l, kulcs) {
    return '<td class="t-has" tabindex="0" data-k="' + kulcs + '" title="' + l.map(function (x) { return R.FENYSZOG[x.a.aspect][0]; }).join(', ') + '">' +
      l.map(function (x) {
        return '<span class="t-fsz"><span class="t-fszj">' + R.FENYSZOG[x.a.aspect][3] + R.VS + '</span><span class="t-orb">' +
          R.fokStr(x.a.orb, false) + '</span></span>';
      }).join('') + '</td>';
  }
  /** Egy képlet elemei a fényszögtáblához: testek (planéták, holdcsomók, kisbolygók) és a csak planétákkal fényszögelő pontok */
  var TENGELY_PONT = { 0: ['AC', 'Ascendens', 'asc'], 1: ['MC', 'Medium Coeli', 'mc'], 3: ['Vtx', 'Vertex', 'vertex'], 4: ['EP', 'Keletpont', 'equAsc'],
    6: ['Cas', 'Koascendens (M. Munkasey)', 'coAscMunkasey'], 7: ['Pas', 'Sarki ascendens', 'polarAsc'] };
  var TPONT_KULCS = { vtx: 3, ep: 4, cas: 6, pas: 7 };
  T.fszElemek = function (e, b) {
    var cs = T.csomo(b), kr = (b && b.kerek) || {}, testek = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, cs];
    if (kr.nodesDown) testek.push(cs === 11 ? 25 : 24);
    if (T.kisbLathato(b)) {
      testek.push(12);
      R.KISBOLYGOK.forEach(function (k) { if (testek.indexOf(k[0]) < 0) testek.push(k[0]); });
    }
    testek = testek.filter(function (id) { return e.elemPl[id]; });
    // pontok: ASC, MC, a Megjelenítésben bekapcsolt további tengelyek, a házcsúcsok (az 1. és a 10. az ASC/MC)
    var pontok = [['A', 0], ['A', 1]];
    (kr.tengelyek || []).forEach(function (t) { if (TPONT_KULCS[t] !== undefined) pontok.push(['A', TPONT_KULCS[t]]); });
    [2, 3, 4, 5, 6, 7, 8, 9, 11, 12].forEach(function (h) { pontok.push(['H', h]); });
    return { testek: testek, pontok: pontok };
  };
  function pontAdat(e, pt, b) {
    if (pt[0] === 'A') { var t = TENGELY_PONT[pt[1]]; return { jel: t[0], nev: t[1], lon: e.hz[t[2]] }; }
    var h = pt[1], ic = { 4: ' (IC)', 7: ' (DC)' }[h] || '';
    return { jel: h + '.h', nev: h + '. házcsúcs' + ic, lon: e.hz.cusps[h] };
  }
  function testLon(e, id) { var p = (e.elemPl || {})[id] || (e.poz || {})[id]; return p ? p.lon : undefined; }
  function testFej(e, id) {
    var p = (e.elemPl || {})[id], g = R.glif(id), nev = R.nev(id) + (p && p.speed < 0 ? ' (retrográd)' : '');
    return g ? fejCella(g, false, nev, testLon(e, id)) : fejCella(R.esc(R.nev(id).slice(0, 4)), true, nev, testLon(e, id));
  }
  function helyStr(lon) { if (typeof lon !== 'number') return ''; var j = R.jegyben(lon); return R.JEGYEK[j.j] + ' ' + R.fokStr(j.fok, false); }

  T.fenyszogek = function (hova, e, b) {
    if (!e.elemzes) { hova.innerHTML = nincsElemzes(e); return; }
    var el = e.elemzes, L = T.fszElemek(e, b), ids = L.testek, nT = ids.length;
    var idx = {}; ids.forEach(function (id, i) { idx[id] = i; });
    var pIdx = {}; L.pontok.forEach(function (pt, i) { pIdx[pt[0] + pt[1]] = i; });
    var cellak = {};
    el.aspects.forEach(function (a) {
      if (a.a[0] !== 'P' || idx[a.a[1]] === undefined) return;
      var id1 = a.a[1], k, masik;
      if (a.b[0] === 'P') {
        var id2 = a.b[1];
        if (idx[id2] === undefined) return;
        if (a.aspect === 1 && [10, 11, 24, 25].indexOf(id1) >= 0 && [10, 11, 24, 25].indexOf(id2) >= 0) return;
        var r = Math.max(idx[id1], idx[id2]), c = Math.min(idx[id1], idx[id2]);
        k = r + '_' + c; masik = { nev: R.nev(id2), lon: testLon(e, id2) };
      } else {
        var pi = pIdx[a.b[0] + a.b[1]];
        if (pi === undefined) return;
        k = 'p' + pi + '_' + idx[id1]; masik = pontAdat(e, L.pontok[pi], b);
      }
      (cellak[k] = cellak[k] || []).push({ a: a, n1: R.nev(id1), l1: testLon(e, id1), n2: masik.nev, l2: masik.lon });
    });
    var h = '<div class="t-asp"><div class="t-gridtart"><table class="t-grid t-fszt"><tbody>';
    // testek: alsó háromszög, a fejléc az átlón
    for (var r = 0; r < nT; r++) {
      h += '<tr>';
      for (var c = 0; c <= r; c++) {
        if (c === r) h += testFej(e, ids[r]);
        else { var l = cellak[r + '_' + c]; h += l ? fszCella(l, r + '_' + c) : '<td></td>'; }
      }
      h += '</tr>';
    }
    // pontok (ASC, MC, további tengelyek, házcsúcsok): csak a testekkel fényszögelnek – sorok a háromszög alatt, a nevük jobbra
    L.pontok.forEach(function (pt, pi) {
      var d = pontAdat(e, pt, b);
      h += '<tr class="t-pontsor' + (pi === 0 ? ' t-elso' : '') + '">';
      for (var c2 = 0; c2 < nT; c2++) { var l2 = cellak['p' + pi + '_' + c2]; h += l2 ? fszCella(l2, 'p' + pi + '_' + c2) : '<td></td>'; }
      h += fejCella(d.jel, true, d.nev, d.lon) + '</tr>';
    });
    h += '</tbody></table></div><div class="t-kv t-aspinfo" aria-live="polite"><div>Válassz egy fényszöget a táblában.</div><div></div></div></div>';
    hova.innerHTML = h;
    var t = hova.querySelector('.t-grid'), info = hova.querySelector('.t-aspinfo');
    function valaszt(td) {
      Array.prototype.forEach.call(t.querySelectorAll('td.t-sel'), function (x) { x.classList.remove('t-sel'); });
      td.classList.add('t-sel');
      info.innerHTML = cellak[td.getAttribute('data-k')].map(function (x) {
        var f = R.FENYSZOG[x.a.aspect];
        return ['1. elem', R.esc(x.n1), '… helye', helyStr(x.l1), '2. elem', R.esc(x.n2), '… helye', helyStr(x.l2),
          'Fényszög neve', f[0] + ' ' + f[3] + R.VS + ' (' + f[1] + '°)', 'Orbis értéke', R.fokStr(x.a.maxOrb || f[2]),
          'Fényszög értéke', R.fokStr(x.a.orb, false) + (x.a.exact ? ' (pontos)' : '')].map(cella).join('');
      }).join('<div class="t-kv-sep"></div>');
    }
    t.addEventListener('click', function (ev) { var td = ev.target.closest('td.t-has'); if (td) valaszt(td); });
    t.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('t-has')) { ev.preventDefault(); valaszt(ev.target); }
    });
  };

  /* ---------- Énállapotok (Ctrl+E) ---------- */
  T.enallapotok = function (e) {
    if (!e.elemzes) return nincsElemzes(e);
    var sor = e.elemzes.selfMarkers.map(function (m) {
      var j;
      if (m.type === 'P') {
        var p = e.elemPl[m.id]; j = R.jegyben(p.lon);
        return '<tr><td class="t-gl">' + R.glif(m.id) + '</td><td>' + R.nev(m.id) + '</td><td class="t-gl">' + R.jegyGlif(j.j) +
          '</td><td>' + R.JEGYEK[j.j] + ' jegyében ' + R.fokStr(j.fok) + ' fokon a(z) ' + p.house + '. Házban</td></tr>';
      }
      if (m.type === 'H') {
        j = R.jegyben(m.lon);
        return '<tr><td class="t-ax">AC</td><td>Ascendens</td><td class="t-gl">' + R.jegyGlif(j.j) +
          '</td><td>' + R.JEGYEK[j.j] + ' jegyében ' + R.fokStr(j.fok) + ' fokon</td></tr>';
      }
      return '<tr><td class="t-gl">' + R.jegyGlif(m.sign) + '</td><td>' + R.JEGYEK[m.sign] + '</td><td class="t-gl">' +
        R.jegyGlif(m.sign) + '</td><td>' + R.JEGYEK[m.sign] + ', mint az 1. Házba bezárt jegy</td></tr>';
    });
    return '<table class="t t-enall"><thead><tr><th>Jele</th><th>Neve</th><th></th><th>Helye</th></tr></thead><tbody>' +
      sor.join('') + '</tbody></table>' +
      (e.hz.kos0 ? '<p class="t-hint">Kos 0° képletnél az Ascendens a Kos 0°-a.</p>' : '');
  };

  /* ---------- Életstratégia, járatlan út (Ctrl+J) ---------- */
  T.eletstrat = function (e) {
    if (!e.elemzes) return nincsElemzes(e);
    var es = e.elemzes.lifeStrategy, sorok = ['Tűz', 'Föld', 'Levegő', 'Víz', 'Összesen'];
    var h = '<table class="t t-es"><thead><tr><th></th><th>Kardinális</th><th>Fix</th><th>Labilis</th><th>Összesen</th></tr></thead><tbody>';
    es.matrix.forEach(function (s, r) {
      h += '<tr><th>' + sorok[r] + '</th>' + s.map(function (v, c) {
        return '<td' + (r === 4 || c === 3 ? ' class="t-sum"' : '') + '>' + v + '</td>';
      }).join('') + '</tr>';
    });
    var ut = function (l) { return l.map(function (j) { return R.JEGYEK[j] + ' / ' + R.HAZNEV[j + 1] + ' Ház'; }).join(', ') || '–'; };
    return h + '</tbody></table><div class="t-kv"><div>Életstratégia:</div><div><b>' + ut(es.walked) + '</b></div>' +
      '<div>Járatlan út:</div><div><b>' + ut(es.unwalked) + '</b></div></div>';
  };

  /* ---------- Egyéb információk ---------- */
  T.egyeb = function (e) {
    var a = e.adat, ut = e.ut, uh = Math.floor(ut.hour), um = Math.floor((ut.hour - uh) * 60),
      us = Math.round(((ut.hour - uh) * 60 - um) * 60);
    if (us === 60) { us = 0; um++; } if (um === 60) { um = 0; uh++; }
    var st = e.csillagido, sth = Math.floor(st), stm = Math.floor((st - sth) * 60),
      sts = Math.floor(((st - sth) * 60 - stm) * 60);
    var ism = R.Keplet.kos0e(a);
    return '<div class="t-kv">' + [
      'Név', R.esc(R.Keplet.cim(a)),
      'Helyi idő', R.datumStr(a.ev, a.ho, a.nap) + '. ' + (ism && a.ismeretlen ? '12:00 (ismeretlen időpont – helyi dél)'
        : R.pad(a.ora) + ':' + R.pad(a.perc) + ':' + R.pad(a.mp || 0)),
      'Időzóna', R.esc(e.zona.info),
      'Világidő (UT)', R.datumStr(ut.year, ut.month, ut.day) + '. ' + R.pad(uh) + ':' + R.pad(um) + ':' + R.pad(us),
      'Julián dátum (UT)', e.jd.toFixed(6),
      'ΔT', e.deltaT.toFixed(2) + ' mp',
      'Helyi csillagidő', R.pad(sth) + ':' + R.pad(stm) + ':' + R.pad(sts),
      'Ekliptika ferdesége', R.fokStr(e.eps),
      'Földrajzi hely', R.esc([R.Keplet.helyNev(a), a.orszag].filter(Boolean).join(', ')) + ' – ' +
        R.fokStr(Math.abs(a.lat), false) + ' ' + (a.lat >= 0 ? 'É' : 'D') + ', ' + R.fokStr(Math.abs(a.lon), false) + ' ' + (a.lon >= 0 ? 'K' : 'Ny'),
      'Házrendszer', (e.hz.kos0 ? 'Kos 0° képlet (egyenlő házak a Kostól)' : e.hz.persp !== undefined ?
        'Egyenlő (planétaperspektíva: ' + R.Keplet.PERSP_NEV(e.hz.persp) + ' az ASC-n; eredeti ASC: ' + R.fokStr(e.hz.origAsc, false) + ')' : R.HAZRENDSZER[e.hsys]) + (e.sid ? ', sziderikus' : ', tropikus'),
      'Számítás', 'Swiss Ephemeris (WebAssembly)'
    ].map(cella).join('') + '</div>' + T.egyebKieg(e) +
      (e.figyelmeztetes.length ? '<p class="t-hint">' + e.figyelmeztetes.map(R.esc).join('<br>') + '</p>' : '');
  };

  /* az „Egyéb” fül kiegészítő adatai (keplet.js: egyebAdatok) */
  function idoStr(t, mp) {
    var h = t.hour, hh = Math.floor(h), m = Math.floor((h - hh) * 60), s = Math.floor(((h - hh) * 60 - m) * 60 + 1e-6);
    return R.datumStr(t.year, t.month, t.day) + '. ' + R.pad(hh) + ':' + R.pad(m) + (mp === false ? '' : ':' + R.pad(s));
  }
  function oraStr(h) {
    h = ((h % 24) + 24) % 24;
    var t = Math.floor(h * 3600 + 1e-6);
    return R.pad(Math.floor(t / 3600)) + ':' + R.pad(Math.floor(t % 3600 / 60)) + ':' + R.pad(t % 60);
  }
  /** Hold-fázis ikon: a megvilágított rész (k = 0..1), telő (jobbról világos) / fogyó */
  function holdIkon(k, telo) {
    var r = 9, rx = Math.abs(1 - 2 * k) * r, s1 = telo ? 1 : 0;
    // a világos rész: fél kör a megvilágított oldalon + ellipszis-ív a terminátoron
    var d = 'M10 1 A' + r + ' ' + r + ' 0 0 ' + s1 + ' 10 19 A' + rx.toFixed(2) + ' ' + r + ' 0 0 ' + (k > 0.5 ? s1 : 1 - s1) + ' 10 1Z';
    return '<svg class="t-hold" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#2b2b2b"/>' +
      '<path d="' + d + '" fill="#fff6c8"/><circle cx="10" cy="10" r="9" fill="none" stroke="#555" stroke-width="0.8"/></svg>';
  }
  T.egyebKieg = function (e) {
    var x = e.egyeb, a = e.adat; if (!x) return '';
    var sor = [], zona = '(' + R.esc(e.zona.kod || '') + (e.zona.orak !== undefined ? ' ' + R.oraStr(e.zona.orak) : '') + ')';
    function blokk(cim, l) { return l.length ? '<h3 class="t-cim">' + cim + '</h3><div class="t-kv">' + l.map(cella).join('') + '</div>' : ''; }
    var ek = a.tipus !== 'aktualis' && R.Keplet.eletkorReszletes ? R.Keplet.eletkorReszletes(a) : null;
    if (ek) sor.push('Életkor', ek.ev + ' éves ' + ek.ho + ' hónapos ' + ek.nap + ' napos');
    sor.push('Helyi középidő', idoStr(x.lmtIdo));
    if (x.latIdo) sor.push('Helyi látszólagos idő', idoStr(x.latIdo));
    sor.push('Greenwich-i csillagidő', oraStr(x.gst));
    sor.push('ARMC', R.fokStr(x.armc) + ' (' + oraStr(x.armc / 15) + ')');
    sor.push('Nutáció (hosszúságban)', (x.nutacio * 3600).toFixed(1).replace('.', ',') + '"');
    sor.push('Koordináta-rendszer', 'Geocentrikus');
    if (x.ayanamsa !== undefined) sor.push('Ajánamsa (Fagan/Bradley)', R.fokStr(x.ayanamsa) +
      ' (tropikus Kos 0° = sziderikus Halak ' + R.fokStr(30 - x.ayanamsa) + ')');
    var hold = [];
    if (x.napHold !== undefined) {
      var telo = x.napHold < 180;
      hold.push('Nap–Hold hosszkülönbség', R.fokStr(x.napHold));
      if (x.holdFazis !== undefined) hold.push('Hold fázisa', holdIkon(x.holdFazis, telo) + ' ' +
        (x.holdFazis * 100).toFixed(1).replace('.', ',') + ' % megvilágított, ' + (telo ? 'telő' : 'fogyó') + ' Hold');
      if (x.holdkor !== undefined) hold.push('Holdkor (az újhold óta)', x.holdkor.toFixed(1).replace('.', ',') + ' nap');
    }
    var nk = [];
    if (x.napkelte !== undefined) {
      nk.push('Napkelte', x.napkelteIdo ? idoStr(x.napkelteIdo) + ' ' + zona : 'nincs (sarki éjszaka/nappal)');
      nk.push('Napnyugta', x.napnyugtaIdo ? idoStr(x.napnyugtaIdo) + ' ' + zona : 'nincs (sarki éjszaka/nappal)');
    }
    var pl = [];
    if (x.planNap !== undefined) {
      pl.push('Nap', R.glif(x.planNap) + ' ' + R.nev(x.planNap));
      pl.push('Óra', R.glif(x.planOra) + ' ' + R.nev(x.planOra));
    }
    return blokk('További adatok', sor) + blokk('Hold', hold) + blokk('Napkelte, napnyugta', nk) + blokk('Planetáris idő', pl);
  };

  /* ---------- Összevetés: keresztkapcsolati fényszögtábla (sorok: belső kör, oszlopok: külső kör) ---------- */
  T.keresztFenyszogek = function (hova, kereszt, eB, eK, b, cimB, cimK) {
    if (!kereszt) { hova.innerHTML = '<p class="t-hint">A keresztkapcsolati fényszögek számítása…</p>'; return; }
    if (kereszt.hiba) { hova.innerHTML = '<p class="t-hint">A keresztkapcsolati fényszögek nem érhetők el: ' + R.esc(kereszt.hiba) + '</p>'; return; }
    // A Windows-os tábla (fAspectInformations_Syn): Nap–Plútó, holdcsomó (ha látható), ASC, MC; a két holdcsomó
    // együttállása kimarad. Sorok: belső kör, oszlopok: külső kör.
    var cs = T.csomo(b), csomoLathato = !!(b && b.kerek && (b.kerek.nodes || b.kerek.nodesDown));
    function lista(e) {
      var l = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].concat(csomoLathato ? [cs] : []).filter(function (id) { return e.poz[id]; });
      return l.concat([998, 999]);
    }
    var sorok = lista(eB), oszl = lista(eK), cell = {};
    (kereszt.aspects || []).forEach(function (a) {
      var i = a.a[0] === 'A' ? (a.a[1] === 0 ? 998 : a.a[1] === 1 ? 999 : null) : a.a[1];
      var j = a.b[0] === 'A' ? (a.b[1] === 0 ? 998 : a.b[1] === 1 ? 999 : null) : a.b[1];
      if ((i === 10 || i === 11) && (j === 10 || j === 11) && a.aspect === 1) return;
      if (i === null || j === null || sorok.indexOf(i) < 0 || oszl.indexOf(j) < 0) return;
      (cell[i + '_' + j] = cell[i + '_' + j] || []).push({ a: a, id1: i, id2: j });
    });
    function fej(id, e) {
      if (R.TENGELY[id]) return fejCella(R.TENGELY[id][1], true, R.TENGELY[id][0], e ? (id === 998 ? e.hz.asc : e.hz.mc) : undefined);
      return e ? testFej(e, id) : fejCella(R.glif(id) || R.esc(R.nev(id).slice(0, 3)), !R.glif(id), R.nev(id));
    }
    var h = '<p class="t-hint">Részletes információkért kattintson az adott fényszögre a táblázatban!</p><div class="t-asp"><div class="t-gridtart"><table class="t-grid t-kereszt"><thead><tr><th class="t-sarok" title="sor: belső kör, oszlop: külső kör">B \\ K</th>' +
      oszl.map(function (j) { return fej(j, eK); }).join('') + '</tr></thead><tbody>';
    sorok.forEach(function (i) {
      h += '<tr>' + fej(i, eB) + oszl.map(function (j) {
        var l = cell[i + '_' + j];
        return l ? fszCella(l, i + '_' + j) : '<td></td>';
      }).join('') + '</tr>';
    });
    h += '</tbody></table></div><div class="t-kv t-aspinfo" aria-live="polite"><div>Válassz egy fényszöget a táblában.</div><div></div></div></div>' +
      '<p class="t-hint">A bal oldali oszlopban a belső-, a felső sorban pedig a külső születési képlet planétái láthatóak! ' +
      'A keresztkapcsolati fényszögtáblázathoz a fényszögekhez tartozó eredeti orbis értékek felét vettük figyelembe (legalább 1°), ' +
      'ami az „orbis értéke” sorban is látható. Belső kör: ' + R.esc(cimB) + ' · külső kör: ' + R.esc(cimK) + '.</p>';
    hova.innerHTML = h;
    var t = hova.querySelector('.t-grid'), info = hova.querySelector('.t-aspinfo');
    function valaszt(td) {
      Array.prototype.forEach.call(t.querySelectorAll('td.t-sel'), function (x) { x.classList.remove('t-sel'); });
      td.classList.add('t-sel');
      info.innerHTML = cell[td.getAttribute('data-k')].map(function (x) {
        var f = R.FENYSZOG[x.a.aspect];
        var lB = x.id1 === 998 ? eB.hz.asc : x.id1 === 999 ? eB.hz.mc : testLon(eB, x.id1);
        var lK = !eK ? undefined : x.id2 === 998 ? eK.hz.asc : x.id2 === 999 ? eK.hz.mc : testLon(eK, x.id2);
        return [R.esc(cimB) + ' – kiválasztott elem:', R.esc(R.nev(x.id1)) + ' – ' + helyStr(lB),
          R.esc(cimK) + ' – kiválasztott elem:', R.esc(R.nev(x.id2)) + (lK !== undefined ? ' – ' + helyStr(lK) : ''),
          'Fényszög:', f[0] + ' ' + f[3] + R.VS + ' (' + f[1] + '°)', 'Orbis értéke:', R.fokStr(x.a.maxOrb),
          'Aktuális orbis:', R.fokStr(x.a.orb, false) + (x.a.exact ? ' (pontos)' : '')].map(cella).join('');
      }).join('<div class="t-kv-sep"></div>');
    }
    t.addEventListener('click', function (ev) { var td = ev.target.closest('td.t-has'); if (td) valaszt(td); });
    t.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('t-has')) { ev.preventDefault(); valaszt(ev.target); }
    });
  };

  /** Összevetés: egy tábla a belső és egy a külső kör adataival */
  T.ket = function (fn, eB, eK, cimB, cimK, b) {
    return '<h3 class="t-cim">Belső kör – ' + R.esc(cimB) + '</h3>' + fn(eB, b) +
      '<h3 class="t-cim">Külső kör – ' + R.esc(cimK) + '</h3>' + (eK ? fn(eK, b) : '<p class="t-hint">számítás…</p>');
  };
  /** Progressziós Hold: a Hold ugyanezen a helyen a valódi életben (DoCalculateSecDirHold) */
  T.progrHold = function (l) {
    if (!l || !l.length) return '';
    return '<h3 class="t-cim">Progressziós Hold értékek</h3><table class="t"><tbody>' + l.map(function (x) {
      return '<tr' + (x.aktualis ? ' class="t-akt"' : '') + '><td>' + R.esc(x.szoveg) + '</td><td>' + (x.aktualis ? 'a mostani léptetés' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  };

  /** A kerék adatai a RegioKerek.rajzol() számára */
  T.kerekAdat = function (e) {
    var el = e.elemzes;
    return { asc: e.hz.asc, mc: e.hz.mc, cusps: e.hz.cusps,
      tengelyJelek: e.hz.persp !== undefined ? [['AC', e.hz.origAsc, 'Eredeti Ascendens'], ['MC', e.hz.origMc, 'Eredeti Medium Coeli']] : null,
      // a Megjelenítés › Tengelyek további pontjai (swe_houses_ex ascmc[3], [4], [6], [7])
      tengelyPontok: { vtx: e.hz.vertex, ep: e.hz.equAsc, cas: e.hz.coAscMunkasey, pas: e.hz.polarAsc }, kos0: !!e.hz.kos0,
      planets: el ? el.planets : Object.keys(e.poz).map(function (id) {
        var x = e.poz[id]; return { id: +id, lon: x.lon, lat: x.lat, speed: x.speedLon, house: 0, lordOf: [], closedLordOf: [] };
      }),
      aspects: el ? el.aspects : [], selfMarkers: el ? el.selfMarkers : [] };
  };
})(typeof window !== 'undefined' ? window : globalThis);
