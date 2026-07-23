/**
 * Profile pictures (#14). An avatar is stored and synced as a compact string,
 * never as a raw asset URL, so it survives the WebRTC wire and localStorage:
 *
 * - `"preset:<id>"` — one of the five built-in sheep avatars below. Only the
 *   id travels; both devices resolve it against this shared module, so a preset
 *   choice costs a dozen bytes on the wire.
 * - `"data:image/..."` — a custom picture the player uploaded, already
 *   downscaled to a small square JPEG data URL by `lib/image.ts`.
 * - `""` / undefined — no choice made; falls back to the legacy default photo
 *   for a human seat (keeps the pre-#14 look) and to a preset for an AI seat.
 *
 * The human player picks their own avatar in Settings; it rides to the other
 * human over the wire (host in the game state, guest in the CONNECTION_ACK).
 * The AI seats are assigned distinct presets by the engine.
 */

export interface AvatarPreset {
  id: string;
  /** A self-contained SVG data URI — no network fetch, syncs as a bare id. */
  src: string;
}

/**
 * Build one flat, circular sheep face. Variants differ only by background
 * gradient and an accent colour (cheeks + the little tuft), which is plenty to
 * tell five of them apart at avatar size.
 */
function sheep(bg1: string, bg2: string, accent: string, key: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>` +
    `<defs><radialGradient id='b${key}' cx='50%' cy='36%' r='78%'>` +
    `<stop offset='0%' stop-color='${bg1}'/><stop offset='100%' stop-color='${bg2}'/>` +
    `</radialGradient></defs>` +
    `<circle cx='50' cy='50' r='50' fill='url(#b${key})'/>` +
    `<ellipse cx='36' cy='40' rx='7' ry='10' fill='#6b6478' transform='rotate(-18 36 40)'/>` +
    `<ellipse cx='64' cy='40' rx='7' ry='10' fill='#6b6478' transform='rotate(18 64 40)'/>` +
    `<g fill='#f8f4ec'>` +
    `<circle cx='34' cy='40' r='12'/><circle cx='66' cy='40' r='12'/>` +
    `<circle cx='40' cy='30' r='12'/><circle cx='60' cy='30' r='12'/>` +
    `<circle cx='50' cy='26' r='13'/>` +
    `<circle cx='30' cy='55' r='11'/><circle cx='70' cy='55' r='11'/>` +
    `<circle cx='40' cy='66' r='12'/><circle cx='60' cy='66' r='12'/>` +
    `<circle cx='50' cy='69' r='12'/><circle cx='50' cy='48' r='20'/>` +
    `</g>` +
    `<ellipse cx='50' cy='52' rx='18' ry='19' fill='#4a4553'/>` +
    `<ellipse cx='50' cy='60' rx='13' ry='12' fill='#efe9df'/>` +
    `<ellipse cx='43' cy='50' rx='4.6' ry='5.4' fill='#fff'/>` +
    `<ellipse cx='57' cy='50' rx='4.6' ry='5.4' fill='#fff'/>` +
    `<circle cx='43.7' cy='51' r='2.4' fill='#2c2a33'/>` +
    `<circle cx='57.7' cy='51' r='2.4' fill='#2c2a33'/>` +
    `<circle cx='40' cy='60' r='3.1' fill='${accent}' opacity='0.7'/>` +
    `<circle cx='60' cy='60' r='3.1' fill='${accent}' opacity='0.7'/>` +
    `<path d='M46 58 Q50 62 54 58' stroke='#2c2a33' stroke-width='1.6' fill='none' stroke-linecap='round'/>` +
    `<path d='M50 20 q4 -8 9 -4 q-2 6 -9 6 q-7 0 -9 -6 q5 -4 9 4z' fill='${accent}'/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The five preselection avatars offered for the AI (and the human, if they like). */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "meadow", src: sheep("#b7e8ae", "#4fae6e", "#ef7a85", "meadow") },
  { id: "sky", src: sheep("#add9ff", "#4d94d6", "#ffc94d", "sky") },
  { id: "sunset", src: sheep("#ffd3a5", "#f6915d", "#7b6ef6", "sunset") },
  { id: "lavender", src: sheep("#dcccff", "#9d7fe0", "#ff9ec2", "lavender") },
  { id: "rose", src: sheep("#ffc9d6", "#f27a9b", "#5fc0c7", "rose") },
];

const PRESET_PREFIX = "preset:";

/** The legacy default photo for a human seat with no chosen avatar (pre-#14 look). */
const DEFAULT_HUMAN_AVATAR = `${import.meta.env.BASE_URL}avatar_woman2.jpg`;

export function presetValue(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}

export function isPresetValue(value: string): boolean {
  return value.startsWith(PRESET_PREFIX);
}

/**
 * Resolve a stored avatar string to something an `<img src>` can render.
 * Unknown / empty values fall back by seat kind so a missing avatar never
 * shows a broken image.
 */
export function resolveAvatarSrc(value: string | undefined, isHuman: boolean): string {
  if (value) {
    if (value.startsWith("data:")) return value;
    if (value.startsWith(PRESET_PREFIX)) {
      const id = value.slice(PRESET_PREFIX.length);
      const preset = AVATAR_PRESETS.find((p) => p.id === id);
      if (preset) return preset.src;
    }
  }
  return isHuman ? DEFAULT_HUMAN_AVATAR : AVATAR_PRESETS[0].src;
}
