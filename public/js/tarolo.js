/*
 * tarolo.js – a böngésző helyi tárolója (localStorage): beállítások, legutóbbi képletek, munkamenet.
 * Minden hozzáférés try/catch-ben: privát ablakban vagy tiltott tárolónál egyszerűen nem emlékszik.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var S = R.Tarolo = {};
  var EL = 'regio.';

  function olvas(k, alap) {
    try {
      var v = global.localStorage.getItem(EL + k);
      return v === null ? alap : JSON.parse(v);
    } catch (e) { return alap; }
  }
  function ir(k, v) {
    try { global.localStorage.setItem(EL + k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function torol(k) { try { global.localStorage.removeItem(EL + k); } catch (e) { /* nincs tároló */ } }

  /* ---------- beállítások ---------- */
  S.ALAP = {
    hsys: 'P', sid: false, csomo: 11,
    kerek: { houseLords: true, feral: true, retrograde: false, stationary: false, selfMarkers: true,
      cuspLabels: true, nodes: false, asteroids: false, conjLines: false },
    alapHely: { telepules: 'Budapest', telepulesKijelzes: '', orszag: 'Hungary', orszagKod: 'H', lat: 47.5, lon: 19.0666667, tz: 'Europe/Budapest' },
    elrendezes: 4, aktualisFrissit: true, lepes: 1, reszletArany: 0.58,
    osszevetesMod: 'egymason', pdKonverz: false, phCsakHold: true, phTengely: false
  };
  function melyMasol(a) { return JSON.parse(JSON.stringify(a)); }
  function osszefesul(alap, v) {
    var u = melyMasol(alap);
    if (!v || typeof v !== 'object') return u;
    Object.keys(u).forEach(function (k) {
      if (v[k] === undefined) return;
      if (u[k] && typeof u[k] === 'object' && !Array.isArray(u[k])) u[k] = osszefesul(u[k], v[k]);
      else if (typeof v[k] === typeof u[k]) u[k] = v[k];
    });
    return u;
  }
  S.beallitasok = function () { return osszefesul(S.ALAP, olvas('beallitasok', null)); };
  S.beallitasMent = function (b) { return ir('beallitasok', b); };
  S.gyari = function () { torol('beallitasok'); return melyMasol(S.ALAP); };

  /* ---------- legutóbbi képletek (adatként, mert a böngésző nem tud fájlútvonalat megjegyezni) ---------- */
  var MAX_LEGUTOBBI = 10;
  S.legutobbi = function () { var l = olvas('legutobbi', []); return Array.isArray(l) ? l : []; };
  S.legutobbiHozzaad = function (adat, fajlnev) {
    var a = melyMasol(adat); delete a.eredeti;
    var kulcs = a.nev + '|' + a.ev + '.' + a.ho + '.' + a.nap + '|' + a.ora + ':' + a.perc;
    var l = S.legutobbi().filter(function (x) { return x.kulcs !== kulcs; });
    l.unshift({ kulcs: kulcs, fajlnev: fajlnev || '', adat: a, ido: Date.now() });
    ir('legutobbi', l.slice(0, MAX_LEGUTOBBI));
  };
  S.legutobbiTorol = function () { torol('legutobbi'); };

  /* ---------- munkamenet: a megnyitott képletek visszaállításához ---------- */
  S.munkamenet = function () { return olvas('munkamenet', null); };
  S.munkamenetMent = function (m) { return ir('munkamenet', m); };
})(typeof window !== 'undefined' ? window : globalThis);
