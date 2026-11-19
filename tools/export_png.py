"""Export PNG versions of the logo SVGs and the favicon set with headless Chrome/Chromium (CLI only).

Usage: python3 tools/export_png.py        (needs Pillow for favicon.ico; CHROME=/path overrides the binary)
"""
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "assets" / "logo" / "svg"
PNG = ROOT / "assets" / "logo" / "png"
FAV = ROOT / "assets" / "favicon"


def chrome() -> str:
    for cand in (os.environ.get("CHROME"), "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        if cand and shutil.which(cand):
            return shutil.which(cand)
    raise SystemExit("No Chrome/Chromium found; set CHROME=/path/to/chrome")


def viewbox(svg: Path) -> tuple[float, float]:
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg.read_text())
    return float(m.group(1)), float(m.group(2))


def render(svg: Path, out: Path, width: int, height: int) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "page.html"
        page.write_text(
            "<!doctype html><html><head><style>html,body{margin:0;background:transparent}"
            "img{display:block;width:100vw;height:100vh}</style></head>"
            f'<body><img src="{svg.as_uri()}" alt=""></body></html>'
        )
        subprocess.run(
            [chrome(), "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
             "--default-background-color=00000000", "--force-device-scale-factor=1",
             f"--window-size={width},{height}",
             f"--screenshot={out}", page.as_uri()],
            check=True, capture_output=True,
        )
    with Image.open(out) as im:
        if im.size != (width, height):  # some Chrome builds add a pixel; normalise
            im.resize((width, height), Image.LANCZOS).save(out)
    print(f"{out.relative_to(ROOT)}  {width}x{height}")


def main() -> None:
    PNG.mkdir(parents=True, exist_ok=True)
    for svg in sorted(SVG.glob("*.svg")):
        w, h = viewbox(svg)
        if w == h:  # icons: 512 and 1024 square
            for size in (512, 1024):
                render(svg, PNG / f"{svg.stem}-{size}.png", size, size)
        else:  # lockups: 600 px and 2000 px wide
            for width in (600, 2000):
                render(svg, PNG / f"{svg.stem}-{width}w.png", width, round(width * h / w))
    fav = SVG / "truckspot-favicon.svg"
    app = SVG / "truckspot-app-icon.svg"
    for size in (16, 32, 48):
        render(fav, FAV / f"favicon-{size}.png", size, size)
    render(app, FAV / "apple-touch-icon-180.png", 180, 180)
    for size in (192, 512):
        render(app, FAV / f"icon-{size}.png", size, size)
    images = [Image.open(FAV / f"favicon-{s}.png") for s in (16, 32, 48)]
    images[2].save(FAV / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=images[:2])
    print("assets/favicon/favicon.ico  16/32/48")


if __name__ == "__main__":
    main()
