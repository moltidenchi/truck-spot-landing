"""Subset the OFL fonts to Latin and write WOFF2 files into assets/fonts/.

Usage: python3 tools/build_fonts.py <dir-with-source-ttfs>
Needs fonttools + brotli (see README). Source TTFs: Big Shoulders Display
(variable, google/fonts ofl/bigshouldersdisplay) and Atkinson Hyperlegible
Regular/Bold (google/fonts ofl/atkinsonhyperlegible).
"""
import io
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"
# Basic Latin + Latin-1 + common punctuation (dashes, quotes, ellipsis, bullet, euro, arrows).
UNICODES = "U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2032-2033,U+20AC,U+2190-2193,U+2212"


def write(font: TTFont, name: str) -> None:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "tnum", "lnum", "case"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    font.flavor = "woff2"
    path = OUT / name
    font.save(path)
    print(f"{path.relative_to(OUT.parent.parent)}  {path.stat().st_size // 1024} KB")


def main(src: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    display = TTFont(src / "BigShouldersDisplay-wght.ttf")
    display = instancer.instantiateVariableFont(display, {"wght": (600, 900)})
    buf = io.BytesIO()
    display.save(buf)  # round-trip so the subsetter sees fully compiled tables
    buf.seek(0)
    display = TTFont(buf)
    write(display, "BigShouldersDisplay-600-900.woff2")
    for weight in ("Regular", "Bold"):
        write(TTFont(src / f"AtkinsonHyperlegible-{weight}.ttf"), f"AtkinsonHyperlegible-{weight}.woff2")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
