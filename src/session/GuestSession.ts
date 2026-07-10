import { GameState, PlayerAction, SeatId } from "../game/types";
import { ListRecorder } from "../lib/ListRecorder";
import { createMessage, P2PMessageType } from "../net/protocol";
import { Transport } from "../net/Transport";
import { GameSession, SessionDeps } from "./GameSession";

/**
 * Guest side: a thin client with no engine — it renders whatever redacted
 * state arrives over the wire and forwards its intents as PlayerActions.
 */
export class GuestSession implements GameSession {
  readonly role = "guest" as const;
  readonly myPlayerId: SeatId = "p3";

  private transport: Transport | null = null;
  // Created once per session: re-pairing after a drop reuses this session and
  // keeps the in-progress recording, while a fresh join after quitting gets a
  // brand-new session (and so a new recorder).
  private recorder: ListRecorder | null = new ListRecorder("multiplayer", "guest", "p3");

  constructor(private readonly deps: SessionDeps) {}

  attachTransport(transport: Transport): void {
    this.transport?.disconnect();
    this.transport = transport;

    transport.onConnectionStateChange((state) => {
      this.deps.events.onConnectionState(state);
      if (state === "connected") {
        this.deps.events.onEnterGame();
        try {
          transport.send(createMessage(P2PMessageType.CONNECTION_ACK, { name: this.deps.getPlayerName() }));
        } catch {
          // Ignore; host falls back to a default name.
        }
      }
    });

    transport.onMessage((message) => {
      if (message.type === P2PMessageType.GAME_STATE_UPDATE) {
        const state = (message.payload as { state: GameState }).state;
        this.recorder?.observe(state);
        this.deps.events.onGameState(state);
      }
    });
  }

  dispatch(action: PlayerAction): void {
    try {
      this.transport?.send(createMessage(P2PMessageType.PLAYER_ACTION, { action }));
    } catch {
      // Disconnected; the reconnect overlay is already showing.
    }
  }

  devSkipTrick(): void {
    // Dev tools live on the engine; the guest has none.
  }

  devSkipRound(): void {
    // Dev tools live on the engine; the guest has none.
  }

  destroy(): void {
    this.transport?.disconnect();
    this.transport = null;
    this.recorder = null;
  }
}
