/*
 * hor.js – a magyar PLACIDUS v4.0 asztrológiai program horoszkópfájljainak (.hor) beolvasása.
 * A formátum (visszafejtve, 7 mintafájlból): kötött, 3926 bájtos rekord, „PLACIDUS v4.0 Horoscope File” fejléccel;
 * a szövegek Windows-1250 kódolásúak, nullával lezártak (a mezők maradéka a program memóriaszemete – nem olvassuk).
 * A Microsoft COMPRESS.EXE-vel tömörített változat („SZDD”, a telepítőlemezek .HO_ fájljai) is megnyílik.
 *
 *   0x020  név [41]                    0x049  típus [11] (radix, szolárrev, lunárrev, Merk rev…)
 *   0x057  világidő (UT): naptár (1 = Gergely, 0 = Julián), év (int16, előjeles: i. e.), hó, nap, óra, perc, mp
 *   0x066  hosszúság: fok (uint16, a felső bit: W), perc      0x071  szélesség: fok (felső bit: S), perc
 *   0x07C  időszámítás: mód (0 = világidő, 1 = helyi középidő, 2 = zónaidő), óra, perc, irány (0 = E, 1 = W)
 *   0x080  helyi idő (mint a világidő)  0x08F  település [31]   0x0AE  nem (1 = férfi, 2 = nő, 0 = nincs)
 *   0x0AF  jegyzet (CR LF sortörésekkel) 0x880  „BB”, az életesemények száma (uint16), majd eseményenként 37 bájt:
 *          jelző, név [31], naptár, év (int16), hó, nap
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';

  var FEJ = 'PLACIDUS v4.0 Horoscope File';
  var CP1250 = null;
  function cp1250(b) {
    if (!CP1250) { try { CP1250 = new TextDecoder('windows-1250'); } catch (e) { CP1250 = false; } }
    if (CP1250) return CP1250.decode(b);
    return String.fromCharCode.apply(null, b); // végső eset (régi böngésző): Latin-1
  }
  function szoveg(d, tol, ig) {
    var v = tol; while (v < ig && d[v] !== 0) v++;
    return cp1250(d.subarray(tol, v)).replace(/\r\n?/g, '\n');
  }
  function u16(d, i) { return d[i] | (d[i + 1] << 8); }
  function i16(d, i) { var v = u16(d, i); return v & 0x8000 ? v - 0x10000 : v; }

  /** Microsoft COMPRESS.EXE (SZDD, LZSS: 4 KiB ablak, szóközzel feltöltve, kezdőpont 4096 − 16) kibontása */
  function szdd(d) {
    var meret = (d[10] | (d[11] << 8) | (d[12] << 16) | (d[13] << 24)) >>> 0, ki = new Uint8Array(meret), n = 0;
    var ablak = new Uint8Array(4096).fill(32), p = 4096 - 16, i = 14;
    while (i < d.length && n < meret) {
      var jelzo = d[i++];
      for (var b = 0; b < 8 && i < d.length && n < meret; b++) {
        if (jelzo & (1 << b)) { var c = d[i++]; ki[n++] = c; ablak[p] = c; p = (p + 1) & 4095; continue; }
        if (i + 1 >= d.length) { i = d.length; break; }
        var lo = d[i++], hi = d[i++], poz = lo | ((hi & 0xf0) << 4), hossz = (hi & 0x0f) + 3;
        for (var k = 0; k < hossz && n < meret; k++) { var c2 = ablak[(poz + k) & 4095]; ki[n++] = c2; ablak[p] = c2; p = (p + 1) & 4095; }
      }
    }
    return ki;
  }
  function szddE(d) { return d.length > 14 && d[0] === 0x53 && d[1] === 0x5A && d[2] === 0x44 && d[3] === 0x44 && d[4] === 0x88 && d[5] === 0xF0; }

  function idopont(d, i) {
    return { julian: d[i] === 0, ev: i16(d, i + 1), ho: d[i + 3], nap: d[i + 4], ora: d[i + 5], perc: d[i + 6], mp: d[i + 7] };
  }
  function koord(d, i) {
    var f = u16(d, i);
    return { fok: f & 0x7fff, perc: d[i + 2], neg: !!(f & 0x8000) };
  }

  /** A fájl tartalma; hibánál kivételt dob. */
  function parse(buf) {
    var d = new Uint8Array(buf);
    if (szddE(d)) d = szdd(d);
    if (d.length < 0x884 || cp1250(d.subarray(0, FEJ.length)) !== FEJ) throw new Error('Ez nem PLACIDUS v4.0 horoszkópfájl.');
    var p = {
      nev: szoveg(d, 0x20, 0x49), tipus: szoveg(d, 0x49, 0x54),
      ut: idopont(d, 0x57), helyi: idopont(d, 0x80),
      hossz: koord(d, 0x66), szel: koord(d, 0x71),
      zona: { mod: d[0x7c], ora: d[0x7d], perc: d[0x7e], nyugat: d[0x7f] === 1 },
      hely: szoveg(d, 0x8f, 0xae), nem: d[0xae], jegyzet: szoveg(d, 0xaf, 0x880), esemenyek: []
    };
    if (d[0x880] === 0x42 && d[0x881] === 0x42) {
      var n = u16(d, 0x882);
      for (var e = 0; e < n && 0x884 + 37 * (e + 1) <= d.length; e++) {
        var r = 0x884 + 37 * e, t = idopont(d, r + 32);
        p.esemenyek.push({ nev: szoveg(d, r + 1, r + 32), julian: t.julian, ev: t.ev, ho: t.ho, nap: t.nap });
      }
    }
    return p;
  }

  /* ---------- naptár ---------- */
  function jdJulian(e, h, n) {          // a Julián-naptári dátum Julián-napja (csillagászati évszám)
    if (h <= 2) { e--; h += 12; }
    return Math.floor(365.25 * (e + 4716)) + Math.floor(30.6001 * (h + 1)) + n - 1524;
  }
  function gergelyJdbol(jd) {          // Julián-nap → Gergely-naptári dátum (Fliegel–Van Flandern)
    var l = jd + 68569, n = Math.floor(4 * l / 146097); l -= Math.floor((146097 * n + 3) / 4);
    var i = Math.floor(4000 * (l + 1) / 1461001); l = l - Math.floor(1461 * i / 4) + 31;
    var j = Math.floor(80 * l / 2447), nap = l - Math.floor(2447 * j / 80); l = Math.floor(j / 11);
    return { ev: 100 * (n - 49) + i + l, ho: j + 2 - 12 * l, nap: nap };
  }
  function datumStr(t) { return (t.ev < 0 ? 'i. e. ' + (-t.ev) : t.ev) + '.' + (t.ho < 10 ? '0' : '') + t.ho + '.' + (t.nap < 10 ? '0' : '') + t.nap; }

  /**
   * A webes képletadat (Regio.Keplet) a beolvasott fájlból: { adat, figyelmeztetes: [] }.
   * A dátum Gergely-naptárra kerül (a Julián-naptári a jegyzetbe), az időszámítás: világidő → kézi 0, helyi középidő → LMT,
   * zónaidő → kézi eltolás. A jegyzet a Placidus jegyzete + az életesemények + a nem radix típus.
   */
  function adatba(p) {
    var h = p.helyi, fig = [];
    if (h.ev < 0) throw new Error('Időszámításunk előtti dátum (i. e. ' + (-h.ev) + ') még nem támogatott.');
    var datum = { ev: h.ev, ho: h.ho, nap: h.nap };
    if (h.julian) datum = gergelyJdbol(jdJulian(h.ev, h.ho, h.nap));
    if (datum.ev < 1 || datum.ev > 2999) throw new Error('Az év 1 és 2999 között lehet.');
    var lon = (p.hossz.fok + p.hossz.perc / 60) * (p.hossz.neg ? -1 : 1), lat = (p.szel.fok + p.szel.perc / 60) * (p.szel.neg ? -1 : 1);
    var z = p.zona, elt = (z.ora + z.perc / 60) * (z.nyugat ? -1 : 1);
    // „Város, Ország” → település és ország (az utolsó vessző szerint)
    var v = p.hely.lastIndexOf(','), telepules = v > 0 ? p.hely.slice(0, v).trim() : p.hely.trim(), orszag = v > 0 ? p.hely.slice(v + 1).trim() : '';
    var a = {
      nev: p.nev.trim(), ev: datum.ev, ho: datum.ho, nap: datum.nap, ora: h.ora, perc: h.perc, mp: h.mp || 0, ismeretlen: false,
      telepules: telepules, orszag: orszag, orszagKod: '', lat: lat, lon: lon,
      zonaMod: z.mod === 1 ? 'lmt' : 'kezi', tz: '', eltolas: z.mod === 0 ? 0 : elt, tzKod: z.mod === 0 ? 'UT' : '', nyari: false,
      jegyzet: '', cimkek: [], megjegyzesek: {}, csatolmanyok: [], tipus: 'radix',
      // a .szk mentéshez: Gender (Windows-os program: 0 = férfi, 1 = nő, 2 = egyéb)
      eredeti: { BirthInfo: { Gender: p.nem === 1 ? '0' : p.nem === 2 ? '1' : '2' } }
    };
    var j = [];
    if (p.jegyzet.trim()) j.push(p.jegyzet.replace(/\s+$/, ''));
    if (p.esemenyek.length) {
      j.push('Életesemények:');
      p.esemenyek.forEach(function (e) {
        var t = e.julian && e.ev > 0 ? gergelyJdbol(jdJulian(e.ev, e.ho, e.nap)) : e;
        j.push(datumStr(t) + ' ' + e.nev);
      });
    }
    if (h.julian) j.push('Julián-naptári születési dátum: ' + datumStr(h) + ' (a képletben a Gergely-naptári: ' + datumStr(datum) + ')');
    if (p.tipus && p.tipus !== 'radix') j.push('A Placidus-fájl típusa: ' + p.tipus);
    a.jegyzet = j.join('\n');

    // ellenőrzések: a zóna illik-e a helyhez és a korhoz, és a fájl világideje egyezik-e
    if (z.mod === 2) {
      if (Math.abs(elt - lon / 15) > 3.5) fig.push('a zóna (' + (elt < 0 ? '−' : '+') + z.ora + ':' + (z.perc < 10 ? '0' : '') + z.perc +
        ') nem illik a földrajzi hosszúsághoz – ellenőrizd az időpontot');
      if (datum.ev < 1880) fig.push('zónaidő ' + datum.ev + '-ben – akkor még a helyi középidő volt használatban, ellenőrizd');
    }
    var u = p.ut;
    if (u.ev === h.ev && !h.julian === !u.julian) {
      var helyiPerc = Date.UTC(2000, h.ho - 1, h.nap, h.ora, h.perc) / 60000, utPerc = Date.UTC(2000, u.ho - 1, u.nap, u.ora, u.perc) / 60000;
      var vart = z.mod === 0 ? 0 : z.mod === 2 ? elt * 60 : lon * 4;
      if (Math.abs(helyiPerc - utPerc - vart) > 2) fig.push('a fájlban tárolt világidő nem egyezik a helyi idővel és a zónával');
    }
    return { adat: a, figyelmeztetes: fig };
  }

  global.RegioHor = { parse: parse, toAdat: adatba, szdd: szdd, FEJ: FEJ };
})(typeof window !== 'undefined' ? window : globalThis);
