import { GameState, SeatId } from "../game/types";
import { MAX_AVATAR_LENGTH } from "../lib/avatars";

/**
 * Profile pictures (#14): heavy avatars travel out of band, and every avatar
 * arriving from a peer is sanitized here.
 *
 * Security boundary. An avatar is the one peer-supplied string that reaches an
 * `<img src>`, so all THREE inbound paths must stay sanitized: guest→host
 * `CONNECTION_ACK.avatar`, host→guest `AVATAR_UPDATE.avatars`, and host→guest
 * the avatars inside `GAME_STATE_UPDATE`. The last one is not optional —
 * sanitizing only the map is bypassable, since a hostile host can skip
 * `AVATAR_UPDATE` and write straight into `players[i].avatar`.
 */

export type AvatarMap = Record<string, string>;

/** Raster only: presets travel as `preset:` keys, so `image/svg+xml` is never needed. */
const ALLOWED_DATA_PREFIXES = ["data:image/jpeg;", "data:image/png;", "data:image/webp;", "data:image/gif;"];

const PRESET_PATTERN = /^preset:[a-z0-9-]{1,32}$/;

const SEAT_IDS: readonly SeatId[] = ["p1", "p2", "p3", "p4"];

/** Anything not a `preset:` key or an in-budget raster data URL degrades to `""`. */
export function sanitizeAvatar(value: unknown): string {
  if (typeof value !== "string" || value === "" || value.length > MAX_AVATAR_LENGTH) return "";
  if (value.startsWith("preset:")) return PRESET_PATTERN.test(value) ? value : "";
  if (ALLOWED_DATA_PREFIXES.some((prefix) => value.startsWith(prefix))) return value;
  return "";
}

/** Sanitize a peer's avatar map; keys other than the four seats are dropped. */
export function sanitizeAvatarMap(value: unknown): AvatarMap {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const map: AvatarMap = {};
  for (const seatId of SEAT_IDS) {
    const clean = sanitizeAvatar(source[seatId]);
    if (clean) map[seatId] = clean;
  }
  return map;
}

/** Sanitize the avatars carried inside a peer's state. Never mutates. */
export function sanitizeStateAvatars(state: GameState): GameState {
  if (state.players.every((player) => (player.avatar ?? "") === sanitizeAvatar(player.avatar))) return state;
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, avatar: sanitizeAvatar(player.avatar) })),
  };
}

/** Too big to ride in every state broadcast (~25 kB vs a dozen bytes for a preset). */
const isHeavy = (avatar: string | undefined): avatar is string => !!avatar && avatar.startsWith("data:");

export function heavyAvatars(state: GameState): AvatarMap {
  const map: AvatarMap = {};
  for (const player of state.players) {
    if (isHeavy(player.avatar)) map[player.id] = player.avatar;
  }
  return map;
}

/** The state as it goes on the wire: heavy avatars blanked. Never mutates. */
export function withoutHeavyAvatars(state: GameState): GameState {
  if (!state.players.some((player) => isHeavy(player.avatar))) return state;
  return {
    ...state,
    players: state.players.map((player) => (isHeavy(player.avatar) ? { ...player, avatar: "" } : player)),
  };
}

/** Re-attach out-of-band avatars to an incoming state. Never mutates. */
export function withAvatars(state: GameState, avatars: AvatarMap): GameState {
  if (Object.keys(avatars).length === 0) return state;
  return {
    ...state,
    players: state.players.map((player) =>
      !player.avatar && avatars[player.id] ? { ...player, avatar: avatars[player.id] } : player,
    ),
  };
}
