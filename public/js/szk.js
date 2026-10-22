/*
 * szk.js – a Windows-os Regiomontanus .szk képletfájljainak olvasása a böngészőben.
 * A .szk INI-szöveg: újabb fájlok UTF-16LE (BOM-mal), régebbiek Windows-1250 kódolásúak.
 * Mentés: UTF-16LE BOM-mal, CRLF sorvégekkel, a Windows-os kulcssorrendben.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';

  function dekodol(buf) {
    var b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return new TextDecoder('utf-8').decode(b.subarray(3));
    // BOM nélkül: ha érvényes UTF-8 (pl. átmentett vagy szerkesztett fájl), akkor az, különben Windows-1250
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { /* nem UTF-8 */ }
    return new TextDecoder('windows-1250').decode(b);
  }

  function iniOlvas(szoveg) {
    var d = {}, sec = null;
    szoveg.split(/\r?\n/).forEach(function (sor) {
      sor = sor.trim();
      if (!sor) return;
      var m = sor.match(/^\[(.+)\]$/);
      if (m) { sec = m[1]; d[sec] = d[sec] || {}; return; }
      var i = sor.indexOf('=');
      if (i > 0 && sec) d[sec][sor.slice(0, i)] = sor.slice(i + 1);
    });
    return d;
  }

  /**
   * Beolvasás. Visszaad: { name, year, month, day, hour, minute, second, bc, timeUnknown,
   *   tzCode, tzManual, offsetHours (LMT esetén a hosszúságból), dst, city, country, countryId,
   *   lat, lon, tags[], notes, picture, attachments[], version, raw }
   */
  function parse(buf) {
    var d = iniOlvas(dekodol(buf));
    var bi = d.BirthInfo || {};
    if (!bi.Year) throw new Error('Ez nem Regiomontanus képletfájl (hiányzik a [BirthInfo] szakasz).');
    var I = function (k, def) { var v = parseInt(bi[k], 10); return isNaN(v) ? (def || 0) : v; };
    var B = function (k) { return bi[k] === 'T'; };

    function koord(fok, perc, neg) {
      var f = I(fok), p = I(perc);
      var v = Math.abs(f) + p / 60;
      return (neg || f < 0) ? -v : v;
    }
    var lat = koord('LocLatDegree', 'LocLatMinute', B('LocLatSouth'));
    var lon = koord('LocLongDegree', 'LocLongMinute', B('LocLongWest'));

    var tzCode = bi.TZoneCode || '';
    var offset;
    if (tzCode === 'LMT') {
      // A Windows-os program: 4 perc / hosszúsági fok, egész percre kerekítve (Calc:850–861)
      var perc = Math.round(4 * Math.abs(I('LocLongDegree')) + (4 / 60) * I('LocLongMinute'));
      offset = (lon < 0 ? -perc : perc) / 60;
    } else {
      var h = I('TZoneHour'), m = I('TZoneMinute');
      offset = (h < 0 ? -1 : 1) * (Math.abs(h) + m / 60);
      if (B('TZoneWest') && offset > 0) offset = -offset; // régi / Kepler-importált fájlok
    }

    var tags = ((d.Tags || {}).Tags || '').split(';').filter(function (t) { return t; });
    var notes = Object.keys(d.Notes || {}).sort().map(function (k) { return d.Notes[k]; }).join('\n');
    var att = Object.keys(d.Attachements || {}).sort().map(function (k) { return d.Attachements[k]; });

    return {
      name: bi.Name || '', year: I('Year'), month: I('Month'), day: I('Day'),
      hour: I('Hour', 12), minute: I('Minute'), second: I('Second') === 999 ? 0 : I('Second'),
      bc: B('BirthDateIsBC'), timeUnknown: B('TimeIsUnknown'),
      tzCode: tzCode, tzManual: B('TZCodeIsManual'), offsetHours: offset, dst: B('IsDayLightSavingTime'),
      city: bi.LocCity || '', country: bi.LocCountry || '', countryId: bi.LocCountryID || '',
      lat: lat, lon: lon, tags: tags, notes: notes,
      picture: (d.Other || {}).PictureFilename || null, attachments: att,
      version: (d.Other || {}).FileVersionId || null, raw: d
    };
  }

  /* ---------- írás (a Windows-os GenerateSzulKepletFileAndSave szerint) ---------- */
  var VERZIO = 'v3.1';
  function TF(b) { return b ? 'T' : 'F'; }
  function fokPerc(x) {
    var a = Math.abs(x), f = Math.floor(a), p = Math.round((a - f) * 60);
    if (p === 60) { f++; p = 0; }
    return [f, p];
  }

  /**
   * A webes képletadatból (Regio.Keplet) .szk szöveg. z: a Regio.Keplet.zona() eredménye.
   * A fájlban nem kezelt mezők (Gender, IsDead, kép, csatolmányok) az eredeti fájlból öröklődnek (a.eredeti).
   */
  function szoveg(a, z) {
    var e = a.eredeti || {}, bi = e.BirthInfo || {}, ot = e.Other || {};
    var orak = z.orak, perc = Math.round(Math.abs(orak) * 60), h = Math.floor(perc / 60), m = perc % 60;
    var lon = fokPerc(a.lon), lat = fokPerc(a.lat);
    var s = ['', '[BirthInfo]',
      'Name=' + a.nev,
      'Gender=' + (bi.Gender || '2'),
      'Year=' + a.ev, 'Month=' + a.ho, 'Day=' + a.nap,
      'Hour=' + (a.ismeretlen ? 12 : a.ora), 'Minute=' + (a.ismeretlen ? 0 : a.perc), 'Second=' + (a.ismeretlen ? 0 : (a.mp || 0)),
      'TimeIsUnknown=' + TF(a.ismeretlen),
      'TZoneCode=' + (z.kod || ''),
      'TZoneWest=' + TF(orak < 0 && h === 0),
      'TZoneHour=' + (orak < 0 && h !== 0 ? -h : h),
      'TZoneMinute=' + m,
      'TZCodeIsManual=' + TF(a.zonaMod === 'kezi' && (!a.tzKod || bi.TZCodeIsManual === 'T')),
      'LocCity=' + (a.telepules || ''), 'LocCountry=' + (a.orszag || ''), 'LocCountryID=' + (a.orszagKod || ''),
      'LocAltitude=' + (bi.LocAltitude || '0'),
      'LocLongDegree=' + lon[0], 'LocLongMinute=' + lon[1], 'LocLongSecond=999', 'LocLongWest=' + TF(a.lon < 0),
      'LocLatDegree=' + lat[0], 'LocLatMinute=' + lat[1], 'LocLatSecond=999', 'LocLatSouth=' + TF(a.lat < 0),
      'IsDayLightSavingTime=' + TF(z.nyari),
      'BirthDateIsBC=F',
      'IsDead=' + (bi.IsDead === 'T' ? 'T' : 'F')];
    if (bi.IsDead === 'T') ['DeathYear', 'DeathMonth', 'DeathDay', 'DeathHour', 'DeathMin', 'DeathSec'].forEach(function (k) {
      s.push(k + '=' + (bi[k] || '0'));
    });
    s.push('', '[Tags]', 'Tags=' + (a.cimkek || []).join(';'), '', '[Notes]');
    var jegyzet = (a.jegyzet || '').replace(/\r/g, '');
    if (jegyzet) jegyzet.split('\n').forEach(function (l, i) { s.push('Note' + (i < 9 ? '0' : '') + (i + 1) + '=' + l); });
    s.push('', '[Other]', 'PictureFilename=' + (ot.PictureFilename || ''), 'FileVersionId=' + VERZIO, '', '[Attachements]');
    var att = e.Attachements || {};
    Object.keys(att).sort().forEach(function (k) { s.push(k + '=' + att[k]); });
    return s.join('\r\n') + '\r\n';
  }

  /** UTF-16LE, BOM-mal – ahogy a Windows-os program (TTntStringList.SaveToFile) menti. */
  function epit(a, z) {
    var t = szoveg(a, z), b = new Uint8Array(2 + t.length * 2);
    b[0] = 0xFF; b[1] = 0xFE;
    for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); b[2 + 2 * i] = c & 255; b[3 + 2 * i] = c >> 8; }
    return b.buffer;
  }

  /** A beolvasott fájlból a webes képletadat (Regio.Keplet). A fájl saját zónaadatai érvényesek. */
  function adatba(p) {
    return {
      nev: p.name, ev: p.year, ho: p.month, nap: p.day, ora: p.hour, perc: p.minute, mp: p.second,
      ismeretlen: p.timeUnknown, telepules: p.city, orszag: p.country, orszagKod: p.countryId, lat: p.lat, lon: p.lon,
      zonaMod: p.tzCode === 'LMT' ? 'lmt' : 'kezi', tz: '', eltolas: p.offsetHours, tzKod: p.tzCode, nyari: p.dst,
      jegyzet: p.notes, cimkek: p.tags, tipus: 'radix', eredeti: p.raw
    };
  }

  global.RegioSzk = { parse: parse, decode: dekodol, text: szoveg, build: epit, toAdat: adatba, VERZIO: VERZIO };
})(typeof window !== 'undefined' ? window : globalThis);
