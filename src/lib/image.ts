/**
 * Turn a user-picked image file into a small, square JPEG data URL suitable
 * for a profile picture (#14). The result must be tiny: it is persisted in
 * localStorage (a few MB total budget) and synced over the WebRTC data
 * channel to the other player, so we centre-crop to a square and downscale to
 * `SIZE` px before re-encoding as JPEG.
 *
 * The picture is displayed inside a CSS circle, so cropping to a centred
 * square (not a circle) is enough — the round mask is applied at render time.
 *
 * The output is always a re-encoded JPEG, never the bytes the user picked, so
 * a hostile or malformed file cannot survive the trip into the game state.
 */

import { MAX_AVATAR_LENGTH } from "./avatars";

const SIZE = 256;

/**
 * Encoder qualities to try, best first. A noisy photograph can encode to well
 * over 64 kB even at 256 px, which — once base64 inflates it by a third —
 * exceeds `MAX_AVATAR_LENGTH` and would be dropped by the *receiving* peer:
 * the picture would look fine on your own device and silently show as the
 * default on your partner's. So we step the quality down until the data URL is
 * within budget, and halve the size as a last resort.
 */
const QUALITIES = [0.82, 0.7, 0.6, 0.5];

/** Leave a little headroom under the peer's hard cap. */
const BUDGET = MAX_AVATAR_LENGTH - 1024;

export class ImageLoadError extends Error {}

export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new ImageLoadError("not an image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(drawSquare(img));
      } catch (e) {
        reject(e instanceof Error ? e : new ImageLoadError(String(e)));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageLoadError("could not decode image"));
    };
    img.src = url;
  });
}

function drawSquare(img: HTMLImageElement): string {
  let best = encodeAt(img, SIZE, QUALITIES[0]);
  for (const quality of QUALITIES) {
    best = encodeAt(img, SIZE, quality);
    if (best.length <= BUDGET) return best;
  }
  // Still too fat at the lowest quality: give up resolution rather than the
  // picture. 128 px is plenty for a circle a few dozen pixels across.
  const smaller = encodeAt(img, SIZE / 2, QUALITIES[QUALITIES.length - 1]);
  return smaller.length < best.length ? smaller : best;
}

function encodeAt(img: HTMLImageElement, size: number, quality: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageLoadError("canvas unsupported");

  // Cover: crop to the largest centred square of the source, scaled to fill.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  return canvas.toDataURL("image/jpeg", quality);
}
