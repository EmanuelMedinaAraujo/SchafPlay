import { useRef, useState } from "react";
import { GameState, PlayerAction, SeatId } from "../game/types";
import { Settings } from "../lib/settings";
import { Transport, TransportState } from "../net/Transport";
import { GameSession, SessionDeps, SessionRole } from "./GameSession";
import { GuestSession } from "./GuestSession";
import { HostSession } from "./HostSession";
import { SoloSession } from "./SoloSession";

export interface UseGameSessionOptions {
  settings: Settings;
  /** Show the game screen (also fires on reconnect, where it is a no-op). */
  onEnterGame(): void;
}

/**
 * Bridges GameSession lifecycles to React state. Reuse rules: re-attaching the
 * same role (reconnect) keeps the engine and recorder; switching roles or
 * quitting destroys the session, so the next join records a fresh list.
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
      getSettings: () => optionsRef.current.settings,
      events: {
        onGameState: setGameState,
        onConnectionState: setConnectionState,
        onEnterGame: () => optionsRef.current.onEnterGame(),
      },
    };
  }
  const deps = depsRef.current;

  function attachPeer(Session: typeof HostSession | typeof GuestSession, peerRole: "host" | "guest", peer: Transport): void {
    const current = sessionRef.current;
    // Re-attaching the same role is a reconnect: keep the session.
    const session: HostSession | GuestSession = current instanceof Session ? current : new Session(deps);
    if (session !== current) {
      current?.destroy();
      sessionRef.current = session;
    }
    setRole(peerRole);
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
    attachHostPeer: (peer: Transport) => attachPeer(HostSession, "host", peer),
    attachGuestPeer: (peer: Transport) => attachPeer(GuestSession, "guest", peer),
    startSolo,
    dispatch,
    quit,
    devSkipTrick: () => sessionRef.current?.devSkipTrick?.(),
    devSkipRound: () => sessionRef.current?.devSkipRound?.(),
  };
}
