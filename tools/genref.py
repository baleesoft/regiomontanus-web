"""Referenciaértékek a natív swetest-ből a böngészős teszthez (1848.03.15 12:00 LMT Budapest)."""
import json, subprocess, sys

SWETEST, EPHE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
DATE, UT = "15.3.1848", "10:43:40"   # 12:00 helyi középidő, Budapest LMT +1:16:20 (tzdata)
LAT, LON = 47.5, 19.0666667
BODIES = [(0, "0"), (1, "1"), (2, "2"), (3, "3"), (4, "4"), (5, "5"), (6, "6"), (7, "7"),
          (8, "8"), (9, "9"), (10, "m"), (11, "t"), (12, "A"), (13, "B"), (15, "D"),
          (16, "E"), (17, "F"), (18, "G"), (19, "H"), (20, "I")]


def run(*args):
    out = subprocess.run([SWETEST, f"-b{DATE}", f"-ut{UT}", f"-edir{EPHE}", "-head", "-g,", *args],
                         capture_output=True, text=True, check=True).stdout
    return [[c.strip() for c in line.split(",")] for line in out.strip().splitlines()]


ref = {"date": DATE, "ut": UT, "lat": LAT, "lon": LON, "planets": {}, "houses": {}, "stars": {}}
for ipl, letter in BODIES:
    row = run(f"-p{letter}", "-fPlbs")[0]
    ref["planets"][ipl] = {"name": row[0], "lon": float(row[1]), "lat": float(row[2]), "speed": float(row[3])}

for hs in "PRCKOA":
    rows = run("-p", f"-house{LON},{LAT},{hs}", "-fPl")
    cusps = [float(r[1]) for r in rows if r[0].startswith("house")]
    asc = next(float(r[1]) for r in rows if r[0] == "Ascendant")
    mc = next(float(r[1]) for r in rows if r[0] == "MC")
    ref["houses"][hs] = {"cusps": cusps, "asc": asc, "mc": mc}

for star in ["Aldebaran", "Regulus", "Spica", "Antares"]:
    row = run("-pf", f"-xf{star}", "-fPl")[0]
    ref["stars"][star] = float(row[-1])

json.dump(ref, open(OUT, "w"), indent=1)
print("ok", len(ref["planets"]), "testek,", len(ref["houses"]), "házrendszer")
