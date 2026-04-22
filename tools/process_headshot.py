#!/usr/bin/env python3
"""Process a headshot into the three web-ready sizes used by the site.

Usage:
    python3 tools/process_headshot.py [path/to/source.jpg]

If no path is given, defaults to website/images/source.jpg. Outputs:
    website/images/simon-parker.jpg           — 1600px on longest edge (reference)
    website/images/simon-parker-portrait.jpg  — 720x960 (3:4) for About page
    website/images/simon-parker-thumb.jpg     — 480x480 square for Home card
"""
from pathlib import Path
import sys
from PIL import Image, ImageOps

PROJECT = Path(__file__).resolve().parent.parent
OUT = PROJECT / "website" / "images"
OUT.mkdir(parents=True, exist_ok=True)

src = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / "source.jpg"
if not src.exists():
    print(f"Source image not found: {src}")
    print("Drop the original photo at website/images/source.jpg, or pass a path.")
    sys.exit(1)

print(f"Loading: {src}")
img = Image.open(src)
img = ImageOps.exif_transpose(img)
img = img.convert("RGB")
print(f"Source: {img.size[0]}x{img.size[1]}")


def fit_longest(im, max_side):
    W, H = im.size
    if W >= H:
        return im.resize((max_side, round(H * (max_side / W))), Image.LANCZOS)
    return im.resize((round(W * (max_side / H)), max_side), Image.LANCZOS)


def crop_aspect(im, target_ratio):
    """Crop to aspect ratio, biased toward keeping the face (upper third)."""
    W, H = im.size
    current = W / H
    if current > target_ratio:
        new_w = round(H * target_ratio)
        left = (W - new_w) // 2
        return im.crop((left, 0, left + new_w, H))
    new_h = round(W / target_ratio)
    top = max(0, (H - new_h) // 3)
    return im.crop((0, top, W, top + new_h))


ref = fit_longest(img, 1600)
ref.save(OUT / "simon-parker.jpg", "JPEG", quality=88, optimize=True, progressive=True)
print(f"Wrote simon-parker.jpg ({ref.size[0]}x{ref.size[1]})")

portrait = crop_aspect(img, 3 / 4).resize((720, 960), Image.LANCZOS)
portrait.save(OUT / "simon-parker-portrait.jpg", "JPEG", quality=88, optimize=True, progressive=True)
print(f"Wrote simon-parker-portrait.jpg (720x960)")

thumb = crop_aspect(img, 1.0).resize((480, 480), Image.LANCZOS)
thumb.save(OUT / "simon-parker-thumb.jpg", "JPEG", quality=86, optimize=True, progressive=True)
print(f"Wrote simon-parker-thumb.jpg (480x480)")

print("Done.")
