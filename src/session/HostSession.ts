import { GameEngine } from "../engine/GameEngine";
import { PlayerAction, SeatId } from "../game/types";
import { getE2EOverrides } from "../lib/e2e";
import { ListRecorder } from "../persistence";
import { createMessage, P2PMessageType } from "../net/protocol";
import { Transport } from "../net/Transport";
import { GameSession, SessionDeps } from "./GameSession";

/**
 * The remote human seats the host fans redacted state out to. A single guest
 * on p3 today; variable multiplayer (#6) turns this into per-transport seats.
 */
const REMOTE_HUMAN_SEATS: readonly SeatId[] = ["p3"];

/**
 * Host side: runs the authoritative engine. The engine is created lazily on
 * the first successful connection and survives reconnects — attaching a
 * fresh transport resumes the same game.
 */
export class HostSession implements GameSession {
  readonly role = "host" as const;
  readonly myPlayerId: SeatId = "p1";

  private engine: GameEngine | null = null;
  private recorder: ListRecorder | null = null;
  private transport: Transport | null = null;

  constructor(private readonly deps: SessionDeps) {}

  attachTransport(transport: Transport): void {
    this.transport?.disconnect();
    this.transport = transport;

    transport.onConnectionStateChange((state) => {
      this.deps.events.onConnectionState(state);
      if (state === "connected") {
        if (!this.engine) this.createEngine();
        const engine = this.engine!;
        this.deps.events.onEnterGame();
        if (engine.getState().status === "LOBBY") {
          engine.dealCards();
        } else {
          engine.resume();
          this.broadcastState();
        }
      }
      if (state === "disconnected" || state === "failed") {
        this.engine?.pause();
      }
    });

    transport.onMessage((message) => {
      const engine = this.engine;
      if (!engine) return;
      if (message.type === P2PMessageType.PLAYER_ACTION) {
        const action = (message.payload as { action: PlayerAction }).action;
        // The guest is always seat 3 — never trust the id on the wire.
        engine.processAction({ ...action, playerId: "p3" });
      }
      if (message.type === P2PMessageType.CONNECTION_ACK) {
        const payload = message.payload as { name?: string; avatar?: string } | undefined;
        if (payload?.name) engine.setGuestName(payload.name);
        if (payload?.avatar !== undefined) engine.setGuestAvatar(payload.avatar);
      }
    });
  }

  /**
   * Constructed lazily at the moment the connection actually succeeds, not at
   * attach time, so it picks up whatever name and round count the user last
   * selected before the game actually starts.
   */
  private createEngine(): void {
    const engine = new GameEngine(this.deps.getPlayerName(), "Gast", this.deps.getTotalRounds(), {
      devToolsEnabled: import.meta.env.DEV,
      hostAvatar: this.deps.getPlayerAvatar(),
      disableLaufende: this.deps.getDisableLaufende(),
      enableRamsch: this.deps.getEnableRamsch(),
      enableStoss: this.deps.getEnableStoss(),
      ...getE2EOverrides(),
    });
    this.engine = engine;
    this.recorder = new ListRecorder("multiplayer", "host", "p1");
    engine.onStateChange(() => {
      // The host's own view is redacted too — it records and renders exactly
      // what a player at seat p1 may see.
      const redacted = engine.getRedactedState("p1");
      this.recorder?.observe(redacted);
      this.deps.events.onGameState(redacted);
      this.broadcastState();
    });
  }

  /** Send each remote human seat its own redacted view of the current state. */
  private broadcastState(): void {
    const engine = this.engine;
    const transport = this.transport;
    if (!engine || !transport) return;
    for (const seat of REMOTE_HUMAN_SEATS) {
      try {
        transport.send(createMessage(P2PMessageType.GAME_STATE_UPDATE, { state: engine.getRedactedState(seat) }));
      } catch {
        // Channel not open (yet / anymore); the next state change will retry.
      }
    }
  }

  dispatch(action: PlayerAction): void {
    this.engine?.processAction(action);
  }

  devSkipTrick(): void {
    this.engine?.devSkipTrick();
  }

  devSkipRound(): void {
    this.engine?.devSkipRound();
  }

  destroy(): void {
    this.transport?.disconnect();
    this.transport = null;
    this.engine?.destroy();
    this.engine = null;
    // An aborted list leaves no trace in the statistics.
    this.recorder = null;
  }
}
