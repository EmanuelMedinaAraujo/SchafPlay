import { GameState, SeatId } from "../game/types";
import { MAX_AVATAR_LENGTH } from "../lib/avatars";

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
 *
 * ## The validation boundary
 *
 * An avatar is the one peer-supplied string that ends up as an `<img src>` on
 * the other device, so every inbound path is sanitized here, in the session
 * layer — the same place the guest's action `playerId` is overwritten. There
 * are three, and *all* of them matter:
 *
 * - guest → host, `CONNECTION_ACK.avatar` (`HostSession`),
 * - host → guest, `AVATAR_UPDATE.avatars` (`GuestSession`),
 * - host → guest, the avatars inside `GAME_STATE_UPDATE` (`GuestSession`).
 *
 * The last one is easy to miss and is why `sanitizeStateAvatars` exists:
 * sanitizing only the out-of-band map would be bypassable by construction, as
 * a hostile host can simply skip `AVATAR_UPDATE` and put the payload straight
 * into `players[i].avatar` instead.
 *
 * Accepted residual risk: a data URL that passes the cap can still decode to a
 * much larger bitmap. Re-decoding every peer avatar through a canvas to bound
 * that costs more than it is worth for a two-player LAN game, and the browser's
 * own image decoders are the hardened part of this path.
 */

export type AvatarMap = Record<string, string>;

// The cap itself lives in `lib/avatars.ts` so the uploader and this boundary
// share one number: it is generous headroom for a real picture, while stopping
// a buggy or hostile peer from pinning megabytes into the authoritative state
// — which the host would then re-broadcast.

/**
 * Data URL image types accepted from a peer. Raster only: the presets travel
 * as `preset:` keys resolved locally, so there is no reason to accept
 * `image/svg+xml` from the wire.
 */
const ALLOWED_DATA_PREFIXES = ["data:image/jpeg;", "data:image/png;", "data:image/webp;", "data:image/gif;"];

/**
 * Shape of an acceptable `preset:` value. The id is never interpolated into a
 * URL — `resolveAvatarSrc` looks it up in `AVATAR_PRESETS` and falls back when
 * it misses — but matching the ids we actually ship keeps that safety a stated
 * property of this boundary rather than an accident of the resolver, and stops
 * a peer parking 64 kB of junk behind the cheap-looking `preset:` prefix.
 */
const PRESET_PATTERN = /^preset:[a-z0-9-]{1,32}$/;

/** The seats an avatar can belong to; anything else in a peer's map is noise. */
const SEAT_IDS: readonly SeatId[] = ["p1", "p2", "p3", "p4"];

/**
 * Normalize an avatar string that arrived over the network. Anything that is
 * not a `preset:` key or an in-budget raster data URL degrades to `""`, which
 * renders the default picture for the seat.
 */
export function sanitizeAvatar(value: unknown): string {
  if (typeof value !== "string" || value === "" || value.length > MAX_AVATAR_LENGTH) return "";
  if (value.startsWith("preset:")) return PRESET_PATTERN.test(value) ? value : "";
  if (ALLOWED_DATA_PREFIXES.some((prefix) => value.startsWith(prefix))) return value;
  return "";
}

/**
 * Sanitize an avatar map received from a peer. Only the four real seats are
 * kept: `withAvatars` can never look up anything else, so unknown keys are
 * pure memory a hostile peer would otherwise get to pin in the session.
 */
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

/**
 * Sanitize the avatars carried inside a state received from a peer — the third
 * inbound path, and the one that would otherwise let a hostile host route
 * around `sanitizeAvatarMap` entirely. Never mutates.
 */
export function sanitizeStateAvatars(state: GameState): GameState {
  if (state.players.every((player) => (player.avatar ?? "") === sanitizeAvatar(player.avatar))) return state;
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, avatar: sanitizeAvatar(player.avatar) })),
  };
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
