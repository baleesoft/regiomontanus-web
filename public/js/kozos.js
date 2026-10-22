/*
 * kozos.js – közös konstansok és segédfüggvények (nevek, jelek, formázás, időzóna).
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};

  var VS = '︎'; // szöveges (nem emoji) megjelenítés

  R.JEGYEK = ['Kos', 'Bika', 'Ikrek', 'Rák', 'Oroszlán', 'Szűz', 'Mérleg', 'Skorpió', 'Nyilas', 'Bak', 'Vízöntő', 'Halak'];
  R.JEGYGLIF = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  R.HAZNEV = ['', 'Első', 'Második', 'Harmadik', 'Negyedik', 'Ötödik', 'Hatodik', 'Hetedik', 'Nyolcadik',
    'Kilencedik', 'Tizedik', 'Tizenegyedik', 'Tizenkettedik'];
  R.PLANETA = {
    0: ['Nap', '☉'], 1: ['Hold', '☽'], 2: ['Merkúr', '☿'], 3: ['Vénusz', '♀'], 4: ['Mars', '♂'],
    5: ['Jupiter', '♃'], 6: ['Szaturnusz', '♄'], 7: ['Uránusz', '♅'], 8: ['Neptunusz', '♆'], 9: ['Plútó', '♇'],
    10: ['Felsz.holdcs.(közepes)', '☊'], 11: ['Felsz.holdcs.(valódi)', '☊'], 12: ['Lilith', '⚸'],
    13: ['Priapus', '⚸'], 15: ['Chiron', '⚷'], 16: ['Pholus', ''], 17: ['Ceres', '⚳'], 18: ['Pallas Athene', '⚴'],
    19: ['Juno', '⚵'], 20: ['Vesta', '⚶'], 24: ['Lesz.holdcs.(közepes)', '☋'], 25: ['Lesz.holdcs.(valódi)', '☋']
  };
  R.SZAMOLT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20];
  R.TENGELY = { 998: ['Ascendens', 'AC'], 999: ['Medium Coeli', 'MC'] };
  R.FENYSZOG = {
    1: ['Együttállás', 0, 15, '☌'], 2: ['Szembenállás', 180, 7.5, '☍'], 3: ['Negyedfény', 90, 4, '□'],
    4: ['Nyolcadfény', 45, 2, '∠'], 5: ['Három-nyolcadfény', 135, 2, '⚼'], 6: ['Harmadfény', 120, 5, '△'],
    7: ['Hatodfény', 60, 2.5, '⚹'], 8: ['Tizenkettedfény', 30, 1, '⚺'], 9: ['Öt-tizenkettedfény', 150, 1, '⚻'],
    10: ['Ötödfény', 72, 3, 'Q'], 11: ['Tizedfény', 36, 2.5, '⊥'], 12: ['Két-ötödfény', 144, 3, 'bQ']
  };
  R.HAZRENDSZER = { P: 'Placidus', R: 'Regiomontanus', C: 'Campanus', K: 'Koch', O: 'Porphyrius', A: 'Egyenlő' };
  R.VS = VS;

  R.pad = function (n) { return (n < 10 && n >= 0 ? '0' : '') + n; };
  R.esc = function (s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /** A Windows-os DoubleFokToStrW: csonkolás, nem kerekítés. mp === false: másodperc nélkül */
  R.fokStr = function (f, mp) {
    var s = Math.trunc(f) + '°', r = f - Math.trunc(f);
    if (r !== 0) {
      s += R.pad(Math.trunc(r * 60)) + '\'';
      r -= Math.trunc(r * 60) / 60;
      if (mp !== false && r !== 0) s += R.pad(Math.trunc(r * 3600)) + '"';
    }
    return s;
  };
  R.jegyben = function (lon) {
    var x = ((lon % 360) + 360) % 360, j = Math.floor(Math.floor(x) / 30);
    return { j: j, fok: x - j * 30 };
  };
  R.oraStr = function (h) {
    var s = h < 0 ? '−' : '+', t = Math.round(Math.abs(h) * 3600);
    return 'UTC' + s + R.pad(Math.floor(t / 3600)) + ':' + R.pad(Math.floor((t % 3600) / 60)) + (t % 60 ? ':' + R.pad(t % 60) : '');
  };
  R.glif = function (id) { return R.PLANETA[id] && R.PLANETA[id][1] ? R.PLANETA[id][1] + VS : ''; };
  R.jegyGlif = function (j) { return R.JEGYGLIF[j] + VS; };
  R.nev = function (id) { return R.PLANETA[id] ? R.PLANETA[id][0] : R.TENGELY[id] ? R.TENGELY[id][0] : String(id); };
  R.datumStr = function (y, mo, d, h, mi) {
    return y + '.' + R.pad(mo) + '.' + R.pad(d) + (h === undefined ? '' : ' ' + R.pad(h) + ':' + R.pad(mi));
  };

  /* ---------- időzóna (IANA a böngésző adatbázisából) ---------- */
  function zonaEltolas(utcMs, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    var p = {}; f.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var d = new Date(0);
    d.setUTCFullYear(+p.year, +p.month - 1, +p.day); d.setUTCHours(+p.hour, +p.minute, +p.second, 0);
    return (d.getTime() - Math.floor(utcMs / 1000) * 1000) / 60000;
  }
  /** Egy UTC pillanatban érvényes zónaeltolás percben */
  R.zonaEltolasUtc = function (utcMs, tz) { return zonaEltolas(utcMs, tz); };
  /** Helyi időből a zóna eltolása (perc) és a nyári időszámítás jelzése. */
  R.helyiZona = function (y, mo, d, h, mi, s, tz) {
    var dt = new Date(0); dt.setUTCFullYear(y, mo - 1, d); dt.setUTCHours(h, mi, s || 0, 0);
    var local = dt.getTime(), off1 = zonaEltolas(local, tz), t = local - off1 * 60000, off2 = zonaEltolas(t, tz);
    var jan = zonaEltolas(Date.UTC(y, 0, 15), tz), jul = zonaEltolas(Date.UTC(y, 6, 15), tz);
    return { percek: off2, nyari: off2 > Math.min(jan, jul), utcMs: local - off2 * 60000 };
  };
  /** Rövid zónakód a .szk fájlba (pl. CET, CEST, EDT); ha nincs, UTC+hh:mm */
  R.zonaKod = function (utcMs, tz, orak) {
    function nev(loc) {
      try {
        var p = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(utcMs));
        for (var i = 0; i < p.length; i++) if (p[i].type === 'timeZoneName') return p[i].value;
      } catch (e) { /* ismeretlen zóna */ }
      return '';
    }
    var k = nev('en-US');
    if (!k || /^(GMT|UTC)/.test(k)) k = nev('en-GB');
    if (!k || /^(GMT|UTC)[+-]/.test(k)) k = R.oraStr(orak).replace('−', '-');
    return k;
  };
  R.zonaErvenyes = function (tz) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
