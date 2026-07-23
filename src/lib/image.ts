/**
 * Turn a user-picked image file into a small, square JPEG data URL suitable
 * for a profile picture (#14). The result must be tiny: it is persisted in
 * localStorage (a few MB total budget) and synced over the WebRTC data
 * channel to the other player, so we centre-crop to a square and downscale to
 * `SIZE` px before re-encoding as JPEG.
 *
 * The picture is displayed inside a CSS circle, so cropping to a centred
 * square (not a circle) is enough — the round mask is applied at render time.
 */

const SIZE = 256;
const QUALITY = 0.82;

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
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageLoadError("canvas unsupported");

  // Cover: crop to the largest centred square of the source, scaled to fill.
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);

  return canvas.toDataURL("image/jpeg", QUALITY);
}
