import { GameState, P2PMessage, P2PMessageType, PlayerAction } from "../types";

export type GameStateMessage = P2PMessage<{ state: GameState }>;
export type PlayerActionMessage = P2PMessage<{ action: PlayerAction }>;
export type ReadyStateMessage = P2PMessage<{ playerId: string; ready: boolean }>;

export function createMessage<T>(type: P2PMessageType, payload?: T): P2PMessage<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
  };
}
