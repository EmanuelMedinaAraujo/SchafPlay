import { GameState } from "../game/types";

/**
 * Profile pictures (#14) kept off the state hot path, and validated at the
 * network boundary.
 *
 * `Player.avatar` lives in the game state, and the host broadcasts a full
 * redacted state on every card play, AI move and ready toggle — dozens of
 * times per round. A custom avatar is a ~25 kB data URL, so leaving it in the
 * snapshot means re-sending both players' pictures with every update: megabytes
 * per round for two images that never change mid-round, with the guest's own
 * picture echoed straight back to it.
 *
 * So the host strips data-URL avatars out of the broadcast state and sends the
 * seat→avatar map once per connection (`AVATAR_UPDATE`); the guest merges that
 * map back into every state it receives. `preset:` keys are a dozen bytes and
 * stay in the state, so a preset avatar renders even before the map arrives —
 * the worst case is the default picture for a moment, never a broken image.
 * The data channel is ordered and reliable and the host sends the map before
 * the state it belongs to, so in practice the map is always there first.
 *
 * Avatars are public by design (`redactStateFor` deliberately leaves them
 * alone), so none of this is a privacy boundary — it is bandwidth plus input
 * validation.
 */

export type AvatarMap = Record<string, string>;

/**
 * Hard cap on an avatar string accepted from the wire. Our own uploader emits
 * a 256 px JPEG data URL (~25 kB), so this is generous headroom while stopping
 * a buggy or hostile peer from pinning megabytes into the authoritative state
 * — which the host would then re-broadcast.
 */
export const MAX_AVATAR_LENGTH = 64 * 1024;

/**
 * Data URL image types accepted from a peer. Raster only: the presets travel
 * as `preset:` keys resolved locally, so there is no reason to accept
 * `image/svg+xml` from the wire.
 */
const ALLOWED_DATA_PREFIXES = ["data:image/jpeg;", "data:image/png;", "data:image/webp;", "data:image/gif;"];

/**
 * Normalize an avatar string that arrived over the network. Anything that is
 * not a `preset:` key or an in-budget raster data URL degrades to `""`, which
 * renders the default picture for the seat.
 */
export function sanitizeAvatar(value: unknown): string {
  if (typeof value !== "string" || value === "" || value.length > MAX_AVATAR_LENGTH) return "";
  if (value.startsWith("preset:")) return value;
  if (ALLOWED_DATA_PREFIXES.some((prefix) => value.startsWith(prefix))) return value;
  return "";
}

/** Sanitize every entry of an avatar map received from a peer. */
export function sanitizeAvatarMap(value: unknown): AvatarMap {
  if (!value || typeof value !== "object") return {};
  const map: AvatarMap = {};
  for (const [seatId, avatar] of Object.entries(value as Record<string, unknown>)) {
    const clean = sanitizeAvatar(avatar);
    if (clean) map[seatId] = clean;
  }
  return map;
}

/** True for an avatar too big to ride in every state broadcast. */
const isHeavy = (avatar: string | undefined): avatar is string => !!avatar && avatar.startsWith("data:");

/** The seat→avatar map for the avatars that travel out of band. */
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
