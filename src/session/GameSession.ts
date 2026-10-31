import { EngineOptions } from "../engine/GameEngine";
import { GameState, PlayerAction } from "../game/types";
import { getE2EOverrides } from "../lib/e2e";
import { Settings } from "../lib/settings";
import { TransportState } from "../net/Transport";

export type SessionRole = "host" | "guest" | "solo";

/** Callbacks a session uses to drive the UI — wired to React state by useGameSession. */
interface SessionEvents {
  onGameState(state: GameState): void;
  onConnectionState(state: TransportState | "idle"): void;
  /** The session is ready to show the game screen (fires again on reconnect). */
  onEnterGame(): void;
}

export interface SessionDeps {
  /**
   * The latest preferences, read when an engine is created (so changes made
   * after mount are picked up) and when the guest introduces itself. The
   * host's/solo player's house rules govern the game.
   */
  getSettings(): Settings;
  events: SessionEvents;
}

/**
 * One running game from the local device's point of view. Owns the engine
 * (host/solo), the transport wiring and the stats recorder; survives
 * transport swaps (reconnects) and is destroyed on quit.
 */
export interface GameSession {
  /** Local UI intent — processed by the engine (host/solo) or sent over the wire (guest). */
  dispatch(action: PlayerAction): void;
  /** Dev tools live on the engine, so the guest has none. */
  devSkipTrick?(): void;
  devSkipRound?(): void;
  /** Quit: drop transport, engine and recorder — an aborted list leaves no stats. */
  destroy(): void;
}

/** The engine options a host or solo game derives from the local settings. */
export function engineOptions(settings: Settings): EngineOptions {
  return {
    devToolsEnabled: import.meta.env.DEV,
    hostAvatar: settings.avatar,
    disableLaufende: settings.disableLaufende,
    enableRamsch: settings.enableRamsch,
    enableStoss: settings.enableStoss,
    ...getE2EOverrides(),
  };
}
