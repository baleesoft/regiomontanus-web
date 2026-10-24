/*
 * suti.js – látogatottsági statisztika (Google Analytics 4) csak a látogató beleegyezésével.
 * A mérési azonosító a js/ga-azonosito.js-ben van (window.REGIO_GA_ID); a nyilvános forrásban üres, így egy saját
 * telepítés nem küld adatot sehova, és a sávot sem mutatja. A Google-szkript CSAK az „Elfogadom” után töltődik be
 * (alap beleegyezési mód); elutasításnál semmi nem kerül a Google-hoz. A választás a böngészőben marad (localStorage).
 * A kerék és a képletek adatai nem kerülnek a statisztikába: az oldal címe rögzítetten „Regiomontanus”, a cím-sor
 * pedig lekérdezés és horgony nélkül.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var KULCS = 'regio.suti', id = global.REGIO_GA_ID || '', betoltve = false, sav = null;

  function olvas() { try { return global.localStorage.getItem(KULCS); } catch (e) { return null; } }
  function ir(v) { try { global.localStorage.setItem(KULCS, v); } catch (e) { /* privát ablak: csak erre a látogatásra */ } }

  function betolt() {
    if (betoltve || !id) return;
    betoltve = true;
    global.dataLayer = global.dataLayer || [];
    global.gtag = function () { global.dataLayer.push(arguments); };
    global.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
    global.gtag('js', new Date());
    global.gtag('config', id, { page_title: 'Regiomontanus', page_location: global.location.origin + global.location.pathname });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }
  /** visszavonáskor a Google sütijei törlődnek, és a következő betöltéstől nincs mérés */
  function torolSutik() {
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid') {
        var dom = global.location.hostname.split('.').slice(-2).join('.');
        [';path=/', ';path=/;domain=' + dom, ';path=/;domain=.' + dom].forEach(function (x) {
          document.cookie = n + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT' + x;
        });
      }
    });
  }
  function stilus() {
    if (document.getElementById('sutiStilus')) return;
    var st = document.createElement('style'); st.id = 'sutiStilus';
    st.textContent = '.suti-sav{position:fixed;left:12px;right:12px;bottom:12px;z-index:90;max-width:760px;margin:0 auto;padding:12px 14px;' +
      'background:#fffdf7;color:#1f1d1a;border:1px solid #b9b1a0;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.22);font:13px/1.45 Tahoma,Verdana,sans-serif}' +
      '.suti-sav p{margin:0 0 8px}.suti-sav .suti-gombok{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.suti-sav button{font:inherit;padding:5px 14px;border:1px solid #9aa7bd;background:#fff;border-radius:3px;cursor:pointer}' +
      '.suti-sav button.fo{background:#2a4a7f;border-color:#2a4a7f;color:#fff}.suti-sav .suti-tobb{margin-top:8px;color:#4a463f}' +
      '.suti-sav .suti-link{border:0;background:none;padding:0;color:#2a4a7f;text-decoration:underline;cursor:pointer}';
    document.head.appendChild(st);
  }
  /** a beleegyező sáv; ujra: a menüből újra megnyitva (a jelenlegi választás látszik) */
  function mutat(ujra) {
    if (!id || sav) return;
    stilus();
    var all = olvas();
    sav = document.createElement('div');
    sav.className = 'suti-sav'; sav.setAttribute('role', 'dialog'); sav.setAttribute('aria-label', 'Sütik és statisztika');
    sav.innerHTML = '<p><b>Látogatottsági statisztika</b> – a program fejlesztéséhez névtelen használati statisztikát gyűjtenénk ' +
      '(Google Analytics, sütikkel). Beleegyezel? ' + (ujra ? '<i>Jelenleg: ' + (all === 'igen' ? 'engedélyezve' : 'nincs engedélyezve') + '.</i>' : '') + '</p>' +
      '<div class="suti-gombok"><button type="button" class="fo" data-suti="igen">Elfogadom</button>' +
      '<button type="button" data-suti="nem">Elutasítom</button><button type="button" class="suti-link" data-suti="tobb">Részletek</button></div>' +
      '<div class="suti-tobb" hidden>A statisztika csak azt méri, hányan és hogyan használják a programot (oldalmegtekintés, ' +
      'eszköz, ország). A képletek adatai – nevek, születési idők és helyek – nem kerülnek a Google-hoz, és a program nem használ ' +
      'hirdetési sütiket. Elutasítás esetén semmilyen adat nem kerül a Google-hoz. A választásod bármikor módosíthatod az ' +
      'Információk › Adatvédelem és sütik menüpontban.</div>';
    document.body.appendChild(sav);
    sav.addEventListener('click', function (e) {
      var b = e.target.closest('[data-suti]'); if (!b) return;
      var v = b.getAttribute('data-suti');
      if (v === 'tobb') { sav.querySelector('.suti-tobb').hidden = !sav.querySelector('.suti-tobb').hidden; return; }
      ir(v);
      if (v === 'igen') betolt();
      else if (betoltve) {
        // visszavonás: a sütik törlése; a már betöltött mérés a lap újratöltéséig letiltva
        global.gtag('consent', 'update', { analytics_storage: 'denied' });
        global['ga-disable-' + id] = true;
        torolSutik();
      }
      sav.remove(); sav = null;
    });
    var f = sav.querySelector('[data-suti="igen"]'); if (f && ujra) f.focus();
  }

  R.Suti = { van: !!id, allapot: olvas, beallit: function () { mutat(true); } };
  if (!id) return;
  var a = olvas();
  if (a === 'igen') betolt();
  else if (a !== 'nem') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mutat(false); });
    else mutat(false);
  }
})(typeof window !== 'undefined' ? window : globalThis);
