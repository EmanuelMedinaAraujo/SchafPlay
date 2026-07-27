# Profilbilder / Profile pictures — artwork brief

These are the five preset profile pictures players can pick in **Settings →
Profilbild**, plus the neutral fallback. The app reads this folder directly:
**dropping a file in here under the right name is the whole handover — no code
change is needed.**

## What to deliver

| File | Character | Status |
| --- | --- | --- |
| `resi.jpg` | Resi — young woman, blonde plaits, dirndl. Used by the AI seat **"Resi (KI)"** | ✅ existing artwork |
| `sepp.jpg` | Sepp — older man, grey moustache, Trachtenhut. Used by the AI seat **"Sepp (KI)"** | ✅ existing artwork |
| `zenzi.jpg` | Zenzi — woman, dark hair. Used by the AI seat **"Zenzi (KI)"** (solo mode) | ✅ existing artwork |
| `wastl.jpg` | Wastl — suggestion: younger man / Bursch in Tracht | ⏳ **placeholder — please replace** |
| `liesl.jpg` | Liesl — suggestion: older woman / Wirtin in dirndl | ⏳ **placeholder — please replace** |
| `default.jpg` | Neutral silhouette shown when a player has picked nothing yet | ⏳ optional — replace if you want something nicer |

The three ✅ files are the artwork already in the game. Replace them too if you
want the set to feel like one family — just keep the file names.

## Specification

- **Format:** JPEG (`.jpg`). Keep the exact file names above, all lowercase.
- **Size:** square, **512 × 512 px** is plenty (the biggest on-screen use is
  ~140 px, so 512 covers high-DPI screens). 1024 × 1024 is fine too.
- **File size:** please aim for **≤ 120 kB each** (JPEG quality ~85). The whole
  app is precached for offline play, so every kilobyte here is downloaded by
  every player. The three current files are ~570 kB each, which is why smaller
  re-exports would be very welcome.
- **Background:** solid/subtle dark navy, matching the current artwork
  (`#0F2340`, roughly). No transparency — JPEG has none.
- **Composition:** head-and-shoulders bust, centred, subject filling roughly
  70–80 % of the frame with a little headroom.
- **⚠️ Circular crop:** the app always displays these **inside a circle**, so
  the corners are cut off. Keep everything important inside the circle that
  fits in the square. Nothing meaningful in the corners.
- **Style:** flat, friendly, illustrative Bavarian characters in Tracht — the
  look of the existing `resi.jpg` / `sepp.jpg`.

## How it looks in the app

- **Settings:** big round preview + a row of round 48 px choices.
- **In game:** round seat portraits (~140 px) for the other players, and a
  smaller round picture above your own name plate.

Players can also upload their own photo; that is cropped to a centred square
and downscaled to 256 px automatically, so it does not affect this folder.
