import { useRef, useState } from "react";
import { GameState, PlayerAction, SeatId } from "../game/types";
import { Transport, TransportState } from "../net/Transport";
import { GameSession, SessionDeps, SessionRole } from "./GameSession";
import { GuestSession } from "./GuestSession";
import { HostSession } from "./HostSession";
import { SoloSession } from "./SoloSession";

export interface UseGameSessionOptions {
  getPlayerName(): string;
  getTotalRounds(): number;
  /** House rule (#31): whether Laufende are disabled. Read when a session starts a new engine. */
  getDisableLaufende(): boolean;
  /** Profile pictures (#14): avatar ids for the local player and the AI seats. */
  getPlayerAvatar(): string;
  getResiAvatar(): string;
  getSeppAvatar(): string;
  /** Show the game screen (also fires on reconnect, where it is a no-op). */
  onEnterGame(): void;
}

/**
 * Bridges GameSession lifecycles to React state. Session reuse rules mirror
 * the pre-refactor behavior exactly:
 * - re-attaching the same role (reconnect) reuses the session, so the engine
 *   and the stats recorder survive a dropped peer;
 * - switching roles (host ↔ join ↔ solo) destroys the old session;
 * - quitting destroys the session — the next join records a fresh list.
 */
export function useGameSession(options: UseGameSessionOptions) {
  const sessionRef = useRef<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionState, setConnectionState] = useState<TransportState | "idle">("idle");
  const [role, setRole] = useState<SessionRole | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Stable deps object: sessions capture it at construction, the getters
  // always read the latest options/state setters through the refs.
  const depsRef = useRef<SessionDeps | null>(null);
  if (!depsRef.current) {
    depsRef.current = {
      getPlayerName: () => optionsRef.current.getPlayerName(),
      getTotalRounds: () => optionsRef.current.getTotalRounds(),
      getDisableLaufende: () => optionsRef.current.getDisableLaufende(),
      getPlayerAvatar: () => optionsRef.current.getPlayerAvatar(),
      getResiAvatar: () => optionsRef.current.getResiAvatar(),
      getSeppAvatar: () => optionsRef.current.getSeppAvatar(),
      events: {
        onGameState: (state) => setGameState(state),
        onConnectionState: (state) => setConnectionState(state),
        onEnterGame: () => optionsRef.current.onEnterGame(),
      },
    };
  }
  const deps = depsRef.current;

  function attachHostPeer(peer: Transport): void {
    let session = sessionRef.current;
    if (!(session instanceof HostSession)) {
      session?.destroy();
      session = new HostSession(deps);
      sessionRef.current = session;
    }
    setRole("host");
    session.attachTransport(peer);
  }

  function attachGuestPeer(peer: Transport): void {
    let session = sessionRef.current;
    if (!(session instanceof GuestSession)) {
      session?.destroy();
      session = new GuestSession(deps);
      sessionRef.current = session;
    }
    setRole("guest");
    session.attachTransport(peer);
  }

  function startSolo(): void {
    sessionRef.current?.destroy();
    const session = new SoloSession(deps);
    sessionRef.current = session;
    setRole("solo");
    session.start();
  }

  function dispatch(action: PlayerAction): void {
    sessionRef.current?.dispatch(action);
  }

  function quit(): void {
    sessionRef.current?.destroy();
    sessionRef.current = null;
    setGameState(null);
    setRole(null);
    setConnectionState("idle");
  }

  const myPlayerId: SeatId = role === "guest" ? "p3" : "p1";

  return {
    gameState,
    connectionState,
    role,
    myPlayerId,
    attachHostPeer,
    attachGuestPeer,
    startSolo,
    dispatch,
    quit,
    devSkipTrick: () => sessionRef.current?.devSkipTrick(),
    devSkipRound: () => sessionRef.current?.devSkipRound(),
  };
}
