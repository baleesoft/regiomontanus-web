/*
 * mappa.js – a Windows-os Regiomontanus mappájának (benne a hors\ képletekkel, hors\images, hors\docs) elérése a böngészőből.
 * Chromium: showDirectoryPicker (a mappa megjegyezve IndexedDB-ben, újraengedélyezéssel; írás is: csatolmány-másolás);
 * más böngésző: <input webkitdirectory> (csak olvasás, a munkamenet végéig).
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio;
  var gyoker = null;          // FileSystemDirectoryHandle
  var lista = null;           // webkitdirectory esetén: [{ ut: 'hors/a.szk', file }]
  var nev = '';
  var DB = 'regio-mappa', TAR = 'h';

  function idb(mod, fn) {
    return new Promise(function (res, rej) {
      if (!global.indexedDB) { rej(new Error('nincs IndexedDB')); return; }
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(TAR); };
      r.onerror = function () { rej(r.error); };
      r.onsuccess = function () {
        var tx = r.result.transaction(TAR, mod), q = fn(tx.objectStore(TAR));
        tx.oncomplete = function () { res(q && q.result); r.result.close(); };
        tx.onerror = function () { rej(tx.error); };
      };
    });
  }
  function engedely(h, ir, kerhet) {
    if (!h.queryPermission) return Promise.resolve(true);
    var m = { mode: ir ? 'readwrite' : 'read' };
    return h.queryPermission(m).then(function (p) {
      if (p === 'granted') return true;
      if (!kerhet) return false;
      return h.requestPermission(m).then(function (q) { return q === 'granted'; });
    });
  }

  /** Mappaválasztás (felhasználói műveletből hívandó). Promise<boolean> */
  function valaszt() {
    if (global.showDirectoryPicker) {
      return global.showDirectoryPicker({ id: 'regiomontanus', mode: 'readwrite' }).then(function (h) {
        gyoker = h; lista = null; nev = h.name;
        return idb('readwrite', function (s) { return s.put(h, 'gyoker'); }).catch(function () {}).then(function () { return true; });
      }, function (e) { if (e && e.name === 'AbortError') return false; throw e; });
    }
    return new Promise(function (res) {
      var i = document.createElement('input');
      i.type = 'file'; i.webkitdirectory = true; i.multiple = true;
      i.addEventListener('change', function () {
        var fl = Array.prototype.slice.call(i.files || []);
        if (!fl.length) { res(false); return; }
        lista = fl.map(function (f) { return { ut: f.webkitRelativePath || f.name, file: f }; });
        nev = (lista[0].ut.split('/')[0]) || '';
        // a kiválasztott mappa neve az utak első tagja – azt levágjuk, hogy az utak a mappához képest legyenek
        lista.forEach(function (x) { x.ut = x.ut.split('/').slice(1).join('/'); });
        gyoker = null; res(true);
      });
      i.click();
    });
  }
  /** A megjegyzett mappa (engedéllyel). kerhet: felhasználói műveletből újra kérhet engedélyt. Promise<boolean> */
  function elerheto(kerhet) {
    if (lista) return Promise.resolve(true);
    var p = gyoker ? Promise.resolve(gyoker) : idb('readonly', function (s) { return s.get('gyoker'); }).catch(function () { return null; });
    return p.then(function (h) {
      if (!h) return false;
      gyoker = h; nev = h.name;
      return engedely(h, false, kerhet);
    });
  }
  function megjegyzett() {
    if (lista || gyoker) return Promise.resolve(nev);
    return idb('readonly', function (s) { return s.get('gyoker'); }).then(function (h) { return h ? h.name : ''; }, function () { return ''; });
  }

  /** Windows-os útvonal (hors\images\a.jpg, C:\...\hors\docs\b.pdf, b.pdf) → a választott mappához viszonyított út-tagok. */
  function utTagok(ertek) {
    var t = String(ertek || '').replace(/^[a-z]:/i, '').split(/[\\/]+/).filter(Boolean);
    var i = -1;
    t.forEach(function (x, j) { if (x.toLowerCase() === 'hors') i = j; });
    if (i >= 0) t = t.slice(i);
    // ha magát a hors mappát választották ki, a „hors” tag elmarad
    if (t.length && t[0].toLowerCase() === 'hors' && nev.toLowerCase() === 'hors') t = t.slice(1);
    return t;
  }
  function kisbetu(s) { return s.toLowerCase(); }

  /** Promise<File|null> – a relatív/abszolút Windows-os útvonalon lévő fájl a választott mappából. */
  function fajl(ertek) {
    var t = utTagok(ertek);
    if (!t.length) return Promise.resolve(null);
    if (lista) {
      var cel = kisbetu(t.join('/')), nevCel = kisbetu(t[t.length - 1]), talalt = null;
      lista.forEach(function (x) { if (kisbetu(x.ut) === cel) talalt = x.file; });
      if (!talalt) lista.forEach(function (x) { if (!talalt && kisbetu(x.ut.split('/').pop()) === nevCel && /(^|\/)hors\//i.test('/' + x.ut)) talalt = x.file; });
      return Promise.resolve(talalt);
    }
    if (!gyoker) return Promise.resolve(null);
    function lep(h, i) {
      if (i === t.length - 1) return h.getFileHandle(t[i]).then(function (f) { return f.getFile(); });
      return h.getDirectoryHandle(t[i]).then(function (d) { return lep(d, i + 1); });
    }
    return lep(gyoker, 0).catch(function () { return null; });
  }

  /** Fájl írása a mappába (pl. hors/docs/<név>), ha van írási engedély. Promise<boolean> */
  function ir(tagok, blob) {
    if (!gyoker) return Promise.resolve(false);
    return engedely(gyoker, true, true).then(function (ok) {
      if (!ok) return false;
      var t = tagok.slice();
      if (t[0] === 'hors' && nev.toLowerCase() === 'hors') t.shift();
      function lep(h, i) {
        if (i === t.length - 1) return h.getFileHandle(t[i], { create: true }).then(function (f) { return f.createWritable(); })
          .then(function (w) { return w.write(blob).then(function () { return w.close(); }); }).then(function () { return true; });
        return h.getDirectoryHandle(t[i], { create: true }).then(function (d) { return lep(d, i + 1); });
      }
      return lep(gyoker, 0);
    }).catch(function () { return false; });
  }

  /**
   * Az összes .szk a választott mappában – a Windows-os FindFilesW szerint: ha van hors\ almappa, azt járja be,
   * rekurzívan, előbb a mappa fájljai, majd az almappák; a „.”-tal kezdődő mappák kimaradnak.
   * Promise<[{ ut: 'hors/x/a.szk', nev: 'a.szk', file?: File, handle?: FileSystemFileHandle }]>
   */
  function szkLista() {
    if (lista) {
      var van = lista.some(function (x) { return /^hors\//i.test(x.ut); });
      return Promise.resolve(lista.filter(function (x) {
        return /\.szk$/i.test(x.ut) && (!van || /^hors\//i.test(x.ut)) && !/(^|\/)\.[^/]*\//.test(x.ut);
      }).map(function (x) { return { ut: x.ut, nev: x.ut.split('/').pop(), file: x.file }; }));
    }
    if (!gyoker) return Promise.resolve([]);
    var ki = [];
    function bejar(h, elo) {
      var fajlok = [], mappak = [];
      var it = h.values();
      function kov() {
        return it.next().then(function (r) {
          if (r.done) return null;
          var e = r.value;
          if (e.kind === 'file' && /\.szk$/i.test(e.name)) fajlok.push(e);
          else if (e.kind === 'directory' && e.name.charAt(0) !== '.') mappak.push(e);
          return kov();
        });
      }
      return kov().then(function () {
        fajlok.sort(function (a, b) { return a.name.localeCompare(b.name, 'hu'); }).forEach(function (f) { ki.push({ ut: elo + f.name, nev: f.name, handle: f }); });
        mappak.sort(function (a, b) { return a.name.localeCompare(b.name, 'hu'); });
        return mappak.reduce(function (p, d) { return p.then(function () { return bejar(d, elo + d.name + '/'); }); }, Promise.resolve());
      });
    }
    return gyoker.getDirectoryHandle('hors').then(function (h) { return bejar(h, 'hors/'); }, function () { return bejar(gyoker, ''); })
      .then(function () { return ki; });
  }
  function fajlOlvas(x) { return x.file ? Promise.resolve(x.file) : x.handle.getFile(); }

  R.Mappa = {
    valaszt: valaszt, elerheto: elerheto, megjegyzett: megjegyzett, fajl: fajl, ir: ir, szkLista: szkLista, fajlOlvas: fajlOlvas,
    utTagok: utTagok, nev: function () { return nev; }, irhato: function () { return !!gyoker; },
    tamogatott: function () { return !!global.showDirectoryPicker || 'webkitdirectory' in document.createElement('input'); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
