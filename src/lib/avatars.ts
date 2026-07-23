/**
 * Profile pictures (#14). An avatar is stored and synced as a compact string,
 * never as a raw asset URL, so it survives the WebRTC wire and localStorage:
 *
 * - `"preset:<id>"` — one of the five built-in sheep avatars below. Only the
 *   id travels; both devices resolve it against this shared module to the same
 *   `public/avatars/<id>.svg` file, so a preset choice costs a dozen bytes on
 *   the wire. The files are precached by the service worker (see the
 *   `sw-version-injector` block in `vite.config.ts`), so presets render
 *   offline-first like the rest of the app's static images.
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
  /** URL of the preset image file in `public/avatars/`; syncs as a bare id. */
  src: string;
}

/** The `public/avatars/<id>.svg` file for a preset id, under the deploy base. */
function presetSrc(id: string): string {
  return `${import.meta.env.BASE_URL}avatars/${id}.svg`;
}

/**
 * The five preselection avatars offered for the AI (and the human, if they
 * like). Each id maps to a `public/avatars/<id>.svg` file — flat circular sheep
 * faces differing by background gradient and accent colour.
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "meadow", src: presetSrc("meadow") },
  { id: "sky", src: presetSrc("sky") },
  { id: "sunset", src: presetSrc("sunset") },
  { id: "lavender", src: presetSrc("lavender") },
  { id: "rose", src: presetSrc("rose") },
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
