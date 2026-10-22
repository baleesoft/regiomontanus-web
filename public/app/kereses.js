/*
 * kereses.js – „Keresés a képletek közt” és „Megnyitás névre kereséssel” (a Windows-os
 * TfrmSpecialisKeresesAKepletekKozt és TfrmFileQuickSearchOpenFiles megfelelője).
 * Hol: a Windows-os Regiomontanus mappája (hors\, rekurzívan – mappa.js) vagy a megnyitott képletek.
 * A név-, címke- és születésnap-keresés itt fut; a számítást igénylő módokban a pozíciókat a böngésző
 * számolja, az illesztést kötegelve az api/kereses.php végzi.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, K = R.Keplet;
  var o = null;           // { se(), beall, megnyitAdat(adat, nev, handle), uzen, kepletek() }
  var dlg = null, gyors = null, fut = null, cache = {};

  var MODOK = ['névre (személy, fájl)', 'címké(k)re', 'életstratégiára', 'járatlan útra', 'planétára megadott jegyben',
    'planétára megadott házban', 'adott napon születettre', 'énállapotra jegyben / házban'];
  var KOTEG = 25;

  function $(s, gy) { return (gy || dlg).querySelector(s); }
  function opciok(l) { return l.map(function (x) { return '<option value="' + x[0] + '">' + R.esc(x[1]) + '</option>'; }).join(''); }
  function jegyLista() { return R.JEGYEK.map(function (n, i) { return [i, n]; }); }
  function hazLista() { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (h) { return [h, h + '. Ház']; }); }
  function plLista(asc) {
    var l = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (id) { return [id, R.nev(id)]; });
    if (asc) l.push([-1, 'Ascendens']);
    l.push([10, 'Felszálló holdcsomó (közepes)'], [11, 'Felszálló holdcsomó (valódi)']);
    return l;
  }

  function epit() {
    dlg = document.createElement('dialog');
    dlg.className = 'kereses-dlg'; dlg.setAttribute('aria-labelledby', 'kerCim');
    dlg.innerHTML =
      '<div class="dfej"><span id="kerCim">Keresés a képletek közt</span>' +
      '<button type="button" class="kisgomb" data-k="zar" aria-label="Bezárás" title="Bezárás"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="dtorzs">' +
      '<div class="ker-hol"><label>Hol: <select data-k="hol"><option value="mappa">a Regiomontanus mappában (hors\\ és almappái)</option>' +
      '<option value="nyitott">a megnyitott képletek közt</option></select></label> <span data-k="mappanev" class="halv"></span> ' +
      '<button type="button" class="gomb" data-k="mappa">Mappa kiválasztása…</button></div>' +
      '<div class="ker-fent"><fieldset class="ker-mod"><legend>Keresés ...</legend>' + MODOK.map(function (m, i) {
        return '<label><input type="radio" name="kerMod" value="' + i + '"' + (i === 0 ? ' checked' : '') + '> ' + R.esc(m) + '</label>';
      }).join('') + '</fieldset>' +
      '<div class="ker-lap">' +
      '<section data-lap="0"><p>Kérem, adjon meg egy tetszőleges szövegrészt, amit a fájlok nevében illetve a születési képlet tulajdonosának név mezőjében keressünk!</p>' +
      '<label class="sor">Név: <input type="text" data-k="nev" autocomplete="off"></label></section>' +
      '<section data-lap="1" hidden><label class="sor">Címke: <input type="text" data-k="cimke" autocomplete="off"></label> ' +
      '<button type="button" class="kisgomb" data-k="cimkeBe" title="Címke a listához" aria-label="Címke a listához">+</button>' +
      '<button type="button" class="kisgomb" data-k="cimkeKi" title="Kijelölt címke törlése a listából" aria-label="Kijelölt címke törlése">−</button>' +
      '<select data-k="cimkek" size="5" multiple aria-label="Keresett címkék"></select>' +
      '<p class="halv">Több címkénél bármelyik egyezése elég; a címke elejére keresünk (a „csal” megtalálja a „család” címkét).</p></section>' +
      '<section data-lap="2" hidden><p>Kérem, válassza ki, mely értékeket veheti fel a keresett életstratégia!</p>' +
      '<select data-k="es" size="12" multiple class="ket-oszlop" aria-label="Jegyek">' + opciok(jegyLista()) + '</select>' +
      '<p class="halv">A Ctrl gomb nyomvatartásával több jegy elemet is kiválaszthat!</p></section>' +
      '<section data-lap="3" hidden><p>Kérem, válassza ki, mely értékeket veheti fel a keresett járatlan út!</p>' +
      '<select data-k="ju" size="12" multiple aria-label="Jegyek">' + opciok(jegyLista()) + '</select>' +
      '<p class="halv">A Ctrl gomb nyomvatartásával több jegy elemet is kiválaszthat!</p></section>' +
      '<section data-lap="4" hidden><p>Kérem, válassza ki a planétát és azt, hogy az mely jegyekben szerepelhet!</p><div class="ket">' +
      '<select data-k="pj" size="12" aria-label="Planéta">' + opciok(plLista(true)) + '</select>' +
      '<select data-k="pjj" size="12" multiple aria-label="Jegyek">' + opciok(jegyLista()) + '</select></div></section>' +
      '<section data-lap="5" hidden><p>Kérem, válassza ki a planétát és azt, hogy az mely házakban szerepelhet!</p><div class="ket">' +
      '<select data-k="ph" size="12" aria-label="Planéta">' + opciok(plLista(false)) + '</select>' +
      '<select data-k="phh" size="12" multiple aria-label="Házak">' + opciok(hazLista()) + '</select></div></section>' +
      '<section data-lap="6" hidden><p>Kérem, adja meg a keresendő személy születésének hónap és napszámát!</p>' +
      '<label class="sor">Hónap: <input type="number" min="1" max="12" data-k="ho" style="width:70px"></label> ' +
      '<label class="sor">Nap: <input type="number" min="1" max="31" data-k="nap" style="width:70px"></label></section>' +
      '<section data-lap="7" hidden><p>Kérem válassza ki, hogy az énállapot milyen jegyű lehet illetve melyik házban szerepelhet! ' +
      'Kereséskor azt nézzük, hogy az adott jegyben VAGY az adott házban van-e énállapot!</p><div class="ket">' +
      '<select data-k="ej" size="12" multiple aria-label="Jegyek">' + opciok(jegyLista()) + '</select>' +
      '<select data-k="eh" size="12" multiple aria-label="Házak">' + opciok(hazLista()) + '</select></div></section>' +
      '</div></div>' +
      '<div class="ker-mukodes"><button type="button" class="gomb fo" data-k="indit">Keresés indítása...</button>' +
      '<button type="button" class="gomb" data-k="alap">Keresés alapállapotba</button>' +
      '<button type="button" class="gomb" data-k="megszakit" disabled>Keresés megszakítása</button>' +
      '<progress data-k="halad" max="1" value="0"></progress><span data-k="szaml" class="halv"></span></div>' +
      '<fieldset class="ker-ered"><legend>Keresés eredménye</legend>' +
      '<div class="ker-tabla" role="listbox" aria-multiselectable="true" aria-label="Találatok" tabindex="0" data-k="lista"></div>' +
      '<div class="ker-also"><span data-k="db" role="status"></span><span class="tolt"></span>' +
      '<button type="button" class="gomb" data-k="mind">Az összes kijelölése</button>' +
      '<button type="button" class="gomb" data-k="semmi">Kijelölés megszüntetése</button>' +
      '<button type="button" class="gomb fo" data-k="nyit">Kijelöltek megnyitása</button>' +
      '<button type="button" class="gomb" data-k="torol">Eredménylista törlése</button></div></fieldset>' +
      '</div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('change', function (e) {
      if (e.target.name === 'kerMod') lapValt();
      if (e.target.getAttribute('data-k') === 'hol') holFrissit();
    });
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
      var k = b.getAttribute('data-k');
      if (k === 'zar') { dlg.close(); return; }
      if (k === 'mappa') { R.Mappa.valaszt().then(function (ok) { if (ok) { cache = {}; $('[data-k="hol"]').value = 'mappa'; } holFrissit(); }); return; }
      if (k === 'indit') return indit();
      if (k === 'alap') return alap();
      if (k === 'megszakit') { if (fut) fut.megszakit = true; return; }
      if (k === 'cimkeBe') return cimkeBe();
      if (k === 'cimkeKi') { Array.prototype.slice.call($('[data-k="cimkek"]').selectedOptions).forEach(function (x) { x.remove(); }); return; }
      if (k === 'mind') return kijelol(true);
      if (k === 'semmi') return kijelol(false);
      if (k === 'nyit') return megnyitKijeloltek($('[data-k="lista"]'));
      if (k === 'torol') { talalatok = []; listaRajzol(); return; }
    });
    listaEsemenyek($('[data-k="lista"]'), function () { return talalatok; });
    // Enter = keresés indítása (FormKeyUp, D SK 350–358)
    dlg.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.target.closest('[data-k="lista"]') && !e.target.closest('button')) {
        e.preventDefault();
        if (e.target.getAttribute('data-k') === 'cimke' && e.target.value.trim()) { cimkeBe(); return; }
        indit();
      }
    });
    dlg.addEventListener('close', function () { if (fut) fut.megszakit = true; });
  }
  function lapValt() {
    var m = +dlg.querySelector('input[name="kerMod"]:checked').value;
    Array.prototype.forEach.call(dlg.querySelectorAll('[data-lap]'), function (s) { s.hidden = +s.getAttribute('data-lap') !== m; });
  }
  function holFrissit() {
    var hol = $('[data-k="hol"]').value;
    R.Mappa.megjegyzett().then(function (n) {
      $('[data-k="mappanev"]').textContent = hol === 'mappa' ? (n ? 'Kiválasztva: ' + n : 'Még nincs kiválasztott mappa.') : '';
    });
    $('[data-k="mappa"]').hidden = hol !== 'mappa';
  }
  function cimkeBe() {
    var m = $('[data-k="cimke"]'), sel = $('[data-k="cimkek"]');
    m.value.split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (t) {
      var van = Array.prototype.some.call(sel.options, function (x) { return x.value.toUpperCase() === t.toUpperCase(); });
      if (!van) { var op = document.createElement('option'); op.value = t; op.textContent = t; sel.appendChild(op); }
    });
    m.value = '';
  }
  function kivalasztott(nev) { return Array.prototype.map.call($('[data-k="' + nev + '"]').selectedOptions, function (x) { return +x.value; }); }

  /* ---------- eredménylista (közös a két ablakkal) ---------- */
  var talalatok = [], gyorsTalalatok = [];
  function sorHtml(t, i, sorszam) {
    var a = t.adat;
    return '<div class="ker-sor" role="option" aria-selected="' + !!t.kijelolt + '" data-i="' + i + '">' +
      (sorszam ? '<span class="c0">' + t.sorszam + '</span>' : '') +
      '<span class="c1">' + R.esc(a.nev) + '</span><span class="c2">' + R.esc(R.datumStr(a.ev, a.ho, a.nap, a.ora, a.perc).replace(' ', '   ')) + '</span>' +
      '<span class="c3">' + R.esc(t.nev) + '</span><span class="c4">' + R.esc(t.ut) + '</span></div>';
  }
  function listaRajzol() {
    var l = $('[data-k="lista"]');
    l.innerHTML = talalatok.map(function (t, i) { return sorHtml(t, i, true); }).join('');
    $('[data-k="db"]').textContent = 'Keresés eredménye: ' + (talalatok.length ? talalatok.length + ' db' : (fut ? '' : 'Nincs találat!'));
  }
  function listaEsemenyek(l, lista) {
    var utolso = -1;
    l.addEventListener('click', function (e) {
      var s = e.target.closest('.ker-sor'); if (!s) return;
      var i = +s.getAttribute('data-i'), t = lista();
      if (e.shiftKey && utolso >= 0) { for (var j = Math.min(i, utolso); j <= Math.max(i, utolso); j++) t[j].kijelolt = true; }
      else if (e.ctrlKey || e.metaKey) t[i].kijelolt = !t[i].kijelolt;
      else t.forEach(function (x, j) { x.kijelolt = j === i; });
      utolso = i;
      Array.prototype.forEach.call(l.querySelectorAll('.ker-sor'), function (s2) { s2.setAttribute('aria-selected', String(!!t[+s2.getAttribute('data-i')].kijelolt)); });
    });
    l.addEventListener('dblclick', function (e) {
      var s = e.target.closest('.ker-sor'); if (!s) return;
      var t = lista(); t[+s.getAttribute('data-i')].kijelolt = true;
      megnyitKijeloltek(l);
    });
    l.addEventListener('keydown', function (e) {
      var t = lista(); if (!t.length) return;
      var i = t.reduce(function (m, x, j) { return x.kijelolt ? j : m; }, -1);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        i = Math.max(0, Math.min(t.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
        t.forEach(function (x, j) { x.kijelolt = j === i; });
        Array.prototype.forEach.call(l.querySelectorAll('.ker-sor'), function (s2) { s2.setAttribute('aria-selected', String(!!t[+s2.getAttribute('data-i')].kijelolt)); });
        var s = l.querySelector('[data-i="' + i + '"]'); if (s) s.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); megnyitKijeloltek(l); }
    });
  }
  function kijelol(be) {
    talalatok.forEach(function (t) { t.kijelolt = be; });
    Array.prototype.forEach.call(dlg.querySelectorAll('.ker-sor'), function (s) { s.setAttribute('aria-selected', String(be)); });
  }
  /** A kijelölt sorok megnyitása új lapként (ismeretlen időnél Kos 0°), majd az ablak bezárul (D SK 294–307). */
  function megnyitKijeloltek(l) {
    var gy = gyors && gyors.contains(l), t = (gy ? gyorsTalalatok : talalatok).filter(function (x) { return x.kijelolt; });
    if (!t.length) { o.uzen('Kérem jelöljön ki egy vagy több sort a megnyitáshoz!'); return; }
    (gy ? gyors : dlg).close();
    t.reduce(function (p, x) {
      return p.then(function () {
        if (x.k) { o.aktival(x.k); return; }
        return (x.file ? Promise.resolve(x.file) : x.handle.getFile()).then(function (f) { return f.arrayBuffer(); })
          .then(function (b) { o.megnyitFajl(x.nev, b, x.handle || null); });
      });
    }, Promise.resolve()).catch(function (e) { o.uzen('Megnyitási hiba: ' + e.message); });
  }

  /* ---------- a keresendő képletek ---------- */
  /** Promise<[{ ut, nev, adat, file?, handle?, k? }]> – a .szk-k beolvasva (munkamenet-gyorsítótárral) */
  function forrasok(hol, halad) {
    if (hol === 'nyitott') {
      return Promise.resolve(o.kepletek().filter(function (k) { return !k.fajta && k.adat && k.adat.tipus !== 'aktualis'; }).map(function (k, i) {
        return { ut: k.fajlnev || '(nincs mentve)', nev: k.fajlnev || K.cim(k.adat), adat: k.adat, k: k, sorszam: i };
      }));
    }
    return R.Mappa.elerheto(true).then(function (ok) {
      if (!ok) throw new Error('Válaszd ki a Windows-os Regiomontanus mappáját (vagy benne a hors mappát) a „Mappa kiválasztása…” gombbal.');
      return R.Mappa.szkLista();
    }).then(function (l) {
      var ki = [], i = 0;
      return l.reduce(function (p, x) {
        return p.then(function () {
          if (fut && fut.megszakit) return;
          halad(++i, l.length, 'beolvasás');
          return R.Mappa.fajlOlvas(x).then(function (f) {
            var kulcs = x.ut + '|' + f.lastModified + '|' + f.size;
            if (cache[kulcs] === undefined) {
              return f.arrayBuffer().then(function (b) {
                try { var p2 = RegioSzk.parse(b); cache[kulcs] = p2.bc ? null : RegioSzk.toAdat(p2); } catch (e) { cache[kulcs] = null; }
                if (cache[kulcs]) ki.push({ ut: x.ut, nev: x.nev, adat: cache[kulcs], file: x.file, handle: x.handle, kulcs: kulcs, sorszam: i - 1 });
              });
            }
            if (cache[kulcs]) ki.push({ ut: x.ut, nev: x.nev, adat: cache[kulcs], file: x.file, handle: x.handle, kulcs: kulcs, sorszam: i - 1 });
          });
        });
      }, Promise.resolve()).then(function () { return ki; });
    });
  }

  /* ---------- keresés ---------- */
  function feltetel() {
    var m = +dlg.querySelector('input[name="kerMod"]:checked').value;
    if (m === 0) { var n = $('[data-k="nev"]').value.trim(); return n ? { mod: 'nev', ertek: n.toUpperCase() } : null; }
    if (m === 1) {
      if ($('[data-k="cimke"]').value.trim()) cimkeBe();
      var c = Array.prototype.map.call($('[data-k="cimkek"]').options, function (x) { return x.value; });
      return c.length ? { mod: 'cimke', cimkek: c } : null;
    }
    if (m === 6) {
      var ho = parseInt($('[data-k="ho"]').value, 10), nap = parseInt($('[data-k="nap"]').value, 10);
      if (isNaN(ho) || isNaN(nap)) return { hiba: 'Kérem, hogy a mezőben csak számot adjon meg!' };
      return { mod: 'nap', ho: ho, nap: nap };
    }
    var f = m === 2 ? { mod: 'eletstrat', jegyek: kivalasztott('es') } : m === 3 ? { mod: 'jaratlan', jegyek: kivalasztott('ju') }
      : m === 4 ? { mod: 'jegy', planeta: kivalasztott('pj')[0], jegyek: kivalasztott('pjj') }
      : m === 5 ? { mod: 'haz', planeta: kivalasztott('ph')[0], hazak: kivalasztott('phh') }
      : { mod: 'enallapot', jegyek: kivalasztott('ej'), hazak: kivalasztott('eh') };
    var ures = (m <= 4 && !f.jegyek.length) || (m === 5 && !f.hazak.length) || (m === 7 && !f.jegyek.length && !f.hazak.length) ||
      ((m === 4 || m === 5) && f.planeta === undefined);
    return ures ? { hiba: 'Kérem, hogy a keresési feltételt megfelelően töltse ki!' } : f;
  }
  /** Kliensoldali módok (D SK 405–450, 526–590) – a név a mappához viszonyított úton (a Windows-os exe-út hibája nélkül). */
  function helyiIlleszt(f, x) {
    if (f.mod === 'nev') return x.ut.toUpperCase().indexOf(f.ertek) >= 0 || (x.adat.nev || '').toUpperCase().indexOf(f.ertek) >= 0;
    if (f.mod === 'cimke') {
      var ck = ';' + (x.adat.cimkek || []).join(';').replace(/,/g, ';').toUpperCase();
      return f.cimkek.some(function (c) { return ck.indexOf(';' + c.toUpperCase()) >= 0; });
    }
    if (f.mod === 'nap') return x.adat.ho === f.ho && x.adat.nap === f.nap;
    return false;
  }
  function indit() {
    if (fut) return;
    var f = feltetel();
    if (!f) return;
    if (f.hiba) { o.uzen(f.hiba); return; }
    var hol = $('[data-k="hol"]').value, b = o.beall;
    talalatok = []; listaRajzol();
    fut = { megszakit: false };
    $('[data-k="megszakit"]').disabled = false; $('[data-k="indit"]').disabled = true;
    function halad(i, n, mit) {
      $('[data-k="halad"]').max = Math.max(1, n); $('[data-k="halad"]').value = i;
      $('[data-k="szaml"]').textContent = i + '/' + n + (mit ? ' (' + mit + ')' : '');
    }
    var lanc = forrasok(hol, halad).then(function (l) {
      if (f.mod === 'nev' || f.mod === 'cimke' || f.mod === 'nap') {
        l.forEach(function (x) { if (helyiIlleszt(f, x)) talalatok.push(x); });
        return;
      }
      // számítás: a pozíciók a böngészőben, az illesztés kötegelve a szerveren (ismeretlen időnél – a Windows-os programhoz
      // hasonlóan – sima radix a tárolt időponttal, D SK 496–522)
      var se = o.se(); if (!se) throw new Error('A számítómotor még töltődik.');
      var i = 0, koteg = [];
      function kuld() {
        var k2 = koteg; koteg = [];
        if (!k2.length) return Promise.resolve();
        return K.kereses(f, k2.map(function (x) { return x.k; })).then(function (v) {
          v.eredmenyek.forEach(function (e, j) { if (e.talalat) { talalatok.push(k2[j].x); } });
          listaRajzol();
        });
      }
      return l.reduce(function (p, x) {
        return p.then(function () {
          if (fut.megszakit) return;
          halad(++i, l.length, 'számítás');
          var a = K.masol(x.adat); a.ismeretlen = false; a.tipus = 'radix';
          if (a.ev < 1 || a.ev > 2999) return;
          return K.szamol(se, a, { hsys: b.hsys, sid: b.sid, csakPoz: true }).then(function (e) {
            var kd = e.kuld; kd.id = i;
            koteg.push({ x: x, k: kd });
            if (koteg.length >= KOTEG) return kuld();
          }, function () { /* hibás képlet: kimarad */ });
        });
      }, Promise.resolve()).then(function () { if (!fut.megszakit) return kuld(); });
    });
    lanc.catch(function (e) { o.uzen(e.message); }).then(function () {
      var m = fut && fut.megszakit; fut = null;
      $('[data-k="megszakit"]').disabled = true; $('[data-k="indit"]').disabled = false;
      listaRajzol();
      if (m) $('[data-k="szaml"]').textContent += ' – megszakítva';
    });
  }
  function alap() {
    if (fut) fut.megszakit = true;
    talalatok = []; listaRajzol(); $('[data-k="db"]').textContent = '';
    ['nev', 'cimke', 'ho', 'nap'].forEach(function (n) { $('[data-k="' + n + '"]').value = ''; });
    $('[data-k="cimkek"]').innerHTML = '';
    Array.prototype.forEach.call(dlg.querySelectorAll('select[multiple] option'), function (x) { x.selected = false; });
    $('[data-k="halad"]').value = 0; $('[data-k="szaml"]').textContent = '';
  }

  /* ---------- Megnyitás névre kereséssel (TfrmFileQuickSearchOpenFiles) ---------- */
  function gyorsEpit() {
    gyors = document.createElement('dialog');
    gyors.className = 'kereses-dlg gyors'; gyors.setAttribute('aria-labelledby', 'gyCim');
    gyors.innerHTML = '<div class="dfej"><span id="gyCim">Megnyitás névre kereséssel</span>' +
      '<button type="button" class="kisgomb" data-g="zar" aria-label="Bezárás" title="Bezárás"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="dtorzs"><fieldset><legend>Név</legend><div class="ker-hol">' +
      '<input type="search" data-g="nev" autocomplete="off" aria-label="Név vagy fájlnév részlete" placeholder="név vagy fájlnév részlete (üresen: mind)">' +
      '<button type="button" class="gomb fo" data-g="keres">Keresés indítása</button>' +
      '<button type="button" class="gomb" data-g="mappa">Mappa…</button><span data-g="mappanev" class="halv"></span></div>' +
      '<div class="ker-tabla" role="listbox" aria-multiselectable="true" aria-label="Találatok" tabindex="0" data-g="lista"></div>' +
      '<div class="ker-also"><span data-g="db" role="status"></span><span class="tolt"></span>' +
      '<button type="button" class="gomb fo" data-g="nyit">Kijelöltek megnyitása</button></div></fieldset></div>';
    document.body.appendChild(gyors);
    gyors.addEventListener('click', function (e) {
      var b = e.target.closest('[data-g]'); if (!b || b.tagName === 'INPUT') return;
      var g = b.getAttribute('data-g');
      if (g === 'zar') gyors.close();
      else if (g === 'keres') gyorsKeres();
      else if (g === 'mappa') R.Mappa.valaszt().then(function (ok) { if (ok) { cache = {}; gyorsKeres(); } gyorsMappa(); });
      else if (g === 'nyit') megnyitKijeloltek($('[data-g="lista"]', gyors));
    });
    listaEsemenyek($('[data-g="lista"]', gyors), function () { return gyorsTalalatok; });
    gyors.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.getAttribute('data-g') === 'nev') { e.preventDefault(); gyorsKeres(); }
    });
  }
  function gyorsMappa() { R.Mappa.megjegyzett().then(function (n) { $('[data-g="mappanev"]', gyors).textContent = n ? ' ' + n : ' (nincs kiválasztott mappa)'; }); }
  function gyorsKeres() {
    var n = $('[data-g="nev"]', gyors).value.trim().toUpperCase(), lista = $('[data-g="lista"]', gyors);
    lista.innerHTML = '<p class="halv">Keresés…</p>';
    forrasok('mappa', function (i, db) { $('[data-g="db"]', gyors).textContent = i + '/' + db; }).then(function (l) {
      gyorsTalalatok = l.filter(function (x) { return !n || helyiIlleszt({ mod: 'nev', ertek: n }, x); });
      lista.innerHTML = gyorsTalalatok.map(function (t, i) { return sorHtml(t, i, false); }).join('');
      $('[data-g="db"]', gyors).textContent = gyorsTalalatok.length ? gyorsTalalatok.length + ' db' : 'Nincs találat!';
    }, function (e) { lista.innerHTML = '<p class="hiba">' + R.esc(e.message) + '</p>'; $('[data-g="db"]', gyors).textContent = ''; });
  }

  R.Kereses = {
    init: function (opt) { o = opt; },
    nyit: function () {
      if (!dlg) epit();
      holFrissit(); lapValt();
      if (!dlg.open) dlg.showModal();
      var m = dlg.querySelector('[data-lap]:not([hidden]) input, [data-lap]:not([hidden]) select'); if (m) m.focus();
    },
    gyors: function (mind) {
      if (!gyors) gyorsEpit();
      gyorsMappa();
      if (!gyors.open) gyors.showModal();
      $('[data-g="nev"]', gyors).focus();
      if (mind) R.Mappa.megjegyzett().then(function (n) { if (n) gyorsKeres(); });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
