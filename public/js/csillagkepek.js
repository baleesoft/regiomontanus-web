/*
 * csillagkepek.js – az asztroszkóp adatai (tools/build-csillagkepek.py generálja, kézzel ne szerkeszd).
 * IAU-csillagképhatárok (Delporte 1930; Roman 1987, CDS VI/42), ekliptikai hosszúság, J2000.
 * ekl: [rövidítés, kezdet]; kulso: [rövidítés, név, legkisebb |β|, ívek]; tejut: ívek (|b| ≤ 10°). Licenc: AGPL-3.0.
 */
(function (global) {
  'use strict';
  var R = global.Regio = global.Regio || {};
  R.CSILLAGKEPEK = {
    nev: {"And": "Androméda", "Ant": "Légszivattyú", "Aps": "Paradicsommadár", "Aql": "Sas", "Aqr": "Vízöntő", "Ara": "Oltár", "Ari": "Kos", "Aur": "Szekeres", "Boo": "Ökörhajcsár", "Cae": "Véső", "Cam": "Zsiráf", "Cnc": "Rák", "CVn": "Vadászebek", "CMa": "Nagy Kutya", "CMi": "Kis Kutya", "Cap": "Bak", "Car": "Hajógerinc", "Cas": "Kassziopeia", "Cen": "Kentaur", "Cep": "Cepheus", "Cet": "Cet", "Cha": "Kaméleon", "Cir": "Körző", "Col": "Galamb", "Com": "Bereniké Haja", "CrA": "Déli Korona", "CrB": "Északi Korona", "Crv": "Holló", "Crt": "Serleg", "Cru": "Dél Keresztje", "Cyg": "Hattyú", "Del": "Delfin", "Dor": "Aranyhal", "Dra": "Sárkány", "Equ": "Csikó", "Eri": "Eridanus", "For": "Kemence", "Gem": "Ikrek", "Gru": "Daru", "Her": "Herkules", "Hor": "Ingaóra", "Hya": "Északi Vízikígyó", "Hyi": "Déli Vízikígyó", "Ind": "Indián", "Lac": "Gyík", "Leo": "Oroszlán", "LMi": "Kis Oroszlán", "Lep": "Nyúl", "Lib": "Mérleg", "Lup": "Farkas", "Lyn": "Hiúz", "Lyr": "Lant", "Men": "Táblahegy", "Mic": "Mikroszkóp", "Mon": "Egyszarvú", "Mus": "Légy", "Nor": "Szögmérő", "Oct": "Oktáns", "Oph": "Kígyótartó", "Ori": "Orion", "Pav": "Páva", "Peg": "Pegazus", "Per": "Perszeusz", "Phe": "Főnix", "Pic": "Festőállvány", "Psc": "Halak", "PsA": "Déli Hal", "Pup": "Hajófara", "Pyx": "Tájoló", "Ret": "Háló", "Sge": "Nyíl", "Sgr": "Nyilas", "Sco": "Skorpió", "Scl": "Szobrász", "Sct": "Pajzs", "SerCap": "Kígyó feje", "SerCau": "Kígyó farka", "Sex": "Szextáns", "Tau": "Bika", "Tel": "Távcső", "Tri": "Háromszög", "TrA": "Déli Háromszög", "Tuc": "Tukán", "UMa": "Nagy Medve", "UMi": "Kis Medve", "Vel": "Vitorla", "Vir": "Szűz", "Vol": "Repülőhal", "Vul": "Róka"},
    ekl: [["Ari", 28.69], ["Tau", 53.42], ["Gem", 90.14], ["Cnc", 117.99], ["Leo", 138.04], ["Vir", 173.86], ["Lib", 217.81], ["Sco", 241.05], ["Oph", 247.64], ["Sgr", 266.24], ["Cap", 299.66], ["Aqr", 327.49], ["Psc", 351.65]],
    kulso: [
      ["And", "Androméda", 14.4, [[2.1, 54.5]]],
      ["Aql", "Sas", 8.4, [[281.0, 312.7]]],
      ["Aqr", "Vízöntő", 0.0, [[308.3, 357.8]]],
      ["Ara", "Oltár", 22.2, [[253.9, 271.7]]],
      ["Ari", "Kos", 0.0, [[28.5, 57.7]]],
      ["Aur", "Szekeres", 4.6, [[72.2, 108.8]]],
      ["Boo", "Ökörhajcsár", 16.2, [[175.3, 223.0]]],
      ["CMi", "Kis Kutya", 7.6, [[106.6, 125.2]]],
      ["Cam", "Zsiráf", 29.8, [[63.3, 112.2]]],
      ["Cap", "Bak", 0.0, [[298.2, 328.8]]],
      ["Cen", "Kentaur", 12.4, [[184.3, 242.0]]],
      ["Cet", "Cet", 0.2, [[348.8, 51.3]]],
      ["Cnc", "Rák", 0.0, [[116.7, 140.7]]],
      ["Com", "Bereniké Haja", 12.2, [[166.8, 196.5]]],
      ["CrA", "Déli Korona", 13.6, [[269.7, 286.1]]],
      ["Crt", "Serleg", 6.6, [[166.8, 189.7]]],
      ["Crv", "Holló", 5.4, [[183.9, 201.9]]],
      ["Del", "Delfin", 19.0, [[308.3, 326.9]]],
      ["Equ", "Csikó", 16.8, [[317.3, 328.5]]],
      ["Eri", "Eridanus", 16.6, [[342.1, 76.3]]],
      ["Gem", "Ikrek", 0.0, [[90.1, 118.3]]],
      ["Gru", "Daru", 20.4, [[307.6, 336.8]]],
      ["Her", "Herkules", 24.4, [[217.1, 289.6]]],
      ["Hya", "Északi Vízikígyó", 7.2, [[123.7, 231.7]]],
      ["Ind", "Indián", 25.4, [[292.1, 314.6]]],
      ["LMi", "Kis Oroszlán", 13.2, [[130.5, 157.9]]],
      ["Leo", "Oroszlán", 0.0, [[132.7, 177.5]]],
      ["Lib", "Mérleg", 0.0, [[216.0, 242.6]]],
      ["Lup", "Farkas", 8.8, [[227.1, 248.3]]],
      ["Lyn", "Hiúz", 12.2, [[92.7, 134.4]]],
      ["Mic", "Mikroszkóp", 8.4, [[298.1, 315.4]]],
      ["Mon", "Egyszarvú", 10.8, [[88.8, 128.0]]],
      ["Nor", "Szögmérő", 20.2, [[241.7, 257.0]]],
      ["Oph", "Kígyótartó", 0.0, [[239.0, 283.6]]],
      ["Ori", "Orion", 0.6, [[69.3, 96.4]]],
      ["Peg", "Pegazus", 8.0, [[323.9, 15.3]]],
      ["Per", "Perszeusz", 8.8, [[42.2, 78.1]]],
      ["PsA", "Déli Hal", 9.6, [[312.5, 337.9]]],
      ["Psc", "Halak", 0.0, [[343.0, 35.2]]],
      ["Pup", "Hajófara", 29.6, [[105.0, 148.8]]],
      ["Scl", "Szobrász", 17.8, [[332.7, 14.0]]],
      ["Sco", "Skorpió", 0.0, [[239.2, 269.9]]],
      ["Sct", "Pajzs", 7.0, [[275.4, 285.5]]],
      ["SerCap", "Kígyó feje", 13.6, [[215.9, 244.4]]],
      ["SerCau", "Kígyó farka", 7.0, [[259.1, 286.6]]],
      ["Sex", "Szextáns", 1.0, [[145.5, 168.8]]],
      ["Sgr", "Nyilas", 0.0, [[265.9, 302.5]]],
      ["Tau", "Bika", 0.0, [[48.0, 90.2]]],
      ["Tel", "Távcső", 22.2, [[271.7, 298.1]]],
      ["Tri", "Háromszög", 12.2, [[32.0, 50.6]]],
      ["UMa", "Nagy Medve", 21.0, [[104.8, 182.8]]],
      ["Vir", "Szűz", 0.0, [[170.7, 225.5]]]
    ],
    tejut: [[78.49, 101.58], [258.48, 281.57]]
  };
})(typeof window !== 'undefined' ? window : globalThis);
