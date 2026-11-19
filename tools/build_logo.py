"""Build the Truck Spot logo SVGs (icon, lockups, mono, favicon) from geometry + the wordmark font.

The wordmark is set in Big Shoulders Display (wght 900) with HarfBuzz and converted to outlines,
so the SVGs need no font. Run: python3 tools/build_logo.py   (needs fonttools, brotli, uharfbuzz)
"""
import io
import json
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "logo" / "svg"
FONT = ROOT / "assets" / "fonts" / "BigShouldersDisplay-600-900.woff2"
TOKENS = json.loads((ROOT / "docs" / "design-tokens" / "tokens.json").read_text())["color"]
INK, RED, YELLOW, WHITE = (TOKENS[k]["$value"] for k in ("asphalt", "ketchup", "mustard", "curb"))

# ---- Icon geometry on a 64 x 64 grid ------------------------------------------------------------
# A map pin leaning forward (into the direction of travel) with a scalloped food-truck awning
# cap in its head above the classic pin dot; three speed lines trail behind.
TILT = 10  # degrees, pin leans right around its tip


CX, CY = 38, 24


def pin_path(cx: float, cy: float, r: float, tip_y: float) -> str:
    import math

    d = tip_y - cy
    a = math.acos(r / d)  # angle between centre->tip and centre->tangent point
    lx, ly = cx - r * math.sin(a), cy + r * math.cos(a)
    rx = cx + r * math.sin(a)
    return f"M{cx:g} {tip_y:g}L{lx:.2f} {ly:.2f}A{r:g} {r:g} 0 1 1 {rx:.2f} {ly:.2f}Z"


def awning_paths(rin: float, ys: float, n: int, inset: float = 0.0):
    """Awning = the cap of a circle (radius rin, concentric with the pin head) above the chord y=ys,
    with n scallops hanging from the chord. Returns (outline, alternate stripe paths). Stripes are
    exact geometry (arc on top, scallop at the bottom), so no clipPath is needed."""
    import math

    hw = math.sqrt(rin**2 - (ys - CY) ** 2)
    xl, xr = CX - hw, CX + hw
    sw = (xr - xl) / n
    r = sw / 2
    large = 1 if ys > CY else 0
    full = f"M{xl:.2f} {ys:g}A{rin:g} {rin:g} 0 {large} 1 {xr:.2f} {ys:g}" + "".join(
        f"a{r:.3f} {r:.3f} 0 0 1 {-sw:.3f} 0" for _ in range(n)
    ) + "Z"

    rs = rin - inset  # stripes may sit inside a slightly smaller arc (mono version)

    def top(x):
        return CY - math.sqrt(max(rs**2 - (x - CX) ** 2, 0))

    stripes = []
    g = inset * 0.35  # side gap; bottom gap uses the full inset
    for i in range(1, n, 2):
        x1, x2 = xl + i * sw + g, xl + (i + 1) * sw - g
        w, rr = x2 - x1, (x2 - x1) / 2
        stripes.append(
            f"M{x1:.2f} {top(x1):.2f}A{rs:g} {rs:g} 0 0 1 {x2:.2f} {top(x2):.2f}"
            f"V{ys - inset * 0.7:g}a{rr:.3f} {rr:.3f} 0 0 1 {-w:.3f} 0Z"
        )
    return full, stripes


CX, CY, R, TIP = 38, 24, 19, 60
PIN = pin_path(CX, CY, R, TIP)
AWNING, STRIPES = awning_paths(14, 24, 4)
_, STRIPES_MONO = awning_paths(14, 24, 4, inset=2.4)
DOT_R, DOT_Y = 3.6, 37
DOT = f"M{CX - DOT_R:g} {DOT_Y}a{DOT_R} {DOT_R} 0 1 0 {2 * DOT_R:g} 0a{DOT_R} {DOT_R} 0 1 0 {-2 * DOT_R:g} 0Z"
SPEED = [  # (y, x_start, x_end), drawn as round-capped strokes
    (17, 4, 13),
    (26, 1, 13),
    (35, 6, 15),
]
TILT_T = f"rotate({TILT} {CX} {TIP})"


def speed_lines(color: str) -> str:
    lines = "".join(f'<path d="M{x1} {y}H{x2}"/>' for y, x1, x2 in SPEED)
    return f'<g fill="none" stroke="{color}" stroke-width="4" stroke-linecap="round">{lines}</g>'


def icon_color(with_speed=True, speed_color=INK) -> str:
    stripes = "".join(f'<path d="{s}"/>' for s in STRIPES)
    return (
        (speed_lines(speed_color) if with_speed else "")
        + f'<g transform="{TILT_T}"><path fill="{RED}" d="{PIN}"/>'
        + f'<path fill="{WHITE}" d="{AWNING}"/><g fill="{YELLOW}">{stripes}</g>'
        + f'<path fill="{WHITE}" d="{DOT}"/></g>'
    )


def icon_mono(color: str, with_speed=True) -> str:
    # One colour; awning and dot are knocked out (evenodd) so the background shows through, with the
    # alternate awning stripes left standing just inside the rim.
    return (
        (speed_lines(color) if with_speed else "")
        + f'<path transform="{TILT_T}" fill="{color}" fill-rule="evenodd" d="{PIN}{AWNING}{"".join(STRIPES_MONO)}{DOT}"/>'
    )


# ---- Wordmark --------------------------------------------------------------------------------------
def wordmark(text="Truck Spot", size=48.0, tracking=0.5):
    """Return (svg path d, width, cap height) for the text at font-size `size`, baseline y=0."""
    tt = TTFont(FONT)
    raw = io.BytesIO()
    tt.flavor = None  # HarfBuzz cannot read WOFF2; hand it plain sfnt bytes
    tt.save(raw)
    face = hb.Face(hb.Blob(raw.getvalue()))
    font = hb.Font(face)
    font.set_variations({"wght": 900})
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})

    upem = tt["head"].unitsPerEm
    from fontTools.varLib.instancer import instantiateVariableFont

    tt = instantiateVariableFont(tt, {"wght": 900})
    gs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    scale = size / upem
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    x = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        # flip y (font units are y-up), scale to px
        tp = TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, -pos.y_offset * scale))
        gs[name].draw(tp)
        x += pos.x_advance * scale + tracking
    cap = tt["OS/2"].sCapHeight * scale
    return pen.getCommands(), x - tracking, cap


WM_D, WM_W, WM_CAP = wordmark()
SKEW = -8  # degrees; italic lean echoes the tilted pin


def svg(w, h, body, title):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
        f'role="img" aria-labelledby="t"><title id="t">{title}</title>{body}</svg>\n'
    )


def lockup(icon_svg: str, word_color: str) -> tuple[str, float, float]:
    # Icon 64x64 scaled to 72 high, wordmark baseline aligned so cap height centres on the pin head.
    scale = 72 / 64
    gap = 12
    h = 72
    baseline = 24 * scale + WM_CAP / 2 + 4  # centre caps on the pin head (cy=24)
    wx = 64 * scale + gap
    word = (
        f'<g transform="translate({wx:.2f} {baseline:.2f}) skewX({SKEW})">'
        f'<path fill="{word_color}" d="{WM_D}"/></g>'
    )
    w = wx + WM_W + 6
    return f'<g transform="scale({scale:g})">{icon_svg}</g>{word}', w, h


def stacked(icon_svg: str, word_color: str) -> tuple[str, float, float]:
    icon_size = 96
    scale = icon_size / 64
    w = max(WM_W + 8, icon_size)
    ix = (w - icon_size) / 2 - 6  # optical: speed lines make the icon heavier on the left
    baseline = icon_size + 10 + WM_CAP
    word = (
        f'<g transform="translate({(w - WM_W) / 2:.2f} {baseline:.2f}) skewX({SKEW})">'
        f'<path fill="{word_color}" d="{WM_D}"/></g>'
    )
    return f'<g transform="translate({ix:.2f} 0) scale({scale:g})">{icon_svg}</g>{word}', w, baseline + 4


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {}
    files["truckspot-icon.svg"] = svg(64, 64, icon_color(), "Truck Spot")
    files["truckspot-icon-on-dark.svg"] = svg(64, 64, icon_color(speed_color=YELLOW), "Truck Spot")
    files["truckspot-icon-mono-black.svg"] = svg(64, 64, icon_mono("#000000"), "Truck Spot")
    files["truckspot-icon-mono-white.svg"] = svg(64, 64, icon_mono("#FFFFFF"), "Truck Spot")
    for name, (ic, wc) in {
        "truckspot-horizontal.svg": (icon_color(), INK),
        "truckspot-horizontal-on-dark.svg": (icon_color(speed_color=YELLOW), WHITE),
        "truckspot-horizontal-mono-black.svg": (icon_mono("#000000"), "#000000"),
        "truckspot-horizontal-mono-white.svg": (icon_mono("#FFFFFF"), "#FFFFFF"),
    }.items():
        body, w, h = lockup(ic, wc)
        files[name] = svg(w, h, body, "Truck Spot")
    for name, (ic, wc) in {
        "truckspot-stacked.svg": (icon_color(), INK),
        "truckspot-stacked-on-dark.svg": (icon_color(speed_color=YELLOW), WHITE),
    }.items():
        body, w, h = stacked(ic, wc)
        files[name] = svg(w, h, body, "Truck Spot")
    # Favicon / app icon: no speed lines (they vanish at 16 px), pin centred and upright-ish.
    fav = f'<g transform="translate(-6 0)">{icon_color(with_speed=False)}</g>'
    files["truckspot-favicon.svg"] = svg(64, 64, fav, "Truck Spot")
    # App icon: pin on a mustard rounded square (iOS/Android launcher style, also used for 180/512).
    app = (
        f'<rect width="64" height="64" rx="14" fill="{YELLOW}"/>'
        f'<g transform="translate(5.5 6) scale(0.82)">{icon_color(with_speed=True)}</g>'
    )
    files["truckspot-app-icon.svg"] = svg(64, 64, app, "Truck Spot")
    for name, content in files.items():
        (OUT / name).write_text(content)
        print(f"assets/logo/svg/{name}")
    (ROOT / "assets" / "favicon" / "favicon.svg").write_text(files["truckspot-favicon.svg"])


if __name__ == "__main__":
    main()
