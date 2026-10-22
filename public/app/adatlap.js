/*
 * adatlap.js – „Születési képlet adatai” párbeszédablak (új képlet / az aktuális képlet adatai),
 * a Windows-os fSzuletesiKepletAdatok megfelelője.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, K = R.Keplet;
  var $ = function (id) { return document.getElementById(id); };
  var dlg, eredeti, feloldo = null;

  function fokPerc(x) {
    var a = Math.abs(x), f = Math.floor(a), p = Math.round((a - f) * 60);
    if (p === 60) { f++; p = 0; }
    return [f, p];
  }
  function zonaMod() { var r = document.querySelector('input[name="aZm"]:checked'); return r ? r.value : 'iana'; }
  function zonaModBeallit(m) { Array.prototype.forEach.call(document.querySelectorAll('input[name="aZm"]'), function (r) { r.checked = r.value === m; }); }

  function kitolt(a) {
    $('aNev').value = a.nev || '';
    $('aEv').value = a.ev; $('aHo').value = a.ho; $('aNap').value = a.nap;
    $('aOra').value = a.ora; $('aPerc').value = a.perc; $('aMp').value = a.mp || 0;
    $('aIsm').checked = !!a.ismeretlen;
    $('aTelep').value = a.telepules || ''; $('aOrszag').value = a.orszag || ''; $('aOrszagKod').value = a.orszagKod || '';
    var sz = fokPerc(a.lat), ho = fokPerc(a.lon);
    $('aSzF').value = sz[0]; $('aSzP').value = sz[1]; $('aSzI').value = a.lat < 0 ? '-1' : '1';
    $('aHoF').value = ho[0]; $('aHoP').value = ho[1]; $('aHoI').value = a.lon < 0 ? '-1' : '1';
    zonaModBeallit(a.zonaMod || 'iana');
    $('aTz').value = a.tz || '';
    $('aElt').value = +(+a.eltolas || 0).toFixed(4);
    $('aTzKod').value = a.tzKod || '';
    $('aNyari').checked = !!a.nyari;
    $('aJegyzet').value = a.jegyzet || '';
    $('aCimkek').value = (a.cimkek || []).join('; ');
    $('aHiba').hidden = true;
    allapot();
  }

  /** Az űrlapból képletadat; ell = true: ellenőrzéssel (hibánál kivételt dob) */
  function kiolvas(ell) {
    var a = K.masol(eredeti);
    function szam(id, min, max, nev) {
      var v = $(id).value.trim(), n = Number(v);
      if (ell && (v === '' || !isFinite(n) || n !== Math.floor(n) || n < min || n > max)) {
        $(id).focus();
        throw new Error(nev + ': ' + min + ' és ' + max + ' közötti egész szám kell.');
      }
      return isFinite(n) && v !== '' ? n : min;
    }
    a.nev = $('aNev').value.trim();
    if (ell && !a.nev) { $('aNev').focus(); throw new Error('Adj nevet a képletnek.'); }
    a.ev = szam('aEv', 1, 2999, 'Év'); a.ho = szam('aHo', 1, 12, 'Hó'); a.nap = szam('aNap', 1, 31, 'Nap');
    var d = new Date(0); d.setUTCFullYear(a.ev, a.ho - 1, a.nap);
    if (ell && d.getUTCDate() !== a.nap) { $('aNap').focus(); throw new Error('Nincs ilyen nap: ' + R.datumStr(a.ev, a.ho, a.nap) + '.'); }
    a.ismeretlen = $('aIsm').checked;
    if (a.ismeretlen) { a.ora = 12; a.perc = 0; a.mp = 0; } else {
      a.ora = szam('aOra', 0, 23, 'Óra'); a.perc = szam('aPerc', 0, 59, 'Perc'); a.mp = szam('aMp', 0, 59, 'Másodperc');
    }
    if (a.ismeretlen && a.tipus !== 'kos0') a.tipus = 'radix';
    a.telepules = $('aTelep').value.trim(); a.orszag = $('aOrszag').value.trim(); a.orszagKod = $('aOrszagKod').value.trim();
    a.lat = (+$('aSzI').value) * (szam('aSzF', 0, 90, 'Szélesség (fok)') + szam('aSzP', 0, 59, 'Szélesség (perc)') / 60);
    a.lon = (+$('aHoI').value) * (szam('aHoF', 0, 180, 'Hosszúság (fok)') + szam('aHoP', 0, 59, 'Hosszúság (perc)') / 60);
    if (ell && (Math.abs(a.lat) > 90 || Math.abs(a.lon) > 180)) throw new Error('Érvénytelen földrajzi koordináta.');
    a.zonaMod = zonaMod();
    a.tz = $('aTz').value.trim();
    if (ell && a.zonaMod === 'iana' && !R.zonaErvenyes(a.tz)) { $('aTz').focus(); throw new Error('Ismeretlen időzóna: „' + a.tz + '”. Példa: Europe/Budapest.'); }
    var e = Number($('aElt').value);
    if (ell && a.zonaMod === 'kezi' && (!isFinite(e) || Math.abs(e) > 14)) { $('aElt').focus(); throw new Error('Az UTC-eltérés −14 és +14 óra között lehet.'); }
    a.eltolas = isFinite(e) ? e : 0;
    a.tzKod = $('aTzKod').value.trim();
    a.nyari = $('aNyari').checked;
    a.jegyzet = $('aJegyzet').value;
    a.cimkek = $('aCimkek').value.split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    return a;
  }

  function allapot() {
    var ism = $('aIsm').checked, m = zonaMod();
    ['aOra', 'aPerc', 'aMp'].forEach(function (id) { $(id).disabled = ism; });
    if (ism) { $('aOra').value = 12; $('aPerc').value = 0; $('aMp').value = 0; }
    $('aTz').disabled = m !== 'iana';
    ['aElt', 'aTzKod', 'aNyari'].forEach(function (id) { $(id).disabled = m !== 'kezi'; });
    var zi = $('aZinfo');
    try {
      var a = kiolvas(false);
      if (a.zonaMod === 'iana' && !R.zonaErvenyes(a.tz)) throw new Error('Ismeretlen időzóna.');
      var z = K.zona(a);
      zi.textContent = 'Az időpont zónája: ' + z.info + (z.kod && z.kod !== 'LMT' ? ' – kód: ' + z.kod : '') +
        (ism ? ' · ismeretlen időpont: helyi délre számol, Kos 0° házakkal' : '');
      zi.classList.remove('hibas');
    } catch (e) { zi.textContent = e.message; zi.classList.add('hibas'); }
  }

  function most() {
    var a = kiolvas(false), n = Date.now(), r;
    if (a.zonaMod === 'iana' && R.zonaErvenyes(a.tz)) {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: a.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(n)).forEach(function (x) { p[x.type] = +x.value; });
      r = [p.year, p.month, p.day, p.hour, p.minute, p.second];
    } else {
      var d = new Date(n + K.zona(a).orak * 3600000);
      r = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
    }
    $('aIsm').checked = false;
    ['aEv', 'aHo', 'aNap', 'aOra', 'aPerc', 'aMp'].forEach(function (id, i) { $(id).value = r[i]; });
    allapot();
  }

  function lezar(ertek) {
    if (dlg.open) dlg.close();
    var f = feloldo; feloldo = null;
    if (f) f(ertek);
  }

  function init() {
    dlg = $('dlgAdat');
    var tzl = [];
    try { tzl = Intl.supportedValuesOf('timeZone'); } catch (e) { tzl = ['Europe/Budapest', 'Europe/Vienna', 'Europe/London', 'America/New_York']; }
    $('tzLista').innerHTML = tzl.map(function (z) { return '<option value="' + R.esc(z) + '">'; }).join('');

    R.TelepulesKereso($('aTelep'), $('aTalalat'), function (t) {
      $('aOrszag').value = t.orszag; $('aOrszagKod').value = t.orszagKod;
      var sz = fokPerc(t.lat), ho = fokPerc(t.lon);
      $('aSzF').value = sz[0]; $('aSzP').value = sz[1]; $('aSzI').value = t.lat < 0 ? '-1' : '1';
      $('aHoF').value = ho[0]; $('aHoP').value = ho[1]; $('aHoI').value = t.lon < 0 ? '-1' : '1';
      if (t.tz) { $('aTz').value = t.tz; zonaModBeallit('iana'); }
      allapot();
    });
    dlg.addEventListener('input', function (e) { if (e.target.id !== 'aTelep') allapot(); });
    dlg.addEventListener('change', allapot);
    $('aMost').addEventListener('click', most);
    $('aVissza').addEventListener('click', function () { kitolt(eredeti); });
    Array.prototype.forEach.call(dlg.querySelectorAll('[data-megse]'), function (b) { b.addEventListener('click', function () { lezar(null); }); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); lezar(null); });
    $('frmAdat').addEventListener('submit', function (e) {
      e.preventDefault();
      try { lezar(kiolvas(true)); } catch (h) { $('aHiba').textContent = h.message; $('aHiba').hidden = false; }
    });
  }

  R.Adatlap = {
    /** Promise<képletadat | null> */
    megnyit: function (adat, cim) {
      if (!dlg) init();
      if (feloldo) lezar(null);
      eredeti = K.masol(adat);
      $('dlgAdatCim').textContent = cim || 'Születési képlet adatai';
      kitolt(eredeti);
      dlg.showModal();
      setTimeout(function () { $('aNev').focus(); $('aNev').select(); }, 0);
      return new Promise(function (res) { feloldo = res; });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
