"""Generates icon-512.png and icon-192.png for the Airsona (formerly Airtime) PWA.

Same glyph as the inline SVG favicon in index.html: five vertical bars of
varying height (like an audio level meter), on the app's dark background --
matches the "brand-bars" logo shown in the header. Bar geometry is defined
on the SVG's own 64x64 unit grid and scaled up, so it stays pixel-faithful
to the favicon at any output size.

Previously this drew a different glyph entirely (a blue play-button circle
with broadcast arcs) -- stale from before the header/favicon was redesigned
to the current bar-chart look, which is why the PNG icons (used for
apple-touch-icon and the PWA manifest) didn't match the favicon a phone's
browser actually shows. Run once; output files are checked into the repo.
"""
from PIL import Image, ImageDraw

BG = (27, 25, 21, 255)       # #1b1915 -- same background as the favicon SVG
ACCENT = (224, 161, 60, 255)  # #e0a13c -- same accent color as the favicon SVG

# Bar geometry on the favicon SVG's own 64x64 unit grid: (x, y, width, height).
BARS_64 = [
    (6, 37, 8, 15),
    (17, 17, 8, 35),
    (28, 28, 8, 24),
    (39, 12, 8, 40),
    (50, 40, 8, 12),
]
CORNER_RADIUS_64 = 14  # background rect corner radius
BAR_RADIUS_64 = 2      # each bar's own corner radius


def render(size):
    scale = size / 64
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=CORNER_RADIUS_64 * scale, fill=BG)
    for x, y, w, h in BARS_64:
        d.rounded_rectangle(
            [x * scale, y * scale, (x + w) * scale, (y + h) * scale],
            radius=BAR_RADIUS_64 * scale,
            fill=ACCENT,
        )
    return img


def main():
    render(512).convert('RGB').save('icon-512.png')
    render(192).convert('RGB').save('icon-192.png')


if __name__ == '__main__':
    main()
