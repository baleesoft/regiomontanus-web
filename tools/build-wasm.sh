#!/usr/bin/env bash
# Swiss Ephemeris -> WebAssembly (public/swe/swe.wasm), reprodukálható fordítás.
# Követelmény: git, python3, pip install ziglang
# Használat: tools/build-wasm.sh [swisseph-commit]
set -euo pipefail

COMMIT="${1:-c69c14adb7a0f94829586ffd92cd422aacb21e86}"   # aloistr/swisseph, 2026-10-20 (v2.10.03)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet https://github.com/aloistr/swisseph "$WORK/swisseph"
git -C "$WORK/swisseph" checkout --quiet "$COMMIT"
SRC="$WORK/swisseph"

EXPORTS=(swe_set_ephe_path swe_version swe_julday swe_revjul swe_utc_to_jd swe_deltat
         swe_calc_ut swe_calc swe_houses_ex swe_houses_ex2 swe_house_pos swe_fixstar2_ut
         swe_sidtime swe_get_ayanamsa_ut swe_set_sid_mode swe_difdeg2n swe_degnorm
         swe_solcross_ut swe_mooncross_ut swe_get_planet_name swe_rise_trans swe_pheno_ut swe_time_equ
         swe_close malloc free)
LDFLAGS=()
for f in "${EXPORTS[@]}"; do LDFLAGS+=("-Wl,--export=$f"); done

python3 -m ziglang cc -target wasm32-wasi -O2 -DNO_SWE_GLP -mexec-model=reactor \
  -o "$ROOT/public/swe/swe.wasm" \
  "$SRC"/{swecl,swedate,swehel,swehouse,swejpl,swemmoon,swemplan,sweph,swephlib}.c \
  "${LDFLAGS[@]}" -lm

# Adatfájlok: 600 éves blokkok 600–2999 között (a böngésző évszám szerint, igény szerint tölti be)
for b in 06 12 18 24; do
  for p in sepl semo seas; do cp "$SRC/ephe/${p}_${b}.se1" "$ROOT/public/swe/ephe/"; done
done
# A sefstars.txt NEM innen jön: a Windows-os Regiomontanus 2018-as katalógusa van a repóban (ugyanazok a pozíciók,
# és benne van mind a 737 csillag – az újabbal a ,32Dra nem található).

ls -la "$ROOT/public/swe/swe.wasm"
