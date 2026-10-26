# Manual intro video

Source of `public/manual/intro-de.mp4`, `intro-en.mp4` and their posters
`intro-poster-de.jpg` / `intro-poster-en.jpg`
("Schafkopf kurz erklärt", ~47 s, no audio) — the clip at the top of the rules
manual.

    node scripts/manual-video/render.mjs

That renders both languages and their posters (about ten minutes). Pass `de`
or `en` to render one language only, or `--poster-only` to redo just the
posters in a few seconds. Needs Playwright's chromium (already a dev
dependency) and `ffmpeg` on the PATH; no npm packages are added. Frames go to
`$TMPDIR/manual-video-frames` (override with `MANUAL_VIDEO_TMP`), never into the
repo.

## How it works

- `index.html` is the whole animation, `?lang=de|en`. Every movement is a
  paused Web Animation; `window.renderAt(seconds)` seeks them all, so a frame is
  a pure function of time. Open it through any static server rooted at the repo
  and call `renderAt(12.5)` in the console to scrub.
- `render.mjs` serves the repo root, steps through the timeline at 30 fps,
  screenshots every frame (960×540) and encodes with libx264, yuv420p,
  `+faststart`. Fonts, card art and avatars are referenced straight from
  `src/assets/fonts`, `public/bavarian-cards` and `public/avatars`, so a card or
  font change re-renders for free.
- Captions and labels live in the `TX` table at the top of the script (German
  and English). The scene timing is the `T` table; keep each caption on screen
  for at least 2.5 s + 0.3 s per word.

Budget: each MP4 ≤ 2.5 MB, each poster ≤ 80 KB. `CRF` (default 27) and
`POSTER_Q` (default 6) tune the encoders if a change pushes them over.

The content mirrors `src/game/rules.ts` (trump order, following suit, the Sau
call) and `CARD_POINTS` in `src/game/deck.ts`. If those rules change, update the
storyboard.
