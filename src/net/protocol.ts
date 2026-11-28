import { GameType, PlayerAction, PlayerActionType, RemoteSeatId, SeatId, Suit } from "../game/types";

/**
 * The host assigns a seat per link and sends only that seat's game view.
 * CONNECTION_ACK introduces the guest and carries its prior seat on re-pair.
 * AVATAR_UPDATE carries a single seat's picture (or the whole map for legacy
 * two-player clients). PING/PONG are handled inside the transport.
 */
export enum P2PMessageType {
  GAME_STATE_UPDATE = "GAME_STATE_UPDATE",
  PLAYER_ACTION = "PLAYER_ACTION",
  CONNECTION_ACK = "CONNECTION_ACK",
  SEAT_ASSIGNED = "SEAT_ASSIGNED",
  AVATAR_UPDATE = "AVATAR_UPDATE",
  PING = "PING",
  PONG = "PONG",
}

export interface P2PMessage<T = unknown> {
  type: P2PMessageType;
  payload?: T;
  timestamp: number;
}

export function createMessage<T>(type: P2PMessageType, payload?: T): P2PMessage<T> {
  return { type, payload, timestamp: Date.now() };
}

export function isRemoteSeat(value: unknown): value is RemoteSeatId {
  return value === "p2" || value === "p3" || value === "p4";
}

export function isSeat(value: unknown): value is SeatId {
  return value === "p1" || isRemoteSeat(value);
}

/** Read only supported fields, with authority coming from the link's seat. */
export function readPlayerAction(value: unknown, playerId: RemoteSeatId): PlayerAction | null {
  const action = value as Partial<PlayerAction> | undefined;
  const data = action?.data;
  switch (action?.type) {
    case PlayerActionType.BID_WILL:
      return typeof data?.wantsToPlay === "boolean"
        ? { type: action.type, playerId, data: { wantsToPlay: data.wantsToPlay } }
        : null;
    case PlayerActionType.BID_DECLARE: {
      const declaration = data?.declaration;
      if (!declaration || !Object.values(GameType).includes(declaration.type) || declaration.type === GameType.RAMSCH) return null;
      const { type, calledSuit, isTout } = declaration;
      if (type === GameType.SAUSPIEL && (calledSuit === undefined || !Object.values(Suit).includes(calledSuit))) return null;
      return {
        type: action.type, playerId,
        data: { declaration: { type, calledSuit: type === GameType.SAUSPIEL ? calledSuit : undefined, isTout: isTout === true } },
      };
    }
    case PlayerActionType.PLAY_CARD:
      return typeof data?.cardId === "string" ? { type: action.type, playerId, data: { cardId: data.cardId } } : null;
    case PlayerActionType.BID_RETREAT:
    case PlayerActionType.READY_NEXT:
    case PlayerActionType.REMATCH:
    case PlayerActionType.STOSS:
      return { type: action.type, playerId };
    default:
      return null;
  }
}
