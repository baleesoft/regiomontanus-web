/*
 * telepules.js – településkereső beviteli mező (combobox) a szerver településadatbázisához (api/telepules.php).
 * Ha a szerver nem érhető el, egy rövid beépített listából keres.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};

  R.TELEPULES_API = '../api/telepules.php';

  var BEEPITETT = [
    ['Budapest', 'H', 'Hungary', 47.5, 19.06667, 'Europe/Budapest'], ['Debrecen', 'H', 'Hungary', 47.53333, 21.63333, 'Europe/Budapest'],
    ['Szeged', 'H', 'Hungary', 46.25, 20.16667, 'Europe/Budapest'], ['Miskolc', 'H', 'Hungary', 48.1, 20.8, 'Europe/Budapest'],
    ['Pécs', 'H', 'Hungary', 46.08333, 18.25, 'Europe/Budapest'], ['Győr', 'H', 'Hungary', 47.68333, 17.63333, 'Europe/Budapest'],
    ['Nyíregyháza', 'H', 'Hungary', 47.95, 21.71667, 'Europe/Budapest'], ['Kecskemét', 'H', 'Hungary', 46.9, 19.7, 'Europe/Budapest'],
    ['Székesfehérvár', 'H', 'Hungary', 47.2, 18.41667, 'Europe/Budapest'], ['Szombathely', 'H', 'Hungary', 47.23333, 16.63333, 'Europe/Budapest'],
    ['Wien', 'A', 'Austria', 48.21667, 16.36667, 'Europe/Vienna'], ['London', 'GBE', 'England', 51.5, -0.16667, 'Europe/London'],
    ['New York', 'USNY', 'USA, New York', 40.7, -74, 'America/New_York']
  ].map(function (t) { return { nev: t[0], orszagKod: t[1], orszag: t[2], lat: t[3], lon: t[4], tz: t[5] }; });

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function helyi(q) {
    var n = norm(q);
    return BEEPITETT.filter(function (t) { return !n || norm(t.nev).indexOf(n) === 0; });
  }
  function lekerdez(param) {
    return fetch(R.TELEPULES_API + '?' + param, { cache: 'no-store' }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j || !Array.isArray(j.talalatok)) throw new Error((j && j.error) || 'HTTP ' + r.status);
        return j.talalatok;
      });
    });
  }

  /**
   * input: a beviteli mező, lista: <ul role=listbox>, valaszt(t): a kiválasztott településsel hívódik.
   * t = { nev, orszagKod, orszag, lat, lon, tz }
   */
  R.TelepulesKereso = function (input, lista, valaszt) {
    var talalatok = [], kijelolt = -1, idozito = null, sorszam = 0, szerverHiba = false;

    function zar() { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    function mutat(l, uzenet) {
      talalatok = l; kijelolt = l.length ? 0 : -1;
      lista.innerHTML = l.length ? l.map(function (t, i) {
        return '<li role="option" id="' + lista.id + '_' + i + '" data-i="' + i + '"' + (i === 0 ? ' aria-selected="true"' : '') + '>' +
          R.esc(t.nev) + '<small>' + R.esc(t.orszag) + ' · ' + R.fokStr(Math.abs(t.lat), false) + (t.lat >= 0 ? 'É' : 'D') + ' ' +
          R.fokStr(Math.abs(t.lon), false) + (t.lon >= 0 ? 'K' : 'Ny') + '</small></li>';
      }).join('') : '<li class="nincs">' + R.esc(uzenet || 'Nincs találat.') + '</li>';
      lista.hidden = false; input.setAttribute('aria-expanded', 'true');
      jelol(kijelolt);
    }
    function jelol(i) {
      kijelolt = i;
      Array.prototype.forEach.call(lista.querySelectorAll('li[data-i]'), function (li) {
        var a = +li.getAttribute('data-i') === i;
        li.setAttribute('aria-selected', a ? 'true' : 'false');
        if (a) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
      });
    }
    function kivalaszt(i) {
      var t = talalatok[i]; if (!t) return;
      zar(); input.value = t.nev; valaszt(t);
    }
    function keres() {
      var q = input.value.trim(), sz = ++sorszam;
      if (q.length < 2) {
        if (szerverHiba) { mutat(helyi(''), ''); return; }
        lekerdez('alap=1').then(function (l) { if (sz === sorszam) mutat(l); }, function () { szerverHiba = true; if (sz === sorszam) mutat(helyi('')); });
        return;
      }
      if (szerverHiba) { mutat(helyi(q), 'Nincs találat (a településadatbázis most nem érhető el).'); return; }
      lekerdez('q=' + encodeURIComponent(q) + '&max=30').then(function (l) { if (sz === sorszam) mutat(l); }, function () {
        szerverHiba = true;
        if (sz === sorszam) mutat(helyi(q), 'Nincs találat (a településadatbázis most nem érhető el).');
      });
    }

    input.addEventListener('input', function () { clearTimeout(idozito); idozito = setTimeout(keres, 180); });
    input.addEventListener('focus', function () { if (!input.value.trim()) keres(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (lista.hidden) { keres(); return; }
        if (talalatok.length) jelol(Math.min(talalatok.length - 1, kijelolt + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); if (talalatok.length) jelol(Math.max(0, kijelolt - 1));
      } else if (e.key === 'Enter') {
        if (!lista.hidden && kijelolt >= 0) { e.preventDefault(); kivalaszt(kijelolt); }
      } else if (e.key === 'Escape') {
        if (!lista.hidden) { e.preventDefault(); e.stopPropagation(); zar(); }
      }
    });
    input.addEventListener('blur', function () { setTimeout(zar, 150); });
    lista.addEventListener('mousedown', function (e) {
      var li = e.target.closest('li[data-i]'); if (!li) return;
      e.preventDefault(); kivalaszt(+li.getAttribute('data-i'));
    });
    return { zar: zar };
  };
})(typeof window !== 'undefined' ? window : globalThis);
