/*
 * sweph.js – Swiss Ephemeris (2.10.03) WebAssembly betöltő a Regiomontanus webes változatához.
 * Függőség nélküli: saját, csak olvasható WASI-réteggel adja át a .se1 fájlokat a C kódnak.
 * Licenc: AGPL-3.0 (Swiss Ephemeris © Astrodienst AG).
 */
(function (global) {
  'use strict';

  var EPHE_DIR = '/ephe';
  var ERRNO = { SUCCESS: 0, BADF: 8, INVAL: 28, NOENT: 44, NOSYS: 52 };

  // Swiss Ephemeris konstansok (swephexp.h)
  var SE = {
    SUN: 0, MOON: 1, MERCURY: 2, VENUS: 3, MARS: 4, JUPITER: 5, SATURN: 6, URANUS: 7,
    NEPTUNE: 8, PLUTO: 9, MEAN_NODE: 10, TRUE_NODE: 11, MEAN_APOG: 12, OSCU_APOG: 13,
    EARTH: 14, CHIRON: 15, PHOLUS: 16, CERES: 17, PALLAS: 18, JUNO: 19, VESTA: 20,
    AST_OFFSET: 10000,
    GREG_CAL: 1, JUL_CAL: 0,
    FLG_JPLEPH: 1, FLG_SWIEPH: 2, FLG_MOSEPH: 4, FLG_SPEED: 256, FLG_EQUATORIAL: 2048,
    FLG_SIDEREAL: 65536
  };

  /* ---------- minimális WASI: csak olvasható, memóriabeli fájlrendszer ---------- */
  function makeWasi(files, getMemory, log) {
    var fds = {};               // fd -> { data: Uint8Array, pos: number }
    var nextFd = 4;             // 0-2 stdio, 3 = előre megnyitott /ephe könyvtár
    var dirName = new TextEncoder().encode(EPHE_DIR);
    var dec = new TextDecoder();
    var stdoutBuf = '';

    function view() { return new DataView(getMemory().buffer); }
    function bytes() { return new Uint8Array(getMemory().buffer); }

    return {
      fd_prestat_get: function (fd, ptr) {
        if (fd !== 3) return ERRNO.BADF;
        var v = view(); v.setUint8(ptr, 0); v.setUint32(ptr + 4, dirName.length, true);
        return ERRNO.SUCCESS;
      },
      fd_prestat_dir_name: function (fd, ptr, len) {
        if (fd !== 3) return ERRNO.BADF;
        bytes().set(dirName.subarray(0, len), ptr);
        return ERRNO.SUCCESS;
      },
      path_open: function (dirfd, dirflags, pathPtr, pathLen, oflags, rb, ri, fdflags, fdOut) {
        if (dirfd !== 3) return ERRNO.BADF;
        var name = dec.decode(bytes().slice(pathPtr, pathPtr + pathLen)).replace(/^\.?\/+/, '');
        if (oflags & 0x1 /* CREAT */ || !files[name]) return ERRNO.NOENT;
        var fd = nextFd++;
        fds[fd] = { data: files[name], pos: 0 };
        view().setUint32(fdOut, fd, true);
        return ERRNO.SUCCESS;
      },
      fd_read: function (fd, iovs, iovsLen, nreadPtr) {
        var f = fds[fd]; if (!f) return ERRNO.BADF;
        var v = view(), mem = bytes(), total = 0;
        for (var i = 0; i < iovsLen; i++) {
          var buf = v.getUint32(iovs + i * 8, true), len = v.getUint32(iovs + i * 8 + 4, true);
          var n = Math.min(len, f.data.length - f.pos);
          if (n <= 0) break;
          mem.set(f.data.subarray(f.pos, f.pos + n), buf);
          f.pos += n; total += n;
          if (n < len) break;
        }
        v.setUint32(nreadPtr, total, true);
        return ERRNO.SUCCESS;
      },
      fd_seek: function (fd, offset, whence, newOffPtr) {
        var f = fds[fd]; if (!f) return ERRNO.BADF;
        var off = Number(offset);
        var base = whence === 0 ? 0 : whence === 1 ? f.pos : f.data.length;
        var np = base + off;
        if (np < 0) return ERRNO.INVAL;
        f.pos = np;
        view().setBigUint64(newOffPtr, BigInt(np), true);
        return ERRNO.SUCCESS;
      },
      fd_close: function (fd) { delete fds[fd]; return ERRNO.SUCCESS; },
      fd_fdstat_get: function (fd, ptr) {
        var type = fd === 3 ? 3 : fd <= 2 ? 2 : fds[fd] ? 4 : -1;
        if (type < 0) return ERRNO.BADF;
        var v = view();
        v.setUint8(ptr, type); v.setUint16(ptr + 2, 0, true);
        v.setBigUint64(ptr + 8, BigInt('0xffffffffffffffff'), true);
        v.setBigUint64(ptr + 16, BigInt('0xffffffffffffffff'), true);
        return ERRNO.SUCCESS;
      },
      fd_fdstat_set_flags: function () { return ERRNO.SUCCESS; },
      fd_write: function (fd, iovs, iovsLen, nwrittenPtr) {
        var v = view(), mem = bytes(), total = 0;
        for (var i = 0; i < iovsLen; i++) {
          var buf = v.getUint32(iovs + i * 8, true), len = v.getUint32(iovs + i * 8 + 4, true);
          stdoutBuf += dec.decode(mem.slice(buf, buf + len)); total += len;
        }
        var lines = stdoutBuf.split('\n'); stdoutBuf = lines.pop();
        lines.forEach(function (l) { if (log) log(l); });
        v.setUint32(nwrittenPtr, total, true);
        return ERRNO.SUCCESS;
      },
      environ_sizes_get: function (cPtr, sPtr) {
        var v = view(); v.setUint32(cPtr, 0, true); v.setUint32(sPtr, 0, true); return ERRNO.SUCCESS;
      },
      environ_get: function () { return ERRNO.SUCCESS; },
      proc_exit: function (code) { throw new Error('swisseph proc_exit(' + code + ')'); }
    };
  }

  /* ---------- SwissEph osztály ---------- */
  function SwissEph(instance) {
    this.x = instance.exports;
    var m = this.x.malloc;
    this.pXX = m(8 * 6);         // double[6]
    this.pCusps = m(8 * 40);     // double[13] (Gauquelin: 37)
    this.pAscmc = m(8 * 10);
    this.pSerr = m(256);
    this.pStr = m(256);
    this.pD = m(8);
  }

  SwissEph.SE = SE;

  /**
   * Betöltés: opts.base = a mappa URL-je, ahol a swe.wasm és az ephe/ van.
   * opts.files = a betöltendő adatfájlok listája.
   */
  SwissEph.load = function (opts) {
    opts = opts || {};
    var base = (opts.base || '.').replace(/\/$/, '');
    var names = opts.files || ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1', 'sefstars.txt'];
    var files = {};
    var memRef = { mem: null };

    function getBin(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
        return r.arrayBuffer();
      });
    }

    var fileLoads = names.map(function (n) {
      return getBin(base + '/ephe/' + n).then(function (b) { files[n] = new Uint8Array(b); });
    });

    return Promise.all([getBin(base + '/swe.wasm')].concat(fileLoads)).then(function (res) {
      var wasi = makeWasi(files, function () { return memRef.mem; }, opts.log);
      return WebAssembly.instantiate(res[0], { wasi_snapshot_preview1: wasi });
    }).then(function (r) {
      memRef.mem = r.instance.exports.memory;
      r.instance.exports._initialize();
      var se = new SwissEph(r.instance);
      se.setEphePath(EPHE_DIR);
      se.loadedFiles = names.slice();
      return se;
    });
  };

  SwissEph.prototype._f64 = function () { return new Float64Array(this.x.memory.buffer); };
  SwissEph.prototype._u8 = function () { return new Uint8Array(this.x.memory.buffer); };
  SwissEph.prototype._readStr = function (ptr) {
    var u8 = this._u8(), end = ptr; while (u8[end]) end++;
    return new TextDecoder().decode(u8.slice(ptr, end));
  };
  SwissEph.prototype._writeStr = function (ptr, s) {
    var b = new TextEncoder().encode(s), u8 = this._u8();
    u8.set(b.subarray(0, 250), ptr); u8[ptr + Math.min(b.length, 250)] = 0;
  };
  SwissEph.prototype._doubles = function (ptr, n) {
    return Array.prototype.slice.call(this._f64(), ptr / 8, ptr / 8 + n);
  };

  SwissEph.prototype.setEphePath = function (p) { this._writeStr(this.pStr, p); this.x.swe_set_ephe_path(this.pStr); };
  SwissEph.prototype.version = function () { this.x.swe_version(this.pStr); return this._readStr(this.pStr); };
  SwissEph.prototype.julday = function (y, m, d, hour, greg) {
    return this.x.swe_julday(y, m, d, hour, greg === undefined ? SE.GREG_CAL : greg);
  };
  SwissEph.prototype.revjul = function (jd, greg) {
    var p = this.pCusps; // ideiglenes puffer
    this.x.swe_revjul(jd, greg === undefined ? SE.GREG_CAL : greg, p, p + 4, p + 8, p + 16);
    var i32 = new Int32Array(this.x.memory.buffer);
    return { year: i32[p / 4], month: i32[p / 4 + 1], day: i32[p / 4 + 2], hour: this._f64()[(p + 16) / 8] };
  };
  SwissEph.prototype.deltat = function (jd) { return this.x.swe_deltat(jd); };
  SwissEph.prototype.sidtime = function (jdUt) { return this.x.swe_sidtime(jdUt); };
  SwissEph.prototype.planetName = function (ipl) { this.x.swe_get_planet_name(ipl, this.pStr); return this._readStr(this.pStr); };

  /** Visszaad: { lon, lat, dist, speedLon, speedLat, speedDist, flag, error } */
  SwissEph.prototype.calcUt = function (jdUt, ipl, iflag) {
    this._u8()[this.pSerr] = 0;
    var rc = this.x.swe_calc_ut(jdUt, ipl, iflag, this.pXX, this.pSerr);
    var xx = this._doubles(this.pXX, 6);
    return { lon: xx[0], lat: xx[1], dist: xx[2], speedLon: xx[3], speedLat: xx[4], speedDist: xx[5],
             flag: rc, error: rc < 0 ? this._readStr(this.pSerr) : (this._readStr(this.pSerr) || null) };
  };
  SwissEph.prototype.calc = function (jdEt, ipl, iflag) {
    this._u8()[this.pSerr] = 0;
    var rc = this.x.swe_calc(jdEt, ipl, iflag, this.pXX, this.pSerr);
    var xx = this._doubles(this.pXX, 6);
    return { lon: xx[0], lat: xx[1], dist: xx[2], speedLon: xx[3], speedLat: xx[4], speedDist: xx[5],
             flag: rc, error: rc < 0 ? this._readStr(this.pSerr) : null };
  };

  /** hsys: 'P','R','C','K','O','A' … – visszaad: { cusps[1..12], asc, mc, armc, vertex, equAsc, coAscKoch, coAscMunkasey, polarAsc } */
  SwissEph.prototype.housesEx = function (jdUt, iflag, lat, lon, hsys) {
    var rc = this.x.swe_houses_ex(jdUt, iflag, lat, lon, hsys.charCodeAt(0), this.pCusps, this.pAscmc);
    var c = this._doubles(this.pCusps, 13), a = this._doubles(this.pAscmc, 10);
    return { rc: rc, cusps: c, asc: a[0], mc: a[1], armc: a[2], vertex: a[3], equAsc: a[4],
             coAscKoch: a[5], coAscMunkasey: a[6], polarAsc: a[7] };
  };

  SwissEph.prototype.fixstar2Ut = function (star, jdUt, iflag) {
    this._writeStr(this.pStr, star);
    this._u8()[this.pSerr] = 0;
    var rc = this.x.swe_fixstar2_ut(this.pStr, jdUt, iflag, this.pXX, this.pSerr);
    var xx = this._doubles(this.pXX, 6);
    return { name: this._readStr(this.pStr), lon: xx[0], lat: xx[1], speedLon: xx[3], flag: rc,
             error: rc < 0 ? this._readStr(this.pSerr) : null };
  };

  /** A Nap következő áthaladása x2cross fokon jdUt után (szolár-revolúcióhoz). */
  SwissEph.prototype.solcrossUt = function (x2cross, jdUt, iflag) {
    return this.x.swe_solcross_ut(x2cross, jdUt, iflag, this.pSerr);
  };
  SwissEph.prototype.mooncrossUt = function (x2cross, jdUt, iflag) {
    return this.x.swe_mooncross_ut(x2cross, jdUt, iflag, this.pSerr);
  };

  global.SwissEph = SwissEph;
})(typeof window !== 'undefined' ? window : globalThis);
