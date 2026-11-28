import { useRef, useState } from "react";
import { GameState, PlayerAction, RemoteSeatId, SeatId } from "../game/types";
import { Settings } from "../lib/settings";
import { Transport, TransportState } from "../net/Transport";
import { GameSession, SessionDeps, SessionRole } from "./GameSession";
import { GuestSession } from "./GuestSession";
import { HostSession, HumanCount, LobbySeat } from "./HostSession";
import { SoloSession } from "./SoloSession";

export interface UseGameSessionOptions {
  settings: Settings;
  /** Show the game screen. */
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
  const [hostSeats, setHostSeats] = useState<LobbySeat[]>([]);
  const [myPlayerId, setLocalSeat] = useState<SeatId>("p1");

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
        onLobbyChange: setHostSeats,
        onLocalSeat: setLocalSeat,
        onConnectionState: setConnectionState,
        onEnterGame: () => optionsRef.current.onEnterGame(),
      },
    };
  }
  const deps = depsRef.current;

  function attachHostPeer(id: RemoteSeatId, peer: Transport, count: HumanCount): void {
    const current = sessionRef.current;
    if (current instanceof HostSession) {
      current.attachTransport(id, peer);
    } else {
      current?.destroy();
      const session = new HostSession(deps, count);
      sessionRef.current = session;
      setRole("host");
      session.attachTransport(id, peer);
    }
  }

  function attachGuestPeer(peer: Transport): void {
    const current = sessionRef.current;
    if (current instanceof GuestSession) {
      current.attachTransport(peer);
    } else {
      current?.destroy();
      const session = new GuestSession(deps);
      sessionRef.current = session;
      setRole("guest");
      session.attachTransport(peer);
    }
  }

  function startSolo(): void {
    sessionRef.current?.destroy();
    const session = new SoloSession(deps);
    sessionRef.current = session;
    setRole("solo");
    setLocalSeat("p1");
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
    setHostSeats([]);
    setLocalSeat("p1");
    setConnectionState("idle");
  }

  return {
    gameState,
    connectionState,
    role,
    myPlayerId,
    hostSeats,
    attachHostPeer,
    attachGuestPeer,
    startSolo,
    dispatch,
    quit,
    devSkipTrick: () => sessionRef.current?.devSkipTrick?.(),
    devSkipRound: () => sessionRef.current?.devSkipRound?.(),
  };
}
