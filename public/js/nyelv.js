/*
 * nyelv.js – a felület többnyelvűsége (magyar az alap, angol: ?lang=en).
 * A nyelv: az URL ?lang= paramétere → a korábbi választás (localStorage 'regio.nyelv') → magyar.
 * A fordítás a megjelenő szövegen történik: a statikus HTML-t betöltéskor, a programból később beírt szövegeket
 * (menük, ablakok, táblák, üzenetek) MutationObserverrel fordítja le. A szótár (lang/<nyelv>.js) kulcsa maga a magyar
 * szöveg; mintázatokkal az összetett szövegek is fordíthatók („Életstratégia: {0} / {1}”), a {n} részeket rekurzívan.
 * A felhasználói adatot (képletnevek, jegyzetek, helynevek) tartalmazó elemek a data-nofordit jelölést kapják.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  var KULCS = 'regio.nyelv', NYELVEK = ['hu', 'en'];
  var SZOTARAK = {};

  function olvas() { try { return global.localStorage.getItem(KULCS); } catch (e) { return null; } }
  function ir(v) { try { global.localStorage.setItem(KULCS, v); } catch (e) { /* privát ablak */ } }
  function valaszt() {
    var m = /[?&]lang=([a-zA-Z]{2})\b/.exec(global.location ? global.location.search : '');
    if (m && NYELVEK.indexOf(m[1].toLowerCase()) >= 0) { ir(m[1].toLowerCase()); return m[1].toLowerCase(); }
    var t = olvas();
    // a böngésző nyelvét szándékosan nem nézzük: sok magyar felhasználónak angol a rendszere
    return t && NYELVEK.indexOf(t) >= 0 ? t : 'hu';
  }
  var kod = valaszt();

  /* ---------- a szótár és a mintázatok ---------- */
  var SZ = null, MINTAK = [];
  // a már lefordított (kimeneti) szövegek: a MutationObserver a saját változtatásait ne fordítsa újra
  // (pl. „Signs and Games (Jegyek és játszmák)” zárójeles része ne forduljon tovább)
  // NINCS: a fordítás nélküli szövegek (az újrarajzolt ábrák feliratait ne keressük újra)
  var KESZ = new Set(), NINCS = new Set(), ERTEKEK = [];
  function keszAlap() { KESZ = new Set(ERTEKEK); NINCS = new Set(); }
  function regexEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /** mintázat: a magyar sablonban {0}, {1}… helyén bármi állhat; az angolban ugyanezek, tetszőleges sorrendben */
  function minta(hu, en) {
    var sorrend = [], re = '^' + hu.split(/(\{\d\})/).map(function (d) {
      var m = /^\{(\d)\}$/.exec(d);
      if (m) { sorrend.push(+m[1]); return '([\\s\\S]+?)'; }
      return regexEsc(d);
    }).join('') + '$';
    return { re: new RegExp(re), sorrend: sorrend, en: en };
  }
  function szotar(nyelv, szavak, mintak) {
    SZOTARAK[nyelv] = { szavak: szavak, mintak: (mintak || []).map(function (x) { return minta(x[0], x[1]); }) };
    if (nyelv === kod) {
      SZ = SZOTARAK[nyelv].szavak; MINTAK = SZOTARAK[nyelv].mintak;
      ERTEKEK = Object.keys(SZ).map(function (k) { return SZ[k]; }); keszAlap();
    }
  }
  /** a mintázat részei nem vághatnak ketté zárójelet vagy idézetet („(ismeretlen időpont – helyi dél)”) */
  function kiegyensulyozott(m) {
    for (var j = 1; j < m.length; j++) {
      var g = m[j], z = 0, q = 0;
      for (var c = 0; c < g.length; c++) {
        var ch = g.charAt(c);
        if (ch === '(') z++; else if (ch === ')') { if (--z < 0) return false; } else if (ch === '„') q++; else if (ch === '”') { if (--q < 0) return false; }
      }
      if (z || q) return false;
    }
    return true;
  }
  /** a levágott szöveg fordítása; null, ha nincs */
  function tiszta(s, mely) {
    if (!SZ || !s) return null;
    if (Object.prototype.hasOwnProperty.call(SZ, s)) return SZ[s];
    if (mely > 4) return null;
    for (var i = 0; i < MINTAK.length; i++) {
      var m = MINTAK[i].re.exec(s);
      if (!m || !kiegyensulyozott(m)) continue;
      var reszek = {}, valt = false;
      MINTAK[i].sorrend.forEach(function (n, j) {
        var g = m[j + 1], lt = g.replace(/^\s+|\s+$/g, ''), f = lt ? tiszta(lt, mely + 1) : null;
        if (f !== null) valt = true;
        reszek[n] = f === null ? g : g.replace(lt, f);
      });
      var ki = MINTAK[i].en.replace(/\{(\d)\}/g, function (_, n) { return reszek[n] !== undefined ? reszek[n] : ''; });
      // az általános mintázatok (pl. „{0} ({1})”) csak akkor számítanak, ha valamelyik részük lefordult
      if (valt || ki !== s) return ki;
    }
    // szám/fok/jel előtag vagy szám/fok utótag: a szöveges rész fordul („5°24′ Bak”, „☿︎ Merkúr”, „Skorpió 2°09'35"”)
    var e = /^([^A-Za-z\u00C0-\u024F]+)([A-Za-z\u00C0-\u024F][\s\S]*)$/.exec(s);
    if (e) { var fe = tiszta(e[2], mely + 1); if (fe !== null) return e[1] + fe; }
    var u = /^([\s\S]*[A-Za-z\u00C0-\u024F.)])(\s+[^A-Za-z\u00C0-\u024F]+)$/.exec(s);
    if (u) { var fu = tiszta(u[1], mely + 1); if (fu !== null) return fu + u[2]; }
    return null;
  }
  /** fordítás (a szöveg elején/végén lévő szóközök maradnak); ha nincs fordítás, az eredeti */
  function t(s) {
    if (kod === 'hu' || s === null || s === undefined) return s;
    s = String(s);
    var lt = s.replace(/^\s+|\s+$/g, '');
    if (!lt || !/[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(lt) || KESZ.has(lt) || NINCS.has(lt)) return s;
    if (KESZ.size + NINCS.size > 50000) keszAlap();
    var f = tiszta(lt.replace(/\s+/g, ' '), 0);
    if (f === null) { NINCS.add(lt); return s; }
    KESZ.add(f);
    return s.replace(lt, f);
  }

  /* ---------- a DOM fordítása ---------- */
  var ATTR = ['title', 'aria-label', 'placeholder', 'alt'];
  function kihagy(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (e.hasAttribute('data-nofordit')) return true;
      var tn = e.tagName;
      if (tn === 'SCRIPT' || tn === 'STYLE' || tn === 'TEXTAREA') return true;
      if (e.isContentEditable && e.getAttribute('contenteditable') !== null) return true;
    }
    return false;
  }
  function attrFordit(el) {
    for (var i = 0; i < ATTR.length; i++) {
      var v = el.getAttribute(ATTR[i]);
      if (v) { var f = t(v); if (f !== v) el.setAttribute(ATTR[i], f); }
    }
  }
  function bejar(n) {
    if (n.nodeType === 3) {
      if (n.parentNode && kihagy(n.parentNode)) return;
      var v = n.nodeValue, f = t(v);
      if (f !== v) n.nodeValue = f;
      return;
    }
    if (n.nodeType !== 1 || kihagy(n)) return;
    attrFordit(n);
    if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) { var fv = t(n.value); if (fv !== n.value) n.value = fv; }
    for (var c = n.firstChild; c; c = c.nextSibling) bejar(c);
  }
  function indit() {
    if (kod === 'hu') return;
    document.documentElement.lang = kod;
    if (document.title) document.title = t(document.title);
    bejar(document.documentElement);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'characterData') bejar(m.target);
        else if (m.type === 'attributes') { if (!kihagy(m.target)) attrFordit(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) bejar(m.addedNodes[j]);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
    document.documentElement.classList.remove('nyelv-var');
  }
  if (kod !== 'hu' && global.document) {
    // a lefordítatlan (magyar) szöveg ne villanjon fel
    document.documentElement.classList.add('nyelv-var');
    var st = document.createElement('style'); st.textContent = 'html.nyelv-var body { visibility: hidden; }';
    document.head.appendChild(st);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indit); else setTimeout(indit, 0);
    // a böngésző saját párbeszédablakai
    ['alert', 'confirm', 'prompt'].forEach(function (nev) {
      var o = global[nev];
      if (typeof o === 'function') global[nev] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = t(msg); return o.apply(global, a); };
    });
  }

  /** nyelvváltás: a választás megjegyzése és újratöltés ?lang= paraméterrel */
  function valt(uj) {
    if (NYELVEK.indexOf(uj) < 0 || uj === kod) return;
    ir(uj);
    var u = new URL(global.location.href);
    u.searchParams.set('lang', uj);
    global.location.href = u.toString();
  }

  R.Nyelv = { kod: kod, nyelvek: NYELVEK, t: t, szotar: szotar, valt: valt, fordit: bejar,
    kesz: function (s) { return KESZ.has(s); },
    nevek: { hu: 'Magyar', en: 'English' } };
  R.t = t;
})(typeof window !== 'undefined' ? window : globalThis);
