# Credits and third-party licences

The page code, logo artwork and illustrations in this repository are original work for this contest entry (code under the MIT licence in `LICENSE`; artwork rights per the contest terms, see the README). The following third-party material is included or used.

## Leaflet 1.9.4 (vendored)

- What: interactive map library, copied unmodified from the npm package `leaflet@1.9.4` into `assets/vendor/leaflet-1.9.4/` (`leaflet.js`, `leaflet.css`, `images/`). The source map file was left out.
- Licence: BSD 2-Clause, © 2010–2023 Volodymyr Agafonkin, © 2010–2011 CloudMade. Full text: `assets/vendor/leaflet-1.9.4/LICENSE`.
- SHA-256 at the time of vendoring:
  - `leaflet.js` `db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a`
  - `leaflet.css` `a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6`
- Project: https://leafletjs.com

## OpenStreetMap map data and tiles

- Map tiles are loaded at runtime from `tile.openstreetmap.org`. Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL) 1.0: https://www.openstreetmap.org/copyright. The attribution is shown on the map and in the page footer.
- The OSM Foundation’s public tile servers are for light use under the Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/). For a production launch, switch to a commercial or self-hosted tile provider (see README).

## Fonts (self-hosted WOFF2, Latin subset)

- **Big Shoulders Display** — © 2019 The Big Shoulders Project Authors (https://github.com/xotypeco/big_shoulders). SIL Open Font License 1.1, full text `assets/fonts/OFL-BigShouldersDisplay.txt`. Subset to Latin and limited to weights 600–900 by `tools/build_fonts.py`. Also used, converted to outlines, for the logo wordmark (permitted by the OFL; the logo files embed no font software).
- **Atkinson Hyperlegible** — © 2020 Braille Institute of America, Inc. SIL Open Font License 1.1, full text `assets/fonts/OFL-AtkinsonHyperlegible.txt`. Regular and Bold, subset to Latin by `tools/build_fonts.py`.
- Neither licence declares a Reserved Font Name, so the subset files keep their original names.

## Build and test tools (not shipped in the page)

- html-validate 11.21.0 (MIT), dev dependency for HTML validation.
- fontTools, Brotli, uharfbuzz and Pillow (MIT / BSD / Apache-2.0 / MIT-CMU), used only by the Python scripts in `tools/` to subset fonts, outline the wordmark and export PNGs.

## Demo data

All food trucks, menus, prices, opening hours and truck positions are invented for this concept. Any resemblance to a real business name is unintended. The default map centre is downtown Austin, Texas, chosen as a well-known food-truck city; no real vendor is shown.

## AI assistance

This entry was designed and built with AI assistance.
