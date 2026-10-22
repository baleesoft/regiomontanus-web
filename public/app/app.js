/*
 * Regiomontanus – webes alkalmazás (1. fázis: alkalmazás-keret).
 * Menüsor, eszköztár, mozaikos munkaasztal, részletes nézet, képletléptető, fájlkezelés.
 * Licenc: AGPL-3.0.
 */
(function () {
  'use strict';
  var R = Regio, K = R.Keplet, T = R.Tablak, S = R.Tarolo;
  var $ = function (id) { return document.getElementById(id); };

  var se = null, beall = S.beallitasok();
  var kepletek = [], aktiv = -1, nezet = 'mozaik', ful = 'planetak', lepNyitva = false, kovId = 1;
  var tesztek = [], betoltve = false;
  var MEZOK = ['Év', 'Hó', 'Nap', 'Óra', 'Perc'];
  var FULEK = [['planetak', 'Planéták', 'Ctrl+B'], ['hazak', 'Házak', 'Ctrl+H'], ['fenyszogek', 'Fényszögek', 'Ctrl+F'],
    ['eletstrat', 'Életstratégia', 'Ctrl+J'], ['enallapotok', 'Énállapotok', 'Ctrl+E'], ['egyeb', 'Egyéb', '']];
  var FAZIS = { 2: '2. fázis', 3: '3. fázis', 4: '4. fázis', 5: 'később' };

  function akt() { return kepletek[aktiv] || null; }
  function vanAkt() { return !!akt(); }

  /* ====================================================================== */
  /* Képletek kezelése                                                       */
  /* ====================================================================== */
  function ujKepletObj(adat, fajl) {
    return { id: kovId++, eredeti: K.masol(adat), adat: K.masol(adat), eltolas: [0, 0, 0, 0, 0], e: null, hiba: null,
      sorszam: 0, fajlnev: fajl ? fajl.nev : '', handle: fajl ? fajl.handle || null : null, valtozott: !fajl, mini: '', idozito: null };
  }
  function hozzaad(adat, fajl, nemAktival) {
    var k = ujKepletObj(adat, fajl);
    kepletek.push(k);
    if (!nemAktival) aktiv = kepletek.length - 1;
    if (fajl) S.legutobbiHozzaad(adat, fajl.nev);
    szamol(k);
    render();
    return k;
  }
  function szamol(k) {
    if (!se) return;
    var sz = ++k.sorszam;
    K.szamol(se, k.adat, { hsys: beall.hsys, sid: beall.sid }).then(function (e) {
      if (sz !== k.sorszam) return;
      k.e = e; k.hiba = null; k.mini = miniSvg(k);
      render();
    }, function (h) {
      if (sz !== k.sorszam) return;
      k.e = null; k.hiba = h.message; k.mini = '';
      render();
    });
  }
  function utemezSzamol(k) {
    clearTimeout(k.idozito);
    k.idozito = setTimeout(function () { szamol(k); }, 90);
  }
  function mindSzamol() { kepletek.forEach(szamol); }

  function bezar(i) {
    var k = kepletek[i]; if (!k) return Promise.resolve(false);
    var elott = k.valtozott && k.adat.tipus !== 'aktualis'
      ? kerdez('A(z) „' + R.esc(K.cim(k.adat)) + '” képlet változásai nincsenek elmentve. Mented bezárás előtt?', true)
      : Promise.resolve('nem');
    return elott.then(function (v) {
      if (!v) return false;
      var lep = v === 'igen' ? ment(k, false) : Promise.resolve(true);
      return lep.then(function (ok) {
        if (!ok) return false;
        var j = kepletek.indexOf(k); if (j < 0) return true;
        kepletek.splice(j, 1);
        if (aktiv >= kepletek.length) aktiv = kepletek.length - 1;
        if (!kepletek.length) nezet = 'mozaik';
        render();
        return true;
      });
    });
  }
  function mindBezar() {
    var i = kepletek.length - 1;
    function kov() {
      if (i < 0) return Promise.resolve(true);
      return bezar(i--).then(function (ok) { return ok ? kov() : false; });
    }
    return kov();
  }
  function aktival(i, reszletbe) {
    if (i < 0 || i >= kepletek.length) return;
    aktiv = i;
    if (reszletbe) nezet = 'reszlet';
    render();
  }

  /* ====================================================================== */
  /* Kerék és bélyegkép                                                      */
  /* ====================================================================== */
  function kerekBeall(k) {
    var b = beall.kerek, pl = RegioKerek.ALAP.planets.slice();
    if (b.nodes) pl.push(beall.csomo, beall.csomo === 11 ? 25 : 24);
    if (b.asteroids) pl.push(15, 17, 18, 19, 20);
    return { planets: pl, houseLords: b.houseLords, feral: b.feral, retrograde: b.retrograde, stationary: b.stationary,
      selfMarkers: b.selfMarkers && !(k.e && k.e.hz.kos0), cuspLabels: b.cuspLabels,
      aspectTypes: b.conjLines ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : RegioKerek.ALAP.aspectTypes };
  }
  function kerekRajzol(hova, k) {
    if (k.e) {
      var svg = RegioKerek.rajzol(hova, T.kerekAdat(k.e), kerekBeall(k));
      svg.setAttribute('aria-label', 'Képletkerék: ' + K.cim(k.adat));
      return svg;
    }
    hova.innerHTML = k.hiba ? '<div class="hiba">Hiba: ' + R.esc(k.hiba) + '</div>' : '<div class="betolt">számítás…</div>';
    return null;
  }
  function miniSvg(k) {
    if (!k.e) return '';
    var d = document.createElement('div');
    RegioKerek.rajzol(d, T.kerekAdat(k.e), { houseLords: false, cuspLabels: false, selfMarkers: false, feral: false,
      aspectSymbols: [] });
    var s = d.firstChild; s.removeAttribute('style'); s.setAttribute('aria-hidden', 'true'); s.removeAttribute('role');
    Array.prototype.forEach.call(s.querySelectorAll('title'), function (t) { t.parentNode.removeChild(t); });
    return s.outerHTML;
  }

  /* ====================================================================== */
  /* Kiírás                                                                  */
  /* ====================================================================== */
  function lepettE(k) { return k.eltolas.some(function (x) { return x !== 0; }); }
  function idoStr(a) {
    return R.datumStr(a.ev, a.ho, a.nap) + (a.ismeretlen ? ' (idő ismeretlen)' : ' ' + R.pad(a.ora) + ':' + R.pad(a.perc));
  }
  function datumSor(k) {
    var a = k.adat;
    return idoStr(a) + (K.helyNev(a) ? ' · ' + K.helyNev(a) : '');
  }
  function infoSor(k) {
    if (k.hiba) return '<span class="figy">' + R.esc(k.hiba) + '</span>';
    if (!k.e) return 'számítás…';
    if (!k.e.elemzes) return '<span class="figy">Képlet-elemzés nem érhető el</span>';
    var es = k.e.elemzes.lifeStrategy;
    var s = es.walked.length ? 'Életstratégia: ' + es.walked.map(function (j) { return R.JEGYEK[j] + ' / ' + R.HAZNEV[j + 1] + ' Ház'; }).join(', ') : '';
    if (k.adat.tipus === 'aktualis') s = (beall.aktualisFrissit ? 'automatikus frissítés: 3 perc' : 'frissítés kikapcsolva');
    return R.esc(s);
  }
  function tipusCimke(k) {
    return '<span class="tipus">' + R.esc(K.tipusNev(k.adat)) + '</span>' + (lepettE(k) ? ' <span class="tipus lep" title="Léptetett időpont">léptetve</span>' : '');
  }

  function render() {
    renderCim(); renderEszkoztar(); renderLista(); renderLepteto(); renderAsztal(); renderStatusz();
    munkamenetMent();
  }
  function renderCim() {
    var k = akt();
    $('cimNev').textContent = k ? '– ' + K.cim(k.adat) + (k.valtozott && k.adat.tipus !== 'aktualis' ? ' *' : '') : '';
    document.title = k ? K.cim(k.adat) + ' – Regiomontanus' : 'Regiomontanus';
    $('db').textContent = kepletek.length;
    Array.prototype.forEach.call($('racs').querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(+b.getAttribute('data-r') === beall.elrendezes && nezet === 'mozaik'));
    });
  }
  function renderStatusz() {
    var k = akt();
    if (!k) { $('st1').textContent = kepletek.length ? '' : 'Nincs megnyitott képlet'; $('st2').textContent = ''; $('st3').textContent = ''; return; }
    var a = k.adat;
    $('st1').textContent = K.cim(a) + ' ' + idoStr(a) + (K.helyNev(a) ? ' ' + K.helyNev(a) : '');
    $('st2').textContent = K.tipusNev(a);
    var r = [];
    if (a.tipus !== 'aktualis') { var ek = K.eletkor(a); if (ek >= 0 && ek < 150) r.push(ek + ' é'); }
    if (k.e) r.push(k.e.hz.kos0 ? 'Kos 0° házak' : R.HAZRENDSZER[beall.hsys] + (beall.sid ? ', sziderikus' : ''));
    if (lepettE(k)) r.push('léptetve: ' + eltolasStr(k.eltolas));
    if (k.e && k.e.figyelmeztetes.length) r.push(k.e.figyelmeztetes.join(' '));
    $('st3').textContent = r.join(' · ');
  }
  function eltolasStr(e) {
    var n = ['év', 'hó', 'nap', 'óra', 'perc'];
    return e.map(function (x, i) { return x ? (x > 0 ? '+' : '') + x + ' ' + n[i] : ''; }).filter(Boolean).join(', ');
  }

  /* ---------- munkaasztal ---------- */
  function renderAsztal() {
    var hova = $('asztal');
    if (!kepletek.length) { renderUdv(hova); return; }
    if (nezet === 'reszlet' && akt()) { renderReszlet(hova); return; }
    nezet = 'mozaik';
    var r = beall.elrendezes;
    var l = r === 1 ? [aktiv] : kepletek.map(function (k, i) { return i; });
    hova.innerHTML = '<main class="mozaik r' + r + '" aria-label="Munkaasztal">' + l.map(function (i) {
      var k = kepletek[i];
      return '<section class="csempe' + (i === aktiv ? ' aktiv' : '') + '" data-i="' + i + '" aria-label="' + R.esc(K.cim(k.adat)) + '">' +
        '<div class="fej"><b>' + R.esc(K.cim(k.adat)) + (k.valtozott && k.adat.tipus !== 'aktualis' ? ' *' : '') + '</b> ' + tipusCimke(k) +
        '<span class="tolt"></span>' +
        '<button type="button" class="kisgomb" data-tett="nagyit" aria-label="Kinagyítás" title="Kinagyítás (dupla kattintás)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>' +
        '<button type="button" class="kisgomb" data-tett="bezar" aria-label="Bezárás" title="Bezárás (Alt+W)"><svg viewBox="0 0 24 24" aria-hidden="true" style="stroke:#6b665d"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '</div><div class="kerek"></div><div class="lab"><span>' + R.esc(datumSor(k)) + '</span><span>' + infoSor(k) + '</span></div></section>';
    }).join('') + '</main>';
    Array.prototype.forEach.call(hova.querySelectorAll('.csempe'), function (s) {
      kerekRajzol(s.querySelector('.kerek'), kepletek[+s.getAttribute('data-i')]);
    });
  }
  function renderUdv(hova) {
    var l = S.legutobbi();
    hova.innerHTML = '<div class="udv"><h1>Regiomontanus</h1>' +
      '<p>' + (betoltve ? 'Nyiss meg egy .szk képletfájlt (vagy húzd ide), vagy készíts új képletet.' : 'A számítómotor betöltése folyamatban…') + '</p>' +
      '<div class="gombok"><button type="button" class="gomb fo" data-tett="uj">Új képlet (Alt+N)</button>' +
      '<button type="button" class="gomb" data-tett="megnyit">Megnyitás (Ctrl+O)</button>' +
      '<button type="button" class="gomb" data-tett="aktualis">Aktuális égi állás</button></div>' +
      (l.length ? '<h2>Legutóbbi képletek</h2><ul>' + l.map(function (x, i) {
        return '<li><button type="button" data-legutobbi="' + i + '">' + R.esc(K.cim(x.adat)) + '<small>' + R.esc(idoStr(x.adat)) +
          (x.fajlnev ? ' · ' + R.esc(x.fajlnev) : '') + '</small></button></li>';
      }).join('') + '</ul>' : '') + '</div>';
  }
  function renderReszlet(hova) {
    var k = akt();
    hova.innerHTML = '<nav class="belyegek" aria-label="Megnyitott képletek">' + kepletek.map(function (x, i) {
      return '<button type="button" data-valt="' + i + '" aria-current="' + (i === aktiv) + '"><span class="mini">' + x.mini + '</span>' +
        '<span class="ln"><b>' + R.esc(K.cim(x.adat)) + '</b><small>' + R.esc(K.tipusNev(x.adat)) + '</small></span></button>';
    }).join('') + '</nav>' +
      '<main class="reszlet" aria-label="Részletes nézet" style="--kerek-arany:' + (aranyKorlat(beall.reszletArany) * 100).toFixed(1) + '%"><section class="fo-kerek"><div class="fej"><b>' + R.esc(K.cim(k.adat)) + '</b> ' +
      tipusCimke(k) + '<span class="tolt"></span><button type="button" class="gomb fo" data-tett="vissza">Vissza a mozaikhoz (Esc)</button></div>' +
      '<div class="kerek"></div></section>' +
      '<div class="elvalaszto" role="separator" tabindex="0" aria-orientation="vertical" aria-controls="tablaTart" ' +
      'aria-label="A kerék és a táblák szélességének állítása" aria-valuemin="30" aria-valuemax="80" aria-valuenow="' +
      Math.round(aranyKorlat(beall.reszletArany) * 100) + '" title="Húzd oldalra (vagy ←/→); dupla kattintás: alapméret"></div>' +
      '<aside class="tablak" aria-label="Táblák"><div class="fulek" role="tablist">' + FULEK.map(function (f) {
        return '<button type="button" role="tab" data-ful="' + f[0] + '" aria-selected="' + (ful === f[0]) + '"' +
          (f[2] ? ' title="' + f[2] + '"' : '') + '>' + f[1] + '</button>';
      }).join('') + '</div><div class="tabla-tart" role="tabpanel" id="tablaTart"></div></aside></main>';
    kerekRajzol(hova.querySelector('.fo-kerek .kerek'), k);
    renderTabla($('tablaTart'), k);
  }
  /* ---------- elválasztó a részletes nézetben ---------- */
  function aranyKorlat(x) { x = +x; return isFinite(x) ? Math.min(0.8, Math.max(0.3, x)) : 0.58; }
  function aranyBeallit(x, ment) {
    x = aranyKorlat(x);
    var m = document.querySelector('.reszlet'), e = document.querySelector('.elvalaszto');
    if (m) m.style.setProperty('--kerek-arany', (x * 100).toFixed(1) + '%');
    if (e) e.setAttribute('aria-valuenow', String(Math.round(x * 100)));
    beall.reszletArany = x;
    if (ment) beallMent();
  }
  function elvalasztoInit() {
    var huz = null;
    $('asztal').addEventListener('pointerdown', function (e) {
      var el = e.target.closest('.elvalaszto'); if (!el || e.button !== 0) return;
      var m = el.parentNode, r = m.getBoundingClientRect(), cs = getComputedStyle(m);
      huz = { el: el, bal: r.left + parseFloat(cs.paddingLeft), szel: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - el.offsetWidth };
      el.setPointerCapture(e.pointerId); el.classList.add('huz'); document.body.classList.add('huzas');
      e.preventDefault();
    });
    $('asztal').addEventListener('pointermove', function (e) {
      if (!huz) return;
      aranyBeallit((e.clientX - huz.bal - huz.el.offsetWidth / 2) / huz.szel, false);
    });
    function vege() {
      if (!huz) return;
      huz.el.classList.remove('huz'); document.body.classList.remove('huzas'); huz = null;
      beallMent();
    }
    $('asztal').addEventListener('pointerup', vege);
    $('asztal').addEventListener('pointercancel', vege);
    $('asztal').addEventListener('dblclick', function (e) { if (e.target.closest('.elvalaszto')) aranyBeallit(0.58, true); });
    $('asztal').addEventListener('keydown', function (e) {
      if (!e.target.classList || !e.target.classList.contains('elvalaszto')) return;
      var d = { ArrowLeft: -0.02, ArrowRight: 0.02 }[e.key];
      if (d) { e.preventDefault(); aranyBeallit(beall.reszletArany + d, true); }
      else if (e.key === 'Home') { e.preventDefault(); aranyBeallit(0.3, true); }
      else if (e.key === 'End') { e.preventDefault(); aranyBeallit(0.8, true); }
    });
  }

  function renderTabla(hova, k) {
    if (!k.e) { hova.innerHTML = k.hiba ? '<p class="hiba">' + R.esc(k.hiba) + '</p>' : '<p class="betolt">számítás…</p>'; return; }
    if (ful === 'fenyszogek') { T.fenyszogek(hova, k.e, beall); return; }
    hova.innerHTML = ful === 'hazak' ? T.hazak(k.e) : ful === 'eletstrat' ? T.eletstrat(k.e) : ful === 'enallapotok' ? T.enallapotok(k.e)
      : ful === 'egyeb' ? T.egyeb(k.e) : T.planetak(k.e, beall);
  }

  /* ---------- megnyitott képletek lenyíló ---------- */
  function renderLista() {
    var l = $('lista');
    if (l.hidden) return;
    l.innerHTML = (kepletek.length ? kepletek.map(function (k, i) {
      return '<button type="button" role="menuitem" data-valt="' + i + '" aria-current="' + (i === aktiv) + '"><span class="mini">' + k.mini + '</span>' +
        '<span class="ln"><b>' + R.esc(K.cim(k.adat)) + '</b><small>' + R.esc(K.tipusNev(k.adat)) + ' · ' + R.esc(datumSor(k)) + '</small></span></button>';
    }).join('') : '<div class="ures">Nincs megnyitott képlet.</div>') +
      '<div class="lab">Váltás billentyűzetről: Alt+1 … Alt+9</div>';
  }
  function listaValt(nyit) {
    var l = $('lista');
    l.hidden = nyit === undefined ? !l.hidden : !nyit;
    $('listaGomb').setAttribute('aria-expanded', String(!l.hidden));
    renderLista();
    if (!l.hidden) { var b = l.querySelector('[aria-current="true"]') || l.querySelector('button'); if (b) b.focus(); }
  }

  /* ---------- léptető ---------- */
  function renderLepteto() {
    var l = $('lepteto'), k = akt();
    l.hidden = !lepNyitva;
    if (!lepNyitva) return;
    if (!$('lepMezok').firstChild) {
      $('lepMezok').innerHTML = MEZOK.map(function (n, i) {
        return '<span class="mezo"><button type="button" data-lep="' + i + '" data-ir="-1" aria-label="' + n + ' mínusz">−</button><span>' + n +
          '</span><button type="button" data-lep="' + i + '" data-ir="1" aria-label="' + n + ' plusz">+</button></span>';
      }).join('');
    }
    $('lepNev').textContent = k ? K.cim(k.adat) : 'nincs aktív képlet';
    $('lepIdo').textContent = k ? R.datumStr(k.adat.ev, k.adat.ho, k.adat.nap, k.adat.ora, k.adat.perc) : '–';
    $('lepElt').textContent = k && lepettE(k) ? '(' + eltolasStr(k.eltolas) + ')' : '';
    Array.prototype.forEach.call(l.querySelectorAll('button[data-lep], #lepEredeti'), function (b) { b.disabled = !k; });
  }
  function lep(i, ir) {
    var k = akt(); if (!k) return;
    var m = Math.max(1, Math.min(999, Math.floor(+$('lepMertek').value) || 1));
    k.eltolas[i] += ir * m;
    k.adat = K.leptet(k.eredeti, k.eltolas);
    if (k.adat.ismeretlen && (i >= 3)) { k.adat.ismeretlen = false; k.adat.tipus = 'kos0'; }
    if (k.adat.ev < 1 || k.adat.ev > 2999) { k.eltolas[i] -= ir * m; k.adat = K.leptet(k.eredeti, k.eltolas); uzen('Az év 1 és 2999 között lehet.'); }
    k.valtozott = lepettE(k) || k.valtozott;
    utemezSzamol(k);
    renderLepteto(); renderStatusz(); renderCim();
  }
  function lepEredeti() {
    var k = akt(); if (!k || !lepettE(k)) return;
    k.eltolas = [0, 0, 0, 0, 0]; k.adat = K.masol(k.eredeti);
    szamol(k); render();
  }

  /* ====================================================================== */
  /* Menü és eszköztár                                                       */
  /* ====================================================================== */
  function link(url) { return function () { window.open(url, '_blank', 'noopener'); }; }
  var TETT = {
    uj: ujKeplet, adatok: adatokSzerk, megnyit: megnyit,
    ment: function () { var k = akt(); if (k) ment(k, false); }, mentMaskent: function () { var k = akt(); if (k) ment(k, true); },
    bezar: function () { if (vanAkt()) bezar(aktiv); }, mindBezar: mindBezar,
    kep: kepMent, nyomtat: nyomtat,
    planetak: function () { tablaMutat('planetak'); }, hazak: function () { tablaMutat('hazak'); },
    fenyszogek: function () { tablaMutat('fenyszogek'); }, eletstrat: function () { tablaMutat('eletstrat'); },
    enallapotok: function () { tablaMutat('enallapotok'); }, egyeb: function () { tablaMutat('egyeb'); },
    lepteto: function () { lepNyitva = !lepNyitva; render(); if (lepNyitva) { var b = document.querySelector('#lepteto button[data-lep]'); if (b) b.focus(); } },
    kos0: kos0Keplet, aktualis: aktualisKeplet,
    enJel: function () { beall.kerek.selfMarkers = !beall.kerek.selfMarkers; beallMent(); render(); },
    aszteroidak: function () { beall.kerek.asteroids = !beall.kerek.asteroids; beallMent(); render(); },
    megjelenites: megjelenitesDlg, egyebek: egyebekDlg, gyari: gyariBeall,
    beallLetolt: beallLetolt, beallBetolt: beallBetolt,
    nevjegy: function () { $('nvSwe').textContent = se ? 'Swiss Ephemeris ' + se.version() + ' (WebAssembly)' : ''; $('dlgNevjegy').showModal(); },
    segitseg: link('https://www.regiomontanus.hu/'), facebook: link('https://www.facebook.com/regiomontanus.astrology'),
    iskola: link('https://humanisztikus.hu/'),
    vissza: function () { nezet = 'mozaik'; render(); }, nagyit: function () { if (vanAkt()) { nezet = 'reszlet'; render(); } }
  };
  ['P', 'R', 'C', 'K', 'O', 'A'].forEach(function (h) {
    TETT['hsys' + h] = function () { if (beall.hsys !== h) { beall.hsys = h; beallMent(); mindSzamol(); render(); } };
  });
  TETT.zodT = function () { if (beall.sid) { beall.sid = false; beallMent(); mindSzamol(); render(); } };
  TETT.zodS = function () { if (!beall.sid) { beall.sid = true; beallMent(); mindSzamol(); render(); } };

  var KELL_AKT = { adatok: 1, ment: 1, mentMaskent: 1, bezar: 1, kep: 1, nyomtat: 1, planetak: 1, hazak: 1, fenyszogek: 1,
    eletstrat: 1, enallapotok: 1, egyeb: 1, kos0: 1, nagyit: 1 };
  function engedelyezett(t) { return !!TETT[t] && (!KELL_AKT[t] || vanAkt()) && (betoltve || ['nevjegy', 'segitseg', 'facebook', 'iskola', 'megjelenites', 'egyebek', 'gyari'].indexOf(t) >= 0 || t.indexOf('hsys') === 0 || t.indexOf('zod') === 0); }
  function vegrehajt(t) { if (engedelyezett(t)) TETT[t](); }

  function legutobbiMenu() {
    var l = S.legutobbi();
    if (!l.length) return [{ c: '(üres)', t: '' }];
    return l.map(function (x, i) {
      return { c: K.cim(x.adat) + ' – ' + idoStr(x.adat), fn: function () { legutobbiNyit(i); } };
    }).concat(['-', { c: 'Lista törlése', fn: function () { S.legutobbiTorol(); render(); } }]);
  }
  function tesztMenu() {
    return tesztek.map(function (t) { return { c: t.cim, fn: function () { tesztNyit(t); } }; });
  }

  var MENU = [
    { c: 'Fájl', l: [
      { c: 'Új képlet', b: 'Alt+N', t: 'uj' }, { c: 'Az aktuális képlet adatai', b: 'Ctrl+A', t: 'adatok' }, '-',
      { c: 'Megnyitás', b: 'Ctrl+O', t: 'megnyit' }, { c: 'Megnyitás könyvtárból...', f: 4 }, { c: 'Megnyitás névre kereséssel', f: 4 },
      { c: 'Legutóbbi képletek', al: legutobbiMenu }, { c: 'Teszt-képletek', al: tesztMenu, lathato: function () { return tesztek.length > 0; } }, '-',
      { c: 'Mentés', b: 'Ctrl+S', t: 'ment' }, { c: 'Mentés másként', t: 'mentMaskent' }, { c: 'Bezár', b: 'Alt+W', t: 'bezar' },
      { c: 'Mind bezár', t: 'mindBezar' }, '-',
      { c: 'Horoszkóp mentése képként', t: 'kep' }, { c: 'Nyomtatás', b: 'Ctrl+P', t: 'nyomtat' }] },
    { c: 'Táblázatok', l: [
      { c: 'Planéták', b: 'Ctrl+B', t: 'planetak' }, { c: 'Házak', b: 'Ctrl+H', t: 'hazak' }, { c: 'Fényszögek', b: 'Ctrl+F', t: 'fenyszogek' },
      { c: 'Életstratégia, járatlan út', b: 'Ctrl+J', t: 'eletstrat' }, { c: 'Énállapotok', b: 'Ctrl+E', t: 'enallapotok' }, '-',
      { c: 'Állócsillagok', f: 2 }, '-', { c: 'Egyéb információk', t: 'egyeb' }] },
    { c: 'Speciális', l: [
      { c: 'Képletléptető', b: 'Ctrl+L', t: 'lepteto', pipa: function () { return lepNyitva; } }, { c: 'Progresszióléptető', f: 2 }, '-',
      { c: 'Planéta az Ascendensen', f: 3 }, { c: 'Kos 0° képlet', t: 'kos0' }, '-',
      { c: 'Horoszkópolvasó aktiválása', f: 3 }, '-', { c: 'Aktuális égi állások', t: 'aktualis' }, '-', { c: 'Keresés', f: 4 }] },
    { c: 'Progressziók', l: [
      { c: 'Primer direkciók', f: 2 }, { c: 'Progressziós Hold', f: 2 }, { c: 'Tranzitok', f: 2 }, '-',
      { c: 'Szolár-képlet', f: 2 }, '-', { c: 'Revolúciók...', f: 2 }] },
    { c: 'Összevetés', l: [{ c: 'Összevetés (Szinasztria)', f: 3 }, { c: 'Képletek megjelenítése...', f: 3 }] },
    { c: 'Beállítások', l: [
      { c: 'Megjelenítés', t: 'megjelenites' }, { c: 'Egyebek', t: 'egyebek' }, { c: 'Fényszög orbisok', f: 4 }, { c: 'Színek és szimbólumok', f: 4 },
      { c: 'Házrendszer', al: function () {
        return ['P', 'R', 'C', 'K', 'O', 'A'].map(function (h) { return { c: R.HAZRENDSZER[h], t: 'hsys' + h, radio: true, pipa: function () { return beall.hsys === h; } }; });
      } },
      { c: 'Zodiákus', al: function () {
        return [{ c: 'Sziderikus', t: 'zodS', radio: true, pipa: function () { return beall.sid; } },
          { c: 'Tropikus', t: 'zodT', radio: true, pipa: function () { return !beall.sid; } }];
      } },
      { c: 'Primer direkció iránya', f: 2 }, '-', { c: 'Születési képletek importálása', f: 4 }, '-',
      { c: 'Település adatok szerkesztése', f: 5 }, '-',
      { c: 'Betöltés fájlból', t: 'beallBetolt' }, { c: 'Mentés fájlba', t: 'beallLetolt' }, '-',
      { c: 'Alapértelmezések visszatöltése', t: 'gyari' }] },
    { c: 'Információk', l: [
      { c: 'Segítség a program használatához', t: 'segitseg' }, { c: 'Tippek és trükkök', f: 4 }, '-',
      { c: 'Regiomontanus a Facebookon', t: 'facebook' }, { c: 'Humanisztikus Asztrológia Iskola', t: 'iskola' }, '-',
      { c: 'Névjegy', t: 'nevjegy' }] },
    { c: 'Kiegészítések', l: [{ c: 'Jegyek és játszmák', f: 5 }, { c: 'Születési értesítő', f: 5 }] }
  ];

  /* Eszköztár – a Windows-os ikonsor sorrendjében. [cím, ikon, tett | fázis, lenyomva?] */
  var ESZKOZ = [
    ['Új képlet (Alt+N)', 'M6 3h8l4 4v14H6zM12 11v6M9 14h6', 'uj'],
    ['Az aktuális képlet adatai (Ctrl+A)', 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5', 'adatok'], 0,
    ['Megnyitás (Ctrl+O)', 'M3 7h6l2 2h10v10H3z', 'megnyit'],
    ['Mentés (Ctrl+S)', 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', 'ment'],
    ['Mind bezár', 'M4 7h12v13H4zM8 4h12v12M7 11l6 6M13 11l-6 6', 'mindBezar'], 0,
    ['Horoszkóp mentése képként', 'M3 6h18v13H3zM6 16l4-4 3 3 3-3 3 3', 'kep'],
    ['Nyomtatás (Ctrl+P)', 'M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z', 'nyomtat'], 0,
    ['Planéták (Ctrl+B)', 'M4 5h16v14H4zM4 10h16M10 5v14', 'planetak'],
    ['Házak (Ctrl+H)', 'M12 3v18M3 12h18M6 6l12 12M18 6L6 18', 'hazak'],
    ['Fényszögek (Ctrl+F)', 'M4 20h16M4 20V4M4 14h6v6M4 8h12v12', 'fenyszogek'],
    ['Életstratégia, járatlan út (Ctrl+J)', 'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16', 'eletstrat'],
    ['Énjelölők a keréken – be/ki', 'M12 4l8 14H4z', 'enJel', function () { return beall.kerek.selfMarkers; }],
    ['Személyes adatok – be/ki', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6', 4],
    ['Állócsillagok – be/ki', 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.6l-5.3 2.8 1.2-6-4.5-4.1 6-.7z', 2],
    ['Chiron és a kisbolygók – be/ki', 'M7 5a2 2 0 1 0 .01 0M16 7a3 3 0 1 0 .01 0M10 15a2.5 2.5 0 1 0 .01 0', 'aszteroidak', function () { return beall.kerek.asteroids; }], 0,
    ['Aktuális égi állás', 'M12 8a4 4 0 1 0 .01 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2', 'aktualis'],
    ['Planéta az Ascendensen (perspektíva)', 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 .01 0', 3],
    ['Kos 0° képlet', 'M12 21V10a5 5 0 0 0-9-3M12 10a5 5 0 0 1 9-3', 'kos0'], 0,
    ['Összevetés (szinasztria)', 'M9 6a6 6 0 1 0 .01 0M15 6a6 6 0 1 0 .01 0', 3], 0,
    ['Primer direkciók', 'M4 12h14M13 6l6 6-6 6', 2],
    ['Progressziós Hold', 'M15 3a9 9 0 1 0 6 15A7 7 0 0 1 15 3z', 2],
    ['Tranzitok', 'M12 3a9 9 0 1 0 .01 0M3 12h18', 2], 0,
    ['Szolár-képlet', 'M12 7a5 5 0 1 0 .01 0M12 11.5v1', 2], 0,
    ['Revolúciók…', 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5', 2], 0,
    ['Képletléptető (Ctrl+L)', 'M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4', 'lepteto', function () { return lepNyitva; }],
    ['Progresszióléptető', 'M4 18l6-6-6-6M12 18l6-6-6-6', 2], 0,
    ['Segítség a program használatához', 'M12 3a9 9 0 1 0 .01 0M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 17h.01', 'segitseg'], 0,
    ['Humanisztikus Asztrológia Iskola', 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5', 'iskola'], 0,
    ['Jegyek és játszmák', 'M4 7h10v14H4zM10 3h10v14', 5],
    ['Születési értesítő', 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z', 5], 0,
    ['Horoszkópolvasó – be/ki', 'M4 5h16v11H9l-5 4z', 3], 0,
    ['Keresés a képletek közt', 'M10 4a6 6 0 1 0 .01 0M15 15l6 6', 4],
    ['Megnyitás névre kereséssel', 'M4 6h10M4 12h7M4 18h7M17 11a3 3 0 1 0 .01 0M19.5 15.5L22 18', 4]
  ];
  function eszkoztarEpit() {
    $('ikonok').innerHTML = ESZKOZ.map(function (e, i) {
      if (e === 0) return '<span class="sep" aria-hidden="true"></span>';
      var fz = typeof e[2] === 'number', cim = e[0] + (fz ? ' – ' + FAZIS[e[2]] : '');
      return '<button type="button" class="ikon" data-eszk="' + i + '" aria-label="' + R.esc(cim) + '" title="' + R.esc(cim) + '"' +
        (e[3] ? ' aria-pressed="false"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + e[1] + '"/></svg></button>';
    }).join('');
  }
  function renderEszkoztar() {
    Array.prototype.forEach.call($('ikonok').querySelectorAll('button'), function (b) {
      var e = ESZKOZ[+b.getAttribute('data-eszk')];
      b.disabled = typeof e[2] === 'number' || !engedelyezett(e[2]);
      if (e[3]) b.setAttribute('aria-pressed', String(!!e[3]()));
    });
  }

  /* ---------- legördülő menük ---------- */
  var nyitottMenu = null;
  function menuEpit() {
    $('menusor').innerHTML = MENU.map(function (m, i) {
      return '<div class="mf" data-m="' + i + '"><button type="button" aria-haspopup="true" aria-expanded="false">' + m.c + '</button></div>';
    }).join('');
  }
  function menuLista(l) {
    var ul = document.createElement('ul');
    ul.className = 'menu'; ul.setAttribute('role', 'menu');
    l.forEach(function (x) {
      var li = document.createElement('li');
      if (x === '-') { li.className = 'sep'; li.setAttribute('role', 'separator'); ul.appendChild(li); return; }
      if (x.lathato && !x.lathato()) return;
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', x.radio ? 'menuitemradio' : x.pipa ? 'menuitemcheckbox' : 'menuitem');
      var pipa = x.pipa ? x.pipa() : false;
      if (x.pipa) b.setAttribute('aria-checked', String(pipa));
      b.innerHTML = '<span class="pipa" aria-hidden="true">' + (pipa ? (x.radio ? '•' : '✓') : '') + '</span><span>' + R.esc(x.c) + '</span>' +
        (x.b ? '<span class="bill">' + x.b + '</span>' : '') + (x.al ? '<span class="nyil" aria-hidden="true">▸</span>' : '') +
        (x.f ? '<span class="fazis">' + FAZIS[x.f] + '</span>' : '');
      if (x.f || (x.t !== undefined && !x.fn && !x.al && (!x.t || !engedelyezett(x.t)))) b.disabled = true;
      if (x.al) {
        b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
        b.addEventListener('click', function (ev) { ev.stopPropagation(); alMenuNyit(li, x); });
        b.addEventListener('mouseenter', function () { alMenuNyit(li, x); });
      } else {
        b.addEventListener('mouseenter', function () { alMenuZar(ul); });
        b.addEventListener('click', function () {
          menuZar();
          if (x.fn) x.fn(); else if (x.t) vegrehajt(x.t);
        });
      }
      li.appendChild(b); ul.appendChild(li);
    });
    ul.addEventListener('keydown', menuBill);
    return ul;
  }
  function alMenuZar(ul) {
    Array.prototype.forEach.call(ul.querySelectorAll(':scope > li.nyitva'), function (li) {
      li.classList.remove('nyitva'); var s = li.querySelector('.menu'); if (s) li.removeChild(s);
      li.firstChild.setAttribute('aria-expanded', 'false');
    });
  }
  function alMenuNyit(li, x, fokusz) {
    if (li.classList.contains('nyitva')) { if (fokusz) { var f = li.querySelector('.menu button:not(:disabled)'); if (f) f.focus(); } return; }
    alMenuZar(li.parentNode);
    var s = menuLista(x.al());
    li.appendChild(s); li.classList.add('nyitva'); li.firstChild.setAttribute('aria-expanded', 'true');
    if (fokusz) { var b = s.querySelector('button:not(:disabled)'); if (b) b.focus(); }
  }
  function menuNyit(i, fokusz) {
    menuZar();
    var mf = $('menusor').querySelector('[data-m="' + i + '"]');
    var ul = menuLista(MENU[i].l);
    mf.appendChild(ul); mf.classList.add('nyitva'); mf.firstChild.setAttribute('aria-expanded', 'true');
    nyitottMenu = i;
    if (fokusz) { var b = ul.querySelector('button:not(:disabled)') || ul.querySelector('button'); if (b) b.focus(); }
  }
  function menuZar() {
    if (nyitottMenu === null) return;
    var mf = $('menusor').querySelector('[data-m="' + nyitottMenu + '"]');
    var ul = mf.querySelector('.menu'); if (ul) mf.removeChild(ul);
    mf.classList.remove('nyitva'); mf.firstChild.setAttribute('aria-expanded', 'false');
    nyitottMenu = null;
  }
  function menuBill(e) {
    var ul = e.currentTarget, gombok = Array.prototype.filter.call(ul.querySelectorAll(':scope > li > button'), function (b) { return !b.disabled; });
    var i = gombok.indexOf(document.activeElement);
    if (i < 0 && !ul.contains(document.activeElement)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (!gombok.length) return;
      i = e.key === 'ArrowDown' ? (i + 1) % gombok.length : (i - 1 + gombok.length) % gombok.length;
      gombok[i].focus();
    } else if (e.key === 'ArrowRight') {
      if (i >= 0 && gombok[i].getAttribute('aria-haspopup')) { e.preventDefault(); e.stopPropagation(); gombok[i].click(); var s = gombok[i].parentNode.querySelector('.menu button:not(:disabled)'); if (s) s.focus(); }
      else if (!ul.parentNode.closest('.menu')) { e.preventDefault(); e.stopPropagation(); menuNyit((nyitottMenu + 1) % MENU.length, true); }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); e.stopPropagation();
      var szulo = ul.parentNode;
      if (szulo.closest('.menu')) { var gb = szulo.firstChild; alMenuZar(szulo.parentNode); gb.focus(); }
      else menuNyit((nyitottMenu - 1 + MENU.length) % MENU.length, true);
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      var sz = ul.parentNode;
      if (sz.closest('.menu')) { var g = sz.firstChild; alMenuZar(sz.parentNode); g.focus(); }
      else { var m = nyitottMenu; menuZar(); $('menusor').querySelector('[data-m="' + m + '"] > button').focus(); }
    } else if (e.key === 'Tab') { menuZar(); }
  }

  /* ====================================================================== */
  /* Műveletek                                                               */
  /* ====================================================================== */
  function alapAdat() {
    var a = K.ures(), h = beall.alapHely;
    a.telepules = h.telepules; a.telepulesKijelzes = h.telepulesKijelzes || ''; a.orszag = h.orszag; a.orszagKod = h.orszagKod; a.lat = h.lat; a.lon = h.lon; a.tz = h.tz;
    a.zonaMod = h.tz ? 'iana' : 'lmt';
    var n = new Date(); a.ev = n.getFullYear(); a.ho = n.getMonth() + 1; a.nap = n.getDate(); a.ora = n.getHours(); a.perc = n.getMinutes(); a.mp = 0;
    return a;
  }
  function ujKeplet() {
    var a = alapAdat(); a.nev = '';
    R.Adatlap.megnyit(a, 'Új születési képlet').then(function (u) { if (u) hozzaad(u, null); });
  }
  function adatokSzerk() {
    var k = akt(); if (!k) return;
    R.Adatlap.megnyit(k.adat, 'Születési képlet adatai – ' + K.cim(k.adat)).then(function (u) {
      if (!u) return;
      if (u.tipus === 'aktualis') u.tipus = 'radix'; // szerkesztve már nem frissül automatikusan
      k.eredeti = u; k.adat = K.masol(u); k.eltolas = [0, 0, 0, 0, 0]; k.valtozott = true;
      szamol(k); render();
    });
  }
  function kos0Keplet() {
    var k = akt(); if (!k) return;
    var a = K.masol(k.adat);
    a.tipus = 'kos0'; a.nev = K.cim(a); delete a.eredeti;
    hozzaad(a, null).valtozott = false;
    render();
  }
  function aktualisAdat() {
    var a = alapAdat(); a.nev = 'Aktuális égi állás'; a.tipus = 'aktualis';
    if (a.zonaMod === 'iana') {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: a.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = +x.value; });
      a.ev = p.year; a.ho = p.month; a.nap = p.day; a.ora = p.hour; a.perc = p.minute; a.mp = p.second;
    }
    return a;
  }
  function aktualisKeplet() { hozzaad(aktualisAdat(), null).valtozott = false; render(); }
  function aktualisFrissit() {
    if (!beall.aktualisFrissit) return;
    kepletek.forEach(function (k) {
      if (k.adat.tipus !== 'aktualis' || lepettE(k)) return;
      var u = aktualisAdat(); u.telepules = k.adat.telepules; u.telepulesKijelzes = k.adat.telepulesKijelzes || ''; u.orszag = k.adat.orszag; u.orszagKod = k.adat.orszagKod;
      u.lat = k.adat.lat; u.lon = k.adat.lon; u.tz = k.adat.tz; u.zonaMod = k.adat.zonaMod; u.eltolas = k.adat.eltolas;
      if (u.zonaMod !== 'iana') { var d = new Date(Date.now() + K.zona(u).orak * 3600000);
        u.ev = d.getUTCFullYear(); u.ho = d.getUTCMonth() + 1; u.nap = d.getUTCDate(); u.ora = d.getUTCHours(); u.perc = d.getUTCMinutes(); u.mp = d.getUTCSeconds(); }
      k.eredeti = u; k.adat = K.masol(u); szamol(k);
    });
  }
  function tablaMutat(f) {
    if (!vanAkt()) return;
    ful = f; nezet = 'reszlet'; render();
    var t = document.querySelector('.fulek [data-ful="' + f + '"]'); if (t) t.focus();
  }

  /* ---------- fájlok ---------- */
  function fajlbolMegnyit(nev, buf, handle) {
    try {
      var p = RegioSzk.parse(buf);
      if (p.bc) throw new Error('Időszámításunk előtti dátum még nem támogatott.');
      if (p.year < 1 || p.year > 2999) throw new Error('Az év 1 és 2999 között lehet.');
      hozzaad(RegioSzk.toAdat(p), { nev: nev, handle: handle });
      return true;
    } catch (e) { uzen(nev + ': nem nyitható meg – ' + e.message); return false; }
  }
  function megnyit() {
    if (window.showOpenFilePicker) {
      window.showOpenFilePicker({ multiple: true, types: [{ description: 'Regiomontanus képlet', accept: { 'application/octet-stream': ['.szk'] } }] })
        .then(function (hl) {
          return hl.reduce(function (p, h) {
            return p.then(function () { return h.getFile(); }).then(function (f) { return f.arrayBuffer().then(function (b) { fajlbolMegnyit(f.name, b, h); }); });
          }, Promise.resolve());
        }).catch(function (e) { if (e && e.name !== 'AbortError') uzen('Megnyitási hiba: ' + e.message); });
      return;
    }
    $('fajlInput').click();
  }
  function fajlokMegnyit(lista) {
    Array.prototype.reduce.call(lista, function (p, f) {
      return p.then(function () {
        if (!/\.szk$/i.test(f.name)) { uzen(f.name + ': csak .szk képletfájl nyitható meg.'); return; }
        return f.arrayBuffer().then(function (b) { fajlbolMegnyit(f.name, b, null); });
      });
    }, Promise.resolve());
  }
  function fajlnevJavasol(k) {
    if (k.fajlnev) return k.fajlnev;
    return (K.cim(k.adat).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'kepet') + '.szk';
  }
  function letolt(blob, nev) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = nev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function irHandle(h, adat) {
    var elo = h.queryPermission ? h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      return p === 'granted' ? p : h.requestPermission({ mode: 'readwrite' });
    }) : Promise.resolve('granted');
    return elo.then(function (p) {
      if (p !== 'granted') throw new Error('Nincs írási engedély a fájlhoz.');
      return h.createWritable();
    }).then(function (w) { return w.write(adat).then(function () { return w.close(); }); });
  }
  /** Promise<boolean>: sikerült-e menteni */
  function ment(k, maskent) {
    var a = K.masol(k.adat); a.nev = K.cim(a);
    var buf = RegioSzk.build(a, K.zona(a)), nev = fajlnevJavasol(k), p;
    if (!maskent && k.handle && k.handle.createWritable) p = irHandle(k.handle, buf);
    else if (window.showSaveFilePicker) {
      p = window.showSaveFilePicker({ suggestedName: nev, types: [{ description: 'Regiomontanus képlet', accept: { 'application/octet-stream': ['.szk'] } }] })
        .then(function (h) { k.handle = h; k.fajlnev = h.name; return irHandle(h, buf); });
    } else { letolt(new Blob([buf], { type: 'application/octet-stream' }), nev); k.fajlnev = nev; p = Promise.resolve(); }
    return p.then(function () {
      k.valtozott = false; k.eredeti = K.masol(k.adat); k.eltolas = [0, 0, 0, 0, 0];
      S.legutobbiHozzaad(k.adat, k.fajlnev);
      uzen('Mentve: ' + k.fajlnev);
      render();
      return true;
    }, function (e) {
      if (!(e && e.name === 'AbortError')) uzen('Nem sikerült menteni: ' + e.message);
      return false;
    });
  }
  function legutobbiNyit(i) {
    var x = S.legutobbi()[i]; if (!x) return;
    hozzaad(K.masol(x.adat), null);
    var k = akt(); k.fajlnev = x.fajlnev || ''; k.valtozott = false; render();
  }
  function tesztNyit(t) {
    fetch(new URL(t.fajl, new URL('../proba/', location.href)).href, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (b) { fajlbolMegnyit(t.fajl.split('/').pop(), b, null); })
      .catch(function (e) { uzen(t.cim + ': ' + e.message); });
  }

  /* ---------- kép és nyomtatás ---------- */
  var fontCache = null;
  function fontDataUri() {
    if (fontCache) return fontCache;
    var fajlok = [['../fonts/regio-symbols-1.woff2', 'U+260A-260D, U+263D-2653, U+26B3-26BC'], ['../fonts/regio-symbols-2.woff2', 'U+2609, U+25A1, U+25B3']];
    fontCache = Promise.all(fajlok.map(function (f) {
      return fetch(f[0]).then(function (r) { return r.blob(); }).then(function (b) {
        return new Promise(function (res) { var o = new FileReader(); o.onload = function () { res('@font-face{font-family:"Regio Symbols";src:url(' + o.result + ') format("woff2");unicode-range:' + f[1] + ';}'); }; o.readAsDataURL(b); });
      });
    })).then(function (l) { return l.join(''); });
    return fontCache;
  }
  function kepMent() {
    var k = akt(); if (!k || !k.e) { uzen('A képlet még nem készült el.'); return; }
    var d = document.createElement('div'), svg = kerekRajzol(d, k), meret = 1400;
    fontDataUri().then(function (css) {
      var st = document.createElementNS('http://www.w3.org/2000/svg', 'style'); st.textContent = css; svg.insertBefore(st, svg.firstChild);
      svg.setAttribute('width', meret); svg.setAttribute('height', meret); svg.removeAttribute('style');
      var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = meret; c.height = meret;
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, meret, meret);
        setTimeout(function () {
          g.drawImage(img, 0, 0, meret, meret);
          c.toBlob(function (b) { letolt(b, fajlnevJavasol(k).replace(/\.szk$/i, '') + '.png'); }, 'image/png');
        }, 60);
      };
      img.onerror = function () { uzen('A kép nem készíthető el ebben a böngészőben.'); };
      img.src = src;
    }).catch(function (e) { uzen('A kép nem készíthető el: ' + e.message); });
  }
  /* A nyomtatási nézet a beforeprint eseménykor készül, így a böngésző saját Nyomtatás menüjére is működik. */
  function nyomtatasElokeszit() {
    var k = akt(), n = $('nyomtat');
    if (!k || !k.e) { n.innerHTML = '<p>Nincs kiszámolt képlet a nyomtatáshoz.</p>'; return; }
    n.innerHTML = '<h1>' + R.esc(K.cim(k.adat)) + '</h1><div>' + R.esc(datumSor(k)) + ' · ' + R.esc(k.e.zona.info) + '</div><div class="kerek"></div>' +
      '<section><h2>Planéták</h2>' + T.planetak(k.e, beall) + '</section><section><h2>Házak</h2>' + T.hazak(k.e) + '</section>' +
      '<section><h2>Énállapotok</h2>' + T.enallapotok(k.e) + '</section><section><h2>Életstratégia, járatlan út</h2>' + T.eletstrat(k.e) + '</section>';
    kerekRajzol(n.querySelector('.kerek'), k);
  }
  function nyomtat() {
    var k = akt(); if (!k || !k.e) { uzen('A képlet még nem készült el.'); return; }
    nyomtatasElokeszit();
    setTimeout(function () { window.print(); }, 30);
  }

  /* ---------- beállítások ---------- */
  function beallMent() { S.beallitasMent(beall); }
  function megjelenitesDlg() {
    var d = $('dlgMegj');
    Array.prototype.forEach.call(d.querySelectorAll('input[data-k]'), function (c) { c.checked = !!beall.kerek[c.getAttribute('data-k')]; });
    Array.prototype.forEach.call(d.querySelectorAll('input[name="mCsomo"]'), function (r) { r.checked = +r.value === beall.csomo; });
    d.returnValue = ''; d.showModal();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      Array.prototype.forEach.call(d.querySelectorAll('input[data-k]'), function (c) { beall.kerek[c.getAttribute('data-k')] = c.checked; });
      var r = d.querySelector('input[name="mCsomo"]:checked'); if (r) beall.csomo = +r.value;
      beallMent(); render();
    };
  }
  var egyebHely = null, egyebKereso = null;
  function egyebekDlg() {
    var d = $('dlgEgyeb'), h = beall.alapHely;
    egyebHely = JSON.parse(JSON.stringify(h));
    $('eTelep').value = h.telepulesKijelzes || h.telepules;
    $('eInfo').textContent = helyInfo(h);
    $('eFrissit').checked = beall.aktualisFrissit;
    if (!egyebKereso) egyebKereso = R.TelepulesKereso($('eTelep'), $('eTalalat'), function (t) {
      egyebHely = { telepules: t.adatNev || t.nev, telepulesKijelzes: t.nev, orszag: t.orszag, orszagKod: t.orszagKod, lat: t.lat, lon: t.lon, tz: t.tz };
      $('eInfo').textContent = helyInfo(egyebHely);
    });
    d.returnValue = ''; d.showModal();
    d.onclose = function () {
      if (d.returnValue !== 'ok') return;
      beall.alapHely = egyebHely; beall.aktualisFrissit = $('eFrissit').checked;
      beallMent(); render();
    };
  }
  function helyInfo(h) {
    return (h.telepulesKijelzes || h.telepules) + ', ' + h.orszag + ' – ' + R.fokStr(Math.abs(h.lat), false) + (h.lat >= 0 ? ' É' : ' D') + ', ' +
      R.fokStr(Math.abs(h.lon), false) + (h.lon >= 0 ? ' K' : ' Ny') + (h.tz ? ' · ' + h.tz : '');
  }
  function gyariBeall() {
    kerdez('Visszaállítod a program alapértelmezett beállításait?', false).then(function (v) {
      if (v !== 'igen') return;
      var h = beall.hsys, s = beall.sid;
      beall = S.gyari();
      if (beall.hsys !== h || beall.sid !== s) mindSzamol();
      render(); uzen('Az alapértelmezések visszaálltak.');
    });
  }
  function beallLetolt() {
    letolt(new Blob([JSON.stringify(beall, null, 2)], { type: 'application/json' }), 'regiomontanus-beallitasok.json');
  }
  function beallBetolt() {
    var i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = function () {
      var f = i.files[0]; if (!f) return;
      f.text().then(function (t) {
        var v = JSON.parse(t), h = beall.hsys, s = beall.sid;
        S.beallitasMent(v); beall = S.beallitasok();
        if (beall.hsys !== h || beall.sid !== s) mindSzamol();
        render(); uzen('Beállítások betöltve.');
      }).catch(function (e) { uzen('A beállításfájl nem olvasható: ' + e.message); });
    };
    i.click();
  }

  /* ---------- üzenet, kérdés ---------- */
  var uzenIdo = null;
  function uzen(s) {
    var u = document.querySelector('.uzenet');
    if (!u) { u = document.createElement('div'); u.className = 'uzenet'; u.setAttribute('role', 'status'); document.body.appendChild(u); }
    u.textContent = s; u.hidden = false;
    clearTimeout(uzenIdo); uzenIdo = setTimeout(function () { u.hidden = true; }, 4500);
  }
  /** Promise<'igen' | 'nem' | ''> */
  function kerdez(html, harom) {
    var d = $('dlgKerdes');
    $('kerdesSzoveg').innerHTML = html;
    $('kerdesMegse').hidden = !harom;
    d.returnValue = '';
    d.showModal();
    $('kerdesIgen').focus();
    return new Promise(function (res) { d.onclose = function () { res(d.returnValue || (harom ? '' : 'nem')); }; });
  }

  /* ---------- munkamenet ---------- */
  function munkamenetMent() {
    if (!betoltve) return;
    S.munkamenetMent({
      kepletek: kepletek.map(function (k) { return { adat: k.eredeti, eltolas: k.eltolas, fajlnev: k.fajlnev, valtozott: k.valtozott }; }),
      aktiv: aktiv, nezet: nezet, ful: ful, lepNyitva: lepNyitva
    });
  }
  function munkamenetBetolt() {
    var m = S.munkamenet();
    if (!m || !Array.isArray(m.kepletek)) return;
    m.kepletek.forEach(function (x) {
      if (!x || !x.adat || typeof x.adat.ev !== 'number') return;
      var k = ujKepletObj(x.adat, x.fajlnev ? { nev: x.fajlnev } : null);
      k.valtozott = !!x.valtozott;
      if (Array.isArray(x.eltolas) && x.eltolas.length === 5) { k.eltolas = x.eltolas.map(function (v) { return +v || 0; }); k.adat = K.leptet(k.eredeti, k.eltolas); }
      kepletek.push(k);
    });
    aktiv = Math.min(Math.max(0, +m.aktiv || 0), kepletek.length - 1);
    nezet = m.nezet === 'reszlet' ? 'reszlet' : 'mozaik';
    if (FULEK.some(function (f) { return f[0] === m.ful; })) ful = m.ful;
    lepNyitva = !!m.lepNyitva;
  }

  /* ====================================================================== */
  /* Események                                                               */
  /* ====================================================================== */
  function beviteliMezo(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('dialog[open]')) return;
    var kod = e.code || '', betu = kod.indexOf('Key') === 0 ? kod.slice(3) : '';
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (betu === 'N') { e.preventDefault(); vegrehajt('uj'); return; }
      if (betu === 'W') { e.preventDefault(); vegrehajt('bezar'); return; }
      var d = /^Digit([1-9])$/.exec(kod);
      if (d) { e.preventDefault(); aktival(+d[1] - 1); return; }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      var t = { O: 'megnyit', S: 'ment', P: 'nyomtat', A: 'adatok', B: 'planetak', H: 'hazak', F: 'fenyszogek', J: 'eletstrat', E: 'enallapotok', L: 'lepteto' }[betu];
      if (!t) return;
      if ((betu === 'A' || betu === 'F') && beviteliMezo(e.target)) return;
      if (betu === 'A' && window.getSelection && String(window.getSelection()) && !vanAkt()) return;
      e.preventDefault();
      vegrehajt(t);
      return;
    }
    if (e.key === 'Escape') {
      if (nyitottMenu !== null) { menuZar(); return; }
      if (!$('lista').hidden) { listaValt(false); $('listaGomb').focus(); return; }
      if (nezet === 'reszlet') { nezet = 'mozaik'; render(); }
    }
  });
  document.addEventListener('mousedown', function (e) {
    if (nyitottMenu !== null && !e.target.closest('.menusor')) menuZar();
    if (!$('lista').hidden && !e.target.closest('#lista, #listaGomb')) listaValt(false);
  });
  $('menusor').addEventListener('click', function (e) {
    var b = e.target.closest('.mf > button'); if (!b) return;
    var i = +b.parentNode.getAttribute('data-m');
    if (nyitottMenu === i) menuZar(); else menuNyit(i, e.detail === 0);
  });
  $('menusor').addEventListener('mouseover', function (e) {
    var b = e.target.closest('.mf > button'); if (!b || nyitottMenu === null) return;
    var i = +b.parentNode.getAttribute('data-m'); if (i !== nyitottMenu) menuNyit(i, false);
  });
  $('menusor').addEventListener('keydown', function (e) {
    var b = e.target.closest('.mf > button'); if (!b) return;
    var i = +b.parentNode.getAttribute('data-m');
    if (e.key === 'ArrowDown') { e.preventDefault(); menuNyit(i, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); $('menusor').querySelector('[data-m="' + ((i + 1) % MENU.length) + '"] > button').focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); $('menusor').querySelector('[data-m="' + ((i - 1 + MENU.length) % MENU.length) + '"] > button').focus(); }
  });
  $('ikonok').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-eszk]'); if (!b || b.disabled) return;
    vegrehajt(ESZKOZ[+b.getAttribute('data-eszk')][2]);
  });
  $('racs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-r]'); if (!b) return;
    beall.elrendezes = +b.getAttribute('data-r'); nezet = 'mozaik'; beallMent(); render();
  });
  $('listaGomb').addEventListener('click', function () { listaValt(); });
  $('lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-valt]'); if (!b) return;
    listaValt(false); aktival(+b.getAttribute('data-valt'));
  });
  $('lista').addEventListener('keydown', function (e) {
    var l = Array.prototype.slice.call($('lista').querySelectorAll('button')), i = l.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && l.length) { e.preventDefault(); l[(i + 1) % l.length].focus(); }
    if (e.key === 'ArrowUp' && l.length) { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
  });
  $('asztal').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tett]');
    var cs = e.target.closest('.csempe');
    if (t) {
      var tt = t.getAttribute('data-tett');
      if (cs) {
        var i = +cs.getAttribute('data-i');
        if (tt === 'bezar') { bezar(i); return; }
        if (tt === 'nagyit') { aktival(i, true); return; }
      }
      vegrehajt(tt); return;
    }
    var v = e.target.closest('[data-valt]'); if (v) { aktival(+v.getAttribute('data-valt')); return; }
    var f = e.target.closest('[data-ful]');
    if (f) {
      ful = f.getAttribute('data-ful');
      Array.prototype.forEach.call(document.querySelectorAll('.fulek button'), function (b) { b.setAttribute('aria-selected', String(b === f)); });
      renderTabla($('tablaTart'), akt()); munkamenetMent(); return;
    }
    var lu = e.target.closest('[data-legutobbi]'); if (lu) { legutobbiNyit(+lu.getAttribute('data-legutobbi')); return; }
    if (cs && +cs.getAttribute('data-i') !== aktiv) aktival(+cs.getAttribute('data-i'));
  });
  $('asztal').addEventListener('dblclick', function (e) {
    var cs = e.target.closest('.csempe'); if (cs && !e.target.closest('button')) aktival(+cs.getAttribute('data-i'), true);
  });
  $('asztal').addEventListener('keydown', function (e) {
    var f = e.target.closest('.fulek [data-ful]'); if (!f) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var l = Array.prototype.slice.call(document.querySelectorAll('.fulek button')), i = l.indexOf(f);
    var u = l[(i + (e.key === 'ArrowRight' ? 1 : l.length - 1)) % l.length]; u.click(); u.focus();
  });
  $('lepteto').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-lep]'); if (b) { lep(+b.getAttribute('data-lep'), +b.getAttribute('data-ir')); return; }
  });
  $('lepEredeti').addEventListener('click', lepEredeti);
  $('lepZar').addEventListener('click', function () { lepNyitva = false; render(); });
  $('fajlInput').addEventListener('change', function () { fajlokMegnyit(this.files); this.value = ''; });

  var ejtDb = 0, ejtJel = null;
  function ejtJelzo(be) {
    if (be && !ejtJel) { ejtJel = document.createElement('div'); ejtJel.className = 'ejt'; ejtJel.textContent = 'Engedd el a .szk fájlokat a megnyitáshoz'; document.body.appendChild(ejtJel); }
    if (!be && ejtJel) { ejtJel.remove(); ejtJel = null; }
  }
  window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); ejtDb++; ejtJelzo(true); } });
  window.addEventListener('dragleave', function () { if (--ejtDb <= 0) { ejtDb = 0; ejtJelzo(false); } });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault(); ejtDb = 0; ejtJelzo(false);
    if (!betoltve) { uzen('A számítómotor még töltődik, próbáld újra egy pillanat múlva.'); return; }
    if (e.dataTransfer && e.dataTransfer.files.length) fajlokMegnyit(e.dataTransfer.files);
  });
  window.addEventListener('beforeprint', nyomtatasElokeszit);
  window.addEventListener('beforeunload', function (e) {
    var valt = kepletek.some(function (k) { return k.valtozott && k.adat.tipus !== 'aktualis'; });
    var tarol = false;
    try { tarol = !!window.localStorage; } catch (x) { tarol = false; }
    if (valt && !tarol) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ====================================================================== */
  /* Indulás                                                                 */
  /* ====================================================================== */
  menuEpit(); eszkoztarEpit(); elvalasztoInit();
  munkamenetBetolt();
  render();
  fetch('../proba/tesztkepletek.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; })
    .then(function (l) { tesztek = Array.isArray(l) ? l.filter(function (t) { return t && t.cim && t.fajl; }) : []; })
    .catch(function () { tesztek = []; });
  SwissEph.load({ base: '../swe' }).then(function (s) {
    se = s; betoltve = true;
    $('ver').textContent = 'Swiss Ephemeris ' + se.version();
    mindSzamol();
    render();
    setInterval(aktualisFrissit, 180000);
  }).catch(function (e) {
    $('ver').textContent = 'hiba';
    $('asztal').innerHTML = '<div class="udv"><h1>Betöltési hiba</h1><p>' + R.esc(e.message) + '</p><p>Ellenőrizd, hogy a swe/ mappa feltöltődött-e a tárhelyre.</p></div>';
  });
})();
