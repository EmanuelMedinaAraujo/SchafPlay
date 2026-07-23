import { GameState, PlayerAction, SeatId } from "../game/types";
import { Transport, TransportState } from "../net/Transport";

export type SessionRole = "host" | "guest" | "solo";

/** Callbacks a session uses to drive the UI — wired to React state by useGameSession. */
export interface SessionEvents {
  onGameState(state: GameState): void;
  onConnectionState(state: TransportState | "idle"): void;
  /** The session is ready to show the game screen (fires again on reconnect). */
  onEnterGame(): void;
}

export interface SessionDeps {
  /** Read at engine-creation time so name/round changes made after mount are picked up. */
  getPlayerName(): string;
  /** Profile picture (#14) of the local player, synced to the other human (host in-state, guest via CONNECTION_ACK). */
  getPlayerAvatar(): string;
  getTotalRounds(): number;
  /** House rule (#31): whether Laufende are disabled for the round scoring. Read when the engine is created. */
  getDisableLaufende(): boolean;
  /** House rule (#11): whether an all-pass starts a Ramsch. Read when the engine is created — the host's/solo player's device setting governs the game. */
  getEnableRamsch(): boolean;
  /** House rule (#57): whether Stoß/Retour is enabled. Read when the engine is created — the host's/solo player's device setting governs the game. */
  getEnableStoss(): boolean;
  events: SessionEvents;
}

/**
 * One running game from the local device's point of view. Owns the engine
 * (host/solo), the transport wiring and the stats recorder; survives
 * transport swaps (reconnects) and is destroyed on quit.
 */
export interface GameSession {
  readonly role: SessionRole;
  readonly myPlayerId: SeatId;
  /** Local UI intent — processed by the engine (host/solo) or sent over the wire (guest). */
  dispatch(action: PlayerAction): void;
  /** Attach a (re)established transport; reconnects call this again on the same session. */
  attachTransport(transport: Transport): void;
  devSkipTrick(): void;
  devSkipRound(): void;
  /** Quit: drop transport, engine and recorder — an aborted list leaves no stats. */
  destroy(): void;
}
