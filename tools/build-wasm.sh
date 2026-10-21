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
         swe_solcross_ut swe_mooncross_ut swe_get_planet_name swe_close malloc free)
LDFLAGS=()
for f in "${EXPORTS[@]}"; do LDFLAGS+=("-Wl,--export=$f"); done

python3 -m ziglang cc -target wasm32-wasi -O2 -DNO_SWE_GLP -mexec-model=reactor \
  -o "$ROOT/public/swe/swe.wasm" \
  "$SRC"/{swecl,swedate,swehel,swehouse,swejpl,swemmoon,swemplan,sweph,swephlib}.c \
  "${LDFLAGS[@]}" -lm

for f in sepl_18.se1 semo_18.se1 seas_18.se1 sefstars.txt; do
  cp "$SRC/ephe/$f" "$ROOT/public/swe/ephe/"
done

ls -la "$ROOT/public/swe/swe.wasm"
