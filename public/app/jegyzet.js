/*
 * jegyzet.js – „Jegyzetek a horoszkóp elemeihez” (a Windows-os TfrmMegjRichEdit megfelelője).
 * A jegyzetek a képlet adatában vannak: adat.megjegyzesek = { 'A_999': rtf, 'P_0': rtf, 'H_1': rtf, 'J_0': rtf, … }
 * (a .szk [Megjegyzes] szakasza; a Windows-os .mgj kulcsaival). Az RTF-átalakítás: js/rtf.js.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, X = R.Rtf;
  var o = null;                // init-beállítások: { akt, valtozott(k, jelekValtoztak), uzen, kerdez, beall, letolt }
  var ablak = null, szerk = null, kotott = null, tipus = 'A', azon = 999, osszes = false, piszkos = false, idozito = null;
  var szimb = true;

  var MERETEK = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
  var FONT_PT = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 };
  var FSZ_JEL = { 1: '☌', 2: '☍', 3: '□', 4: '∠', 5: '⚼', 6: '△', 7: '⚹', 8: '⚺', 9: '⚻', 10: '⬠', 11: '⊥', 12: '⬟' };
  var PL_JEL = ['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '♇'];

  function $(s) { return ablak.querySelector(s); }
  function kulcs(t, i) { return t + '_' + i; }
  function megj(k) { return (k && k.adat && k.adat.megjegyzesek) || {}; }

  /** Az elem neve az állapotsorhoz (D MRE 812–866). */
  function elemNev(t, i) {
    if (t === 'A') return 'Általános jegyzetek az ábrához';
    var n;
    if (t === 'P') n = 'Planéta: ' + (i === -1 ? 'Ascendens' : i === -2 ? 'Medium Coeli' : R.nev(i));
    else if (t === 'H') n = i + '. ház';
    else if (t === 'J') n = 'Zodiákus jegy: ' + R.JEGYEK[i];
    else if (t === 'F') n = 'Fényszög: ' + (R.FENYSZOG[i] ? R.FENYSZOG[i][0] : i);
    else n = 'Énállapot: ' + i;
    return 'Jegyzet az ábra „' + n + '” részéhez';
  }
  function elemRovid(t, i) {
    if (t === 'A') return 'általános';
    if (t === 'P') return i === -1 ? 'Ascendens' : i === -2 ? 'MC' : R.nev(i);
    if (t === 'H') return i + '. ház';
    if (t === 'J') return R.JEGYEK[i];
    if (t === 'F') return R.FENYSZOG[i] ? R.FENYSZOG[i][0] : 'fényszög ' + i;
    return 'énállapot ' + i;
  }

  /* ---------- ablak ---------- */
  function gomb(attr, cim, tartalom) {
    return '<button type="button" class="jgomb" ' + attr + ' title="' + R.esc(cim) + '" aria-label="' + R.esc(cim) + '">' + tartalom + '</button>';
  }
  function ikon(d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  function epit() {
    ablak = document.createElement('div');
    ablak.className = 'jegyzet-ablak'; ablak.setAttribute('role', 'dialog'); ablak.setAttribute('aria-label', 'Jegyzetek a horoszkóp elemeihez');
    ablak.innerHTML =
      '<div class="olv-fej jfej"><b>Jegyzetek a horoszkóp elemeihez</b><span class="jcim"></span>' +
      '<button type="button" class="kisgomb" data-j="zar" title="Bezárás (Esc)" aria-label="Bezárás">' + ikon('M6 6l12 12M18 6L6 18') + '</button></div>' +
      '<div class="jeszk" role="toolbar" aria-label="Szerkesztés">' +
      gomb('data-j="uj"', 'Új jegyzet (Ctrl+N)', ikon('M6 3h8l4 4v14H6zM12 11v6M9 14h6')) +
      gomb('data-j="megnyit"', 'Szöveg betöltése jegyzetként – .mgj, .rtf, .txt (Ctrl+O)', ikon('M3 7h6l2 2h10v10H3z')) +
      gomb('data-j="ment"', 'Jegyzet mentése külön fájlba – RTF (Ctrl+S)', ikon('M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6')) +
      gomb('data-j="nyomtat"', 'Szöveg nyomtatása (Ctrl+P)', ikon('M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z')) +
      '<span class="sep"></span>' +
      gomb('data-j="osszes" aria-pressed="false"', 'Az aktuális képlethez kapcsolódó összes jegyzet szövegének betöltése', ikon('M4 5h16M4 10h16M4 15h16M4 20h10')) +
      '<span class="sep"></span>' +
      '<select data-j="meret" title="Betű mérete" aria-label="Betű mérete">' + MERETEK.map(function (m) {
        return '<option value="' + m + '"' + (m === 10 ? ' selected' : '') + '>' + m + '</option>';
      }).join('') + '</select>' +
      gomb('data-cmd="bold"', 'Félkövér (Ctrl+B)', '<b>F</b>') + gomb('data-cmd="italic"', 'Dőlt (Ctrl+I)', '<i>D</i>') +
      gomb('data-cmd="underline"', 'Aláhúzott (Ctrl+U)', '<u>A</u>') +
      '<input type="color" data-j="szin" value="#c00000" title="Betűszín" aria-label="Betűszín">' +
      '<span class="sep"></span>' +
      gomb('data-cmd="justifyLeft"', 'Balra zárás', ikon('M4 6h16M4 10h10M4 14h16M4 18h10')) +
      gomb('data-cmd="justifyCenter"', 'Középre zárás', ikon('M4 6h16M7 10h10M4 14h16M7 18h10')) +
      gomb('data-cmd="justifyRight"', 'Jobbra zárás', ikon('M4 6h16M10 10h10M4 14h16M10 18h10')) +
      gomb('data-cmd="insertUnorderedList"', 'Felsorolás', ikon('M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01')) +
      '<span class="sep"></span>' +
      gomb('data-j="szimb" aria-pressed="true"', 'Szimbólumok használata (ki: a nevek kerülnek a szövegbe)', '<span class="asztro">☉</span>') +
      '</div>' +
      '<div class="jszerk" contenteditable="true" spellcheck="true" lang="hu" role="textbox" aria-multiline="true" aria-label="Jegyzet szövege"></div>' +
      '<div class="jszimb" role="toolbar" aria-label="Házak és fényszögek beillesztése">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (h) {
        return gomb('data-haz="' + h + '"', 'Ház számának szövegbe illesztése kattintásra (' + R.HAZNEV[h] + ')', String(h));
      }).join('') + gomb('data-hazszo="1"', 'A „Ház” szó szövegbe illesztése kattintásra', ikon('M4 11l8-7 8 7M6 10v10h12V10')) +
      '<span class="sep"></span>' + Object.keys(FSZ_JEL).map(function (f) {
        return gomb('data-fsz="' + f + '"', 'Fényszög nevének szövegbe illesztése kattintásra (' + R.FENYSZOG[f][0] + ')', '<span class="asztro">' + FSZ_JEL[f] + '</span>');
      }).join('') + '</div>' +
      '<div class="jszimb" role="toolbar" aria-label="Planéták és jegyek beillesztése">' +
      PL_JEL.map(function (j, i) {
        return gomb('data-pl="' + i + '"', 'Planéta nevének szövegbe illesztése kattintásra (' + R.nev(i) + ')', '<span class="asztro">' + j + '</span>');
      }).join('') + '<span class="sep"></span>' + R.JEGYGLIF.map(function (j, i) {
        return gomb('data-jegy="' + i + '"', 'Jegy nevének szövegbe illesztése kattintásra (' + R.JEGYEK[i] + ')', '<span class="asztro">' + j + '</span>');
      }).join('') + '</div>' +
      '<div class="jstatusz"><span class="jmod"></span><span class="jelem"></span></div>' +
      '<input type="file" data-j="fajl" accept=".mgj,.rtf,.txt,text/plain,application/rtf" hidden>';
    document.body.appendChild(ablak);
    szerk = $('.jszerk');
    // hely: a böngészőablak jobb alsó sarka (D M 373–374)
    var w = Math.min(Math.max(560, Math.round(innerWidth * 0.45)), innerWidth - 16), h = Math.min(420, innerHeight - 80);
    ablak.style.width = w + 'px'; ablak.style.height = h + 'px';
    ablak.style.left = Math.max(8, innerWidth - w - 12) + 'px'; ablak.style.top = Math.max(8, innerHeight - h - 40) + 'px';
    esemenyek();
  }

  function esemenyek() {
    // húzás a fejlécnél
    var fej = $('.jfej'), huz = null;
    fej.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      huz = { x: e.clientX - ablak.offsetLeft, y: e.clientY - ablak.offsetTop }; fej.setPointerCapture(e.pointerId);
    });
    fej.addEventListener('pointermove', function (e) {
      if (!huz) return;
      ablak.style.left = Math.min(innerWidth - 60, Math.max(0, e.clientX - huz.x)) + 'px';
      ablak.style.top = Math.min(innerHeight - 30, Math.max(0, e.clientY - huz.y)) + 'px';
    });
    fej.addEventListener('pointerup', function () { huz = null; });
    // gombok: a fókusz maradjon a szövegben
    ablak.addEventListener('mousedown', function (e) { if (e.target.closest('.jgomb')) e.preventDefault(); });
    ablak.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var j = b.getAttribute('data-j'), cmd = b.getAttribute('data-cmd');
      if (cmd) { if (!osszes) { szerk.focus(); document.execCommand(cmd, false, null); valt(); } return; }
      if (b.hasAttribute('data-haz')) return beszur(R.HAZNEV[+b.getAttribute('data-haz')] + ' ', null);
      if (b.hasAttribute('data-hazszo')) return beszur('Ház', null);
      if (b.hasAttribute('data-fsz')) { var f = +b.getAttribute('data-fsz'); return beszur(R.FENYSZOG[f][0].toLowerCase(), FSZ_JEL[f]); }
      if (b.hasAttribute('data-pl')) { var p = +b.getAttribute('data-pl'); return beszur(R.nev(p), PL_JEL[p]); }
      if (b.hasAttribute('data-jegy')) { var g = +b.getAttribute('data-jegy'); return beszur(R.JEGYEK[g], R.JEGYGLIF[g]); }
      if (j === 'zar') return bezar();
      if (j === 'uj') return uj();
      if (j === 'megnyit') { if (!osszes) $('[data-j="fajl"]').click(); return; }
      if (j === 'ment') return exportal();
      if (j === 'nyomtat') return nyomtat();
      if (j === 'osszes') return osszesValt();
      if (j === 'szimb') { szimb = !szimb; b.setAttribute('aria-pressed', String(szimb)); }
    });
    $('[data-j="meret"]').addEventListener('change', function (e) {
      if (osszes) return;
      var pt = +e.target.value, n = 3;
      Object.keys(FONT_PT).forEach(function (k) { if (Math.abs(FONT_PT[k] - pt) < Math.abs(FONT_PT[n] - pt)) n = +k; });
      szerk.focus(); document.execCommand('fontSize', false, String(n)); valt();
    });
    $('[data-j="szin"]').addEventListener('input', function (e) {
      if (osszes) return;
      szerk.focus(); document.execCommand('foreColor', false, e.target.value); valt();
    });
    $('[data-j="fajl"]').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; e.target.value = '';
      if (f) betolt(f);
    });
    szerk.addEventListener('input', valt);
    szerk.addEventListener('blur', function () { ment(); });
    // beillesztés: csak a támogatott formázás marad meg
    szerk.addEventListener('paste', function (e) {
      var d = e.clipboardData; if (!d) return;
      e.preventDefault();
      var html = d.getData('text/html');
      if (html) {
        var t = document.createElement('div'); t.innerHTML = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
        document.execCommand('insertHTML', false, X.html(X.domModell(t)));
      } else document.execCommand('insertText', false, d.getData('text/plain'));
      valt();
    });
    ablak.addEventListener('keydown', function (e) {
      // az ablakon belül a program gyorsbillentyűi (Ctrl+B = Planéták stb.) nem élnek
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); bezar(); return; }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var b = e.key.toLowerCase();
      if (b === 's') { e.preventDefault(); exportal(); }
      else if (b === 'p') { e.preventDefault(); nyomtat(); }
      else if (b === 'n') { e.preventDefault(); uj(); }
      else if (b === 'o') { e.preventDefault(); if (!osszes) $('[data-j="fajl"]').click(); }
    });
  }

  function beszur(nev, jel) {
    if (osszes) return;
    szerk.focus();
    if (szimb && jel) document.execCommand('insertHTML', false, '<b><span class="asztro" style="font-size:15pt">' + jel + '</span></b>&nbsp;');
    else document.execCommand('insertText', false, nev);
    valt();
  }

  function valt() {
    if (osszes) return;
    if (!piszkos) { piszkos = true; $('.jmod').textContent = 'Módosított'; }
    clearTimeout(idozito);
    idozito = setTimeout(ment, 800);
  }

  /** A szerkesztő tartalma a kötött képlet adatába (UpdateAktMegjegyzesToINI) – csak tényleges változásnál. */
  function ment() {
    clearTimeout(idozito);
    if (!kotott || osszes || !piszkos) return;
    var m = X.domModell(szerk), van = m.some(function (p) { return p.futamok.some(function (f) { return f.t.trim(); }); });
    var kk = kulcs(tipus, azon), r = van ? X.rtf(m) : null;
    [kotott.adat, kotott.eredeti].forEach(function (a) {
      if (!a) return;
      a.megjegyzesek = a.megjegyzesek || {};
      if (r) a.megjegyzesek[kk] = r; else delete a.megjegyzesek[kk];
    });
    var elotte = !!kotott.jegyzetKulcsok && kotott.jegyzetKulcsok[kk];
    piszkos = false;
    o.valtozott(kotott, elotte !== !!r);
    kotott.jegyzetKulcsok = jelek(kotott);
  }

  function tolt() {
    osszes = false;
    $('[data-j="osszes"]').setAttribute('aria-pressed', 'false');
    szerk.setAttribute('contenteditable', 'true'); ablak.classList.remove('csakolvas');
    var r = megj(kotott)[kulcs(tipus, azon)];
    szerk.innerHTML = r ? X.htmlBol(r) : '';
    piszkos = false; $('.jmod').textContent = '';
    $('.jelem').textContent = elemNev(tipus, azon);
    $('.jcim').textContent = kotott ? ' – ' + R.Keplet.cim(kotott.adat) : '';
  }

  /* ---------- „Összes jegyzet” (LoadAllItemToMEMO, javítva: kettőspont után szóköz, minden P_ és E_) ---------- */
  function osszesHtml(k) {
    var a = k.adat, mj = megj(k), ki = '<h3>Születési képlet tulajdonosának adatai</h3>';
    var nap = R.hetNapja(a.ev, a.ho, a.nap, a.naptar === 'J');
    var NAP = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
    ki += '<p class="nagy"><b>Név:</b> ' + R.esc(a.nev) + '<br><b>Születési idő:</b> ' +
      R.datumStr(a.ev, a.ho, a.nap, a.ora, a.perc).replace(' ', ' - ') + '  (' + NAP[nap] + ')' +
      '<br><b>Születési hely:</b> ' + R.esc([R.Keplet.helyNev(a), a.orszag].filter(Boolean).join(', ')) + '</p>';
    var szakaszok = [['A', 'Általános'], ['J', 'Jegyek'], ['P', 'Planéták'], ['H', 'Házak'], ['F', 'Fényszögek'], ['E', 'Énállapotok']];
    var kulcsok = X.rendez(Object.keys(mj));
    szakaszok.forEach(function (sz) {
      var l = kulcsok.filter(function (k2) { return k2[0] === sz[0]; });
      if (!l.length) return;
      ki += '<h3>' + sz[1] + '</h3>';
      l.forEach(function (k2) {
        var id = parseInt(k2.slice(2), 10);
        var m = X.modell(mj[k2]);
        if (sz[0] !== 'A') {
          var cimke = { t: (sz[0] === 'H' ? id + '. Ház' : elemRovid(sz[0], id)) + ': ', b: true, i: false, u: false, szin: null, hatter: null, meret: null, asztro: false };
          if (m.length && !m[0].felsorolas) m[0].futamok.unshift(cimke); else m.unshift({ felsorolas: false, igazitas: '', futamok: [cimke] });
        }
        ki += '<div class="jelemblokk">' + X.html(m) + '</div>';
      });
    });
    if (!kulcsok.length) ki += '<p><i>Ehhez a képlethez még nincs jegyzet.</i></p>';
    return ki;
  }
  function osszesValt() {
    if (!kotott) return;
    if (!osszes) {
      ment();
      osszes = true;
      $('[data-j="osszes"]').setAttribute('aria-pressed', 'true');
      szerk.setAttribute('contenteditable', 'false'); ablak.classList.add('csakolvas');
      szerk.innerHTML = osszesHtml(kotott);
      $('.jmod').textContent = '';
      $('.jelem').textContent = 'Az ábrához tartozó összes jegyzet (csak olvasható – szerkeszteni elemenként lehet)';
    } else tolt();
  }

  function uj() {
    if (osszes || !kotott) return;
    var ures = !szerk.textContent.trim();
    (ures ? Promise.resolve('igen') : o.kerdez('Ha új jegyzetet szeretne létrehozni, akkor az eddigi jegyzet törlésre kerül! Valóban folytatni szeretné?', false))
      .then(function (v) {
        if (v !== 'igen') return;
        szerk.innerHTML = ''; piszkos = true; ment(); tolt(); szerk.focus();
      });
  }

  /** Fájl betöltése: .mgj → a képlet összes jegyzete (import); .rtf / .txt → az aktuális elem szövege. */
  function betolt(f) {
    f.arrayBuffer().then(function (buf) {
      if (/\.mgj$/i.test(f.name)) { mgjImport(kotott, buf, f.name); return; }
      var b = new Uint8Array(buf), html;
      if (/^\{\\rtf/.test(new TextDecoder('latin1').decode(b.subarray(0, 8)))) html = X.htmlBol(new TextDecoder('windows-1250').decode(b));
      else html = R.esc(global.RegioSzk.decode(buf)).replace(/\r?\n/g, '<br>');
      szerk.focus(); document.execCommand('insertHTML', false, html); valt(); ment();
    });
  }

  function fajlNev(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'jegyzet'; }
  function exportal() {
    if (!kotott) return;
    ment();
    var r = osszes ? null : megj(kotott)[kulcs(tipus, azon)];
    var rtf = osszes ? X.rtf(X.domModell(szerk)) : (r || X.rtf([]));
    o.letolt(new Blob([rtf], { type: 'application/rtf' }),
      fajlNev(R.Keplet.cim(kotott.adat) + ' – ' + (osszes ? 'összes jegyzet' : elemRovid(tipus, azon))) + '.rtf');
  }
  function nyomtat() {
    var ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(ifr);
    var d = ifr.contentDocument;
    d.open();
    d.write('<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>' + R.esc(kotott ? R.Keplet.cim(kotott.adat) : 'Jegyzet') +
      '</title><style>@page{margin:12.7mm 25.4mm}body{font:10pt Arial,sans-serif}.asztro{font-family:"Regio Symbols","Noto Sans Symbols 2","Segoe UI Symbol",sans-serif}h3{text-align:center;font-size:15pt}</style></head><body>' +
      (kotott && !osszes ? '<p><small>' + R.esc(R.Keplet.cim(kotott.adat) + ' – ' + elemNev(tipus, azon)) + '</small></p>' : '') + szerk.innerHTML + '</body></html>');
    d.close();
    setTimeout(function () { ifr.contentWindow.focus(); ifr.contentWindow.print(); setTimeout(function () { ifr.remove(); }, 1000); }, 50);
  }

  /** A Windows-os .mgj beolvasása a képlet jegyzetei közé. Ütközésnél kérdez. */
  function mgjImport(k, buf, nev) {
    if (!k) return Promise.resolve(false);
    var uj;
    try { uj = X.mgjOlvas(buf); } catch (e) { o.uzen('A jegyzetfájl nem olvasható: ' + e.message); return Promise.resolve(false); }
    var kulcsok = Object.keys(uj);
    if (!kulcsok.length) { o.uzen('A(z) ' + (nev || '.mgj') + ' fájlban nincs jegyzet.'); return Promise.resolve(false); }
    var mj = megj(k), utk = kulcsok.filter(function (x) { return mj[x] && mj[x] !== uj[x]; });
    var kerdes = utk.length ? o.kerdez(utk.length + ' elemhez már van jegyzet ennél a képletnél. Felülírjuk őket a fájl tartalmával? ' +
      '(Nem: csak a hiányzók kerülnek be.)', true) : Promise.resolve('igen');
    return kerdes.then(function (v) {
      if (!v) return false;
      [k.adat, k.eredeti].forEach(function (a) {
        if (!a) return;
        a.megjegyzesek = a.megjegyzesek || {};
        kulcsok.forEach(function (x) { if (v === 'igen' || !a.megjegyzesek[x]) a.megjegyzesek[x] = uj[x]; });
      });
      o.valtozott(k, true);
      k.jegyzetKulcsok = jelek(k);
      if (ablak && !ablak.hidden && kotott === k) tolt();
      o.uzen(kulcsok.length + ' jegyzet betöltve' + (nev ? ' (' + nev + ')' : '') + '.');
      return true;
    });
  }
  /** A képlet jegyzetei Windows-os .mgj-ként (a hors\docs mappába tehető, a .szk nevével). */
  function mgjExport(k, szkNev) {
    if (!k) return false;
    if (ablak && !ablak.hidden && kotott === k) ment();
    var mj = megj(k);
    if (!Object.keys(mj).length) { o.uzen('Ennek a képletnek nincs jegyzete.'); return false; }
    var nev = (szkNev ? szkNev.replace(/\.szk$/i, '') : fajlNev(R.Keplet.cim(k.adat))) + '.mgj';
    o.letolt(new Blob([X.mgjEpit(mj)], { type: 'application/octet-stream' }), nev);
    o.uzen('A(z) ' + nev + ' a Windows-os program hors\\docs mappájába másolható.');
    return true;
  }

  /** A jegyzettel rendelkező elemek (a „!” jelekhez). */
  function jelek(k) {
    var ki = {}, mj = megj(k);
    Object.keys(mj).forEach(function (x) { if (mj[x]) ki[x] = true; });
    return ki;
  }

  function nyit(k, t, i) {
    if (!k) return;
    if (k.fajta) { o.uzen('Összevetés képletekhez nem lehet megjegyzést adni!'); return; }
    if (!ablak) epit();
    if (!ablak.hidden && kotott) ment();
    kotott = k; tipus = t; azon = i;
    if (!k.jegyzetKulcsok) k.jegyzetKulcsok = jelek(k);
    szimb = !(o.beall && o.beall.jegyzetSzimbolum === false);
    $('[data-j="szimb"]').setAttribute('aria-pressed', String(szimb));
    ablak.hidden = false;
    tolt();
    szerk.focus();
  }
  function bezar() {
    if (!ablak || ablak.hidden) return;
    ment();
    ablak.hidden = true;
    var k = kotott; kotott = null;
    if (k) o.valtozott(k, true);
  }
  /** A program jelzi, hogy az aktív képlet megváltozhatott: a panel mindig az aktív laphoz kötődik. */
  function aktValt() {
    if (!ablak || ablak.hidden) return;
    var k = o.akt();
    if (k === kotott) return;
    ment();
    if (!k || k.fajta) { bezar(); return; }
    kotott = k; if (!k.jegyzetKulcsok) k.jegyzetKulcsok = jelek(k);
    tolt();
  }

  R.Jegyzet = {
    init: function (opt) { o = opt; },
    nyit: nyit, bezar: bezar, aktValt: aktValt, mgjImport: mgjImport, mgjExport: mgjExport, jelek: jelek,
    nyitva: function () { return !!ablak && !ablak.hidden; },
    vanJegyzet: function (k) { return Object.keys(megj(k)).length > 0; },
    elemNev: elemNev
  };
})(typeof window !== 'undefined' ? window : globalThis);
