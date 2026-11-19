"""Take the README/contest screenshots with headless Chrome/Chromium (CLI --screenshot only) and crop
them with Pillow. Sections are found by the page's own colour bands (white finder after the hero, ketchup opt-in,
asphalt footer), so no test hooks are needed in the page.

Usage: python3 tools/shots.py [base-url]   (default http://127.0.0.1:8000/, start `python3 -m http.server 8000` first)
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shots"
KETCHUP, ASPHALT, WHITE = (200, 40, 27), (29, 33, 39), (255, 255, 255)


def chrome() -> str:
    for cand in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        if shutil.which(cand):
            return shutil.which(cand)
    raise SystemExit("No Chrome/Chromium found")


def shoot(url: str, width: int, height: int) -> Image.Image:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "shot.png"
        subprocess.run(
            [chrome(), "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1", "--virtual-time-budget=15000",
             f"--window-size={width},{height}", f"--screenshot={out}", url],
            check=True, capture_output=True,
        )
        return Image.open(out).convert("RGB").copy()


def near(px, colour, tol=6):
    return all(abs(a - b) <= tol for a, b in zip(px, colour))


def band(im: Image.Image, colour, x=3, start=0):
    """First and last row (from `start`) where column x has `colour`, as a contiguous run."""
    top = next(y for y in range(start, im.height) if near(im.getpixel((x, y)), colour))
    bottom = next((y for y in range(top, im.height) if not near(im.getpixel((x, y)), colour)), im.height)
    return top, bottom


def save(im: Image.Image, name: str):
    OUT.mkdir(exist_ok=True)
    path = OUT / name
    im.save(path, optimize=True)
    print(f"shots/{name}  {im.width}x{im.height}")


def main(base: str):
    save(shoot(base, 1440, 900), "01-desktop-hero.png")

    full = shoot(base + "#truck-falafel-fleet", 1440, 3000)
    hero_end, _ = band(full, WHITE)  # first white row = end of the mustard header + hero
    red_top, red_end = band(full, KETCHUP, start=hero_end)
    _, foot_end = band(full, ASPHALT, start=red_end)
    save(full.crop((0, hero_end, 1440, red_top)), "02-desktop-map-and-tickets.png")
    save(full.crop((0, red_top, 1440, foot_end)), "03-desktop-optin-and-footer.png")
    save(full.crop((0, 0, 1440, foot_end)), "07-desktop-full-page.png")

    save(shoot(base, 390, 844), "04-mobile-hero.png")
    mob = shoot(base, 390, 9000)
    m_hero_end, _ = band(mob, WHITE)
    m_red_top, m_red_end = band(mob, KETCHUP, start=m_hero_end)
    _, m_foot_end = band(mob, ASPHALT, start=m_red_end)
    save(mob.crop((0, m_hero_end, 390, m_hero_end + 1400)), "05-mobile-map-and-tickets.png")
    save(mob.crop((0, m_red_top, 390, m_foot_end)), "06-mobile-optin.png")

    guide = shoot(base + "style-guide.html", 1440, 9000)
    last = max(y for y in range(guide.height) if near(guide.getpixel((3, y)), ASPHALT))
    save(guide.crop((0, 0, 1440, 1960)), "08-style-guide-logo-sheet.png")
    save(guide.crop((0, 0, 1440, last + 1)), "09-style-guide-full.png")

    og = shoot(base, 1200, 630)
    og.save(ROOT / "assets" / "img" / "og-image.png", optimize=True)
    print("assets/img/og-image.png  1200x630")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/")
