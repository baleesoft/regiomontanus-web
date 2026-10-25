/*
 * morinus.js – a Morinus asztrológiai program (Python, wxPython) horoszkópfájljainak (.hor) beolvasása.
 * A fájl 27 egymás után írt Python-pickle (morin.py save / subLoad), sorrendben:
 *   name, male, htype, bc, year, month, day, hour, minute, second, cal, zt, plus, zh, zm, daylightsaving,
 *   place, deglon, minlon, seclon, east, deglat, minlat, seclat, north, altitude, notes
 * chart.py: cal 0 = Gergely, 1 = Julián; zt 0 = zónaidő (plus: keleti), 1 = világidő (GMT), 2 = helyi középidő,
 * 3 = helyi látszólagos idő; daylightsaving: −1 óra; bc: az év történeti (a csillagászati 1 − év);
 * htype 0 = radix, 1 = szolár, 2 = lunár, 3 = revolúció, 4 = tranzit, 5 = horári, 6 = profekció, 7 = PD a képletben.
 * A pickle a 0. (szöveges, Python 2) és a bináris (2–5.) protokollban is olvasható – csak az itt előforduló egyszerű típusok.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';

  var MEZOK = ['name', 'male', 'htype', 'bc', 'year', 'month', 'day', 'hour', 'minute', 'second', 'cal', 'zt', 'plus', 'zh', 'zm',
    'daylightsaving', 'place', 'deglon', 'minlon', 'seclon', 'east', 'deglat', 'minlat', 'seclat', 'north', 'altitude', 'notes'];
  var TIPUS = ['radix', 'szolár', 'lunár', 'revolúció', 'tranzit', 'horári', 'profekció', 'primer direkció a képletben'];

  /* ---------- egyszerű unpickler (sorozat) ---------- */
  function utf8(b) { try { return new TextDecoder('utf-8').decode(b); } catch (e) { return String.fromCharCode.apply(null, b); } }
  function latin1(b) { var s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
  /** raw-unicode-escape: a 256 alatti karakterek nyers bájtként, a többi \uXXXX / \UXXXXXXXX */
  function rawUnicode(b) {
    return latin1(b).replace(/\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/g, function (_, u, U) {
      return u ? String.fromCharCode(parseInt(u, 16)) : String.fromCodePoint(parseInt(U, 16));
    });
  }
  function pickleSor(d) {
    var i = 0, ki = [], verem = [];
    function sor() { var v = i; while (i < d.length && d[i] !== 10) i++; var s = d.subarray(v, i); i++; return s; }
    function le(n) { var v = 0; for (var k = n - 1; k >= 0; k--) v = v * 256 + d[i + k]; i += n; return v; }
    while (i < d.length) {
      var op = String.fromCharCode(d[i++]);
      switch (op) {
        case '\x80': i++; break;                                  // PROTO
        case '\x95': i += 8; break;                               // FRAME
        case 'V': verem.push(rawUnicode(sor())); break;           // UNICODE (0. protokoll)
        case 'S': { var s = latin1(sor()).trim(); verem.push(s.slice(1, -1).replace(/\\x([0-9a-f]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }).replace(/\\(.)/g, '$1')); break; }
        case 'X': { var n = le(4); verem.push(utf8(d.subarray(i, i + n))); i += n; break; }
        case '\x8c': { var m = d[i++]; verem.push(utf8(d.subarray(i, i + m))); i += m; break; }
        case 'T': { var t = le(4); verem.push(latin1(d.subarray(i, i + t))); i += t; break; }
        case 'U': { var u = d[i++]; verem.push(latin1(d.subarray(i, i + u))); i += u; break; }
        case 'I': { var x = latin1(sor()).trim(); verem.push(x === '01' ? true : x === '00' ? false : parseInt(x, 10)); break; }
        case 'L': verem.push(parseInt(latin1(sor()).replace(/L$/, ''), 10)); break;
        case 'F': verem.push(parseFloat(latin1(sor()))); break;
        case 'G': { var dv = new DataView(d.buffer, d.byteOffset + i, 8); verem.push(dv.getFloat64(0, false)); i += 8; break; }
        case 'K': verem.push(d[i++]); break;
        case 'M': verem.push(le(2)); break;
        case 'J': { var j = le(4); verem.push(j > 0x7fffffff ? j - 0x100000000 : j); break; }
        case '\x88': verem.push(true); break;
        case '\x89': verem.push(false); break;
        case 'N': verem.push(null); break;
        case 'p': sor(); break;                                   // PUT
        case 'q': i++; break;                                     // BINPUT
        case 'r': i += 4; break;                                  // LONG_BINPUT
        case '\x94': break;                                       // MEMOIZE
        case '.': ki.push(verem.pop()); verem = []; break;        // STOP: egy érték kész
        case '\r': break;
        default: throw new Error('Ismeretlen pickle-utasítás (0x' + d[i - 1].toString(16) + ').');
      }
    }
    return ki;
  }

  /** Morinus-fájl-e (a PLACIDUS-fájlok szöveges fejléccel kezdődnek) */
  function morinusE(buf) {
    var d = new Uint8Array(buf);
    return d.length > 4 && (d[0] === 0x56 || (d[0] === 0x53 && d[1] === 0x27) || (d[0] === 0x80 && d[1] >= 2 && d[1] <= 5));
  }

  function parse(buf) {
    var l;
    try { l = pickleSor(new Uint8Array(buf)); } catch (e) { throw new Error('Ez nem Morinus horoszkópfájl (' + e.message + ').'); }
    if (l.length < MEZOK.length || typeof l[0] !== 'string' || typeof l[4] !== 'number') throw new Error('Ez nem Morinus horoszkópfájl.');
    var p = {};
    MEZOK.forEach(function (k, i) { p[k] = l[i]; });
    return p;
  }

  /** Az időegyenlet percben (Spencer, kb. ±0,5 perc) – a helyi látszólagos időhöz */
  function idoegyenlet(ev, ho, nap) {
    var n = Math.floor(275 * ho / 9) - (Math.floor((ho + 9) / 12) * (1 + Math.floor((ev - 4 * Math.floor(ev / 4) + 2) / 3))) + nap - 30;
    var g = 2 * Math.PI / 365 * (n - 1);
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }

  /** A webes képletadat (Regio.Keplet): { adat, figyelmeztetes: [] } */
  function adatba(p) {
    var fig = [], ev = p.bc ? 1 - p.year : p.year;
    if (ev < -2999 || ev > 2999) throw new Error('Az év i. e. 3000 és i. sz. 2999 között lehet.');
    var lon = (p.deglon + p.minlon / 60 + (p.seclon || 0) / 3600) * (p.east ? 1 : -1);
    var lat = (p.deglat + p.minlat / 60 + (p.seclat || 0) / 3600) * (p.north ? 1 : -1);
    var hely = String(p.place || ''), v = hely.lastIndexOf(',');
    var nyari = !!p.daylightsaving, d = nyari ? 1 : 0, zt = p.zt, zonaMod = 'kezi', elt = 0, kod = '';
    // a Morinus (chart.py Time): UT = helyi − (zóna | 0 | hosszúság·4 perc | LMT + időegyenlet) − nyári óra
    if (zt === 0) elt = (p.zh + p.zm / 60) * (p.plus ? 1 : -1) + d;
    else if (zt === 1) { elt = d; kod = d ? '' : 'UT'; }
    else {
      var lmt = (p.deglon + p.minlon / 60) * 4 / 60 * (p.east ? 1 : -1);
      if (zt === 2 && !d) zonaMod = 'lmt';
      elt = lmt + d;
      if (zt === 3) {
        elt += idoegyenlet(ev, p.month, p.day) / 60;   // LMT = LAT − időegyenlet
        fig.push('helyi látszólagos idő – az időegyenlettel átszámítva (±1 perc), ellenőrizd');
      }
    }
    var a = {
      nev: String(p.name || '').trim(), ev: ev, ho: p.month, nap: p.day, naptar: p.cal === 1 ? 'J' : 'G',
      ora: p.hour, perc: p.minute, mp: p.second || 0, ismeretlen: false,
      telepules: v > 0 ? hely.slice(0, v).trim() : hely.trim(), orszag: v > 0 ? hely.slice(v + 1).trim() : '', orszagKod: '',
      lat: lat, lon: lon, zonaMod: zonaMod, tz: '', eltolas: zonaMod === 'lmt' ? 0 : elt, tzKod: kod, nyari: nyari,
      jegyzet: '', cimkek: [], megjegyzesek: {}, csatolmanyok: [], tipus: 'radix',
      // a .szk mentéshez: Gender (0 = férfi, 1 = nő), tengerszint feletti magasság
      eredeti: { BirthInfo: { Gender: p.male ? '0' : '1', LocAltitude: String(p.altitude || 0) } }
    };
    var j = [];
    if (p.notes && String(p.notes).trim()) j.push(String(p.notes).replace(/\r\n?/g, '\n').replace(/\s+$/, ''));
    if (p.htype) j.push('A Morinus-fájl típusa: ' + (TIPUS[p.htype] || p.htype));
    a.jegyzet = j.join('\n');
    if (zt === 0 && Math.abs(elt - d - lon / 15) > 3.5) fig.push('a zóna nem illik a földrajzi hosszúsághoz – ellenőrizd az időpontot');
    return { adat: a, figyelmeztetes: fig };
  }

  global.RegioMorinus = { parse: parse, toAdat: adatba, morinusE: morinusE, pickle: pickleSor };
})(typeof window !== 'undefined' ? window : globalThis);
