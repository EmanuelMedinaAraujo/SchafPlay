#!/usr/bin/env python3
"""Generate the preset profile pictures (#14) as flat-vector SVG files.

The look follows the existing hand-drawn avatars in public/ (avatar_resi.jpg,
avatar_sepp.jpg): a friendly Bavarian character bust in Tracht — dirndl or
Trachtenjanker — drawn flat with dark outlines on a dark navy background, and
composed to read inside the circular avatar frame the UI uses everywhere.

Run: python3 scripts/gen-avatars.py   (writes public/avatars/*.svg)
"""

import math
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "avatars")

# Sampled from the existing avatar artwork.
BG_1 = "#16305c"
BG_2 = "#0c1c38"

LINE = "#2a2118"          # outline brown-black, as in the originals
SHIRT = "#fdfdfb"
SHIRT_SHADE = "#dfe3ea"


def head(skin, shade, blush, brow, eye, *, mouth="smile", mustache=None, wrinkles=False):
    """Face: skull, ears, neck, and the features. Shared by every character."""
    parts = []
    # Neck + collarbone shadow
    parts.append(f'<path d="M86 116h28v26a14 14 0 0 1-28 0z" fill="{skin}"/>')
    parts.append(f'<path d="M86 116h28v10a14 9 0 0 1-28 0z" fill="{shade}"/>')
    # Ears
    parts.append(f'<ellipse cx="62" cy="95" rx="7" ry="10" fill="{skin}" stroke="{LINE}" stroke-width="1.6"/>')
    parts.append(f'<ellipse cx="138" cy="95" rx="7" ry="10" fill="{skin}" stroke="{LINE}" stroke-width="1.6"/>')
    # Skull
    parts.append(
        f'<path d="M100 44c22 0 38 17 38 40 0 26-17 46-38 46S62 110 62 84c0-23 16-40 38-40z"'
        f' fill="{skin}" stroke="{LINE}" stroke-width="1.8"/>'
    )
    # Cheeks
    parts.append(f'<ellipse cx="75" cy="101" rx="9" ry="6" fill="{blush}" opacity=".55"/>')
    parts.append(f'<ellipse cx="125" cy="101" rx="9" ry="6" fill="{blush}" opacity=".55"/>')
    # Eyes
    for cx in (86, 114):
        parts.append(f'<ellipse cx="{cx}" cy="88" rx="7" ry="5.4" fill="#fff" stroke="{LINE}" stroke-width="1.2"/>')
        parts.append(f'<circle cx="{cx + 0.6}" cy="88.4" r="3.4" fill="{eye}"/>')
        parts.append(f'<circle cx="{cx + 0.6}" cy="88.4" r="1.7" fill="#20242e"/>')
        parts.append(f'<circle cx="{cx - 0.8}" cy="86.6" r="1.2" fill="#fff"/>')
    # Brows
    parts.append(f'<path d="M78 77q8-5 16-1" fill="none" stroke="{brow}" stroke-width="3" stroke-linecap="round"/>')
    parts.append(f'<path d="M106 76q8-4 16 1" fill="none" stroke="{brow}" stroke-width="3" stroke-linecap="round"/>')
    # Nose
    parts.append(f'<path d="M100 92v10q0 3-3 4" fill="none" stroke="{LINE}" stroke-width="1.6" stroke-linecap="round"/>')
    if wrinkles:
        parts.append(f'<path d="M70 84q4-3 8-2" fill="none" stroke="{LINE}" stroke-width="1.1" opacity=".45" stroke-linecap="round"/>')
        parts.append(f'<path d="M122 82q4-1 8 2" fill="none" stroke="{LINE}" stroke-width="1.1" opacity=".45" stroke-linecap="round"/>')
    # Mouth
    if mouth == "smile":
        parts.append(f'<path d="M88 110q12 12 24 0q-12 5-24 0z" fill="#8d3b3f" stroke="{LINE}" stroke-width="1.4" stroke-linejoin="round"/>')
        parts.append(f'<path d="M90.5 110.8q9.5 3.2 19 0q-9.5 2.6-19 0z" fill="#fff"/>')
    else:  # closed, gentle
        parts.append(f'<path d="M89 111q11 8 22 0" fill="none" stroke="{LINE}" stroke-width="2" stroke-linecap="round"/>')
    if mustache:
        parts.append(
            f'<path d="M100 104q-5-5-13-3-9 2-9 8 8 3 13-1 4-3 9-4zm0 0q5-5 13-3 9 2 9 8-8 3-13-1-4-3-9-4z"'
            f' fill="{mustache}" stroke="{LINE}" stroke-width="1.2" stroke-linejoin="round"/>'
        )
    return "\n  ".join(parts)


def braid(x0, y0, color, shade, flip=1):
    """A hanging plait: alternating rounded segments, as on the Resi artwork."""
    out = []
    x, y = x0, y0
    for i in range(6):
        w = 11 - i * 0.9
        h = 9 - i * 0.5
        tilt = 18 * flip
        fill = color if i % 2 == 0 else shade
        out.append(
            f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{w:.1f}" ry="{h:.1f}" fill="{fill}"'
            f' stroke="{LINE}" stroke-width="1.4" transform="rotate({tilt} {x:.1f} {y:.1f})"/>'
        )
        x += 1.6 * flip
        y += h * 1.45
    # Ribbon tie at the end
    out.append(f'<rect x="{x - 5.5:.1f}" y="{y - 4:.1f}" width="11" height="6" rx="3" fill="#c8385a" stroke="{LINE}" stroke-width="1.2"/>')
    return "\n  ".join(out)


def flower(cx, cy, petal, core, r=4.2):
    out = []
    for i in range(5):
        a = math.radians(i * 72 - 90)
        px = cx + math.cos(a) * r
        py = cy + math.sin(a) * r
        out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r * 0.62:.1f}" fill="{petal}" stroke="{LINE}" stroke-width="1"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r * 0.5:.1f}" fill="{core}" stroke="{LINE}" stroke-width="1"/>')
    return "\n  ".join(out)


def dirndl(bodice, bodice_dark, apron):
    """Woman's Tracht: puff-sleeve blouse, laced bodice, trimmed neckline.

    Blouse and sleeves are one silhouette so the bust reads as a single shape
    inside the circular frame instead of detached blobs.
    """
    return f"""
  <path d="M2 200c0-30 8-52 34-62 12-5 26-8 64-8s52 3 64 8c26 10 34 32 34 62z"
        fill="{SHIRT}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M40 200c-4-22 0-36 8-44" fill="none" stroke="{SHIRT_SHADE}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M160 200c4-22 0-36-8-44" fill="none" stroke="{SHIRT_SHADE}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M22 178q12-10 26-11M178 178q-12-10-26-11" fill="none" stroke="{SHIRT_SHADE}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M66 154q34-14 68 0l10 46H56z" fill="{bodice}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M66 154q34-14 68 0l2 12q-36-13-72 0z" fill="{bodice_dark}"/>
  <path d="M100 160q-20 1-33 7l-6 33h78l-6-33q-13-6-33-7z" fill="{apron}" opacity=".2"/>
  <path d="M72 165q28-11 56 0" fill="none" stroke="#f4efe4" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M100 164v36" stroke="{LINE}" stroke-width="1.2" opacity=".45"/>
  <path d="M86 173l28 11M114 173l-28 11M86 188l28 11M114 188l-28 11" stroke="#f2e2b6" stroke-width="2" stroke-linecap="round"/>
  <circle cx="86" cy="173" r="2" fill="#e8d9a8" stroke="{LINE}" stroke-width=".8"/>
  <circle cx="114" cy="173" r="2" fill="#e8d9a8" stroke="{LINE}" stroke-width=".8"/>
  <circle cx="86" cy="188" r="2" fill="#e8d9a8" stroke="{LINE}" stroke-width=".8"/>
  <circle cx="114" cy="188" r="2" fill="#e8d9a8" stroke="{LINE}" stroke-width=".8"/>
"""


def janker(jacket, jacket_dark, scarf):
    """Man's Tracht: white shirt, wool Janker with lapels, neckerchief, Edelweiss pin."""
    return f"""
  <path d="M2 200c0-30 10-50 36-60 12-5 26-8 62-8s50 3 62 8c26 10 36 30 36 60z"
        fill="{jacket}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M78 138h44l4 14-26 14-26-14z" fill="{SHIRT}" stroke="{LINE}" stroke-width="1.6"/>
  <path d="M76 150l24 16-8 34H72z" fill="{SHIRT}" stroke="{LINE}" stroke-width="1.6"/>
  <path d="M124 150l-24 16 8 34h20z" fill="{SHIRT}" stroke="{LINE}" stroke-width="1.6"/>
  <path d="M74 144q-20 6-30 18l16 38 22-34z" fill="{jacket_dark}" stroke="{LINE}" stroke-width="1.6"/>
  <path d="M126 144q20 6 30 18l-16 38-22-34z" fill="{jacket_dark}" stroke="{LINE}" stroke-width="1.6"/>
  <path d="M100 164q-10 5-12 13 5 6 12 6t12-6q-2-8-12-13z" fill="{scarf}" stroke="{LINE}" stroke-width="1.5"/>
  <path d="M91 181l-7 19h10l5-15zM109 181l7 19h-10l-5-15z" fill="{scarf}" stroke="{LINE}" stroke-width="1.5"/>
  <circle cx="99.5" cy="187" r="4.8" fill="{scarf}" stroke="{LINE}" stroke-width="1.5"/>
  <circle cx="66" cy="190" r="3.6" fill="#c8a04a" stroke="{LINE}" stroke-width="1.2"/>
  <circle cx="134" cy="190" r="3.6" fill="#c8a04a" stroke="{LINE}" stroke-width="1.2"/>
  {flower(140, 164, "#f4f1e6", "#e8c65a", 3.6)}
"""


def hat(felt, felt_dark, band, feather):
    """Trachtenhut with cord band, Gamsbart tuft and a feather."""
    return f"""
  <path d="M64 46q6-22 36-22t36 22l4 14H60z" fill="{felt}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M64 46q6-22 36-22 8 0 14 3-24 3-30 19l-3 12H61z" fill="{felt_dark}" opacity=".55"/>
  <path d="M58 58h84q10 0 10 6t-14 8H62q-14-2-14-8t10-6z" fill="{felt}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M60 56h80l2 8H58z" fill="{band}" stroke="{LINE}" stroke-width="1.4"/>
  <path d="M128 52q10-16 20-20-4 12-14 22z" fill="{feather}" stroke="{LINE}" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M66 40q-4-16 2-24 6 8 10 22-6-8-12 2z" fill="#8a6a45" stroke="{LINE}" stroke-width="1.3" stroke-linejoin="round"/>
"""


def svg(body, hair_back, head_svg, hair_front, extras=""):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="78%">
      <stop offset="0%" stop-color="{BG_1}"/>
      <stop offset="100%" stop-color="{BG_2}"/>
    </radialGradient>
    <clipPath id="frame"><circle cx="100" cy="100" r="100"/></clipPath>
  </defs>
  <circle cx="100" cy="100" r="100" fill="url(#bg)"/>
  <g clip-path="url(#frame)">
  {hair_back}
  {body}
  {head_svg}
  {hair_front}
  {extras}
  </g>
</svg>
"""


# --- The five presets -------------------------------------------------------

def resi():
    """Blonde plaits, blue-and-red dirndl — the classic Wirtshaus look."""
    h, hs = "#f0c65c", "#dcae42"
    return svg(
        body=dirndl("#2f5d94", "#254c7c", "#c8385a"),
        hair_back=f'<path d="M56 96q-6-56 44-56t44 56q2 26-6 34 4-46-38-46T62 130q-8-8-6-34z" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>',
        head_svg=head("#f7d3b4", "#e3b795", "#ea8c86", "#c99b34", "#3f7ec4"),
        hair_front=f"""
  <path d="M100 40q-40 0-44 44 12-18 20-20 10 6 24 6t24-6c8 2 20 4 20 20 0-44-44-44-44-44z" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M100 44q-14 14-38 22" fill="none" stroke="{hs}" stroke-width="2" opacity=".8"/>
  {braid(66, 118, h, hs, -1)}
  {braid(134, 118, h, hs, 1)}
  {flower(70, 66, "#f6f1e2", "#e8c65a")}
  {flower(130, 66, "#f2a2b8", "#e8c65a")}
""",
    )


def sepp():
    """Grey-moustached Bauer in a felt hat and wool Janker."""
    return svg(
        body=janker("#414c46", "#333d38", "#2f6b45"),
        hair_back="",
        head_svg=head("#f0c5a2", "#dba889", "#d97a72", "#9a9a96", "#5a7f5f",
                      mouth="smile", mustache="#c9c9c4", wrinkles=True),
        hair_front=f"""
  <path d="M64 74q0-14 8-20 8 26 28 26t28-26q8 6 8 20-6-38-36-38T64 74z" fill="#b8b8b3" stroke="{LINE}" stroke-width="1.6"/>
  {hat("#6a6f68", "#565b55", "#3f4a42", "#a9814e")}
""",
    )


def kathi():
    """Auburn hair in a flower-pinned bun, green dirndl."""
    h, hs = "#b4562c", "#98421f"
    return svg(
        body=dirndl("#2f6b45", "#255637", "#e8c65a"),
        hair_back=f'<path d="M56 98q-6-58 44-58t44 58q2 24-6 32 4-46-38-46T62 130q-8-8-6-32z" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>',
        head_svg=head("#f6cfae", "#e2b390", "#e08a80", "#8a3e1e", "#4f8a56"),
        hair_front=f"""
  <circle cx="100" cy="30" r="17" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M100 40q-42 0-44 42 10-20 18-22 12 7 26 7t26-7c8 2 16 2 18 22-2-42-44-42-44-42z" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M86 46q-14 10-22 26" fill="none" stroke="{hs}" stroke-width="2.2" opacity=".75"/>
  <path d="M114 46q14 10 22 26" fill="none" stroke="{hs}" stroke-width="2.2" opacity=".75"/>
  {flower(78, 46, "#f2a2b8", "#e8c65a", 4.6)}
  {flower(124, 44, "#f6f1e2", "#e8c65a", 4)}
""",
    )


def wastl():
    """Young Bursch, dark hair, red-checked shirt under a brown Janker."""
    return svg(
        body=janker("#6b4a30", "#553a25", "#b23a3a"),
        hair_back="",
        head_svg=head("#f4c8a4", "#dfab87", "#dd8478", "#3a2a1e", "#6b4a2a"),
        hair_front=f"""
  <path d="M100 38q-34 0-36 34-1 12 3 18 1-16 7-22 10 8 26 8t26-8c6 6 8 22 7 22 4-6 3-18 3-18-2-34-36-34z" fill="#3a2a1e" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M84 52q10 8 30 6" fill="none" stroke="#503a29" stroke-width="2.4" stroke-linecap="round"/>
""",
    )


def liesl():
    """Silver-haired Wirtin with a plum dirndl and a lace collar."""
    h, hs = "#d6d3ce", "#bab7b1"
    return svg(
        body=dirndl("#6b3560", "#57294e", "#f2e2b6"),
        hair_back=f'<path d="M56 98q-6-58 44-58t44 58q2 24-6 32 4-46-38-46T62 130q-8-8-6-32z" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>',
        head_svg=head("#f2cdb0", "#dfb192", "#dd8b84", "#a9a49c", "#5e7f9c",
                      mouth="closed", wrinkles=True),
        hair_front=f"""
  <circle cx="100" cy="32" r="15" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M100 40q-40 0-42 42 8-22 16-24 12 8 26 8t26-8c8 2 16 2 16 24-2-42-42-42-42-42z" fill="{h}" stroke="{LINE}" stroke-width="1.8"/>
  <path d="M82 48q-12 10-18 26" fill="none" stroke="{hs}" stroke-width="2.2"/>
  <path d="M118 48q12 10 18 26" fill="none" stroke="{hs}" stroke-width="2.2"/>
  {flower(126, 48, "#e8c65a", "#f6f1e2", 3.8)}
""",
    )


def default():
    """Neutral placeholder for a human seat that has not picked a picture.

    Deliberately a muted silhouette rather than a character, so "no choice yet"
    never reads as one of the five presets. Replaces the 550 kB stock photo the
    pre-#14 code used, which had to be precached for offline play.
    """
    figure = "#6d7f9e"
    figure_dark = "#5a6b87"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="78%">
      <stop offset="0%" stop-color="{BG_1}"/>
      <stop offset="100%" stop-color="{BG_2}"/>
    </radialGradient>
    <clipPath id="frame"><circle cx="100" cy="100" r="100"/></clipPath>
  </defs>
  <circle cx="100" cy="100" r="100" fill="url(#bg)"/>
  <g clip-path="url(#frame)">
    <path d="M18 200c0-34 12-56 40-66 12-4 26-6 42-6s30 2 42 6c28 10 40 32 40 66z" fill="{figure}"/>
    <path d="M78 132h44v14a22 22 0 0 1-44 0z" fill="{figure_dark}"/>
    <circle cx="100" cy="92" r="34" fill="{figure}"/>
    <path d="M62 62h76q8 0 8 5t-9 6H63q-9-1-9-6t8-5z" fill="{figure_dark}"/>
    <path d="M74 62q4-20 26-20t26 20z" fill="{figure_dark}"/>
  </g>
</svg>
"""


PRESETS = {
    "default": default,
    "resi": resi,
    "sepp": sepp,
    "kathi": kathi,
    "wastl": wastl,
    "liesl": liesl,
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in PRESETS.items():
        path = os.path.join(OUT, f"{name}.svg")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(fn())
        print("wrote", os.path.relpath(path, os.path.join(os.path.dirname(__file__), "..")))
