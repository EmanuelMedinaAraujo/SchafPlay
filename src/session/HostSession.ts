import { GameEngine } from "../engine/GameEngine";
import { redactStateFor } from "../engine/redaction";
import { GameState, PlayerAction, RemoteSeatId } from "../game/types";
import { ListRecorder } from "../persistence";
import { createMessage, P2PMessageType, readPlayerAction } from "../net/protocol";
import { Transport, TransportState } from "../net/Transport";
import { AvatarMap, heavyAvatars, sanitizeAvatar, withoutHeavyAvatars } from "./avatarSync";
import { engineOptions, GameSession, SessionDeps } from "./GameSession";

export type HumanCount = 2 | 3 | 4;

export interface LobbySeat {
  id: RemoteSeatId;
  name: string;
  state: TransportState | "idle";
}

interface GuestIdentity {
  name: string;
  avatar: string;
}

interface GuestLink {
  transport: Transport;
  open: boolean;
  admitted: boolean;
  hello?: { identity: GuestIdentity; assignedSeat?: unknown; supportsSeats: boolean };
  sentAvatars: AvatarMap;
  helloTimeout?: ReturnType<typeof setTimeout>;
  close(): void;
}

interface GuestSeat extends LobbySeat {
  avatar: string;
  link?: GuestLink;
}

// Players in a two-human game still sit opposite each other.
const GUEST_SEATS: readonly RemoteSeatId[] = ["p3", "p2", "p4"];
const HELLO_TIMEOUT_MS = 5_000;

/** Owns the lobby and the same authoritative engine for the lifetime of the table. */
export class HostSession implements GameSession {
  private engine: GameEngine | null = null;
  private recorder = new ListRecorder("multiplayer", "host", "p1");
  private readonly seats: GuestSeat[];

  constructor(private readonly deps: SessionDeps, private readonly humanCount: HumanCount) {
    this.seats = GUEST_SEATS.slice(0, humanCount - 1).map((id) => ({ id, name: "", avatar: "", state: "idle" }));
  }

  attachTransport(id: RemoteSeatId, transport: Transport): void {
    const seat = this.seats.find((candidate) => candidate.id === id);
    if (!seat || seat.state === "connected") {
      transport.disconnect();
      return;
    }

    seat.link?.close();
    const link: GuestLink = {
      transport,
      open: false,
      admitted: false,
      sentAvatars: {},
      close: () => {
        clearTimeout(link.helloTimeout);
        offState();
        offMessage();
        transport.disconnect();
      },
    };
    seat.link = link;

    const offState = transport.onConnectionStateChange((state) => {
      if (state === "connected") {
        link.open = true;
        if (link.hello) this.admit(seat, link);
        else link.helloTimeout = setTimeout(() => this.drop(seat, link, "failed"), HELLO_TIMEOUT_MS);
        return;
      }
      if (state === "disconnected" || state === "failed") {
        this.drop(seat, link, link.admitted ? "disconnected" : "failed");
      } else {
        seat.state = state;
        this.publishLobby();
      }
    });

    const offMessage = transport.onMessage((message) => {
      if (message?.type === P2PMessageType.CONNECTION_ACK && !link.admitted && !link.hello) {
        const payload = message.payload as { name?: unknown; avatar?: unknown; supportsSeats?: unknown; seat?: unknown } | undefined;
        link.hello = {
          identity: {
            name: (typeof payload?.name === "string" && payload.name.trim().slice(0, 20)) || seat.name || "Gast",
            avatar: payload?.avatar === undefined ? seat.avatar : sanitizeAvatar(payload.avatar),
          },
          assignedSeat: payload?.seat,
          supportsSeats: payload?.supportsSeats === true,
        };
        // Either the hello or the host's open event may arrive first.
        if (link.open) this.admit(seat, link);
      } else if (message?.type === P2PMessageType.PLAYER_ACTION && link.admitted) {
        const action = readPlayerAction((message.payload as { action?: unknown })?.action, seat.id);
        if (action) this.engine?.processAction(action);
      }
    });
  }

  private admit(seat: GuestSeat, link: GuestLink): void {
    const hello = link.hello!;
    clearTimeout(link.helloTimeout);
    if ((hello.assignedSeat !== undefined && hello.assignedSeat !== seat.id) ||
        (!hello.supportsSeats && this.humanCount > 2)) {
      // The rejected peer receives no seat assignment, avatars or game state.
      this.drop(seat, link, "failed");
      return;
    }

    try {
      if (hello.supportsSeats) {
        link.transport.send(createMessage(P2PMessageType.SEAT_ASSIGNED, { seat: seat.id }));
      }
    } catch {
      this.drop(seat, link, "failed");
      return;
    }

    link.admitted = true;
    Object.assign(seat, hello.identity, { state: "connected" });
    this.publishLobby();
    if (this.engine) {
      this.engine.setGuestConnection(seat.id, true, hello.identity);
    } else if (this.seats.every((candidate) => candidate.state === "connected")) {
      this.startGame();
    }
  }

  private drop(seat: GuestSeat, link: GuestLink, state: "disconnected" | "failed"): void {
    link.close();
    seat.link = undefined;
    seat.state = state;
    if (link.admitted) this.engine?.setGuestConnection(seat.id, false);
    this.publishLobby();
  }

  private publishLobby(): void {
    this.deps.events.onLobbyChange(this.seats.map(({ id, name, state }) => ({ id, name, state })));
    const pending = this.seats.find((seat) => seat.state === "connecting") ??
      this.seats.find((seat) => seat.state !== "connected");
    this.deps.events.onConnectionState(pending?.state ?? "connected");
  }

  private startGame(): void {
    const settings = this.deps.getSettings();
    const guests = Object.fromEntries(this.seats.map(({ id, name, avatar }) => [id, { name, avatar }]));
    const engine = new GameEngine(settings.playerName, settings.totalRounds, { ...engineOptions(settings), guests });
    this.engine = engine;
    engine.onStateChange((snapshot) => {
      if (snapshot.status === "LOBBY") return;
      const hostView = redactStateFor(snapshot, "p1");
      this.recorder.observe(hostView);
      this.deps.events.onGameState(hostView);
      this.broadcastState(snapshot);
    });
    engine.dealCards();
    this.deps.events.onEnterGame();
  }

  private broadcastState(snapshot: GameState): void {
    const avatars = heavyAvatars(snapshot);
    const compact = withoutHeavyAvatars(snapshot);
    for (const { id, link } of this.seats) {
      if (!link?.admitted) continue;
      try {
        if (link.hello?.supportsSeats) {
          // Per seat keeps four uploaded avatars below the per-message limit.
          for (const { id: avatarSeat } of snapshot.players) {
            if (avatars[avatarSeat] === link.sentAvatars[avatarSeat]) continue;
            const update = avatars[avatarSeat] ? { [avatarSeat]: avatars[avatarSeat] } : {};
            link.transport.send(createMessage(P2PMessageType.AVATAR_UPDATE, { avatars: update, seat: avatarSeat }));
            link.sentAvatars[avatarSeat] = avatars[avatarSeat];
          }
        } else if (JSON.stringify(avatars) !== JSON.stringify(link.sentAvatars)) {
          // Older two-player guests replace the whole map.
          link.transport.send(createMessage(P2PMessageType.AVATAR_UPDATE, { avatars }));
          link.sentAvatars = avatars;
        }
        const state = redactStateFor(compact, id);
        link.transport.send(createMessage(P2PMessageType.GAME_STATE_UPDATE, { state }));
      } catch {
        // The link may have closed. Its connection state will trigger re-pairing.
      }
    }
  }

  dispatch(action: PlayerAction): void {
    this.engine?.processAction({ ...action, playerId: "p1" });
  }

  devSkipTrick(): void {
    this.engine?.devSkipTrick();
  }

  devSkipRound(): void {
    this.engine?.devSkipRound();
  }

  destroy(): void {
    for (const seat of this.seats) seat.link?.close();
    this.engine?.destroy();
    this.engine = null;
  }
}
