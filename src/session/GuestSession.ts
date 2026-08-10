import { GameState, PlayerAction, SeatId } from "../game/types";
import { ListRecorder } from "../persistence";
import { createMessage, P2PMessageType } from "../net/protocol";
import { Transport } from "../net/Transport";
import { AvatarMap, sanitizeAvatarMap, sanitizeStateAvatars, withAvatars } from "./avatarSync";
import { GameSession, SessionDeps } from "./GameSession";

/**
 * Guest side: a thin client with no engine — it renders whatever redacted
 * state arrives over the wire and forwards its intents as PlayerActions.
 */
export class GuestSession implements GameSession {
  readonly role = "guest" as const;
  readonly myPlayerId: SeatId = "p3";

  private transport: Transport | null = null;
  // Once per session, so a re-pairing keeps the in-progress recording.
  private recorder: ListRecorder | null = new ListRecorder("multiplayer", "guest", "p3");
  /** Kept across re-pairing so a reconnect doesn't flash the default picture. */
  private avatars: AvatarMap = {};

  constructor(private readonly deps: SessionDeps) {}

  attachTransport(transport: Transport): void {
    this.transport?.disconnect();
    this.transport = transport;

    transport.onConnectionStateChange((state) => {
      this.deps.events.onConnectionState(state);
      if (state === "connected") {
        this.deps.events.onEnterGame();
        try {
          transport.send(
            createMessage(P2PMessageType.CONNECTION_ACK, {
              name: this.deps.getPlayerName(),
              avatar: this.deps.getPlayerAvatar(),
            }),
          );
        } catch {
          // Ignore; host falls back to a default name.
        }
      }
    });

    transport.onMessage((message) => {
      if (message.type === P2PMessageType.AVATAR_UPDATE) {
        // Validated like any other wire input — the host is untrusted here too.
        this.avatars = sanitizeAvatarMap((message.payload as { avatars?: unknown })?.avatars);
        return;
      }
      if (message.type === P2PMessageType.GAME_STATE_UPDATE) {
        // Peer input too: sanitizing only the map above would be bypassable.
        const incoming = sanitizeStateAvatars((message.payload as { state: GameState }).state);
        const state = withAvatars(incoming, this.avatars);
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
