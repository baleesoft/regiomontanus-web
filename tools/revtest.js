// A revolúció-kereső (Regio.Idotech.atmenet) ellenőrzése állomás (retrográd fordulópont) közelében:
// megvan-e minden átmenet? Referencia: 5 perces lépésekkel végigpásztázott előjelváltások.
// Használat: node tools/revtest.js   (a public/js/idotech.js-t teszteli, 1 perces újrakezdéssel, mint a Revolúciók ablak)
const fs = require('fs'), path = require('path'); const pub = path.resolve(__dirname, '..', 'public');
globalThis.fetch = async u => { const p = path.join(pub, u); return { ok: fs.existsSync(p), status: 404,
  arrayBuffer: async () => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); } }; };
globalThis.window = globalThis;
const idoFajl = process.argv[2] ? path.resolve(process.argv[2]) : path.join(pub, 'js/idotech.js'), ujraKezd = process.argv[3] ? +process.argv[3] : 1 / 1440;
['swe/sweph.js','js/kozos.js','js/keplet.js'].forEach(f => require(path.join(pub, f))); require(idoFajl);
SwissEph.load({ base: 'swe' }).then(async se => {
  await se.ensureEphe([2000, 2600]);
  const I = Regio.Idotech, fl = SwissEph.SE.FLG_SWIEPH | SwissEph.SE.FLG_SPEED;
  const J0 = se.julday(2020, 1, 1, 0);
  let osszes = 0, hiany = 0, hamis = 0, maxHiba = 0; const pelda = [];
  for (const ipl of [2, 3, 4, 6, 11]) {
    const allomas = []; let elo = se.calcUt(J0, ipl, fl).speedLon;
    for (let t = J0 + 0.1; t < J0 + 1500 && allomas.length < 3; t += 0.1) { const v = se.calcUt(t, ipl, fl).speedLon; if ((v < 0) !== (elo < 0)) allomas.push(t); elo = v; }
    for (const ta of allomas) {
      const l0 = se.calcUt(ta, ipl, fl).lon;
      for (const dd of [-0.02, -0.002, -0.0002, 0.0002, 0.002, 0.02]) {
        const cel = (l0 + dd + 360) % 360, A = ta - 40, B = ta + 40;
        const ref = []; let dp = I.kul(se.calcUt(A, ipl, fl).lon, cel);
        for (let t = A + 1/288; t < B; t += 1/288) { const d = I.kul(se.calcUt(t, ipl, fl).lon, cel); if ((d < 0) !== (dp < 0) && Math.abs(d) < 30) ref.push(t); dp = d; }
        const got = []; let jd = A;
        while (true) { const t = I.atmenet(se, ipl, cel, jd, true, fl); if (t === null || t >= B) break; got.push(t); jd = t + ujraKezd; }
        osszes += ref.length;
        ref.forEach(r => { const g = got.find(g => Math.abs(g - r) < 0.02); if (!g) { hiany++; if (pelda.length < 4) pelda.push(R(ipl, dd, ref.length, got.length)); } else maxHiba = Math.max(maxHiba, Math.abs(I.kul(se.calcUt(g, ipl, fl).lon, cel))); });
        got.forEach(g => { if (!ref.some(r => Math.abs(g - r) < 0.02)) hamis++; });
      }
    }
  }
  function R(ipl, dd, a, b) { return Regio.nev(ipl) + ' (eltérés az állomástól ' + dd + '°): referencia ' + a + ' átmenet, talált ' + b; }
  console.log(path.basename(idoFajl), 'újrakezdés', ujraKezd, 'nap | referencia-átmenetek:', osszes, '| kihagyott:', hiany, '| hamis:', hamis,
    '| max. eltérés a célfoktól:', (maxHiba * 3600).toFixed(3) + '″');
  pelda.forEach(p => console.log('  pl.', p));
  process.exitCode = hiany || hamis ? 1 : 0;
});
