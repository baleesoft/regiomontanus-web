/*
 * szk.js – a Windows-os Regiomontanus .szk képletfájljainak olvasása a böngészőben.
 * A .szk INI-szöveg: újabb fájlok UTF-16LE (BOM-mal), régebbiek Windows-1250 kódolásúak.
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

  global.RegioSzk = { parse: parse, decode: dekodol };
})(typeof window !== 'undefined' ? window : globalThis);
