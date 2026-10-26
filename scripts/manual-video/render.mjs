#!/usr/bin/env node
/**
 * Renders the manual's intro videos by seeking index.html frame by frame.
 *
 *   node scripts/manual-video/render.mjs                # both languages + posters
 *   node scripts/manual-video/render.mjs de             # one language
 *   node scripts/manual-video/render.mjs --poster-only  # just the poster frames
 *   node scripts/manual-video/render.mjs --frames-only
 *
 * Needs only what the repo already has: Playwright (chromium) and ffmpeg.
 * Frames go to a temp dir outside the repo.
 */
import { createServer } from "node:http";
import { readFile, mkdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const { chromium } = await import(join(root, "node_modules/@playwright/test/index.mjs"));

const FPS = 30;
const POSTER_AT = 2.4; // seconds into the timeline: the finished title card
const out = join(root, "public/manual");
const work = process.env.MANUAL_VIDEO_TMP ?? join(tmpdir(), "manual-video-frames");
const args = process.argv.slice(2);
const langs = args.filter((a) => a === "de" || a === "en");
const targets = langs.length ? langs : ["de", "en"];
const framesOnly = args.includes("--frames-only");
const posterOnly = args.includes("--poster-only");

const MIME = { ".html": "text/html", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".js": "text/javascript" };
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = join(root, path);
    if (!file.startsWith(root) || !(await stat(file)).isFile()) throw new Error("nf");
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/scripts/manual-video/index.html`;

const run = (cmd, argv) =>
  new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "ignore", "inherit"] });
    p.on("exit", (c) => (c === 0 ? ok() : fail(new Error(`${cmd} exited ${c}`))));
  });

// Paused animations only repaint on the next frame; let it happen before shooting.
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const browser = await chromium.launch();
await mkdir(out, { recursive: true });

for (const lang of targets) {
  const dir = join(work, lang);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.goto(`${base}?lang=${lang}`);
  await page.evaluate(() => window.ready);
  // One poster per language: the title card carries the localized subtitle.
  if (!args.includes("--no-poster")) {
    await page.evaluate((t) => window.renderAt(t), POSTER_AT);
    await settle(page);
    const png = join(work, `poster-${lang}.png`);
    await page.screenshot({ path: png });
    if (!framesOnly) {
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-q:v", process.env.POSTER_Q ?? "6", "-pix_fmt", "yuvj420p", join(out, `intro-poster-${lang}.jpg`)]);
      console.log(`wrote public/manual/intro-poster-${lang}.jpg`);
    }
  }
  if (posterOnly) {
    await page.close();
    continue;
  }
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    await settle(page);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(5, "0")}.png`) });
  }
  await page.close();
  console.log(`${lang}: ${frames} frames in ${dir}`);
  if (framesOnly) continue;
  await run("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%05d.png"),
    "-c:v", "libx264", "-preset", "veryslow", "-crf", process.env.CRF ?? "27", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-level", "4.0", "-r", String(FPS), "-an", "-movflags", "+faststart",
    join(out, `intro-${lang}.mp4`),
  ]);
  console.log(`wrote public/manual/intro-${lang}.mp4`);
}

await browser.close();
server.close();
