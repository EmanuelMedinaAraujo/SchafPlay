import { P2PMessage } from "./protocol";

export type TransportState = "connecting" | "connected" | "disconnected" | "failed";

/**
 * A framed, keepalive-supervised message channel to the remote player.
 * WebRTCPeer is the only implementation today; sessions and UI depend on
 * this interface so other transports can slot in without touching them.
 */
export interface Transport {
  /** Throws when the channel is not open — callers retry on the next state change. */
  send(message: P2PMessage): void;
  onMessage(callback: (message: P2PMessage) => void): () => void;
  onConnectionStateChange(callback: (state: TransportState) => void): () => void;
  isConnected(): boolean;
  disconnect(): void;
}
