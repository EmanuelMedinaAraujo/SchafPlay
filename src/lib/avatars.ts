/**
 * Profile pictures (#14). An avatar is stored and synced as a compact string,
 * never as a raw asset URL, so it survives the WebRTC wire and localStorage:
 *
 * - `"preset:<id>"` — one of the five built-in portraits below. Only the id
 *   travels; both devices resolve it against this shared module to the same
 *   `public/avatars/<id>.jpg` file, so a preset choice costs a dozen bytes on
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

/**
 * Hard cap on an avatar string, in characters. Enforced at the network
 * boundary (`session/avatarSync.ts`) against a peer's picture, and respected
 * by our own uploader (`lib/image.ts`) so a legitimate custom picture is never
 * one the partner has to reject. It lives here, in the layer both sides can
 * import, so those two cannot drift apart.
 */
export const MAX_AVATAR_LENGTH = 64 * 1024;

export interface AvatarPreset {
  id: string;
  /** URL of the preset image file in `public/avatars/`; syncs as a bare id. */
  src: string;
}

/** The `public/avatars/<id>.jpg` file for a preset id, under the deploy base. */
function presetSrc(id: string): string {
  return `${import.meta.env.BASE_URL}avatars/${id}.jpg`;
}

/**
 * The five preselection portraits, offered to the human and used for the AI
 * seats. Each id maps to `public/avatars/<id>.jpg` — see the artwork brief in
 * `public/avatars/README.md`. Adding or replacing a picture is a pure asset
 * change: drop the file in under the id's name, no code change needed.
 *
 * `resi`, `sepp` and `zenzi` are the AI seats' namesakes, so an AI seat shows
 * the character it actually is. `wastl` and `liesl` are the two extra choices
 * offered to human players.
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "resi", src: presetSrc("resi") },
  { id: "sepp", src: presetSrc("sepp") },
  { id: "zenzi", src: presetSrc("zenzi") },
  { id: "wastl", src: presetSrc("wastl") },
  { id: "liesl", src: presetSrc("liesl") },
];

const PRESET_PREFIX = "preset:";

/**
 * Neutral placeholder for a human seat that has not picked a picture — a plain
 * silhouette, so "nothing chosen yet" never reads as one of the five presets.
 */
const DEFAULT_HUMAN_AVATAR = `${import.meta.env.BASE_URL}avatars/default.jpg`;

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
