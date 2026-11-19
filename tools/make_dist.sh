#!/usr/bin/env bash
# Build the production-ready zip: the static site (page source + all assets), the design
# handoff (tokens, style guide, logo files) and the licence files. No build step is needed to run it.
# Usage: bash tools/make_dist.sh   -> dist/truck-spot-v<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./package.json').version")
NAME="truck-spot-v${VERSION}"
rm -rf dist && mkdir -p "dist/${NAME}"
cp -r index.html style-guide.html site.webmanifest .nojekyll assets docs \
      README.md LICENSE CREDITS.md package.json tools tests shots "dist/${NAME}/"
rm -rf "dist/${NAME}/tools/__pycache__"
(cd dist && python3 -m zipfile -c "${NAME}.zip" "${NAME}")
rm -rf "dist/${NAME}"
echo "dist/${NAME}.zip ($(du -h "dist/${NAME}.zip" | cut -f1))"
unzip -l "dist/${NAME}.zip" | tail -1
