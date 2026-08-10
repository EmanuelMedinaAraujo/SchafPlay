import { GameEngine } from "../engine/GameEngine";
import { PlayerAction, SeatId } from "../game/types";
import { getE2EOverrides } from "../lib/e2e";
import { ListRecorder } from "../persistence";
import { createMessage, P2PMessageType } from "../net/protocol";
import { Transport } from "../net/Transport";
import { heavyAvatars, sanitizeAvatar, withoutHeavyAvatars } from "./avatarSync";
import { GameSession, SessionDeps } from "./GameSession";

/** The fan-out seam for variable multiplayer (#6). */
const REMOTE_HUMAN_SEATS: readonly SeatId[] = ["p3"];

/** What a `CONNECTION_ACK` carries, already past the wire boundary. */
interface GuestIdentity {
  name: string | undefined;
  /** Sanitized; `undefined` means the peer sent none, not "clear it". */
  avatar: string | undefined;
}

/**
 * Runs the authoritative engine. It is created lazily on the first successful
 * connection and survives reconnects — a fresh transport resumes the same game.
 */
export class HostSession implements GameSession {
  readonly role = "host" as const;
  readonly myPlayerId: SeatId = "p1";

  private engine: GameEngine | null = null;
  private recorder: ListRecorder | null = null;
  private transport: Transport | null = null;
  /** Reset per transport: a re-paired peer needs the avatar map again (#14). */
  private sentAvatars = "";
  /** An ACK that beat the engine into existence, held for `createEngine` (#95). */
  private pendingGuestIdentity: GuestIdentity | null = null;

  constructor(private readonly deps: SessionDeps) {}

  attachTransport(transport: Transport): void {
    this.transport?.disconnect();
    this.transport = transport;
    this.sentAvatars = "";
    this.pendingGuestIdentity = null;

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
      if (message.type === P2PMessageType.CONNECTION_ACK) {
        const payload = message.payload as { name?: string; avatar?: unknown } | undefined;
        // The session is the network boundary; the engine stores what it is given.
        const identity: GuestIdentity = {
          name: payload?.name,
          avatar: payload?.avatar === undefined ? undefined : sanitizeAvatar(payload.avatar),
        };
        // The guest sends this once, as soon as *its* channel opens, which can
        // be before the host's own "connected" callback has built the engine.
        // Dropping it then left the seat as „Gast" for the whole game (#95).
        if (this.engine) this.applyGuestIdentity(this.engine, identity);
        else this.pendingGuestIdentity = identity;
        return;
      }
      const engine = this.engine;
      if (!engine) return;
      if (message.type === P2PMessageType.PLAYER_ACTION) {
        const action = (message.payload as { action: PlayerAction }).action;
        // The guest is always seat 3 — never trust the id on the wire.
        engine.processAction({ ...action, playerId: "p3" });
      }
    });
  }

  private applyGuestIdentity(engine: GameEngine, identity: GuestIdentity): void {
    if (identity.name) engine.setGuestName(identity.name);
    if (identity.avatar !== undefined) engine.setGuestAvatar(identity.avatar);
  }

  /** Lazily at connect, not at attach, so it picks up the latest settings. */
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
    // After the listener above, so the seat it fills in is broadcast like any other change.
    if (this.pendingGuestIdentity) {
      this.applyGuestIdentity(engine, this.pendingGuestIdentity);
      this.pendingGuestIdentity = null;
    }
  }

  /** Send each remote human seat its own redacted view of the current state. */
  private broadcastState(): void {
    const engine = this.engine;
    const transport = this.transport;
    if (!engine || !transport) return;
    for (const seat of REMOTE_HUMAN_SEATS) {
      const state = engine.getRedactedState(seat);
      try {
        // Once per peer instead of in every snapshot (see session/avatarSync.ts).
        // Sent before the state it belongs to; the channel is ordered.
        const avatars = heavyAvatars(state);
        const signature = JSON.stringify(avatars);
        if (signature !== this.sentAvatars) {
          transport.send(createMessage(P2PMessageType.AVATAR_UPDATE, { avatars }));
          this.sentAvatars = signature;
        }
        transport.send(createMessage(P2PMessageType.GAME_STATE_UPDATE, { state: withoutHeavyAvatars(state) }));
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
    this.pendingGuestIdentity = null;
    // An aborted list leaves no trace in the statistics.
    this.recorder = null;
  }
}
