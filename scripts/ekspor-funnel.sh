#!/usr/bin/env bash
# Ekspor CSV harian funnel ke ~/tni-belajar/docs/devops/ekspor/
# Dipanggil launchd harian jam 01:00 WIB.

set -euo pipefail

TOKEN="LAPIS3-FUNNEL-PROD"
API="https://siappsikotes-api.rasyidahmad180.workers.dev/api/laporan/funnel"
DIR="${HOME}/tni-belajar/docs/devops/ekspor"
mkdir -p "$DIR"

DATE="$(date +%F)"
OUT="${DIR}/funnel-${DATE}.csv"

curl -sf "${API}?token=${TOKEN}&hari=2&format=csv" > "$OUT" 2>/dev/null || exit 1

# Symlink latest
ln -sf "$(basename "$OUT")" "${DIR}/latest.csv"

echo "$(date -Iseconds) exported $(wc -l < "$OUT") lines to $OUT"