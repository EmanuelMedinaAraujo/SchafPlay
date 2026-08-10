/**
 * A user-picked image file into a small square JPEG data URL (#14). Always
 * re-encoded, never the user's original bytes, so a hostile or malformed file
 * cannot survive the trip into the game state.
 */

import { MAX_AVATAR_LENGTH } from "./avatars";

const SIZE = 256;

/**
 * Tried best first, stepping down until the data URL fits `MAX_AVATAR_LENGTH`.
 * Over budget, the *receiving* peer drops it — the picture would look fine
 * locally and silently show as the default on the partner's device.
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
  // Give up resolution rather than the picture.
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
