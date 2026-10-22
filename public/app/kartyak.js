/*
 * kartyak.js – Kiegészítések: „Jegyek és játszmák” és „Születési értesítő” kártya (a Windows-os kieg_jj / kieg_sze
 * kiegészítések megfelelője). Mindkettő vászonra rajzolódik, így a képernyőn látott kártya és a mentett kép azonos.
 * A „Jegyek és játszmák” szövegei (Rákos Péter könyvéből) a szerverről jönnek (api/jj.php).
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, K = R.Keplet;
  var o = null;   // { uzen, letolt }

  function rgb(r, g, b) { return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  var FEJ_BETU = '"Copperplate", "Copperplate Gothic Light", "Cormorant SC", "Trajan Pro", Georgia, serif';
  var TORZS_BETU = '"Myriad Pro", "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  /** Szöveg tördelése a megadott szélességre; visszaadja a sorokat. */
  function tordel(g, szoveg, szel) {
    var sorok = [];
    String(szoveg).split('\n').forEach(function (bek) {
      if (!bek) { sorok.push(''); return; }
      var szavak = bek.split(' '), sor = '';
      szavak.forEach(function (sz) {
        var p = sor ? sor + ' ' + sz : sz;
        if (g.measureText(p).width > szel && sor) { sorok.push(sor); sor = sz; } else sor = p;
      });
      sorok.push(sor);
    });
    return sorok;
  }
  /** Szövegdoboz: tördelés, a magasság túllépésekor „…” (DT_WORDBREAK | DT_END_ELLIPSIS). */
  function doboz(g, szoveg, x, y, w, h, betu, szin, igazit, sorkoz) {
    g.font = betu; g.fillStyle = szin; g.textAlign = igazit || 'left'; g.textBaseline = 'top';
    var m = parseFloat(betu.match(/(\d+(?:\.\d+)?)px/)[1]), lh = m * (sorkoz || 1.25), sorok = tordel(g, szoveg, w);
    var max = Math.max(1, Math.floor(h / lh));
    if (sorok.length > max) { sorok = sorok.slice(0, max); sorok[max - 1] = sorok[max - 1].replace(/\s*\S*$/, '') + '…'; }
    var tx = igazit === 'center' ? x + w / 2 : igazit === 'right' ? x + w : x;
    sorok.forEach(function (s, i) { g.fillText(s, tx, y + i * lh); });
    return sorok.length * lh;
  }
  /** Egysoros felirat, a szélességhez kicsinyítve (a hiányzó Bebas Neue / Copperplate helyett más betűvel is kifér). */
  function felirat(g, s, x, y, w, meret, csalad, szin) {
    var m = meret;
    g.font = m + 'px ' + csalad;
    while (m > 10 && g.measureText(s).width > w - 12) { m -= 1; g.font = m + 'px ' + csalad; }
    g.fillStyle = szin; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(s, x + w / 2, y + (meret - m) / 2);
  }
  function fajlNev(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '_').trim(); }

  function ablak(cim, osztaly) {
    var d = document.createElement('dialog');
    d.className = 'kartya-dlg ' + (osztaly || '');
    d.setAttribute('aria-label', cim);
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('keydown', function (e) { e.stopPropagation(); });
    return d;
  }
  function kepMent(c, nev, d) {
    var fmt = d.querySelector('[data-fmt]') ? d.querySelector('[data-fmt]').value : 'jpg';
    c.toBlob(function (b) { o.letolt(b, fajlNev(nev) + (fmt === 'png' ? '.png' : '.jpg')); o.uzen('A kép elkészült: ' + fajlNev(nev)); },
      fmt === 'png' ? 'image/png' : 'image/jpeg', 1);
  }

  /* ====================== Jegyek és játszmák (D JJ, JJM, JJX) ====================== */
  function jjRajzol(c, a, x) {
    var g = c.getContext('2d'), W = 550, H = 680;
    g.fillStyle = rgb(88, 58, 50); g.fillRect(0, 0, W, H);
    felirat(g, 'JEGYEK ÉS JÁTSZMÁK', 0, 18, W, 28, FEJ_BETU, rgb(245, 197, 79));
    // ÉNÁLLAPOTOK
    g.fillStyle = rgb(244, 201, 146); g.fillRect(5, 65, 245, 245);
    felirat(g, 'ÉNÁLLAPOTOK', 15, 76, 225, 19, FEJ_BETU, rgb(88, 58, 50));
    var en = x.enallapotok.map(function (e) { return R.JEGYEK[e.jegy] + ' (' + e.mi + ')'; }).join('\n\n');
    if (x.idoNelkul) en += '\n\nA Hold jegye a pontos születési idő ismerete nélkül valószínűsítve.\n\nAz Ascendens és a születési uralkodó jegye a pontos születési idő ismerete nélkül nem meghatározható.';
    doboz(g, en, 18, 108, 219, 196, '15px ' + TORZS_BETU, rgb(88, 58, 50), 'left', 1.2);
    // név
    g.fillStyle = rgb(116, 78, 67); g.fillRect(255, 65, 290, 137);
    g.font = '24px ' + FEJ_BETU;
    var nev = a.nev.toLocaleUpperCase('hu'), sorok = tordel(g, nev, 260), lh = 29, ny = 65 + (137 - sorok.length * lh) / 2;
    doboz(g, nev, 270, Math.max(72, ny), 260, 130, '24px ' + FEJ_BETU, rgb(245, 197, 79), 'center', 1.2);
    // TRIKÓFELIRATOK
    g.fillStyle = rgb(116, 78, 67); g.fillRect(5, 316, 245, 293);
    felirat(g, 'TRIKÓFELIRATOK', 15, 327, 225, 19, FEJ_BETU, rgb(245, 197, 79));
    var tr = x.trikofeliratok.map(function (t) {
      return R.JEGYEK[t.jegy] + ': ' + (t.nagybetu ? t.szoveg.toLocaleUpperCase('hu') : t.szoveg);
    }).join('\n\n');
    doboz(g, tr, 18, 360, 219, 244, '14px ' + TORZS_BETU, rgb(245, 197, 79), 'left', 1.2);
    // SZÜLŐI PROGRAMOK
    g.fillStyle = rgb(172, 138, 93); g.fillRect(255, 207, 290, 402);
    felirat(g, 'SZÜLŐI PROGRAMOK', 265, 218, 270, 19, FEJ_BETU, rgb(88, 58, 50));
    var sp = x.idoNelkul ? 'A szülői programok a pontos születési idő ismerete nélkül nem meghatározhatók.'
      : x.szuloiProgramok.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n\n');
    doboz(g, sp, 270, 252, 260, 350, '15px ' + TORZS_BETU, rgb(88, 58, 50), 'left', 1.2);
    // lábléc
    g.fillStyle = rgb(70, 46, 40); g.fillRect(0, 614, W, 66);
    doboz(g, 'Az asztrológiai énállapotok kapcsolati\njátszmáiról, sorsforgatókönyvéről bővebben\nRákos Péter Jegyek és játszmák c. könyvében olvashatsz.',
      0, 620, W, 58, '13px ' + TORZS_BETU, rgb(196, 160, 110), 'center', 1.25);
  }
  function jj(k) {
    if (!k || !k.e) { o.uzen('Nincs kiválasztható Születési képlet!'); return; }
    var e = k.fajta ? k.e : k.e, a = k.adat;
    var idoNelkul = !!a.ismeretlen;
    K.jj(e, idoNelkul).then(function (x) {
      var d = ablak('Jegyek és játszmák', 'jj');
      d.innerHTML = '<div class="kfej"><b>Jegyek és játszmák</b><span class="tolt"></span>' +
        '<label class="halv">Formátum: <select data-fmt><option value="jpg">JPG</option><option value="png">PNG</option></select></label>' +
        '<button type="button" class="gomb" data-m="ment">Mentés képként</button>' +
        '<button type="button" class="kisgomb" data-m="nevjegy" title="A program névjegye" aria-label="A program névjegye">i</button>' +
        '<button type="button" class="kisgomb" data-m="zar" title="Bezárás (Esc)" aria-label="Bezárás"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
        '<canvas width="550" height="680" role="img"></canvas><p class="halv kinfo" hidden>„Jegyek és játszmák” – Design: Rákos Péter, Program: Nemes Balázs, 2014. ' +
        'Bővebben: jegyekesjatszmak.hu, humanisztikus.hu/asztrologia-konyvek</p>';
      var c = d.querySelector('canvas');
      c.setAttribute('aria-label', 'Jegyek és játszmák kártya: ' + a.nev + '. Énállapotok: ' +
        x.enallapotok.map(function (z) { return R.JEGYEK[z.jegy] + ' (' + z.mi + ')'; }).join(', ') + '.');
      jjRajzol(c, a, x);
      d.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-m]'); if (!b) return;
        var m = b.getAttribute('data-m');
        if (m === 'zar') d.close();
        else if (m === 'ment') kepMent(c, 'jegyekesjatszmak.hu - ' + a.nev, d);
        else if (m === 'nevjegy') { var p = d.querySelector('.kinfo'); p.hidden = !p.hidden; }
      });
      d.showModal();
    }, function (h) { o.uzen('A Jegyek és játszmák kártya most nem érhető el: ' + h.message); });
  }

  /* ====================== Születési értesítő (D SZE, SZEM, SZEX) ====================== */
  var FIU = rgb(168, 186, 213), LANY = rgb(233, 166, 198), ZOLD = rgb(197, 213, 123);
  function szeRajzol(c, a, e, st) {
    var g = c.getContext('2d'), W = 960, H = 725, sz = st.fiu ? FIU : LANY;
    g.fillStyle = rgb(88, 56, 26); g.fillRect(0, 0, W, H);
    var AM = '"Amatic SC", "Amatic", "Comic Sans MS", cursive', BN = '"Bebas Neue", "Oswald", Impact, "Arial Narrow", sans-serif';
    // CSILLAGJEGYEIM
    g.fillStyle = '#fff'; g.fillRect(24, 24, 300, 420);
    g.fillStyle = sz; g.fillRect(24, 24, 300, 62);
    felirat(g, 'CSILLAGJEGYEIM', 24, 36, 300, 40, BN, rgb(88, 56, 26));
    var pl = function (id) { return e.poz[id] ? R.jegyben(e.poz[id].lon).j : null; };
    var jegyek = [[pl(0), 'Nap']];
    if (!a.ismeretlen) jegyek.push([R.jegyben(e.hz.asc).j, 'Ascendens']);
    jegyek.push([pl(1), 'Hold']);
    var y = 110;
    jegyek.forEach(function (j) {
      g.font = '52px ' + '"Regio Symbols", "Segoe UI Symbol", sans-serif'; g.fillStyle = sz; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(R.JEGYGLIF[j[0]] + R.VS, 44, y);
      doboz(g, R.JEGYEK[j[0]], 112, y - 4, 200, 50, 'bold 52px ' + AM, rgb(88, 56, 26), 'left');
      doboz(g, '(' + j[1] + ')', 112, y + 46, 200, 30, '28px ' + AM, rgb(120, 96, 70), 'left');
      y += 104;
    });
    // SZÜLETTEM / MAGASSÁGOM / SÚLYOM
    var dob = function (x0, y0, w, h, cim, ertek, meret) {
      g.fillStyle = ZOLD; g.fillRect(x0, y0, w, h);
      felirat(g, cim, x0, y0 + 10, w, 32, BN, rgb(88, 56, 26));
      doboz(g, ertek, x0 + 8, y0 + 52, w - 16, h - 56, 'bold ' + (meret || 40) + 'px ' + AM, rgb(60, 40, 18), 'center', 1.05);
    };
    var datum = R.datumStr(a.ev, a.ho, a.nap) + '.\n' + R.pad(a.ismeretlen ? 12 : a.ora) + ' óra ' + R.pad(a.ismeretlen ? 0 : a.perc) + ' perc';
    dob(24, 462, 300, 150, 'SZÜLETTEM', datum, 42);
    dob(342, 462, 190, 150, 'MAGASSÁGOM', st.magassag ? st.magassag + ' cm' : '… cm', 46);
    dob(550, 462, 190, 150, 'SÚLYOM', st.suly ? st.suly + ' gramm' : '… gramm', 40);
    // MEGÉRKEZTEM + név
    g.fillStyle = sz; g.fillRect(342, 24, 594, 120);
    felirat(g, 'MEGÉRKEZTEM', 342, 34, 594, 38, BN, rgb(88, 56, 26));
    doboz(g, a.nev, 352, 74, 574, 64, 'bold 56px ' + AM, rgb(60, 40, 18), 'center', 1);
    // fénykép
    var fx = 342, fy = 162, fw = 594, fh = 282;
    g.fillStyle = '#fff'; g.fillRect(fx, fy, fw, fh);
    if (st.kep) {
      g.save(); g.beginPath(); g.rect(fx + 8, fy + 8, fw - 16, fh - 16); g.clip();
      var kw = st.kep.naturalWidth, kh = st.kep.naturalHeight, fordit = st.forgat % 180 !== 0;
      var alap = Math.min((fw - 16) / (fordit ? kh : kw), (fh - 16) / (fordit ? kw : kh)) * st.nagyit;
      g.translate(fx + fw / 2 + st.dx, fy + fh / 2 + st.dy); g.rotate(st.forgat * Math.PI / 180);
      g.drawImage(st.kep, -kw * alap / 2, -kh * alap / 2, kw * alap, kh * alap);
      g.restore();
    } else doboz(g, 'Kattints a „Fénykép…” gombra a kép hozzáadásához!', fx + 40, fy + fh / 2 - 30, fw - 80, 60, '30px ' + AM, rgb(140, 120, 100), 'center');
    // nem jelzése és könyvajánló
    g.fillStyle = sz; g.fillRect(758, 462, 178, 150);
    doboz(g, st.fiu ? 'Kisfiú\nvagyok' : 'Kislány\nvagyok', 758, 486, 178, 110, 'bold 50px ' + AM, rgb(60, 40, 18), 'center', 1);
    doboz(g, 'Csillagjegyeimről részletesen BÖSZÖRMÉNYI GYULA - RÁKOS PÉTER: Csillagok nyelvén című könyvében olvashattok.',
      24, 640, 912, 60, '28px ' + AM, rgb(233, 220, 196), 'center', 1.1);
  }
  function sze(k) {
    if (!k || !k.e) { o.uzen('Nincs kiválasztható Születési képlet!'); return; }
    var a = k.adat, e = k.e, st = { fiu: true, suly: '', magassag: '', kep: null, nagyit: 1, forgat: 0, dx: 0, dy: 0 };
    var d = ablak('Születési értesítő', 'sze');
    d.innerHTML = '<div class="kfej"><b>Születési értesítő</b><span class="tolt"></span>' +
      '<label class="halv">Formátum: <select data-fmt><option value="jpg">JPG</option><option value="png">PNG</option></select></label>' +
      '<button type="button" class="gomb" data-m="ment">Mentés képként</button>' +
      '<button type="button" class="kisgomb" data-m="zar" title="Bezárás (Esc)" aria-label="Bezárás"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '<div class="sze-urlap">' +
      '<label><input type="radio" name="szeNem" value="fiu" checked> Kisfiú</label><label><input type="radio" name="szeNem" value="lany"> Kislány vagyok</label>' +
      '<label>Súlyom: <input type="number" min="0" max="9999" step="10" data-s="suly" style="width:80px"> gramm</label>' +
      '<label>Magasságom: <input type="number" min="0" max="80" step="1" data-s="magassag" style="width:64px"> cm</label>' +
      '<button type="button" class="gomb" data-m="kep">Fénykép…</button>' +
      '<button type="button" class="kisgomb" data-m="kisebb" title="Kicsinyítés" aria-label="Kicsinyítés">−</button>' +
      '<button type="button" class="kisgomb" data-m="nagyobb" title="Nagyítás" aria-label="Nagyítás">+</button>' +
      '<button type="button" class="kisgomb" data-m="balra" title="Forgatás balra" aria-label="Forgatás balra">⟲</button>' +
      '<button type="button" class="kisgomb" data-m="jobbra" title="Forgatás jobbra" aria-label="Forgatás jobbra">⟳</button>' +
      '<span class="halv">A képet egérrel húzhatod.</span></div>' +
      '<canvas width="960" height="725" role="img" aria-label="Születési értesítő: ' + R.esc(a.nev) + '"></canvas>';
    var c = d.querySelector('canvas');
    function rajz() { szeRajzol(c, a, e, st); }
    function kepBetolt(src) { var i = new Image(); i.onload = function () { st.kep = i; st.nagyit = 1; st.forgat = 0; st.dx = st.dy = 0; rajz(); }; i.src = src; }
    if (a.kepAdat) kepBetolt(a.kepAdat); else if (k.kepUrl) kepBetolt(k.kepUrl);
    d.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.name === 'szeNem') st.fiu = t.value === 'fiu';
      if (t.getAttribute('data-s')) st[t.getAttribute('data-s')] = t.value ? String(Math.max(0, Math.round(+t.value))) : '';
      rajz();
    });
    d.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-m]'); if (!b) return;
      var m = b.getAttribute('data-m');
      if (m === 'zar') d.close();
      else if (m === 'ment') kepMent(c, 'szuletesiertesito.hu - ' + a.nev, d);
      else if (m === 'kep') {
        var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
        i.addEventListener('change', function () { var f = i.files && i.files[0]; if (f) kepBetolt(URL.createObjectURL(f)); });
        i.click();
      }
      else if (m === 'nagyobb') { st.nagyit = Math.min(5, st.nagyit + 0.1); rajz(); }
      else if (m === 'kisebb') { st.nagyit = Math.max(0.1, st.nagyit - 0.1); rajz(); }
      else if (m === 'balra') { st.forgat = (st.forgat + 270) % 360; rajz(); }
      else if (m === 'jobbra') { st.forgat = (st.forgat + 90) % 360; rajz(); }
    });
    var huz = null;
    c.addEventListener('pointerdown', function (ev) {
      if (!st.kep) return;
      var r = c.getBoundingClientRect(), sk = c.width / r.width;
      huz = { x: ev.clientX, y: ev.clientY, dx: st.dx, dy: st.dy, sk: sk }; c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', function (ev) {
      if (!huz) return;
      st.dx = huz.dx + (ev.clientX - huz.x) * huz.sk; st.dy = huz.dy + (ev.clientY - huz.y) * huz.sk; rajz();
    });
    c.addEventListener('pointerup', function () { huz = null; });
    rajz();
    d.showModal();
    // a webbetűk betöltése után újrarajzolás
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('40px "Amatic SC"'), document.fonts.load('bold 40px "Amatic SC"')]).then(rajz, function () {});
    }
  }

  R.Kartyak = { init: function (opt) { o = opt; }, jj: jj, sze: sze };
})(typeof window !== 'undefined' ? window : globalThis);
