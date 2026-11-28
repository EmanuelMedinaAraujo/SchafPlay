import { GameState, PlayerAction, RemoteSeatId } from "../game/types";
import { ListRecorder } from "../persistence";
import { createMessage, isRemoteSeat, isSeat, P2PMessageType } from "../net/protocol";
import { Transport } from "../net/Transport";
import { AvatarMap, sanitizeAvatarMap, sanitizeStateAvatars, withAvatars } from "./avatarSync";
import { GameSession, SessionDeps } from "./GameSession";

/** Thin client, with the local seat and recorder kept through transport swaps. */
export class GuestSession implements GameSession {
  private transport: Transport | null = null;
  private detach: (() => void) | null = null;
  private seat: RemoteSeatId | null = null;
  private recorder: ListRecorder | null = null;
  private inGame = false;

  constructor(private readonly deps: SessionDeps) {}

  attachTransport(transport: Transport): void {
    this.detach?.();
    this.transport = transport;
    let avatars: AvatarMap = {};
    let localSeat: RemoteSeatId | null = null;

    const offState = transport.onConnectionStateChange((state) => {
      if (state === "connected") {
        const { playerName, avatar } = this.deps.getSettings();
        try {
          transport.send(createMessage(P2PMessageType.CONNECTION_ACK, {
            name: playerName, avatar, supportsSeats: true, seat: this.seat ?? undefined,
          }));
        } catch {
          this.fail();
        }
        return;
      }
      if (state === "disconnected" || state === "failed") {
        this.detach?.();
        if (!this.inGame) this.seat = null;
      }
      this.deps.events.onConnectionState(state);
    });

    const offMessage = transport.onMessage((message) => {
      if (message?.type === P2PMessageType.SEAT_ASSIGNED) {
        const seat = (message.payload as { seat?: unknown })?.seat;
        if (!isRemoteSeat(seat) || (this.seat && this.seat !== seat)) {
          this.fail();
          return;
        }
        localSeat = this.seat = seat;
        if (!this.inGame) this.deps.events.onConnectionState("connected");
      } else if (message?.type === P2PMessageType.AVATAR_UPDATE) {
        const payload = message.payload as { avatars?: unknown; seat?: unknown } | undefined;
        const incoming = sanitizeAvatarMap(payload?.avatars);
        const seat = payload?.seat;
        if (isSeat(seat)) {
          if (incoming[seat]) avatars[seat] = incoming[seat];
          else delete avatars[seat];
        } else {
          avatars = incoming;
        }
      } else if (message?.type === P2PMessageType.GAME_STATE_UPDATE) {
        // A legacy two-player host sends snapshots without a seat assignment.
        const seat = localSeat ?? "p3";
        const incoming = (message.payload as { state?: GameState })?.state;
        if (!Array.isArray(incoming?.players) || incoming.status === "LOBBY") return;
        if (this.seat && this.seat !== seat) {
          this.fail();
          return;
        }
        this.seat = seat;
        this.recorder ??= new ListRecorder("multiplayer", "guest", seat);
        const state = withAvatars(sanitizeStateAvatars(incoming), avatars);
        this.recorder.observe(state);
        this.deps.events.onLocalSeat(seat);
        this.deps.events.onGameState(state);
        this.deps.events.onConnectionState("connected");
        if (!this.inGame) {
          this.inGame = true;
          this.deps.events.onEnterGame();
        }
      }
    });

    this.detach = () => {
      offState();
      offMessage();
      transport.disconnect();
      this.transport = null;
      this.detach = null;
    };
  }

  private fail(): void {
    this.detach?.();
    this.deps.events.onConnectionState("failed");
  }

  dispatch(action: PlayerAction): void {
    try {
      this.transport?.send(createMessage(P2PMessageType.PLAYER_ACTION, { action }));
    } catch {
      // The connection state will trigger re-pairing.
    }
  }

  destroy(): void {
    this.detach?.();
    this.recorder = null;
  }
}
