/*
 * progr.js – a Progressziók menü beállító ablakai (a Windows-os fSzekdirSettings, fSolarRevSettings,
 * fPlanetRevSettings megfelelői). Minden ablak Promise-t ad vissza; Mégsem/Esc esetén null-t.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio, K = R.Keplet, I = R.Idotech;
  var P = R.Progr = {};

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function helyStr(h) {
    return R.esc((h.telepulesKijelzes || h.telepules || '–') + (h.orszag ? ', ' + h.orszag : '')) + ' – ' +
      R.fokStr(Math.abs(h.lat), false) + (h.lat >= 0 ? ' É' : ' D') + ', ' + R.fokStr(Math.abs(h.lon), false) + (h.lon >= 0 ? ' K' : ' Ny') +
      (h.tz ? ' · ' + R.esc(h.tz) : '');
  }
  P.helyStr = helyStr;

  /**
   * Általános keret: cím, törzs (HTML), gombok. init(dlg, kesz) a vezérlők bekötésére;
   * kesz(ertek) lezárja az ablakot. Visszaad: Promise<ertek | null>.
   */
  function ablak(cim, torzs, init, okFelirat) {
    var d = el('<dialog class="progr-dlg" aria-label="' + R.esc(cim) + '"><form method="dialog" novalidate>' +
      '<div class="dfej"><span>' + R.esc(cim) + '</span></div><div class="dtorzs">' + torzs +
      '<p class="hibauz" data-hiba hidden></p></div><div class="dlab"><span class="tolt"></span>' +
      '<button type="submit" class="gomb fo" data-ok>' + (okFelirat || 'Rendben') + '</button>' +
      '<button type="button" class="gomb" data-megse>Mégsem</button></div></form></dialog>');
    document.body.appendChild(d);
    return new Promise(function (res) {
      var vege = false;
      function kesz(v) { if (vege) return; vege = true; if (d.open) d.close(); d.remove(); res(v); }
      d.hiba = function (s) { var h = d.querySelector('[data-hiba]'); h.textContent = s || ''; h.hidden = !s; };
      d.addEventListener('cancel', function (e) { e.preventDefault(); kesz(null); });
      d.querySelector('[data-megse]').addEventListener('click', function () { kesz(null); });
      var ok = init(d, kesz);
      d.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        try { var v = ok(); if (v !== undefined) kesz(v); } catch (h) { d.hiba(h.message); }
      });
      d.showModal();
      var f = d.querySelector('[data-fokusz]') || d.querySelector('input, select'); if (f) { f.focus(); if (f.select) f.select(); }
    });
  }
  function szam(d, sel, min, max, nev) {
    var i = d.querySelector(sel), v = i.value.trim(), n = Number(v);
    if (v === '' || !isFinite(n) || n !== Math.floor(n) || n < min || n > max) { i.focus(); throw new Error(nev + ': ' + min + ' és ' + max + ' közötti egész szám kell.'); }
    return n;
  }
  /** Település-választó blokk; az aktuális hely a d.hely-ben */
  function helyBlokk(azon) {
    return '<fieldset><legend>Hely</legend><div class="mezok"><div class="szeles keres">' +
      '<label for="' + azon + 'T">Település (a születési hely, vagy válassz másikat)</label>' +
      '<input id="' + azon + 'T" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="' + azon + 'L" aria-autocomplete="list">' +
      '<ul class="talalatok" id="' + azon + 'L" role="listbox" hidden></ul></div></div><div class="zinfo" data-helyinfo></div></fieldset>';
  }
  function helyInit(d, azon, hely, valt) {
    d.hely = hely;
    var inp = d.querySelector('#' + azon + 'T');
    inp.value = hely.telepulesKijelzes || hely.telepules || '';
    d.querySelector('[data-helyinfo]').innerHTML = helyStr(hely) + (hely.tz ? '' : ' · <span class="figy">időzóna: a születési képlet eltolása</span>');
    R.TelepulesKereso(inp, d.querySelector('#' + azon + 'L'), function (t) {
      d.hely = { telepules: t.adatNev || t.nev, telepulesKijelzes: t.nev !== (t.adatNev || t.nev) ? t.nev : '', orszag: t.orszag,
        orszagKod: t.orszagKod, lat: t.lat, lon: t.lon, tz: t.tz };
      d.querySelector('[data-helyinfo]').innerHTML = helyStr(d.hely);
      if (valt) valt();
    });
  }

  /* ---------- Progressziós Hold ---------- */
  P.ph = function (szul) {
    var most = new Date();
    return ablak('Progr.beáll. - Progressziós Hold',
      '<fieldset><legend>Év / Életkor</legend><div class="mezok">' +
      '<label>Év / Életkor: <input class="sz" data-fokusz data-ertek type="number" min="0" max="2999" value="' + most.getFullYear() + '"></label>' +
      '<label>Hónap (kiegészítés): <input class="sz2" data-honap type="number" min="0" max="12" value="' + (most.getMonth() + 1) + '"></label></div>' +
      '<p class="t-hint" style="margin-top:8px">200 fölött évszám (a hónap ekkor naptári hónap), alatta életkor (a hónap: plusz hónapok).<br>' +
      '1 nap a születés után = 1 év az életben, 2 óra = 1 hónap.</p><div class="zinfo" data-info></div></fieldset>',
      function (d) {
        function info() {
          var e = +d.querySelector('[data-ertek]').value || 0, h = +d.querySelector('[data-honap]').value || 0, x = I.phEltolas(szul, e, h);
          d.querySelector('[data-info]').textContent = 'A progressziós képlet a születés után ' + x.napok + ' nappal' +
            (x.orak ? (x.orak > 0 ? ' + ' : ' − ') + Math.abs(x.orak) + ' órával' : '') + ' (' + I.evHo(x.napok + x.orak / 24) + ').';
        }
        d.addEventListener('input', info); info();
        return function () {
          var e = szam(d, '[data-ertek]', 0, 2999, 'Év / Életkor'), h = szam(d, '[data-honap]', 0, 12, 'Hónap');
          if (e > 200 && e < szul.ev) throw new Error('Az év nem lehet korábbi a születési évnél.');
          return I.phEltolas(szul, e, h);
        };
      });
  };

  /* ---------- Primer direkció ---------- */
  P.pd = function (szul, konverz) {
    return ablak('Progr.beáll. - Primer direkció',
      '<fieldset><legend>Primer direkció éve</legend><div class="mezok"><label>Év: <input class="sz" data-fokusz data-ev type="number" min="1" max="2999" value="' +
      new Date().getFullYear() + '"></label></div><p class="t-hint" style="margin-top:8px">1° = 1 év; minden elem (planéták, házak, tengelyek) ennyivel fordul el. Irány: ' +
      (konverz ? 'konverz' : 'direkt') + ' (Beállítások › Primer direkció iránya).</p></fieldset>',
      function (d) {
        return function () {
          var ev = szam(d, '[data-ev]', 1, 2999, 'Év');
          var n = Math.abs(szul.ev - ev);
          return { ev: ev, n: konverz ? -n : n };
        };
      });
  };

  /* ---------- Szolár-képlet ---------- */
  P.szolar = function (se, szul, napHossz, flag, hely) {
    return ablak('Szolár-képlet beállítások',
      '<fieldset><legend>Melyik évre?</legend><div class="mezok">' +
      '<button type="button" class="gomb" data-elozo title="Előző év">◀</button>' +
      '<label>Év: <input class="sz" data-fokusz data-ev type="number" min="0" max="4999" value="' + new Date().getFullYear() + '"></label>' +
      '<button type="button" class="gomb" data-kov title="Következő év">▶</button></div>' +
      '<p class="t-hint" style="margin-top:8px">A születési évnél kisebb szám: életkor (születésnap száma).</p></fieldset>' + helyBlokk('szH') +
      '<fieldset><legend>A szolár-képlet időpontja</legend><div class="zinfo" data-eredm style="font-size:13px">–</div></fieldset>',
      function (d) {
        var talalat = null;
        function szamol() {
          talalat = null;
          var v = +d.querySelector('[data-ev]').value;
          if (!isFinite(v) || v < 0) { d.querySelector('[data-eredm]').textContent = '–'; return; }
          var ev = I.szolarEv(szul, Math.floor(v));
          se.ensureEphe([ev, ev + 1]).then(function () {
            var jd = I.szolar(se, szul, napHossz, ev, flag);
            if (jd === null) { d.querySelector('[data-eredm]').textContent = 'Nincs találat.'; return; }
            var a = I.adatJd(se, jd, d.hely, szul), z = K.zona(a), ut = I.jdBol(se, jd, 0);
            talalat = { jd: jd, ev: ev, adat: a };
            d.querySelector('[data-eredm]').innerHTML = '<b>' + R.datumStr(a.ev, a.ho, a.nap, a.ora, a.perc) + ':' + R.pad(a.mp) + '</b> ' +
              R.esc(z.kod || '') + ' (' + R.esc(z.info) + ') · UT: ' + R.datumStr(ut.ev, ut.ho, ut.nap, ut.ora, ut.perc) + ':' + R.pad(ut.mp);
          });
        }
        helyInit(d, 'szH', hely, szamol);
        d.querySelector('[data-ev]').addEventListener('input', szamol);
        d.querySelector('[data-elozo]').addEventListener('click', function () { var i = d.querySelector('[data-ev]'); i.value = +i.value - 1; szamol(); });
        d.querySelector('[data-kov]').addEventListener('click', function () { var i = d.querySelector('[data-ev]'); i.value = +i.value + 1; szamol(); });
        szamol();
        return function () {
          if (!talalat) throw new Error('Még nincs kiszámolt időpont.');
          return { jd: talalat.jd, ev: talalat.ev, hely: d.hely };
        };
      });
  };

  /* ---------- Revolúciók ---------- */
  var REV_PL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 17, 18, 19, 20];
  P.rev = function (se, szul, e, flag, hely) {
    var most = new Date();
    var plOpt = REV_PL.filter(function (id) { return e.poz[id]; }).map(function (id) {
      return '<option value="' + id + '">' + R.esc(R.nev(id)) + '</option>';
    }).join('');
    var hova = '<option value="0">ugyanoda (a radix helyére)</option>';
    for (var h = 1; h <= 12; h++) hova += '<option value="' + h + '">' + h + '. Ház csúcsán' + (h === 1 ? ' (ASC)' : h === 4 ? ' (IC)' : h === 7 ? ' (DESC)' : h === 10 ? ' (MC)' : '') + '</option>';
    hova += '<option value="13">megadott jegyen és fokon</option>';
    Object.keys(R.FENYSZOG).forEach(function (f) {
      hova += '<option value="f' + f + '">' + R.FENYSZOG[f][0] + ' (' + R.FENYSZOG[f][1] + '°) egy radix-planétával</option>';
    });
    var jegyOpt = R.JEGYEK.map(function (j, i) { return '<option value="' + i + '">' + j + '</option>'; }).join('');
    return ablak('Revolúciók...',
      '<fieldset><legend>Mi és hová?</legend><div class="mezok">' +
      '<label>Planéta <select data-pl data-fokusz>' + plOpt + '</select></label>' +
      '<label class="szeles">Hová ér? <select data-hova>' + hova + '</select></label></div>' +
      '<div class="mezok" style="margin-top:8px" data-fokon><label>Jegy <select data-jegy>' + jegyOpt + '</select></label>' +
      '<label>fok <input class="sz2" data-fok type="number" min="0" max="29"></label><label>perc <input class="sz2" data-perc type="number" min="0" max="59"></label>' +
      '<label>mp <input class="sz2" data-mp type="number" min="0" max="59"></label></div>' +
      '<div class="mezok" style="margin-top:8px" data-fsz hidden><label>Radix-planéta <select data-fszpl>' + plOpt + '</select></label></div>' +
      '<div class="zinfo" data-helyzet></div></fieldset>' +
      '<fieldset><legend>Keresés</legend><div class="mezok">' +
      '<label>Év <input class="sz" data-ev type="number" value="' + most.getFullYear() + '"></label>' +
      '<label>Hó <input class="sz2" data-ho type="number" value="' + (most.getMonth() + 1) + '"></label>' +
      '<label>Nap <input class="sz2" data-nap type="number" value="' + most.getDate() + '"></label>' +
      '<label>Irány <select data-irany><option value="1">előre</option><option value="0">vissza</option></select></label>' +
      '<label>Darab <input class="sz2" data-db type="number" min="1" max="20" value="1"></label>' +
      '<button type="button" class="gomb" data-keres>Keresés</button></div></fieldset>' + helyBlokk('rvH') +
      '<fieldset><legend>Találatok</legend><div data-lista class="rev-lista"><p class="t-hint">Még nincs keresés.</p></div>' +
      '<label class="pipa" style="display:flex;margin-top:6px"><input type="checkbox" data-ossz checked> Összevetés is a radixszal</label></fieldset>',
      function (d) {
        var talalatok = [];
        var q = function (s) { return d.querySelector(s); };
        function cel() {
          var hv = q('[data-hova]').value, pl = +q('[data-pl]').value;
          if (hv === '0') return e.poz[pl].lon;
          if (hv.charAt(0) === 'f') return e.poz[+q('[data-fszpl]').value].lon + R.FENYSZOG[+hv.slice(1)][1];
          var fok = +q('[data-fok]').value || 0, perc = +q('[data-perc]').value || 0, mp = +q('[data-mp]').value || 0;
          return +q('[data-jegy]').value * 30 + fok + perc / 60 + mp / 3600;
        }
        function jegyBe(lon) {
          var j = R.jegyben(lon), f = Math.trunc(j.fok), p = Math.trunc((j.fok - f) * 60), m = Math.trunc(((j.fok - f) * 60 - p) * 60);
          q('[data-jegy]').value = j.j; q('[data-fok]').value = f; q('[data-perc]').value = p; q('[data-mp]').value = m;
        }
        function frissit() {
          var pl = +q('[data-pl]').value, hv = q('[data-hova]').value, x = e.poz[pl], p = e.elemPl[pl], j = R.jegyben(x.lon);
          var jel = [];
          if (x.speedLon < 0) jel.push('R'); if (p && p.feral) jel.push('F'); if (p && p.isolated) jel.push('i');
          q('[data-helyzet]').textContent = 'A radixban: ' + R.nev(pl) + ' – ' + R.JEGYEK[j.j] + ' ' + R.fokStr(j.fok) + ' fokán' + (jel.length ? ' (' + jel.join(',') + ')' : '');
          q('[data-fsz]').hidden = hv.charAt(0) !== 'f';
          q('[data-fokon]').hidden = hv.charAt(0) === 'f';
          ['[data-jegy]', '[data-fok]', '[data-perc]', '[data-mp]'].forEach(function (s) { q(s).disabled = hv !== '13'; });
          if (hv === '0') jegyBe(x.lon);
          else if (hv !== '13' && hv.charAt(0) !== 'f') jegyBe(e.hz.cusps[+hv]);
        }
        function keres() {
          d.hiba('');
          var pl = +q('[data-pl]').value, c = I.kul(cel(), 0), elore = q('[data-irany]').value === '1', db = Math.min(20, Math.max(1, +q('[data-db]').value || 1));
          var ev = +q('[data-ev]').value, ho = +q('[data-ho]').value, nap = +q('[data-nap]').value;
          if (!(ev >= 1 && ev <= 2999 && ho >= 1 && ho <= 12 && nap >= 1 && nap <= 31)) { d.hiba('Érvénytelen kezdődátum.'); return; }
          q('[data-lista]').innerHTML = '<p class="t-hint">Keresés…</p>';
          var evek = []; for (var y = Math.max(1, ev - (elore ? 0 : 300)); y <= Math.min(2999, ev + (elore ? 300 : 0)); y += 100) evek.push(y);
          se.ensureEphe(evek).then(function () {
            var jd = se.julday(ev, ho, nap, 0), l = [];
            for (var i = 0; i < db; i++) {
              var t = I.atmenet(se, pl, (c + 360) % 360, jd, elore, flag);
              if (t === null) break;
              l.push(t); jd = t + (elore ? 1 : -1) / 1440; // a következő keresés 1 perccel utána (közeli retrográd átmenetek)
            }
            talalatok = l.map(function (t) {
              var a = I.adatJd(se, t, d.hely, szul), x = se.calcUt(t, pl, flag);
              return { jd: t, adat: a, pl: pl, retro: x.speedLon < 0, lon: x.lon };
            });
            q('[data-lista]').innerHTML = talalatok.length ? talalatok.map(function (x, i) {
              var a = x.adat, z = K.zona(a), j = R.jegyben(x.lon);
              return '<label class="pipa" style="display:flex"><input type="checkbox" data-v="' + i + '"' + (i === 0 ? ' checked' : '') + '> ' +
                R.datumStr(a.ev, a.ho, a.nap, a.ora, a.perc) + ':' + R.pad(a.mp) + ' ' + R.esc(z.kod || '') + ' – ' + R.esc(R.nev(pl)) + ' ' +
                R.JEGYEK[j.j] + ' ' + R.fokStr(j.fok, false) + (x.retro ? ' R' : '') + '</label>';
            }).join('') : '<p class="t-hint">Nincs találat.</p>';
          });
        }
        helyInit(d, 'rvH', hely, function () {
          talalatok.forEach(function (x) { x.adat = I.adatJd(se, x.jd, d.hely, szul); });
          if (talalatok.length) keres();
        });
        q('[data-pl]').addEventListener('change', function () { frissit(); });
        q('[data-hova]').addEventListener('change', function () { frissit(); });
        q('[data-keres]').addEventListener('click', keres);
        frissit();
        return function () {
          if (!talalatok.length) { keres(); throw new Error('Előbb keress, majd jelöld ki a kívánt időpontokat.'); }
          var ki = talalatok.filter(function (x, i) { var c = d.querySelector('[data-v="' + i + '"]'); return c && c.checked; });
          if (!ki.length) throw new Error('Jelölj ki legalább egy időpontot.');
          return { talalatok: ki, osszevetes: q('[data-ossz]').checked, hely: d.hely };
        };
      }, 'Képlet(ek) megnyitása');
  };
})(typeof window !== 'undefined' ? window : globalThis);
