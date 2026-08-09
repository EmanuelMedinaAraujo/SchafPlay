/**
 * Profile pictures (#14). An avatar is stored and synced as a compact string:
 * `"preset:<id>"` (resolved locally against `AVATAR_PRESETS`), a `"data:image/..."`
 * URL from `lib/image.ts`, or `""` for "not chosen".
 */

/** Shared by the uploader (`lib/image.ts`) and the wire boundary (`session/avatarSync.ts`). */
export const MAX_AVATAR_LENGTH = 64 * 1024;

export interface AvatarPreset {
  id: string;
  src: string;
}

function presetSrc(id: string): string {
  return `${import.meta.env.BASE_URL}avatars/${id}.jpg`;
}

/** Adding a portrait is a pure asset change: drop `public/avatars/<id>.jpg` in and list the id. */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "resi", src: presetSrc("resi") },
  { id: "sepp", src: presetSrc("sepp") },
  { id: "zenzi", src: presetSrc("zenzi") },
  { id: "wastl", src: presetSrc("wastl") },
  { id: "liesl", src: presetSrc("liesl") },
];

const PRESET_PREFIX = "preset:";

const DEFAULT_HUMAN_AVATAR = `${import.meta.env.BASE_URL}avatars/default.jpg`;

export function presetValue(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}

export function isPresetValue(value: string): boolean {
  return value.startsWith(PRESET_PREFIX);
}

/** Unknown/empty values fall back by seat kind, never to a broken image. */
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
