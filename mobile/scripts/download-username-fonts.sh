#!/usr/bin/env bash
#
# Download every Google Font the web app lets users pick as a username
# font and stash the .ttf files under mobile/assets/fonts/.
#
# Pulls straight from github.com/google/fonts. Most fonts live in
# `ofl/<slug>/<Family>-Regular.ttf`, a few live under `apache/<slug>/`,
# and a handful are variable-axis fonts that only publish one .ttf with
# an axis bracket in the filename.
#
# Usage: bash mobile/scripts/download-username-fonts.sh
#
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUT_DIR="$SCRIPT_DIR/../assets/fonts"
mkdir -p "$OUT_DIR"

# Format: "Display Name|OUT_NAME|SOURCE_URL"
#   Keep aligned with src/lib/profile-fonts.ts.
FONTS=(
  "Sofadi One|SofadiOne.ttf|https://github.com/google/fonts/raw/main/ofl/sofadione/SofadiOne-Regular.ttf"
  "Jersey 10|Jersey10.ttf|https://github.com/google/fonts/raw/main/ofl/jersey10/Jersey10-Regular.ttf"
  "Limelight|Limelight.ttf|https://github.com/google/fonts/raw/main/ofl/limelight/Limelight-Regular.ttf"
  "Unkempt|Unkempt.ttf|https://github.com/google/fonts/raw/main/apache/unkempt/Unkempt-Regular.ttf"
  "Gugi|Gugi.ttf|https://github.com/google/fonts/raw/main/ofl/gugi/Gugi-Regular.ttf"
  "Turret Road|TurretRoad.ttf|https://github.com/google/fonts/raw/main/ofl/turretroad/TurretRoad-Regular.ttf"
  "Nova Mono|NovaMono.ttf|https://github.com/google/fonts/raw/main/ofl/novamono/NovaMono.ttf"
  "Ewert|Ewert.ttf|https://github.com/google/fonts/raw/main/ofl/ewert/Ewert-Regular.ttf"
  "Ballet|Ballet.ttf|https://github.com/google/fonts/raw/main/ofl/ballet/Ballet%5Bopsz%5D.ttf"
  "Manufacturing Consent|ManufacturingConsent.ttf|https://github.com/google/fonts/raw/main/ofl/manufacturingconsent/ManufacturingConsent-Regular.ttf"
  "Rubik Puddles|RubikPuddles.ttf|https://github.com/google/fonts/raw/main/ofl/rubikpuddles/RubikPuddles-Regular.ttf"
  "Hachi Maru Pop|HachiMaruPop.ttf|https://github.com/google/fonts/raw/main/ofl/hachimarupop/HachiMaruPop-Regular.ttf"
  "Ms Madi|MsMadi.ttf|https://github.com/google/fonts/raw/main/ofl/msmadi/MsMadi-Regular.ttf"
  "Jacquard 24|Jacquard24.ttf|https://github.com/google/fonts/raw/main/ofl/jacquard24/Jacquard24-Regular.ttf"
  "Texturina|Texturina.ttf|https://github.com/google/fonts/raw/main/ofl/texturina/Texturina-Regular.ttf"
  "Great Vibes|GreatVibes.ttf|https://github.com/google/fonts/raw/main/ofl/greatvibes/GreatVibes-Regular.ttf"
  "Rye|Rye.ttf|https://github.com/google/fonts/raw/main/ofl/rye/Rye-Regular.ttf"
  "Bonbon|Bonbon.ttf|https://github.com/google/fonts/raw/main/ofl/bonbon/Bonbon-Regular.ttf"
  "Agu Display|AguDisplay.ttf|https://github.com/google/fonts/raw/main/ofl/agudisplay/AguDisplay%5BMORF%5D.ttf"
  "Agbalumo|Agbalumo.ttf|https://github.com/google/fonts/raw/main/ofl/agbalumo/Agbalumo-Regular.ttf"
)

for entry in "${FONTS[@]}"; do
  IFS='|' read -r display filename url <<<"$entry"
  if curl -sSLf -o "$OUT_DIR/$filename" "$url"; then
    size=$(stat -f%z "$OUT_DIR/$filename" 2>/dev/null || stat -c%s "$OUT_DIR/$filename")
    echo "✓ $display → $filename ($size bytes)"
  else
    echo "✗ $display: download from $url failed"
    rm -f "$OUT_DIR/$filename"
  fi
done
