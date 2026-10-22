/*
 * kartyak.js – Kiegészítések: „Jegyek és játszmák” (kieg_jj) és „Születési értesítő” (kieg_sze) – a Windows-os
 * ablakok pixelre azonos elrendezésével (a .dfm-ek koordinátái), a képmentés a Delphi SaveToFile / SavePicturetoFile
 * rajzolási lépéseivel.
 * A dizájnképek (Rákos Péter) nem részei a nyilvános repónak: a tárhelyen a ../kieg/ mappából töltődnek
 * (a privát telepítőcsomag része); ha hiányoznak, a kártya képek nélkül jelenik meg.
 * A „Jegyek és játszmák” szövegei a szerverről jönnek (api/jj.php).
 * Betűk: Amatic SC, Bebas Neue, Source Sans 3 (a Myriad Pro helyett) – mind SIL OFL 1.1.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, K = R.Keplet;
  var o = null;   // { uzen, letolt }
  var KEP = '../kieg/';

  function rgb(r, g, b) { return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  // egyszeres idézőjellel: HTML style-attribútumban és vásznon is használható
  var MYRIAD = "'Source Sans 3', 'Myriad Pro', 'Segoe UI', Arial, sans-serif";
  var BEBAS = "'Bebas Neue', Oswald, Impact, sans-serif";
  var AMATIC = "'Amatic SC', 'Comic Sans MS', cursive";
  var esc = function (s) { return R.esc(s); };
  function pt(p) { return p * 96 / 72; }   // Delphi Font.Size (pt) → képpont

  /* ---------- közös: abszolút pozicionált elemek, képek ---------- */
  function hely(x, y, w, h) { return 'left:' + x + 'px;top:' + y + 'px;' + (w ? 'width:' + w + 'px;' : '') + (h ? 'height:' + h + 'px;' : ''); }
  function kep(nev, x, y, w, h, extra) {
    return '<img src="' + KEP + nev + '" alt="" draggable="false" style="position:absolute;' + hely(x, y, w, h) + (extra || '') +
      '" onerror="this.style.visibility=\'hidden\'">';
  }
  /** Kép betöltése (Promise<Image|null>) */
  function kepTolt(src) {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
  }
  function betukKeszek() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['40px "Amatic SC"', 'bold 40px "Amatic SC"', '20px "Bebas Neue"', '600 16px "Source Sans 3"']
      .map(function (f) { return document.fonts.load(f, 'ÁÉŐŰáéőű'); })).then(function () {}, function () {});
  }

  /* ---------- vászon: DrawText megfelelője (DT_WORDBREAK, DT_CENTER, DT_END_ELLIPSIS, függőleges középre) ---------- */
  function tordel(g, szoveg, szel) {
    var sorok = [];
    String(szoveg).split('\n').forEach(function (bek) {
      if (!bek) { sorok.push(''); return; }
      var sor = '';
      bek.split(' ').forEach(function (sz) {
        var p = sor ? sor + ' ' + sz : sz;
        if (g.measureText(p).width > szel && sor) { sorok.push(sor); sor = sz; } else sor = p;
      });
      sorok.push(sor);
    });
    return sorok;
  }
  function drawText(g, szoveg, r, betu, szin, opt) {
    opt = opt || {};
    g.font = betu; g.fillStyle = szin; g.textBaseline = 'top';
    var m = parseFloat(/(\d+(?:\.\d+)?)px/.exec(betu)[1]), lh = m * (opt.sorkoz || 1.22);
    var w = r[2] - r[0], h = r[3] - r[1];
    var sorok = opt.tordel === false ? String(szoveg).split('\n') : tordel(g, szoveg, w);
    var max = Math.max(1, Math.floor(h / lh + 0.01));
    if (sorok.length > max) { sorok = sorok.slice(0, max); sorok[max - 1] = sorok[max - 1].replace(/\s*\S*$/, '') + '…'; }
    var y = r[1] + (opt.fuggKozep ? Math.max(0, (h - sorok.length * lh) / 2) : 0);
    g.textAlign = opt.kozep ? 'center' : 'left';
    sorok.forEach(function (s, i) { g.fillText(s, opt.kozep ? r[0] + w / 2 : r[0], y + i * lh); });
  }
  function fajlNev(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '_').trim(); }
  function vaszonMent(c, nev) {
    c.toBlob(function (b) { o.letolt(b, fajlNev(nev) + '.jpg'); o.uzen('A képet elmentettem: ' + fajlNev(nev) + '.jpg'); }, 'image/jpeg', 1);
  }

  function ablak(cim, osztaly, w, h) {
    var d = document.createElement('dialog');
    d.className = 'kartya-dlg ' + osztaly;
    d.setAttribute('aria-label', cim);
    d.style.width = w + 'px'; d.style.height = h + 'px';
    // kis képernyőn arányosan kicsinyítve
    var z = Math.min(1, (innerWidth - 16) / w, (innerHeight - 16) / h);
    if (z < 1) d.style.zoom = z.toFixed(3);
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('keydown', function (e) { e.stopPropagation(); });
    // a keret nélküli Windows-os ablakhoz hasonlóan bárhol megfogva mozgatható (WM_NCHITTEST → HTCAPTION)
    var huz = null;
    d.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, input, label, a, [data-m], .sze-foto, .kartya-nevjegy')) return;
      var r = d.getBoundingClientRect();
      huz = { x: e.clientX - r.left, y: e.clientY - r.top };
      d.style.margin = '0'; d.style.left = r.left + 'px'; d.style.top = r.top + 'px';
      d.setPointerCapture(e.pointerId);
    });
    d.addEventListener('pointermove', function (e) { if (huz) { d.style.left = (e.clientX - huz.x) + 'px'; d.style.top = (e.clientY - huz.y) + 'px'; } });
    d.addEventListener('pointerup', function () { huz = null; });
    return d;
  }
  function gombKep(nev, x, y, cim, m, extra) {
    return '<button type="button" class="kk-gomb" data-m="' + m + '" title="' + esc(cim) + '" aria-label="' + esc(cim) + '" style="' + hely(x, y) + (extra || '') + '">' +
      '<img src="' + KEP + nev + '" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode(\'' + esc(cim.charAt(0)) + '\'))"></button>';
  }

  /* ====================== Jegyek és játszmák (fJJMain.dfm, uJJImageExport.pas) ====================== */
  var JJ = { alap: rgb(88, 58, 50), cim: rgb(245, 197, 79), enBg: rgb(244, 201, 146), enBetu: rgb(88, 58, 50),
    nevBg: rgb(116, 78, 67), szuloBg: rgb(172, 138, 93), lablec: rgb(148, 115, 75) };
  var JJ_LABLEC = 'Az asztrológiai énállapotok kapcsolati\njátszmáiról, sorsforgatókönyvéről bővebben\nRákos Péter Jegyek és játszmák c. könyvében olvashatsz.';
  var JJ_NOTIME_EN = 'A Hold jegye a pontos születési idő ismerete nélkül valószínűsítve.\n\nAz Ascendens és a születési uralkodó jegye a pontos születési idő ismerete nélkül nem meghatározható.';
  var JJ_NOTIME_SZ = 'A szülői programok a pontos születési idő ismerete nélkül nem meghatározhatók.';

  function jjSzovegek(x) {
    return {
      en: x.enallapotok.map(function (e) { return R.JEGYEK[e.jegy] + ' (' + e.mi + ')'; }).join('\n\n'),
      triko: x.trikofeliratok.map(function (t) { return R.JEGYEK[t.jegy] + ': ' + (t.nagybetu ? t.szoveg.toLocaleUpperCase('hu') : t.szoveg); }).join('\n\n'),
      szulo: x.szuloiProgramok.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n\n')
    };
  }
  function jjHtml(a, x) {
    var t = jjSzovegek(x), nt = x.idoNelkul;
    var lbl = function (s, xx, y, w, h, meret, szin, extra) {
      return '<div class="kk-lbl" style="' + hely(xx, y, w, h) + 'font-size:' + meret + 'px;color:' + szin + ';' + (extra || '') + '">' + esc(s) + '</div>';
    };
    return '<div class="kk-lap jj-lap" style="width:550px;height:679px;background:' + JJ.alap + ';font-family:' + MYRIAD + '">' +
      '<div class="kk-lbl jj-cim" style="left:0;top:17px;width:550px;text-align:center"><img src="' + KEP + 'jj-cim.png" alt="Jegyek és játszmák" style="height:31px" ' +
      'onerror="this.replaceWith(document.createTextNode(\'JEGYEK ÉS JÁTSZMÁK\'))"></div>' +
      // énállapotok
      '<div class="kk-pnl" style="' + hely(5, 65, 245, 245) + 'background:' + JJ.enBg + '">' +
      lbl('ÉNÁLLAPOTOK', 0, 13, 245, 23, 19, JJ.enBetu, 'text-align:center') +
      lbl(t.en, 27, 50, 193, 187, 16, JJ.enBetu) +
      (nt ? lbl(JJ_NOTIME_EN, 9, 126, 227, 100, 12, JJ.enBetu) : '') + '</div>' +
      // név
      '<div class="kk-pnl" style="' + hely(255, 65, 290, 137) + 'background:' + JJ.nevBg + '">' +
      '<div class="kk-lbl" style="' + hely(11, 14, 269, 109) + 'font-size:24px;color:' + JJ.cim + ';display:flex;align-items:center;justify-content:center;text-align:center">' +
      esc(a.nev.toLocaleUpperCase('hu')) + '</div></div>' +
      // trikófeliratok
      '<div class="kk-pnl" style="' + hely(5, 316, 245, 293) + 'background:' + JJ.nevBg + '">' +
      lbl('TRIKÓFELIRATOK', 0, 13, 245, 23, 19, JJ.cim, 'text-align:center') +
      lbl(t.triko, 10, 50, 227, 240, 15, JJ.cim) + '</div>' +
      // szülői programok
      '<div class="kk-pnl" style="' + hely(255, 207, 290, 402) + 'background:' + JJ.szuloBg + '">' +
      lbl('SZÜLŐI PROGRAMOK', 0, 13, 290, 23, 19, JJ.enBetu, 'text-align:center') +
      (nt ? lbl(JJ_NOTIME_SZ, 37, 50, 217, 100, 12, JJ.enBetu, 'text-align:center') : lbl(t.szulo, 14, 50, 265, 339, 16, JJ.enBetu)) +
      gombKep('jj-imgExport.png', 262, 375, 'Mentés képként', 'ment') + '</div>' +
      // lábléc
      kep('jj-imgKockak.jpg', 0, 614, 550, 65, 'object-fit:cover;object-position:left top') +
      '<a class="kk-lbl jj-lablec" href="https://humanisztikus.hu/asztrologia-konyvek" target="_blank" rel="noopener" title="Ugrás a weboldalhoz" style="' +
      hely(12, 620, 423, 53) + 'font-size:13px;color:' + JJ.lablec + ';display:flex;align-items:center;text-decoration:none">' + esc(JJ_LABLEC) + '</a>' +
      // címsor-ikonok
      gombKep('jj-imgExit.png', 517, 8, 'Kilépés a programból', 'zar') +
      gombKep('jj-imgAbout.png', 517, 32, 'A program névjegye', 'nevjegy') +
      '</div>';
  }
  function jjNevjegy(d) {
    var n = document.createElement('div');
    n.className = 'kartya-nevjegy'; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', 'Jegyek és játszmák – névjegy');
    n.style.cssText = 'width:441px;height:470px;background:' + JJ.alap + ';font-family:' + MYRIAD;
    n.innerHTML = '<div class="kk-pnl" data-m="njzar" style="' + hely(5, 6, 431, 421) + 'background:' + rgb(214, 175, 128) + ';cursor:pointer">' +
      kep('jj-nj-cim.png', 106, 33, 195, 0) + kep('jj-nj-verzio.png', 189, 66, 30, 0) +
      '<div class="kk-lbl" style="' + hely(10, 289) + 'font-size:15px;color:' + JJ.enBetu + '">Program: Nemes Balázs</div>' +
      '<div class="kk-lbl" style="' + hely(10, 315) + 'font-size:15px;color:' + JJ.enBetu + '">Design: Rákos Péter</div>' +
      '<div class="kk-lbl" style="' + hely(247, 108, 176, 248) + 'background:' + rgb(61, 40, 34) + '"></div>' +
      '<a href="https://humanisztikus.hu/asztrologia-konyvek" target="_blank" rel="noopener" title="Ugrás a weboldalhoz">' + kep('jj-nj-imgBook.jpg', 240, 103, 180, 250) + '</a></div>' +
      gombKep('jj-nj-imgClose.png', 398, 433, 'Bezárás', 'njzar');
    d.querySelector('.kk-lap').appendChild(n);
    n.style.position = 'absolute'; n.style.left = ((550 - 441) / 2) + 'px'; n.style.top = ((679 - 470) / 2) + 'px';
  }
  /** Mentés képként (uJJImageExport.SaveToFile): 550×680 */
  function jjExport(a, x) {
    var t = jjSzovegek(x), nt = x.idoNelkul;
    return Promise.all([kepTolt(KEP + 'jj-imgKockak.jpg'), kepTolt(KEP + 'jj-cim-export.png'), betukKeszek()]).then(function (l) {
      var c = document.createElement('canvas'); c.width = 550; c.height = 680;
      var g = c.getContext('2d'), L = 5, F = 65, LC = 245, RC = 290, f = '600 ';
      g.fillStyle = JJ.alap; g.fillRect(0, 0, 550, 680);
      g.fillStyle = JJ.enBg; g.fillRect(L, F, LC, 245);
      g.fillStyle = JJ.nevBg; g.fillRect(L + LC + L, F, RC, 137);
      g.fillRect(L, F + 245 + L, 245, 294);
      g.fillStyle = JJ.szuloBg; g.fillRect(L + LC + L, F + 137 + L, RC, 402);
      if (l[0]) g.drawImage(l[0], 0, 680 - l[0].height);
      if (l[1]) { var cw = l[1].width / 2, ch = l[1].height / 2; g.drawImage(l[1], (550 - cw) / 2, (65 - ch) / 2, cw, ch); }
      else drawText(g, 'JEGYEK ÉS JÁTSZMÁK', [0, 0, 550, 65], pt(28) + 'px Georgia, serif', JJ.cim, { kozep: true, fuggKozep: true });
      drawText(g, 'ÉNÁLLAPOTOK', [L, F + 17, L + LC, F + 37], f + pt(14) + 'px ' + MYRIAD, JJ.enBetu, { kozep: true });
      drawText(g, t.en, [L + 27, F + 53, L + LC - 10, F + 240], f + pt(12) + 'px ' + MYRIAD, JJ.enBetu);
      if (nt) drawText(g, JJ_NOTIME_EN, [L + 5, F + 130, L + LC - 5, F + 245], f + pt(9) + 'px ' + MYRIAD, JJ.enBetu);
      drawText(g, 'TRIKÓFELIRATOK', [L, F + 245 + L + 17, L + LC, F + 245 + L + 37], f + pt(14) + 'px ' + MYRIAD, JJ.cim, { kozep: true });
      drawText(g, t.triko, [L + 10, F + 245 + L + 53, L + LC - 10, F + 245 + L + 290], f + pt(11) + 'px ' + MYRIAD, JJ.cim);
      drawText(g, a.nev.toLocaleUpperCase('hu'), [L + LC + L + 10, F + 10, L + LC + L + RC - 10, F + 127], f + pt(18) + 'px ' + MYRIAD, JJ.cim, { kozep: true, fuggKozep: true });
      drawText(g, 'SZÜLŐI PROGRAMOK', [L + LC + L, F + 137 + L + 17, L + LC + L + RC, F + 137 + L + 37], f + pt(14) + 'px ' + MYRIAD, JJ.enBetu, { kozep: true });
      if (nt) drawText(g, JJ_NOTIME_SZ, [L + LC + L + 35, F + 137 + L + 53, L + LC + L + RC - 35, F + 137 + L + 53 + 51], f + pt(9) + 'px ' + MYRIAD, JJ.enBetu, { kozep: true, fuggKozep: true });
      else drawText(g, t.szulo, [L + LC + L + 15, F + 137 + L + 53, L + LC + L + RC - 15, F + 137 + L + 392], f + pt(12) + 'px ' + MYRIAD, JJ.enBetu);
      drawText(g, JJ_LABLEC, [L + 5, 680 - (l[0] ? l[0].height : 66) + 10, 540, 675], f + pt(10) + 'px ' + MYRIAD, JJ.lablec);
      return c;
    });
  }
  function jj(k) {
    if (!k || !k.e) { o.uzen('Nincs kiválasztható Születési képlet!'); return; }
    var a = k.adat;
    K.jj(k.e, !!a.ismeretlen).then(function (x) {
      var d = ablak('Jegyek és játszmák', 'jj', 550, 679);
      d.innerHTML = jjHtml(a, x);
      d.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-m]'); if (!b) return;
        var m = b.getAttribute('data-m');
        if (m === 'zar') d.close();
        else if (m === 'nevjegy') { if (!d.querySelector('.kartya-nevjegy')) jjNevjegy(d); }
        else if (m === 'njzar') { if (ev.target.closest('a')) return; var n = d.querySelector('.kartya-nevjegy'); if (n) n.remove(); }
        else if (m === 'ment') jjExport(a, x).then(function (c) { vaszonMent(c, 'jegyekesjatszmak.hu - ' + a.nev); });
      });
      d.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { var n = d.querySelector('.kartya-nevjegy'); if (n) { ev.preventDefault(); n.remove(); } }
      });
      d.showModal();
      var z = d.querySelector('[data-m="zar"]'); if (z) z.focus();
    }, function (h) { o.uzen('A Jegyek és játszmák kártya most nem érhető el: ' + h.message); });
  }

  /* ====================== Születési értesítő (fSZEMain.dfm, uBabyImageHandling.pas) ====================== */
  var SZE = { alap: rgb(88, 56, 26), zold: rgb(197, 213, 123), jegy: rgb(111, 81, 52), fiu: rgb(168, 186, 213), lany: rgb(233, 166, 198) };
  function szeJegyek(a, e) {
    var j = function (lon) { return R.JEGYEK[R.jegyben(lon).j]; };
    var l = [j(e.poz[0].lon) + ' (Nap)'];
    if (!a.ismeretlen) l.push(j(e.hz.asc) + ' (Ascendens)');
    l.push(j(e.poz[1].lon) + ' (Hold)');
    return l.join('\n');
  }
  function szeSzulAdat(a) {
    return R.datumStr(a.ev, a.ho, a.nap) + '.\n' + R.pad(a.ismeretlen ? 12 : a.ora) + ' óra ' + R.pad(a.ismeretlen ? 0 : a.perc) + ' perc';
  }
  function sze(k) {
    if (!k || !k.e) { o.uzen('Nincs kiválasztható Születési képlet!'); return; }
    var a = k.adat, e = k.e;
    var st = { fiu: true, magassag: 0, suly: 0, adatok: false, kep: null, skala: 1, x: 0, y: 0 };
    var d = ablak('Születési értesítő', 'sze', 858, 691);
    function gs(nev) { return st.fiu ? nev + '_boy.png' : nev + '_girl.png'; }
    function szin() { return st.fiu ? SZE.fiu : SZE.lany; }
    function lbl(s, x, y, w, h, betu, meret, szinS, extra) {
      return '<div class="kk-lbl" style="' + hely(x, y, w, h) + 'font-family:' + betu + ';font-size:' + meret + 'px;color:' + szinS + ';' + (extra || '') + '">' + esc(s) + '</div>';
    }
    function rajzol() {
      var cs = szin(), kepVan = !!st.kep;
      d.innerHTML = '<div class="kk-lap sze-lap" style="width:858px;height:691px">' +
        '<div class="kk-pnl" style="' + hely(0, 0, 858, 644) + 'background:' + SZE.alap + '"></div>' +
        '<div class="kk-pnl" style="' + hely(360, 643, 498, 48) + 'background:' + SZE.alap + '"></div>' +
        // csillagjegyeim
        '<div class="kk-pnl" style="' + hely(1, 1, 359, 501) + 'background:#fff">' +
        kep('sze-' + (st.fiu ? 'imgViragos_boy.jpg' : 'imgViragos_girl.jpg'), 12, 80, 332, 374) +
        lbl('CSILLAGJEGYEIM', 20, 20, 0, 0, BEBAS, 19, cs, 'line-height:24px') +
        lbl(szeJegyek(a, e), 20, 56, 324, 310, AMATIC, 27, SZE.jegy, 'font-weight:700;line-height:1.2') +
        '<a class="sze-konyv" href="https://humanisztikus.hu/asztrologia-konyvek" target="_blank" rel="noopener" title="Ugrás a weboldalhoz" style="color:' + cs + '">' +
        '<span style="' + hely(6, 460) + '">Csillagjegyeimről részletesen BÖSZÖRMÉNYI GYULA - </span><span style="' + hely(6, 480) + '">RÁKOS PÉTER: <i>Csillagok nyelvén</i> című könyvében olvashattok.</span></a></div>' +
        // születési adatok
        '<div class="kk-pnl" style="' + hely(1, 510, 359, 133) + 'background:' + SZE.zold + '">' +
        lbl('SZÜLETTEM', 7, 15, 110, 24, BEBAS, 19, '#fff', 'text-align:center') +
        lbl('MAGASSÁGOM', 127, 15, 110, 24, BEBAS, 19, '#fff', 'text-align:center') +
        lbl('SÚLYOM', 247, 15, 110, 24, BEBAS, 19, '#fff', 'text-align:center') +
        lbl(szeSzulAdat(a), 7, 55, 110, 75, AMATIC, 24, '#fff', 'font-weight:700;text-align:center;line-height:1.15') +
        (st.adatok ? lbl(st.magassag + ' cm', 127, 55, 110, 75, AMATIC, 24, '#fff', 'font-weight:700;text-align:center') +
          lbl(st.suly + ' g', 247, 55, 110, 75, AMATIC, 24, '#fff', 'font-weight:700;text-align:center')
          : '<button type="button" class="kk-lbl sze-adatgomb" data-m="adatok" style="' + hely(127, 55, 230, 75) + 'font-family:' + AMATIC +
            ';font-size:24px;font-weight:700;color:#fff">Kattints ide az adataim megadásához!</button>') + '</div>' +
        // adatbekérő panel (pnlBirthDetails)
        '<div class="kk-pnl sze-adatpanel" hidden style="' + hely(1, 510, 359, 133) + 'background:' + SZE.zold + ';font-family:' + BEBAS + ';font-size:19px;color:#fff">' +
        '<label style="' + hely(18, 14) + '" for="szeMag">Magasságom</label><input id="szeMag" type="number" min="0" max="70" value="' + st.magassag + '" style="' + hely(119, 10, 96, 32) + '">' +
        '<span style="' + hely(226, 14) + '">cm</span>' +
        '<label style="' + hely(18, 55) + '" for="szeSuly">Súlyom</label><input id="szeSuly" type="number" min="0" max="9999" step="10" value="' + st.suly + '" style="' + hely(119, 51, 96, 32) + '">' +
        '<span style="' + hely(226, 55) + '">gramm</span>' +
        '<label style="' + hely(19, 96) + 'color:' + SZE.jegy + '"><input type="radio" name="szeNem" value="fiu"' + (st.fiu ? ' checked' : '') + '> Kisfiú</label>' +
        '<label style="' + hely(98, 96) + 'color:' + SZE.jegy + '"><input type="radio" name="szeNem" value="lany"' + (st.fiu ? '' : ' checked') + '> Kislány vagyok</label>' +
        gombKep('sze-' + gs('imgAccept'), 313, 88, 'Tovább a születési értesítőhöz', 'elfogad') + '</div>' +
        // név
        '<div class="kk-pnl" style="' + hely(367, 1, 490, 234) + 'background:' + SZE.zold + '">' +
        lbl('MEGÉRKEZTEM', 4, 17, 483, 33, BEBAS, 24, '#fff', 'text-align:center') +
        lbl(a.nev, 8, 49, 474, 168, AMATIC, 72, '#fff', 'font-weight:700;text-align:center;line-height:1.05;overflow:hidden') +
        gombKep('sze-imgExit.png', 463, 6, 'Kilépés a programból', 'zar') +
        gombKep('sze-imgAbout.png', 463, 31, 'A program névjegye', 'nevjegy') + '</div>' +
        // fénykép
        '<div class="kk-pnl sze-foto" style="' + hely(367, 242, 490, 401) + 'background:#fff">' +
        (kepVan ? '<canvas width="490" height="401" style="position:absolute;left:0;top:0;cursor:move" aria-label="A betöltött fénykép – egérrel húzható"></canvas>'
          : kep('sze-imgAvatar.jpg', 0, 0, 490, 401, 'object-fit:contain;object-position:left top')) + '</div>' +
        // eszközsor
        '<div class="kk-pnl" style="' + hely(367, 643, 490, 47) + 'background:#fff">' +
        gombKep('sze-' + gs('imgAddPicture'), 6, st.fiu ? 4 : 6, 'Kép hozzáadása', 'kep') +
        (kepVan ? gombKep('sze-' + gs('imgZoomIn'), 79, 5, 'Kép nagyítása', 'nagyit') + gombKep('sze-' + gs('imgZoomOut'), 120, 5, 'Kép kicsinyítése', 'kicsinyit') +
          gombKep('sze-' + gs('imgRotateLeft'), 180, 5, 'Kép forgatása balra', 'balra') + gombKep('sze-' + gs('imgRotateRight'), 215, 5, 'Kép forgatása jobbra', 'jobbra') +
          gombKep('sze-' + gs('imgSavePicture'), 449, 5, 'Születési értesítő mentése képként', 'ment') : '') + '</div>' +
        '</div>';
      if (kepVan) fotoRajz();
    }
    /* GetScaledBitmap: a kép a skálával, a 490×401-es ablakba, eltolással */
    function fotoKep() {
      var c = document.createElement('canvas'); c.width = 490; c.height = 401;
      var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 490, 401);
      if (st.kep) g.drawImage(st.kep, st.x, st.y, st.kep.width * st.skala, st.kep.height * st.skala);
      return c;
    }
    function fotoRajz() { var c = d.querySelector('.sze-foto canvas'); if (c) c.getContext('2d').drawImage(fotoKep(), 0, 0); }
    function kozepre() { st.x = Math.round((490 - st.kep.width * st.skala) / 2); st.y = Math.round((401 - st.kep.height * st.skala) / 2); }
    function skala(fel) {
      var lep = st.skala <= 0.5 ? 0.05 : 0.1;
      st.skala = Math.max(lep, st.skala + (fel ? lep : -lep)); kozepre(); fotoRajz();
    }
    function forgat(fok) {
      // RotateBitmap(±90, AdjustSize): a betöltött kép elforgatása
      var s = st.kep, c = document.createElement('canvas'); c.width = s.height; c.height = s.width;
      var g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(fok * Math.PI / 180); g.drawImage(s, -s.width / 2, -s.height / 2);
      st.kep = c; kozepre(); fotoRajz();
    }
    function kepValaszt() {
      var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      i.addEventListener('change', function () {
        var f = i.files && i.files[0]; if (!f) return;
        var u = URL.createObjectURL(f);
        kepTolt(u).then(function (im) {
          if (!im) { o.uzen('A kép nem olvasható.'); return; }
          var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
          URL.revokeObjectURL(u);
          st.kep = c; st.skala = 1; kozepre(); rajzol();
        });
      });
      i.click();
    }
    /* SavePicturetoFile: 960×725 */
    function exportal() {
      return Promise.all([kepTolt(KEP + 'sze-' + (st.fiu ? 'imgViragos_boy.jpg' : 'imgViragos_girl.jpg')), kepTolt(KEP + 'sze-imgAvatar.jpg'), betukKeszek()]).then(function (l) {
        var W = 960, H = 725, BW = 550, BH = 450, S = 8, cs = szin();
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        g.fillStyle = SZE.alap;
        g.fillRect(W - BW - S, H - BH - S, BW + S, BH + S);
        g.fillRect(W - BW - S, 0, S, H);
        g.fillRect(0, 565, W - BW, S);
        g.fillStyle = SZE.zold;
        g.fillRect(0, 565 + S, W - BW - S, H - 565 - S);
        g.fillRect(W - BW, 0, BW, H - BH - S);
        if (l[0]) g.drawImage(l[0], 10, 90, 380, 420);
        g.textBaseline = 'top'; g.textAlign = 'left';
        g.font = pt(16) + 'px ' + BEBAS; g.fillStyle = cs; g.fillText('CSILLAGJEGYEIM', 20, 20);
        g.font = pt(10) + 'px Arial, Helvetica, sans-serif';
        g.fillText('Csillagjegyeimről részletesen BÖSZÖRMÉNYI GYULA -', 20, 520);
        g.fillText('RÁKOS PÉTER:', 20, 540); g.fillText('című könyvében olvashattok.', 227, 540);
        g.font = 'italic ' + pt(10) + 'px Arial, Helvetica, sans-serif'; g.fillText('Csillagok nyelvén', 121, 540);
        drawText(g, szeJegyek(a, e), [20, 65, 340, 310], 'bold ' + pt(22) + 'px ' + AMATIC, SZE.jegy, { tordel: false, sorkoz: 1.25 });
        drawText(g, 'MEGÉRKEZTEM', [W - BW, 20, W, H - BH - S], pt(20) + 'px ' + BEBAS, '#fff', { kozep: true });
        drawText(g, a.nev, [W - BW + S * 2, 65, W - S * 2, H - BH - S], 'bold ' + pt(60) + 'px ' + AMATIC, '#fff', { kozep: true, sorkoz: 1.05 });
        g.font = pt(16) + 'px ' + BEBAS; g.fillStyle = '#fff'; g.textAlign = 'left';
        g.fillText('SZÜLETTEM', 33, H - 125); g.fillText('MAGASSÁGOM', 160, H - 125); g.fillText('SÚLYOM', 315, H - 125);
        var f20 = 'bold ' + pt(20) + 'px ' + AMATIC;
        drawText(g, szeSzulAdat(a), [20, H - 85, 130, H - 10], f20, '#fff', { kozep: true, sorkoz: 1.15 });
        drawText(g, st.magassag + ' cm', [160, H - 85, 250, H - 10], f20, '#fff', { kozep: true, tordel: false });
        drawText(g, st.suly + ' g', [300, H - 85, 385, H - 10], f20, '#fff', { kozep: true, tordel: false });
        if (st.kep) g.drawImage(fotoKep(), W - BW, H - BH, BW, BH);
        else if (l[1]) g.drawImage(l[1], W - BW, H - BH);
        return c;
      });
    }
    function nevjegy() {
      var cs = szin(), n = document.createElement('div');
      n.className = 'kartya-nevjegy'; n.setAttribute('role', 'dialog'); n.setAttribute('aria-label', 'Születési értesítő – névjegy');
      n.style.cssText = 'position:absolute;width:449px;height:499px;left:' + ((858 - 449) / 2) + 'px;top:' + ((691 - 499) / 2) + 'px';
      n.innerHTML = '<div class="kk-pnl" style="' + hely(0, 0, 449, 453) + 'background:' + SZE.alap + '"></div>' +
        '<div class="kk-pnl" style="' + hely(387, 450, 62, 49) + 'background:' + SZE.alap + '"></div>' +
        '<div class="kk-pnl" data-m="njzar" style="' + hely(1, 1, 447, 451) + 'background:#fff;cursor:pointer">' +
        kep('sze-nj-' + gs('imgAbout'), 22, 24, 60, 95) +
        lbl('Születési értesítő', 88, 39, 271, 37, BEBAS, 32, cs, 'text-align:center') +
        lbl('v1.1', 88, 78, 271, 28, BEBAS, 21, cs, 'text-align:center') +
        lbl('Program: Nemes Balázs', 18, 315, 350, 24, BEBAS, 19, cs) +
        lbl('Design: Rákos Péter', 18, 341, 350, 24, BEBAS, 19, cs) +
        '<div class="kk-lbl" style="' + hely(262, 133, 176, 248) + 'background:' + cs + '"></div>' +
        '<a href="https://humanisztikus.hu/asztrologia-konyvek" target="_blank" rel="noopener" title="Ugrás a weboldalhoz">' + kep('sze-nj-imgBook.jpg', 257, 128, 178, 250) + '</a></div>' +
        '<div class="kk-pnl" style="' + hely(388, 451, 60, 47) + 'background:#fff">' + gombKep('sze-nj-' + gs('imgClose'), 13, 6, 'Bezárás', 'njzar') + '</div>';
      d.querySelector('.kk-lap').appendChild(n);
    }
    d.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-m]'); if (!b) return;
      var m = b.getAttribute('data-m');
      if (m === 'zar') d.close();
      else if (m === 'nevjegy') { if (!d.querySelector('.kartya-nevjegy')) nevjegy(); }
      else if (m === 'njzar') { if (ev.target.closest('a')) return; var n = d.querySelector('.kartya-nevjegy'); if (n) n.remove(); }
      else if (m === 'adatok') { var p = d.querySelector('.sze-adatpanel'); p.hidden = false; d.querySelector('#szeMag').focus(); }
      else if (m === 'elfogad') {
        st.magassag = Math.max(0, Math.min(70, parseInt(d.querySelector('#szeMag').value, 10) || 0));
        st.suly = Math.max(0, Math.min(9999, parseInt(d.querySelector('#szeSuly').value, 10) || 0));
        st.adatok = st.magassag !== 0;
        rajzol();
      }
      else if (m === 'kep') kepValaszt();
      else if (m === 'nagyit') skala(true);
      else if (m === 'kicsinyit') skala(false);
      else if (m === 'balra') forgat(-90);
      else if (m === 'jobbra') forgat(90);
      else if (m === 'ment') exportal().then(function (c) { vaszonMent(c, 'szuletesiertesito.hu - ' + a.nev); });
    });
    d.addEventListener('change', function (ev) {
      if (ev.target.name === 'szeNem') {
        st.fiu = ev.target.value === 'fiu';
        var mag = d.querySelector('#szeMag').value, suly = d.querySelector('#szeSuly').value;
        rajzol();
        var p = d.querySelector('.sze-adatpanel'); p.hidden = false;
        d.querySelector('#szeMag').value = mag; d.querySelector('#szeSuly').value = suly;
      }
    });
    d.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { var n = d.querySelector('.kartya-nevjegy'); if (n) { ev.preventDefault(); n.remove(); } }
      if (ev.key === 'Enter' && ev.target.closest('.sze-adatpanel')) { ev.preventDefault(); d.querySelector('[data-m="elfogad"]').click(); }
    });
    // a fénykép egérrel húzható (imgLoadedImageMouseMove)
    var huz = null;
    d.addEventListener('pointerdown', function (ev) {
      var c = ev.target.closest('.sze-foto canvas'); if (!c) return;
      huz = { x: ev.clientX, y: ev.clientY }; c.setPointerCapture(ev.pointerId); ev.stopPropagation();
    }, true);
    d.addEventListener('pointermove', function (ev) {
      if (!huz) return;
      st.x += ev.clientX - huz.x; st.y += ev.clientY - huz.y; huz = { x: ev.clientX, y: ev.clientY }; fotoRajz();
    });
    d.addEventListener('pointerup', function () { huz = null; });
    rajzol();
    d.showModal();
    var z = d.querySelector('[data-m="zar"]'); if (z) z.focus();
  }

  R.Kartyak = { init: function (opt) { o = opt; }, jj: jj, sze: sze };
})(typeof window !== 'undefined' ? window : globalThis);
