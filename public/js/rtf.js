/*
 * rtf.js – a Windows-os Regiomontanus jegyzeteinek (RichEdit RTF) olvasása és írása.
 *
 * Köztes modell: [{ felsorolas: bool, igazitas: ''|'center'|'right'|'justify',
 *                   futamok: [{ t: szöveg, b, i, u, szin: '#rrggbb'|null, hatter, meret: pt|null, asztro: bool }] }]
 * Az asztro futam szövege Unicode-jel (☉ ♈ ☌ …); RTF-ben a RegiomontanusWIN betűtípus betűje (a, q, z …).
 *
 * A .mgj (Windows: hors\docs\<képlet>.mgj): UTF-16LE INI, [Megjegyzes] szakasz; az RTF cp1250 bájtjai
 * párosával egy-egy UTF-16 karakterbe csomagolva, a sortörés helyén „#S#”.
 * Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};

  /* ---------- a RegiomontanusWIN betűtípus betűi ↔ Unicode-jelek (uAstro4AllConsts: cPLANETLIST, cZODIAC…, cFENYSZOG…) ---------- */
  var FONT_JEL = {
    a: '☉', s: '☽', d: '☿', f: '♀', g: '♂', h: '♃', j: '♄', k: '♅', l: '♆', ';': '♇', A: '☊', Q: '☋',
    K: '⚷', F: '⚳', G: '⚴', H: '⚵', J: '⚶', '‡': '⚸', L: '⊕',
    q: '♈', w: '♉', e: '♊', r: '♋', t: '♌', y: '♍', u: '♎', i: '♏', o: '♐', p: '♑', '[': '♒', ']': '♓',
    z: '☌', x: '☍', c: '□', m: '∠', '<': '⚼', b: '△', n: '⚹', '>': '⚺', '?': '⚻',
    '„': '⬠', '†': '⊥', '…': '⬟'   // ötödfény, tizedfény, két-ötödfény (cp1250 0x84, 0x86, 0x85)
  };
  // a RegiomontanusWIN-futamban a 0x80–0x9F bájtok cp1250-es karakterként értendők (pl. „ = 0x84)
  var ASZTRO_BAJT = { 0x84: '„', 0x86: '†', 0x85: '…', 0x87: '‡', 0x82: '‚' };
  var JEL_FONT = {};
  Object.keys(FONT_JEL).forEach(function (k) { JEL_FONT[FONT_JEL[k]] = k; });
  var ASZTRO_FONT = /regiomontanus|regmon|astro/i;

  /* ---------- kódlapok ---------- */
  var dekoderek = {};
  function kodlapKar(kp, bajt) {
    if (bajt < 128) return String.fromCharCode(bajt);
    var d = dekoderek[kp];
    if (!d) { try { d = new TextDecoder('windows-' + kp); } catch (e) { d = new TextDecoder('windows-1250'); } dekoderek[kp] = d; }
    return d.decode(new Uint8Array([bajt]));
  }
  var CP1250 = null;
  function cp1250Bajt(ch) {
    if (!CP1250) {
      CP1250 = {};
      var d = new TextDecoder('windows-1250');
      for (var b = 128; b < 256; b++) { var c = d.decode(new Uint8Array([b])); if (c !== '�') CP1250[c] = b; }
    }
    return CP1250[ch];
  }

  /* ---------- RTF → modell ---------- */
  var KIHAGY = { fonttbl: 1, colortbl: 1, stylesheet: 1, info: 1, pict: 1, object: 1, header: 1, footer: 1,
    pntxtb: 1, pntxta: 1, listtable: 1, listoverridetable: 1, generator: 1, xmlnstbl: 1, themedata: 1,
    colorschememapping: 1, latentstyles: 1, datastore: 1, rsidtbl: 1, mmathPr: 1, fldinst: 1, shppict: 1, nonshppict: 1 };

  function modell(rtf) {
    var fontok = {}, szinek = [], par = [], bek = uj(), ansiKp = 1252;
    var st = { b: 0, i: 0, u: 0, f: 0, fs: 20, cf: 0, hl: 0, uc: 1, kihagy: 0, dest: null, pntext: 0 };
    var verem = [], i = 0, n = rtf.length, ucHatra = 0, fontNev = '', fontSzam = null, fontCs = null, szin = null;
    function uj() { return { felsorolas: false, igazitas: '', futamok: [] }; }
    function kp() {
      var f = fontok[st.f];
      if (f && f.cs !== null) return { 238: 1250, 0: 1252, 204: 1251, 161: 1253, 162: 1254, 186: 1257, 2: 0 }[f.cs] || ansiKp;
      return ansiKp;
    }
    function asztro() { var f = fontok[st.f]; return !!(f && ASZTRO_FONT.test(f.nev)); }
    function szoveg(t) {
      if (st.kihagy) {
        if (st.dest === 'fonttbl') fontNev += t;
        return;
      }
      if (st.pntext) { bek.felsorolas = true; return; }
      var a = asztro();
      if (a) t = t.split('').map(function (c) { return FONT_JEL[c] || c; }).join('');
      var szinHex = st.cf && szinek[st.cf] ? szinek[st.cf] : null, hatter = st.hl && szinek[st.hl] ? szinek[st.hl] : null;
      var meret = st.fs !== 20 && !a ? st.fs / 2 : null;
      var fu = bek.futamok, ut = fu[fu.length - 1];
      if (ut && ut.b === !!st.b && ut.i === !!st.i && ut.u === !!st.u && ut.szin === szinHex && ut.hatter === hatter &&
        ut.meret === meret && ut.asztro === a) { ut.t += t; return; }
      fu.push({ t: t, b: !!st.b, i: !!st.i, u: !!st.u, szin: szinHex, hatter: hatter, meret: meret, asztro: a });
    }
    function bekVege() { par.push(bek); var f = bek.felsorolas, ig = bek.igazitas; bek = uj(); bek.felsorolas = f; bek.igazitas = ig; }
    while (i < n) {
      var c = rtf[i];
      if (c === '{') { verem.push(Object.assign({}, st)); i++; continue; }
      if (c === '}') {
        if (st.dest === 'fonttbl' && fontSzam !== null && fontNev) { /* ; nélküli lezárás */ }
        if (verem.length) st = verem.pop(); i++; continue;
      }
      if (c === '\r' || c === '\n') { i++; continue; }
      if (c === '\\') {
        var k = rtf[i + 1];
        if (k === '\'') {
          var b = parseInt(rtf.substr(i + 2, 2), 16); i += 4;
          if (ucHatra > 0) { ucHatra--; continue; }
          var kl = kp();
          szoveg(asztro() ? (ASZTRO_BAJT[b] || String.fromCharCode(b)) : kl === 0 ? String.fromCharCode(b) : kodlapKar(kl, b));
          continue;
        }
        if (k === '\\' || k === '{' || k === '}') { szoveg(k); i += 2; continue; }
        if (k === '~') { szoveg(' '); i += 2; continue; }
        if (k === '*') { st.kihagy = 1; i += 2; continue; }
        if (k === '\r' || k === '\n') { if (!st.kihagy) bekVege(); i += 2; continue; }
        if (!/[a-zA-Z]/.test(k || '')) { i += 2; continue; }
        var m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.substr(i + 1, 40));
        var szo = m[1], p = m[2] !== undefined ? parseInt(m[2], 10) : null;
        i += 1 + m[0].length;
        if (KIHAGY[szo]) {
          st.kihagy = 1; st.dest = szo;
          if (szo === 'colortbl') { szinek = []; szin = null; }
          continue;
        }
        if (st.dest === 'fonttbl') {
          if (szo === 'f') { fontSzam = p; fontNev = ''; fontCs = null; }
          else if (szo === 'fcharset') fontCs = p;
          continue;
        }
        if (st.dest === 'colortbl') {
          szin = szin || [0, 0, 0];
          if (szo === 'red') szin[0] = p; else if (szo === 'green') szin[1] = p; else if (szo === 'blue') szin[2] = p;
          continue;
        }
        if (st.kihagy) continue;
        switch (szo) {
          case 'ansicpg': ansiKp = p; break;
          case 'b': st.b = p === 0 ? 0 : 1; break;
          case 'i': st.i = p === 0 ? 0 : 1; break;
          case 'ul': st.u = p === 0 ? 0 : 1; break;
          case 'ulnone': st.u = 0; break;
          case 'f': st.f = p; break;
          case 'fs': st.fs = p || 20; break;
          case 'cf': st.cf = p || 0; break;
          case 'highlight': st.hl = p || 0; break;
          case 'plain': st.b = st.i = st.u = 0; st.fs = 20; st.cf = 0; st.hl = 0; break;
          case 'uc': st.uc = p; break;
          case 'u': szoveg(String.fromCharCode(p < 0 ? p + 65536 : p)); ucHatra = st.uc; break;
          case 'par': bekVege(); break;
          case 'line': szoveg('\n'); break;
          case 'tab': szoveg('\t'); break;
          case 'pard': bek.felsorolas = false; bek.igazitas = ''; break;
          case 'pntext': st.pntext = 1; break;
          case 'pn': st.kihagy = 1; st.dest = 'pn'; bek.felsorolas = true; break;
          case 'qc': bek.igazitas = 'center'; break;
          case 'qr': bek.igazitas = 'right'; break;
          case 'qj': bek.igazitas = 'justify'; break;
          case 'ql': bek.igazitas = ''; break;
          case 'emdash': szoveg('—'); break;
          case 'endash': szoveg('–'); break;
          case 'bullet': szoveg('•'); break;
          case 'lquote': szoveg('‘'); break;
          case 'rquote': szoveg('’'); break;
          case 'ldblquote': szoveg('„'); break;
          case 'rdblquote': szoveg('”'); break;
          default: break;
        }
        continue;
      }
      // sima szöveg
      var j = i;
      while (j < n && '{}\\\r\n'.indexOf(rtf[j]) < 0) j++;
      var t = rtf.slice(i, j); i = j;
      if (ucHatra > 0) { var lev = Math.min(ucHatra, t.length); t = t.slice(lev); ucHatra -= lev; }
      if (!t) continue;
      if (st.dest === 'fonttbl' && st.kihagy) {
        fontNev += t;
        if (fontNev.indexOf(';') >= 0 && fontSzam !== null) {
          fontok[fontSzam] = { nev: fontNev.replace(/;.*$/, '').trim(), cs: fontCs };
          fontSzam = null; fontNev = '';
        }
        continue;
      }
      if (st.dest === 'colortbl' && st.kihagy) {
        for (var q = 0; q < t.length; q++) if (t[q] === ';') {
          szinek.push(szin ? '#' + szin.map(function (v) { return ('0' + (v | 0).toString(16)).slice(-2); }).join('') : null); szin = null;
        }
        continue;
      }
      szoveg(t);
    }
    if (bek.futamok.length) par.push(bek);
    // a RichEdit a végére üres bekezdést tesz – elhagyjuk
    while (par.length && !par[par.length - 1].futamok.length) par.pop();
    return par;
  }

  /* ---------- modell → HTML (a szerkesztőhöz; csak engedett elemek) ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function futamHtml(f) {
    var t = esc(f.t).replace(/  /g, ' &nbsp;').replace(/\n/g, '<br>').replace(/\t/g, '&emsp;');
    if (f.asztro) t = '<span class="asztro">' + t + '</span>';
    var st = [];
    if (f.szin) st.push('color:' + f.szin);
    if (f.hatter) st.push('background-color:' + f.hatter);
    if (f.meret) st.push('font-size:' + Math.max(7, Math.min(36, f.meret)) + 'pt');
    if (st.length) t = '<span style="' + st.join(';') + '">' + t + '</span>';
    if (f.u) t = '<u>' + t + '</u>';
    if (f.i) t = '<i>' + t + '</i>';
    if (f.b) t = '<b>' + t + '</b>';
    return t;
  }
  function html(m) {
    var ki = '', lista = false;
    m.forEach(function (p) {
      var tart = p.futamok.map(futamHtml).join('') || '<br>';
      var ig = p.igazitas ? ' style="text-align:' + p.igazitas + '"' : '';
      if (p.felsorolas) { if (!lista) { ki += '<ul>'; lista = true; } ki += '<li' + ig + '>' + tart + '</li>'; return; }
      if (lista) { ki += '</ul>'; lista = false; }
      ki += '<div' + ig + '>' + tart + '</div>';
    });
    if (lista) ki += '</ul>';
    return ki;
  }
  function szovegBol(m) {
    return m.map(function (p) { return (p.felsorolas ? '• ' : '') + p.futamok.map(function (f) { return f.t; }).join(''); }).join('\n');
  }

  /* ---------- DOM (contenteditable) → modell ---------- */
  var BLOKK = /^(DIV|P|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|TABLE|TR)$/;
  function szinHex(s) {
    if (!s) return null;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(s);
    if (m) { if (m[4] !== undefined && +m[4] === 0) return null; return '#' + [m[1], m[2], m[3]].map(function (v) { return ('0' + (+v).toString(16)).slice(-2); }).join(''); }
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map(function (c) { return c + c; }).join('').toLowerCase();
    return null;
  }
  function domModell(gyoker) {
    var par = [], bek = null;
    function ujBek(felsorolas, ig) { bek = { felsorolas: !!felsorolas, igazitas: ig || '', futamok: [] }; par.push(bek); }
    function hozzaad(t, f) {
      if (!bek) ujBek(false, '');
      // a Unicode-asztrojelek külön futamba (RTF-ben RegiomontanusWIN)
      var resz = t.split(/([☉☽☿♀♂♃♄♅♆♇☊☋⚷⚳⚴⚵⚶⚸⊕♈♉♊♋♌♍♎♏♐♑♒♓☌☍□∠⚼△⚹⚺⚻⬠⬟])\uFE0E?/);
      resz.forEach(function (r, k) {
        if (!r) return;
        var a = k % 2 === 1 || (f.asztro && r.split('').every(function (c) { return JEL_FONT[c]; }));
        var fu = bek.futamok, ut = fu[fu.length - 1];
        var uj = { t: r, b: f.b, i: f.i, u: f.u, szin: f.szin, hatter: f.hatter, meret: a ? null : f.meret, asztro: !!a };
        if (ut && ut.b === uj.b && ut.i === uj.i && ut.u === uj.u && ut.szin === uj.szin && ut.hatter === uj.hatter &&
          ut.meret === uj.meret && ut.asztro === uj.asztro) ut.t += r; else fu.push(uj);
      });
    }
    function bejar(cs, f, li) {
      // a contenteditable a többszörös szóközt nem törhető szóközzel jelöli – RTF-be sima szóközként megy
      if (cs.nodeType === 3) { var t = cs.nodeValue.replace(/[\r\n]+/g, ' ').replace(/\u00a0/g, ' '); if (t) hozzaad(t, f); return; }
      if (cs.nodeType !== 1) return;
      var tag = cs.tagName, g = Object.assign({}, f), s = cs.style || {};
      if (tag === 'BR') { if (!bek) ujBek(li, ''); hozzaad('\n', f); return; }
      if (tag === 'B' || tag === 'STRONG' || /^(bold|[6-9]00)$/.test(s.fontWeight || '')) g.b = true;
      if (tag === 'I' || tag === 'EM' || s.fontStyle === 'italic') g.i = true;
      if (tag === 'U' || /underline/.test(s.textDecoration || s.textDecorationLine || '')) g.u = true;
      if (tag === 'FONT' && cs.getAttribute('color')) g.szin = szinHex(cs.getAttribute('color'));
      if (tag === 'FONT' && cs.getAttribute('size')) g.meret = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 18, 6: 24, 7: 36 }[cs.getAttribute('size')] || null;
      if (s.color) g.szin = szinHex(s.color);
      if (s.backgroundColor) g.hatter = szinHex(s.backgroundColor);
      if (s.fontSize && /pt$/.test(s.fontSize)) g.meret = parseFloat(s.fontSize);
      else if (s.fontSize && /px$/.test(s.fontSize)) g.meret = Math.round(parseFloat(s.fontSize) * 0.75);
      if (cs.classList && cs.classList.contains('asztro')) g.asztro = true;
      var blokk = BLOKK.test(tag), uLi = li || tag === 'LI';
      if (blokk && tag !== 'UL' && tag !== 'OL') {
        // új bekezdés, ha az előző nem üres vagy blokkból jövünk
        if (!bek || bek.futamok.length || bek.felsorolas !== (tag === 'LI')) ujBek(tag === 'LI' || li, (s.textAlign && s.textAlign !== 'left' && s.textAlign !== 'start') ? s.textAlign : '');
        else { bek.felsorolas = tag === 'LI' || !!li; if (s.textAlign && s.textAlign !== 'left' && s.textAlign !== 'start') bek.igazitas = s.textAlign; }
      }
      for (var c = cs.firstChild; c; c = c.nextSibling) bejar(c, g, uLi && tag !== 'UL' && tag !== 'OL' ? true : (tag === 'UL' || tag === 'OL' ? false : li));
      if (blokk) bek = null;
    }
    var alap = { b: false, i: false, u: false, szin: null, hatter: null, meret: null, asztro: false };
    for (var c = gyoker.firstChild; c; c = c.nextSibling) bejar(c, alap, false);
    // egy blokk végi <br> (üres sor jelzése) nem kell
    par.forEach(function (p) {
      var fu = p.futamok, ut = fu[fu.length - 1];
      if (ut && /\n$/.test(ut.t)) { ut.t = ut.t.slice(0, -1); if (!ut.t) fu.pop(); }
    });
    while (par.length && !par[par.length - 1].futamok.length) par.pop();
    return par;
  }

  /* ---------- modell → RTF (csak ASCII, sortörés nélkül – így biztonságosan csomagolható a .mgj-be) ---------- */
  function rtfSzoveg(t, asztro) {
    var ki = '';
    for (var k = 0; k < t.length; k++) {
      var ch = t[k], cc = t.charCodeAt(k);
      if (asztro) { var fb = JEL_FONT[ch]; if (fb) ch = fb; else if (ch === '\uFE0E') continue; cc = ch.charCodeAt(0); }
      if (ch === ' ' && t[k - 1] === ' ') { ki += '\\~'; continue; }   // többszörös szóköz: a 2.-tól nem törhető
      if (ch === '\\' || ch === '{' || ch === '}') ki += '\\' + ch;
      else if (ch === '\n') ki += '\\line ';
      else if (ch === '\t') ki += '\\tab ';
      else if (ch === '\u00a0') ki += '\\~';
      else if (cc < 32) continue;
      else if (cc < 128) ki += ch;
      else {
        var b = asztro && cc < 256 && cc >= 0xA0 ? cc : cp1250Bajt(ch);
        if (b !== undefined) ki += '\\\'' + ('0' + b.toString(16)).slice(-2);
        else if (cc >= 0xD800 && cc <= 0xDBFF) { ki += '\\u' + (cc - 65536) + '?\\u' + (t.charCodeAt(++k) - 65536) + '?'; }
        else ki += '\\u' + (cc > 32767 ? cc - 65536 : cc) + '?';
      }
    }
    return ki;
  }
  function rtf(m) {
    var szinek = [];
    function szinIdx(h) { if (!h) return 0; var k = szinek.indexOf(h); if (k < 0) { szinek.push(h); k = szinek.length - 1; } return k + 1; }
    var torzs = '', elozoLista = false;
    m.forEach(function (p) {
      var fej = '\\pard';
      if (p.felsorolas) fej += '{\\pntext\\f2\\\'b7\\tab}{\\*\\pn\\pnlvlblt\\pnf2\\pnindent0{\\pntxtb\\\'b7}}\\fi-200\\li200';
      if (p.igazitas === 'center') fej += '\\qc'; else if (p.igazitas === 'right') fej += '\\qr'; else if (p.igazitas === 'justify') fej += '\\qj';
      torzs += fej + ' ';
      p.futamok.forEach(function (f) {
        var vez = '\\f' + (f.asztro ? 1 : 0) + '\\fs' + (f.asztro ? 30 : Math.round((f.meret || 10) * 2)) + '\\cf' + szinIdx(f.szin) +
          '\\highlight' + szinIdx(f.hatter) + (f.b ? '\\b' : '\\b0') + (f.i ? '\\i' : '\\i0') + (f.u ? '\\ul' : '\\ulnone');
        torzs += '{' + vez + ' ' + rtfSzoveg(f.t, f.asztro) + '}';
      });
      torzs += '\\par ';
      elozoLista = p.felsorolas;
    });
    if (elozoLista) torzs += '\\pard ';
    var szt = szinek.length ? '{\\colortbl ;' + szinek.map(function (h) {
      return '\\red' + parseInt(h.substr(1, 2), 16) + '\\green' + parseInt(h.substr(3, 2), 16) + '\\blue' + parseInt(h.substr(5, 2), 16) + ';';
    }).join('') + '}' : '';
    return '{\\rtf1\\ansi\\ansicpg1250\\deff0\\deflang1038{\\fonttbl{\\f0\\fnil\\fcharset238 Tahoma;}' +
      '{\\f1\\fnil\\fcharset238 RegiomontanusWIN;}{\\f2\\fnil\\fcharset2 Symbol;}}' + szt +
      '\\viewkind4\\uc1\\pard\\f0\\fs20 ' + torzs + '}';
  }

  /* ---------- .mgj ---------- */
  /** Csomagolt érték (UTF-16 karakterenként két cp1250 bájt) → RTF szöveg. */
  function kicsomagol(v) {
    var bajtok = [];
    for (var k = 0; k < v.length; k++) { var c = v.charCodeAt(k); bajtok.push(c & 255, c >> 8); }
    while (bajtok.length && bajtok[bajtok.length - 1] === 0) bajtok.pop();
    var s = '';
    for (var q = 0; q < bajtok.length; q++) s += kodlapKar(1250, bajtok[q]);
    return s.replace(/#S#/g, '\r\n');
  }
  /** Ha az érték már olvasható RTF (pl. kézzel szerkesztett fájl), változatlanul; különben kicsomagolva. */
  /** Régi, sima szöveges jegyzet (a TfrmMegjegyzesek-ből, sortörés = #S#) → RTF. */
  function szovegbolRtf(t) {
    return rtf(t.split('#S#').map(function (sor) {
      return { felsorolas: false, igazitas: '', futamok: sor ? [{ t: sor, b: false, i: false, u: false, szin: null, hatter: null, meret: null, asztro: false }] : [] };
    }));
  }
  /** A .mgj-érték három változata (D MRE 852): kész RTF · csomagolt RTF (a „{\” U+5C7B) · régi sima szöveg. */
  function ertekRtf(v) {
    if (/^\{\\rtf/.test(v)) return v.replace(/#S#/g, '\r\n');
    if (v.charCodeAt(0) === 0x5C7B) return kicsomagol(v);
    return szovegbolRtf(v);
  }
  /** RTF → csomagolt érték: a CR/LF bájtok elhagyva (a RichEdit nem igényli), #S# nélkül; páratlan hossznál 0x00 pótlás. */
  function becsomagol(rtfStr) {
    var s = rtfStr.replace(/[\r\n]+/g, ''), b = [];
    for (var k = 0; k < s.length; k++) { var c = s.charCodeAt(k); b.push(c < 128 ? c : (cp1250Bajt(s[k]) || 63)); }
    if (b.length % 2) b.push(0);
    var ki = '';
    for (var q = 0; q < b.length; q += 2) ki += String.fromCharCode(b[q] | (b[q + 1] << 8));
    return ki;
  }
  /** .mgj fájl (ArrayBuffer) → { kulcs: rtf } */
  function mgjOlvas(buf) {
    var szoveg = global.RegioSzk ? global.RegioSzk.decode(buf) : new TextDecoder('utf-16le').decode(new Uint8Array(buf).subarray(2));
    var ki = {}, sec = null;
    szoveg.split(/\r\n|\n/).forEach(function (sor) {
      var m = /^\s*\[(.+)\]\s*$/.exec(sor);
      if (m) { sec = m[1]; return; }
      var k = sor.indexOf('=');
      if (sec === 'Megjegyzes' && k > 0) { var v = ertekRtf(sor.slice(k + 1)); if (v.trim()) ki[sor.slice(0, k).trim()] = v; }
    });
    return ki;
  }
  /** { kulcs: rtf } → .mgj (UTF-16LE BOM-mal, CRLF) */
  function mgjEpit(jegyzetek) {
    var sorok = ['[Megjegyzes]'];
    rendez(Object.keys(jegyzetek)).forEach(function (k) { if (jegyzetek[k]) sorok.push(k + '=' + becsomagol(jegyzetek[k])); });
    var t = sorok.join('\r\n') + '\r\n', b = new Uint8Array(2 + t.length * 2);
    b[0] = 0xFF; b[1] = 0xFE;
    for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); b[2 + 2 * i] = c & 255; b[3 + 2 * i] = c >> 8; }
    return b.buffer;
  }
  /** A kulcsok sorrendje: A, J, P, H, F, E (a Windows-os „összes jegyzet” sorrendje), azon belül szám szerint. */
  function rendez(kulcsok) {
    var SOR = 'AJPHFE';
    return kulcsok.slice().sort(function (x, y) {
      var a = SOR.indexOf(x[0]), b = SOR.indexOf(y[0]);
      return a !== b ? a - b : (parseInt(x.slice(2), 10) || 0) - (parseInt(y.slice(2), 10) || 0);
    });
  }

  R.Rtf = {
    modell: modell, html: html, domModell: domModell, rtf: rtf, szoveg: szovegBol,
    htmlBol: function (r) { return html(modell(r)); },
    szovegBol: function (r) { return szovegBol(modell(r)); },
    mgjOlvas: mgjOlvas, mgjEpit: mgjEpit, rendez: rendez, kicsomagol: kicsomagol, becsomagol: becsomagol, ertekRtf: ertekRtf,
    szovegbolRtf: szovegbolRtf, JEL_FONT: JEL_FONT,
    FONT_JEL: FONT_JEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
