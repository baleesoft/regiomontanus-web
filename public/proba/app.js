/*
 * Regiomontanus – webes próba: pozíciók a böngészőben (Swiss Ephemeris / WebAssembly),
 * képlet-elemzés a szerveren (api/szamol.php).
 * Licenc: AGPL-3.0.
 */
(function () {
  'use strict';

  var API = '../api/szamol.php';

  var JEGYEK = ['Kos', 'Bika', 'Ikrek', 'Rák', 'Oroszlán', 'Szűz', 'Mérleg', 'Skorpió', 'Nyilas', 'Bak', 'Vízöntő', 'Halak'];
  var JEGYGLIF = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  var HAZNEV = ['', 'Első', 'Második', 'Harmadik', 'Negyedik', 'Ötödik', 'Hatodik', 'Hetedik', 'Nyolcadik',
    'Kilencedik', 'Tizedik', 'Tizenegyedik', 'Tizenkettedik'];
  var VS = '︎'; // szöveges (nem emoji) megjelenítés
  var PLANETA = {
    0: ['Nap', '☉'], 1: ['Hold', '☽'], 2: ['Merkúr', '☿'], 3: ['Vénusz', '♀'], 4: ['Mars', '♂'],
    5: ['Jupiter', '♃'], 6: ['Szaturnusz', '♄'], 7: ['Uránusz', '♅'], 8: ['Neptunusz', '♆'], 9: ['Plútó', '♇'],
    10: ['Felsz.holdcs.(közepes)', '☊'], 11: ['Felsz.holdcs.(valódi)', '☊'], 12: ['Lilith', '⚸'],
    13: ['Priapus', '⚸'], 15: ['Chiron', '⚷'], 16: ['Pholus', ''], 17: ['Ceres', '⚳'], 18: ['Pallas Athene', '⚴'],
    19: ['Juno', '⚵'], 20: ['Vesta', '⚶'], 24: ['Lesz.holdcs.(közepes)', '☋'], 25: ['Lesz.holdcs.(valódi)', '☋']
  };
  var SZAMOLT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20];
  var TENGELY = { 998: ['Ascendens', 'AC'], 999: ['Medium Coeli', 'MC'] };
  var FENYSZOG = {
    1: ['Együttállás', 0, 15, '☌'], 2: ['Szembenállás', 180, 7.5, '☍'], 3: ['Negyedfény', 90, 4, '□'],
    4: ['Nyolcadfény', 45, 2, '∠'], 5: ['Három-nyolcadfény', 135, 2, '⚼'], 6: ['Harmadfény', 120, 5, '△'],
    7: ['Hatodfény', 60, 2.5, '⚹'], 8: ['Tizenkettedfény', 30, 1, '⚺'], 9: ['Öt-tizenkettedfény', 150, 1, '⚻'],
    10: ['Ötödfény', 72, 3, 'Q'], 11: ['Tizedfény', 36, 2.5, '⊥'], 12: ['Két-ötödfény', 144, 3, 'bQ']
  };
  var CSILLAGOK = ['Aldebaran', 'Regulus', 'Spica', 'Antares'];
  var HAZRENDSZER = { P: 'Placidus', R: 'Regiomontanus', C: 'Campanus', K: 'Koch', O: 'Porphyrius', A: 'Egyenlő' };

  var $ = function (id) { return document.getElementById(id); };
  var se = null, ref = null, szamlalo = 0, aktFajl = null;

  /* ---------- formázás ---------- */
  function pad(n) { return ('0' + n).slice(-2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // A Windows-os DoubleFokToStrW: csonkolás, nem kerekítés
  function fokStr(f, mp) {
    var s = Math.trunc(f) + '°', r = f - Math.trunc(f);
    if (r !== 0) {
      s += pad(Math.trunc(r * 60)) + '\'';
      r -= Math.trunc(r * 60) / 60;
      if (mp !== false && r !== 0) s += pad(Math.trunc(r * 3600)) + '"';
    }
    return s;
  }
  function jegyben(lon) {
    var x = ((lon % 360) + 360) % 360, j = Math.floor(Math.floor(x) / 30);
    return { j: j, fok: x - j * 30 };
  }
  function oraStr(h) {
    var s = h < 0 ? '−' : '+', t = Math.round(Math.abs(h) * 3600);
    return 'UTC' + s + pad(Math.floor(t / 3600)) + ':' + pad(Math.floor((t % 3600) / 60)) + (t % 60 ? ':' + pad(t % 60) : '');
  }
  function szogKul(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }
  function glif(id) { return PLANETA[id] && PLANETA[id][1] ? PLANETA[id][1] + VS : ''; }
  function nev(id) { return PLANETA[id] ? PLANETA[id][0] : TENGELY[id] ? TENGELY[id][0] : String(id); }

  function setStatus(el, cls, msg) { el = $(el); el.hidden = !msg; el.className = 'status ' + cls; el.textContent = msg || ''; }

  /* ---------- időzóna (IANA a böngésző adatbázisából) ---------- */
  function zonaEltolas(utcMs, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    var p = {}; f.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var d = new Date(0);
    d.setUTCFullYear(+p.year, +p.month - 1, +p.day); d.setUTCHours(+p.hour, +p.minute, +p.second, 0);
    return (d.getTime() - Math.floor(utcMs / 1000) * 1000) / 60000;
  }
  function helyiBolUtc(y, mo, d, h, mi, s, tz) {
    var dt = new Date(0); dt.setUTCFullYear(y, mo - 1, d); dt.setUTCHours(h, mi, s, 0);
    var local = dt.getTime(), off1 = zonaEltolas(local, tz), t = local - off1 * 60000, off2 = zonaEltolas(t, tz);
    var jan = zonaEltolas(Date.UTC(y, 0, 15), tz), jul = zonaEltolas(Date.UTC(y, 6, 15), tz);
    return { offsetMin: off2, dst: off2 > Math.min(jan, jul) };
  }

  /* ---------- bemenet ---------- */
  function bemenet() {
    var b = {
      nev: $('nev').value, y: +$('ev').value, mo: +$('ho').value, d: +$('nap').value,
      h: +$('ora').value, mi: +$('perc').value, s: +$('mp').value,
      lat: +$('szel').value, lon: +$('hossz').value, mod: $('zonamod').value,
      hsys: $('hsys').value, sid: $('zod').value === 'S', csomo: +$('csomo').value,
      ismeretlen: $('ismeretlen').checked
    };
    // Ismeretlen születési idő: a Windows-os program helyi délre számol (TSzuletesiKepletInfo.SetTimeIsUnknown)
    if (b.ismeretlen) { b.h = 12; b.mi = 0; b.s = 0; if (b.nev.indexOf('Kos 0°<') !== 0) b.nev = 'Kos 0°< ' + b.nev; }
    if (b.mod === 'iana') {
      var r = helyiBolUtc(b.y, b.mo, b.d, b.h, b.mi, b.s, $('tz').value.trim());
      b.offset = r.offsetMin / 60;
      b.zonaInfo = $('tz').value + ' → ' + oraStr(b.offset) + (r.dst ? ' (nyári időszámítás)' : '');
    } else if (b.mod === 'lmt') {
      b.offset = b.lon / 15;
      b.zonaInfo = 'LMT a hosszúságból → ' + oraStr(b.offset);
    } else {
      b.offset = +$('kezi').value;
      b.zonaInfo = (aktFajl && aktFajl.tzCode ? aktFajl.tzCode + ' (a képletfájlból) → ' : 'Kézi → ') + oraStr(b.offset);
    }
    return b;
  }

  /*
   * Kos 0° képlet (TSegedabraCalculator.DoCalculatePlanetaPerspektiva, cKOSNULLAKEPLET):
   * ASC = 0° Kos, MC = 0° Bak, egyenlő házak a Kostól; a többi tengely (Vertex stb.) a valódi marad.
   */
  function kos0(hz) {
    var u = {}; for (var k in hz) u[k] = hz[k];
    u.cusps = [0]; for (var i = 1; i <= 12; i++) u.cusps.push((i - 1) * 30);
    u.asc = 0; u.mc = 270; u.kos0 = true;
    return u;
  }

  /* ---------- számítás ---------- */
  function szamol() {
    if (!se) return;
    var sorszam = ++szamlalo, b;
    try { b = bemenet(); } catch (e) {
      setStatus('status', 'bad', 'Ismeretlen időzóna: „' + $('tz').value + '”. Példa: Europe/Budapest.'); return;
    }
    var SE = SwissEph.SE;
    var jd = se.julday(b.y, b.mo, b.d, b.h + b.mi / 60 + b.s / 3600 - b.offset);
    var ut = se.revjul(jd);

    se.ensureEphe([ut.year]).then(function (eph) {
      if (sorszam !== szamlalo) return;
      var t0 = performance.now();
      var flag = SE.FLG_SWIEPH | SE.FLG_SPEED | (b.sid ? SE.FLG_SIDEREAL : 0);
      var hz = se.housesEx(jd, b.sid ? SE.FLG_SIDEREAL : 0, b.lat, b.lon, b.hsys);
      if (b.ismeretlen) hz = kos0(hz);
      var poz = {}, moshier = false, hianyzo = [];
      SZAMOLT.forEach(function (id) {
        var x = se.calcUt(jd, id, flag);
        if (x.flag < 0) { hianyzo.push(nev(id)); return; }
        if (x.flag & SE.FLG_MOSEPH) moshier = true;
        poz[id] = x;
      });
      var csillagok = CSILLAGOK.map(function (n) { return se.fixstar2Ut(n, jd, SE.FLG_SWIEPH | (b.sid ? SE.FLG_SIDEREAL : 0)); });

      var refOk = ref && Math.abs(jd - ref.jd) < 1e-7 && !b.sid && Math.abs(b.lat - ref.lat) < 1e-6 && Math.abs(b.lon - ref.lon) < 1e-6;
      var keplet = { b: b, jd: jd, ut: ut, hz: hz, poz: poz, csillagok: csillagok, refOk: refOk, ms: performance.now() - t0 };
      megjelenit(keplet, null);

      var msg = [];
      if (moshier) msg.push('Egyes testek Moshier-módban számolódtak (hiányzó adatfájl: ' + eph.missing.join(', ') + ').');
      if (hianyzo.length) msg.push('Erre az időpontra nincs adat: ' + hianyzo.join(', ') + '.');
      setStatus('status2', 'warn', msg.join(' '));
      setStatus('status', 'ok', 'Pozíciók kiszámolva. Képlet-elemzés lekérése a szervertől…');

      var kuld = {
        planets: Object.keys(poz).map(function (id) { var x = poz[id]; return { id: +id, lon: x.lon, lat: x.lat, speed: x.speedLon }; }),
        cusps: hz.cusps.slice(1, 13),
        ascmc: [hz.asc, hz.mc, hz.armc, hz.vertex, hz.equAsc, hz.coAscKoch, hz.coAscMunkasey, hz.polarAsc]
      };
      return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kuld) })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null;
            try { j = JSON.parse(t); } catch (e) { /* nem JSON: pl. hiányzó végpont vagy szerverhiba */ }
            if (!r.ok || !j) throw new Error((j && j.error) || ('HTTP ' + r.status + (j ? '' : ', nem JSON-válasz')));
            return j;
          });
        })
        .then(function (elemzes) {
          if (sorszam !== szamlalo) return;
          megjelenit(keplet, elemzes);
          var maxD = keplet.maxDiff;
          setStatus('status', refOk && maxD >= 1 ? 'bad' : 'ok', refOk
            ? (maxD < 1 ? 'OK – ' : 'ELTÉRÉS – ') + 'a böngészős számítás a natív swetest-től legfeljebb ' + maxD.toFixed(4) + '″-cel tér el; képlet-elemzés kész.'
            : 'Számítás és képlet-elemzés kész.');
        }, function (e) {
          if (sorszam !== szamlalo) return;
          setStatus('status', 'warn', 'A pozíciók elkészültek, de a képlet-elemzés nem érhető el (' + API + '): ' + e.message);
        });
    });
  }

  /* ---------- megjelenítés ---------- */
  function megjelenit(k, el) {
    var b = k.b, hz = k.hz, maxDiff = 0;
    var ep = {};
    if (el) el.planets.forEach(function (p) { ep[p.id] = p; });

    // Alapadatok
    var ut = k.ut, uh = Math.floor(ut.hour), um = Math.floor((ut.hour - uh) * 60), us = Math.round(((ut.hour - uh) * 60 - um) * 60);
    if (us === 60) { us = 0; um++; } if (um === 60) { um = 0; uh++; }
    var st = (((se.sidtime(k.jd) + b.lon / 15) % 24) + 24) % 24, sth = Math.floor(st), stm = Math.floor((st - sth) * 60);
    $('info').innerHTML = [
      'Név', esc(b.nev),
      'Helyi idő', b.y + '.' + pad(b.mo) + '.' + pad(b.d) + '. ' + pad(b.h) + ':' + pad(b.mi) + ':' + pad(b.s),
      'Időzóna', esc(b.zonaInfo),
      'Világidő (UT)', ut.year + '.' + pad(ut.month) + '.' + pad(ut.day) + '. ' + pad(uh) + ':' + pad(um) + ':' + pad(us),
      'Julián dátum (UT)', k.jd.toFixed(6),
      'ΔT', (se.deltat(k.jd) * 86400).toFixed(2) + ' mp',
      'Helyi csillagidő', pad(sth) + ':' + pad(stm) + ':' + pad(Math.floor(((st - sth) * 60 - stm) * 60)),
      'Földrajzi hely', Math.abs(b.lat).toFixed(4) + '° ' + (b.lat >= 0 ? 'É' : 'D') + ', ' + Math.abs(b.lon).toFixed(4) + '° ' + (b.lon >= 0 ? 'K' : 'Ny'),
      'Házrendszer', (hz.kos0 ? 'Kos 0° képlet – ismeretlen születési idő (egyenlő házak a Kostól)' : HAZRENDSZER[b.hsys]) +
        (b.sid ? ', sziderikus' : ', tropikus'),
      'Számítási idő', k.ms.toFixed(1) + ' ms'
    ].map(function (v) { return '<div>' + v + '</div>'; }).join('');

    // Planéták
    var sor = SZAMOLT.filter(function (id) { return k.poz[id]; }).map(function (id) {
      var x = k.poz[id], j = jegyben(x.lon), e = ep[id], dc = '';
      if (k.refOk && ref.planets[id]) {
        var dd = szogKul(x.lon, ref.planets[id].lon) * 3600; maxDiff = Math.max(maxDiff, dd);
        dc = '<span class="' + (dd < 1 ? 'diff-ok' : 'diff-bad') + '">' + dd.toFixed(4) + '″</span>';
      }
      var urak = '', jel = [];
      if (e) {
        urak = e.lordOf.join(',');
        if (e.closedLordOf.length) urak += (urak ? ' ' : '') + '(' + e.closedLordOf.join(',') + ')';
        if (e.feral) jel.push('<span class="flag">F</span>');
        if (e.isolated) jel.push('<span class="flag">i</span>');
        if (e.stationary) jel.push('<span class="flag">S</span>');
        if (e.selfMarker) jel.push('<span class="em" title="énjelölő">●</span>');
      }
      if (x.speedLon < 0) jel.unshift('<span class="r">R</span>');
      return '<tr><td class="glyph">' + glif(id) + '</td><td>' + nev(id) + '</td>' +
        '<td class="glyph">' + JEGYGLIF[j.j] + VS + '</td><td>' + JEGYEK[j.j] + '</td>' +
        '<td class="num">' + fokStr(j.fok) + '</td><td class="num">' + (e ? e.house : '') + '</td>' +
        '<td>' + urak + '</td><td>' + jel.join(' ') + '</td>' +
        '<td class="num">' + x.speedLon.toFixed(4) + '</td><td class="num">' + dc + '</td></tr>';
    });
    $('planetak').innerHTML = '<tr><th></th><th>Planéta</th><th></th><th>Jegy</th><th>Pozíció</th><th>Ház</th>' +
      '<th>Házúr</th><th>Jelölés</th><th>Seb. (°/nap)</th><th>Eltérés</th></tr>' + sor.join('');

    // Házak
    var hsor = [];
    for (var i = 1; i <= 12; i++) {
      var j = jegyben(hz.cusps[i]), dc = '';
      if (k.refOk && ref.houses[b.hsys]) {
        var dd = szogKul(hz.cusps[i], ref.houses[b.hsys].cusps[i - 1]) * 3600; maxDiff = Math.max(maxDiff, dd);
        dc = '<span class="' + (dd < 1 ? 'diff-ok' : 'diff-bad') + '">' + dd.toFixed(4) + '″</span>';
      }
      hsor.push('<tr><td>' + i + '. ház</td><td class="glyph">' + JEGYGLIF[j.j] + VS + '</td><td>' + JEGYEK[j.j] +
        '</td><td class="num">' + fokStr(j.fok) + '</td><td class="num">' + dc + '</td></tr>');
    }
    [['ASC', hz.asc], ['MC', hz.mc], ['Vertex', hz.vertex], ['Ekv. ASC (Keleti pont)', hz.equAsc],
     ['Co-ASC (Koch)', hz.coAscKoch], ['Poláris ASC', hz.polarAsc]].forEach(function (a) {
      var j = jegyben(a[1]);
      hsor.push('<tr><td>' + a[0] + '</td><td class="glyph">' + JEGYGLIF[j.j] + VS + '</td><td>' + JEGYEK[j.j] +
        '</td><td class="num">' + fokStr(j.fok) + '</td><td></td></tr>');
    });
    $('hazak').innerHTML = '<tr><th>' + (hz.kos0 ? 'Kos 0°' : HAZRENDSZER[b.hsys]) + '</th><th></th><th>Jegy</th><th>Pozíció</th><th>Eltérés</th></tr>' + hsor.join('');

    // Állócsillagok
    $('csillagok').innerHTML = '<tr><th>Csillag</th><th></th><th>Jegy</th><th>Pozíció</th><th>Eltérés</th></tr>' +
      k.csillagok.map(function (x, n) {
        if (x.flag < 0) return '<tr><td>' + CSILLAGOK[n] + '</td><td colspan="4" class="diff-bad">' + esc(x.error) + '</td></tr>';
        var j = jegyben(x.lon), dc = '';
        if (k.refOk && ref.stars[CSILLAGOK[n]] !== undefined) {
          var dd = szogKul(x.lon, ref.stars[CSILLAGOK[n]]) * 3600; maxDiff = Math.max(maxDiff, dd);
          dc = '<span class="' + (dd < 1 ? 'diff-ok' : 'diff-bad') + '">' + dd.toFixed(4) + '″</span>';
        }
        return '<tr><td>' + esc(x.name.replace(',', ' (')) + ')</td><td class="glyph">' + JEGYGLIF[j.j] + VS + '</td><td>' +
          JEGYEK[j.j] + '</td><td class="num">' + fokStr(j.fok) + '</td><td class="num">' + dc + '</td></tr>';
      }).join('');
    k.maxDiff = maxDiff;

    // Az elemzés táblái
    if (!el) {
      ['fenyszogek', 'enallapotok'].forEach(function (id) { $(id).innerHTML = '<tr><td class="hint">számítás…</td></tr>'; });
      $('kerek').innerHTML = '<span class="hint">számítás…</span>';
      $('eletstrat').innerHTML = '<span class="hint">számítás…</span>';
      return;
    }
    var kerekPl = RegioKerek.ALAP.planets.slice();
    if ($('kerekExtra').checked) kerekPl.push(b.csomo, b.csomo === 11 ? 25 : 24, 15);
    RegioKerek.rajzol($('kerek'), { asc: hz.asc, mc: hz.mc, cusps: hz.cusps, planets: el.planets,
      aspects: el.aspects, selfMarkers: el.selfMarkers }, { planets: kerekPl, selfMarkers: !hz.kos0 });
    fenyszogTabla(el, b.csomo, ep);
    enallapotTabla(el, ep);
    eletstratTabla(el.lifeStrategy);
  }

  /* Fényszögtábla: alsó háromszög, mint a Windows-os „Fényszög-információk” (fAspectInformations) */
  function fenyszogTabla(el, csomo, ep) {
    var ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, csomo, 12, 15, 16, 17, 18, 19, 20]
      .filter(function (id) { return ep[id]; }).sort(function (a, b) { return a - b; });
    ids.push(998, 999);
    var idx = {}; ids.forEach(function (id, i) { idx[id] = i; });
    var cella = {};
    el.aspects.forEach(function (a) {
      var id1, id2;
      if (a.a[0] !== 'P') return;
      if (a.b[0] === 'P') {
        id1 = a.a[1]; id2 = a.b[1];
        if (a.aspect === 1 && (id1 === 10 || id1 === 11) && (id2 === 10 || id2 === 11)) return;
      } else if (a.b[0] === 'A' && (a.b[1] === 0 || a.b[1] === 1)) {
        id1 = a.a[1]; id2 = a.b[1] === 0 ? 998 : 999;
      } else return;
      if (idx[id1] === undefined || idx[id2] === undefined) return;
      var r = Math.max(idx[id1], idx[id2]), c = Math.min(idx[id1], idx[id2]), kulcs = r + '_' + c;
      (cella[kulcs] = cella[kulcs] || []).push({ a: a, id1: id1, id2: id2 });
    });
    var h = '';
    for (var r = 0; r < ids.length; r++) {
      h += '<tr>';
      for (var c = 0; c <= r; c++) {
        if (c === r) {
          var id = ids[r];
          h += TENGELY[id] ? '<td class="diag ax" title="' + TENGELY[id][0] + '">' + TENGELY[id][1] + '</td>'
            : glif(id) ? '<td class="diag" title="' + esc(nev(id)) + '">' + glif(id) + '</td>'
            : '<td class="diag ax" title="' + esc(nev(id)) + '">' + esc(nev(id).slice(0, 3)) + '</td>';
        } else {
          var l = cella[r + '_' + c];
          h += l ? '<td class="has" data-k="' + r + '_' + c + '" title="' + l.map(function (x) { return FENYSZOG[x.a.aspect][0]; }).join(', ') +
            '">' + l.map(function (x) { return FENYSZOG[x.a.aspect][3]; }).join(' ') + '</td>' : '<td></td>';
        }
      }
      h += '</tr>';
    }
    var t = $('fenyszogek');
    t.innerHTML = h;
    $('aspinfo').innerHTML = '<div>Válassz egy fényszöget a táblában.</div><div></div>';
    t.onclick = function (ev) {
      var td = ev.target.closest('td.has'); if (!td) return;
      Array.prototype.forEach.call(t.querySelectorAll('td.sel'), function (x) { x.classList.remove('sel'); });
      td.classList.add('sel');
      $('aspinfo').innerHTML = cella[td.getAttribute('data-k')].map(function (x) {
        var f = FENYSZOG[x.a.aspect];
        return ['1. elem', esc(nev(x.id1)), '2. elem', esc(nev(x.id2)),
          'Fényszög neve', f[0] + ' (' + f[1] + '°, orbis: ' + fokStr(f[2]) + ')',
          'Fényszög értéke', fokStr(x.a.orb, false) + (x.a.exact ? ' (pontos)' : '')]
          .map(function (v) { return '<div>' + v + '</div>'; }).join('');
      }).join('<div style="grid-column:1/-1;border-top:1px solid #eee8dc;margin:4px 0"></div>');
    };
  }

  /* Énállapotok (fSelfMarkers) */
  function enallapotTabla(el, ep) {
    $('enallapotok').innerHTML = '<tr><th>Jele</th><th>Neve</th><th></th><th>Helye</th></tr>' + el.selfMarkers.map(function (m) {
      var j, hely;
      if (m.type === 'P') {
        var p = ep[m.id]; j = jegyben(p.lon);
        hely = JEGYEK[j.j] + ' jegyében ' + fokStr(j.fok) + ' fokon a(z) ' + p.house + '. Házban';
        return '<tr><td class="glyph">' + glif(m.id) + '</td><td>' + nev(m.id) + '</td><td class="glyph">' + JEGYGLIF[j.j] + VS + '</td><td>' + hely + '</td></tr>';
      }
      if (m.type === 'H') {
        j = jegyben(m.lon);
        return '<tr><td class="glyph" style="font:600 12px Tahoma">AC</td><td>Ascendens</td><td class="glyph">' + JEGYGLIF[j.j] + VS +
          '</td><td>' + JEGYEK[j.j] + ' jegyében ' + fokStr(j.fok) + ' fokon</td></tr>';
      }
      return '<tr><td class="glyph">' + JEGYGLIF[m.sign] + VS + '</td><td>' + JEGYEK[m.sign] + '</td><td class="glyph">' + JEGYGLIF[m.sign] + VS +
        '</td><td>' + JEGYEK[m.sign] + ', mint az 1. Házba bezárt jegy</td></tr>';
    }).join('');
  }

  /* Életstratégia, járatlan út (fEletstratJaratlanUt) */
  function eletstratTabla(es) {
    var sorok = ['Tűz', 'Föld', 'Levegő', 'Víz', 'Összesen'];
    var h = '<table class="es"><thead><tr><th></th><th>Kardinális</th><th>Fix</th><th>Labilis</th><th>Összesen</th></tr></thead><tbody>';
    es.matrix.forEach(function (s, r) {
      h += '<tr><td>' + sorok[r] + '</td>' + s.map(function (v, c) {
        return '<td' + (r === 4 || c === 3 ? ' class="sum"' : '') + '>' + v + '</td>';
      }).join('') + '</tr>';
    });
    var ut = function (l) { return l.map(function (j) { return JEGYEK[j] + ' / ' + HAZNEV[j + 1] + ' Ház'; }).join(', '); };
    h += '</tbody></table><div class="es-res"><div>Életstratégia:</div><div>' + ut(es.walked) + '</div>' +
      '<div>Járatlan út:</div><div>' + ut(es.unwalked) + '</div></div>';
    $('eletstrat').innerHTML = h;
  }

  /* ---------- űrlap kezelése ---------- */
  function zonaMod() { var m = $('zonamod').value; $('tz').disabled = m !== 'iana'; $('kezi').disabled = m !== 'manual'; }
  function beallit(o) {
    aktFajl = o.fajl || null;
    $('nev').value = o.nev; $('ev').value = o.y; $('ho').value = o.mo; $('nap').value = o.d;
    $('ora').value = o.h; $('perc').value = o.mi; $('mp').value = o.s || 0;
    $('telep').value = o.telep || 'custom';
    $('szel').value = +(+o.lat).toFixed(6); $('hossz').value = +(+o.lon).toFixed(6);
    $('zonamod').value = o.mod; if (o.tz) $('tz').value = o.tz; if (o.kezi !== undefined) $('kezi').value = o.kezi;
    $('zod').value = 'T'; zonaMod();
    $('ismeretlen').checked = !!(o.fajl && o.fajl.timeUnknown); idoMod();
  }
  function idoMod() {
    var x = $('ismeretlen').checked;
    ['ora', 'perc', 'mp'].forEach(function (id) { $(id).disabled = x; if (x) $(id).value = id === 'ora' ? 12 : 0; });
  }
  function teszt1848() {
    beallit({ nev: '1848.03.15', y: 1848, mo: 3, d: 15, h: 12, mi: 0, telep: '47.5|19.0666667|Europe/Budapest',
      lat: 47.5, lon: 19.0666667, mod: 'iana', tz: 'Europe/Budapest' });
  }
  function teszt1436() {
    // hors/Regiomontanus.szk: 1436.06.15 16:40 LMT, Unfinden 50°05'É 10°35'K
    beallit({ nev: 'Regiomontanus', y: 1436, mo: 6, d: 15, h: 16, mi: 40, lat: 50 + 5 / 60, lon: 10 + 35 / 60,
      mod: 'manual', kezi: 0.7, fajl: { tzCode: 'LMT' } });
  }
  function fajlMegnyit(f) {
    if (!f) return;
    bufferMegnyit(f.arrayBuffer());
  }
  function bufferMegnyit(igeret) {
    igeret.then(function (buf) {
      var k = RegioSzk.parse(buf);
      if (k.bc) throw new Error('Időszámításunk előtti dátum még nem támogatott.');
      beallit({ nev: k.name, y: k.year, mo: k.month, d: k.day, h: k.hour, mi: k.minute, s: k.second,
        lat: k.lat, lon: k.lon, mod: 'manual', kezi: +k.offsetHours.toFixed(6), fajl: k });
      szamol();
    }).catch(function (e) { setStatus('status', 'bad', 'A fájl nem nyitható meg: ' + e.message); });
  }

  /*
   * Opcionális teszt-képletek: ha a tárhelyen van proba/tesztkepletek.json (a privát telepítőcsomagból),
   * minden eleméhez egy gomb kerül a teszt-gombok mellé: [{ "cim": "...", "fajl": "tesztek/x.szk" }, ...]
   */
  function tesztGombok() {
    fetch('tesztkepletek.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (l) {
      var hova = $('tesztGombok');
      (Array.isArray(l) ? l : []).forEach(function (t) {
        var g = document.createElement('button');
        g.type = 'button'; g.className = 'sec'; g.textContent = 'Teszt: ' + t.cim;
        g.addEventListener('click', function () {
          bufferMegnyit(fetch(t.fajl, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(t.fajl + ': HTTP ' + r.status);
            return r.arrayBuffer();
          }));
        });
        hova.appendChild(g);
      });
    }).catch(function () { /* nincs teszt-lista: nem hiba */ });
  }

  $('frm').addEventListener('submit', function (e) { e.preventDefault(); szamol(); });
  $('zonamod').addEventListener('change', function () { zonaMod(); szamol(); });
  ['hsys', 'zod', 'csomo', 'kerekExtra'].forEach(function (id) { $(id).addEventListener('change', szamol); });
  $('ismeretlen').addEventListener('change', function () { idoMod(); szamol(); });
  $('telep').addEventListener('change', function () {
    var v = $('telep').value; if (v === 'custom') return;
    var p = v.split('|'); $('szel').value = p[0]; $('hossz').value = p[1]; $('tz').value = p[2];
    $('zonamod').value = 'iana'; aktFajl = null; zonaMod(); szamol();
  });
  $('most').addEventListener('click', function () {
    var n = new Date(); aktFajl = null; $('ismeretlen').checked = false; idoMod();
    $('ev').value = n.getFullYear(); $('ho').value = n.getMonth() + 1; $('nap').value = n.getDate();
    $('ora').value = n.getHours(); $('perc').value = n.getMinutes(); $('mp').value = n.getSeconds();
    $('nev').value = 'Aktuális égi állás';
    if ($('zonamod').value === 'manual') { $('zonamod').value = 'iana'; zonaMod(); }
    szamol();
  });
  $('teszt1848').addEventListener('click', function () { teszt1848(); szamol(); });
  $('teszt1436').addEventListener('click', function () { teszt1436(); szamol(); });
  $('megnyit').addEventListener('click', function () { $('fajl').click(); });
  $('fajl').addEventListener('change', function () { fajlMegnyit(this.files[0]); this.value = ''; });

  var dropDb = 0;
  window.addEventListener('dragenter', function (e) { e.preventDefault(); dropDb++; $('drop').classList.add('on'); });
  window.addEventListener('dragleave', function () { if (--dropDb <= 0) { dropDb = 0; $('drop').classList.remove('on'); } });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault(); dropDb = 0; $('drop').classList.remove('on');
    fajlMegnyit(e.dataTransfer.files[0]);
  });

  /* ---------- indulás ---------- */
  var t0 = performance.now();
  Promise.all([
    SwissEph.load({ base: '../swe', log: function (l) { console.log('[swisseph]', l); } }),
    fetch('referencia.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (res) {
    se = res[0]; ref = res[1];
    tesztGombok();
    if (ref) {
      var p = ref.ut.split(':'), d = ref.date.split('.');
      ref.jd = se.julday(+d[2], +d[1], +d[0], +p[0] + p[1] / 60 + p[2] / 3600);
    }
    $('ver').textContent = 'Swiss Ephemeris ' + se.version() + ' (WebAssembly) – betöltve ' + Math.round(performance.now() - t0) + ' ms alatt';
    teszt1848(); szamol();
  }).catch(function (e) {
    setStatus('status', 'bad', 'Betöltési hiba: ' + e.message + ' – ellenőrizd, hogy a swe/ mappa feltöltődött-e.');
    $('ver').textContent = 'hiba';
  });
})();
