"""Generates icon-512.png and icon-192.png for the Airtime PWA.

Same glyph as the inline SVG favicon in index.html: a blue play-button
circle with two broadcast arcs above it, on the app's dark background.
Kept within a safe center zone since manifest icons are "maskable" (the OS
may crop to a circle/squircle). Run once; output files are checked into
the repo.
"""
from PIL import Image, ImageDraw

SIZE = 512
BG = (15, 17, 21, 255)      # #0f1115
ACCENT = (79, 176, 255, 255)  # #4fb0ff


def main():
    img = Image.new('RGBA', (SIZE, SIZE), BG)
    d = ImageDraw.Draw(img)

    cx, cy = SIZE // 2, SIZE // 2 + 40

    # Broadcast arcs above the play button (two concentric quarter-rings)
    arc_w = 18
    d.arc([cx - 110, cy - 220, cx + 110, cy - 60], start=200, end=340, fill=ACCENT, width=arc_w)
    d.arc([cx - 150, cy - 260, cx + 150, cy - 20], start=203, end=337, fill=(79, 176, 255, 150), width=arc_w)

    # Play-button circle
    r = 115
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ACCENT)

    # Play triangle cut into the circle, in the background color
    tri_w, tri_h = 90, 110
    d.polygon([
        (cx - tri_w * 0.35, cy - tri_h / 2),
        (cx - tri_w * 0.35, cy + tri_h / 2),
        (cx + tri_w * 0.65, cy),
    ], fill=BG)

    img.convert('RGB').save('icon-512.png')
    img.convert('RGB').resize((192, 192), Image.LANCZOS).save('icon-192.png')


if __name__ == '__main__':
    main()
