#!/usr/bin/env bash
# Optional headless smoke test (Chrome/Chromium CLI only, no Playwright/Puppeteer):
# loads the page, checks the map rendered tiles and markers, the 12 tickets rendered,
# and that the console logged no errors or Content-Security-Policy violations.
# Usage: bash tests/browser_check.sh [base-url]   (default: serves the repo on 127.0.0.1:8799)
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="${CHROME:-$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)}"
[ -n "$CHROME" ] || { echo "skip: no Chrome/Chromium found"; exit 0; }

BASE="${1:-}"
if [ -z "$BASE" ]; then
  python3 -m http.server 8799 --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER=$!
  trap 'kill $SERVER' EXIT
  sleep 1
  BASE="http://127.0.0.1:8799/"
fi

fail=0
for page in "" "style-guide.html"; do
  log=$(mktemp)
  dom=$("$CHROME" --headless --no-sandbox --disable-gpu --enable-logging=stderr --v=0 \
        --virtual-time-budget=12000 --window-size=1440,1000 --dump-dom "${BASE}${page}" 2>"$log")
  errors=$(grep -E "CONSOLE" "$log" | grep -E "${BASE%/}" | grep -viE "sourcemap|\.map" || true)
  if [ -n "$errors" ]; then echo "FAIL ${page:-index}: console messages"; echo "$errors"; fail=1; fi
  if [ -z "$page" ]; then
    tickets=$(grep -o 'class="ticket[" ]' <<<"$dom" | wc -l)
    markers=$(grep -o 'truck-marker' <<<"$dom" | wc -l)
    tiles=$(grep -o 'leaflet-tile-loaded' <<<"$dom" | wc -l)
    attribution=$(grep -c 'openstreetmap.org/copyright' <<<"$dom" || true)
    echo "index: tickets=$tickets markers=$markers tiles_loaded=$tiles osm_attribution=$attribution"
    [ "$tickets" -eq 12 ] || { echo "FAIL: expected 12 tickets"; fail=1; }
    [ "$markers" -ge 12 ] || { echo "FAIL: expected 12 map markers"; fail=1; }
    [ "$tiles" -gt 0 ] || { echo "FAIL: no map tiles loaded (offline?)"; fail=1; }
    [ "$attribution" -gt 0 ] || { echo "FAIL: OSM attribution missing"; fail=1; }
  fi
  rm -f "$log"
done
[ "$fail" -eq 0 ] && echo "browser check: OK"
exit "$fail"
