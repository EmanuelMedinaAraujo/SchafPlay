import { GameState, PlayerAction } from "../game/types";

/**
 * Wire protocol between host and guest. Transport-agnostic: any Transport
 * implementation carries these framed messages.
 *
 * - Host → Guest: GAME_STATE_UPDATE `{ state: RedactedGameState }`
 * - Guest → Host: PLAYER_ACTION `{ action: PlayerAction }`
 * - Guest → Host on connect: CONNECTION_ACK `{ name }` (guest display name)
 * - PING/PONG are transport-level keepalive, handled inside the transport.
 */
export enum P2PMessageType {
  GAME_STATE_UPDATE = "GAME_STATE_UPDATE",
  PLAYER_ACTION = "PLAYER_ACTION",
  CONNECTION_ACK = "CONNECTION_ACK",
  PING = "PING",
  PONG = "PONG",
}

export interface P2PMessage<T = unknown> {
  type: P2PMessageType;
  payload?: T;
  timestamp: number;
}

export type GameStateMessage = P2PMessage<{ state: GameState }>;
export type PlayerActionMessage = P2PMessage<{ action: PlayerAction }>;

export function createMessage<T>(type: P2PMessageType, payload?: T): P2PMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}
