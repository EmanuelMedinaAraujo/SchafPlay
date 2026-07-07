import Peer, { DataConnection } from "peerjs";
import { P2PMessage, P2PMessageType } from "../types";

export type PeerConnectionState = "connecting" | "connected" | "disconnected" | "failed";

/** Unambiguous alphabet: no 0/O, 1/I/L. */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 5;
/** Namespace so short codes can't collide with other apps on the public broker. */
const ID_PREFIX = "schafplay-7f3a-";

export function generateGameCode(): string {
  const values = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => CODE_ALPHABET[v % CODE_ALPHABET.length]).join("");
}

export function normalizeGameCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const peerIdFor = (code: string) => ID_PREFIX + normalizeGameCode(code).toLowerCase();

/**
 * One game link. Signaling runs over the public PeerJS broker (the host
 * registers a short code, the guest dials it) — all game traffic afterwards
 * is a direct P2P WebRTC data channel.
 */
export class PeerConnection {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private isHost = false;
  private closed = false;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<(message: P2PMessage) => void>();
  private stateHandlers = new Set<(state: PeerConnectionState) => void>();

  /** Register `code` with the broker and wait for a guest to dial in. */
  host(code: string): Promise<void> {
    this.isHost = true;
    this.emitState("connecting");
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerIdFor(code));
      this.peer = peer;
      peer.on("open", () => resolve());
      peer.on("connection", (conn) => {
        // One guest only; a second dial-in replaces a dead first attempt.
        this.conn?.close();
        this.setupConnection(conn);
      });
      peer.on("error", (error) => {
        reject(error);
        this.fail();
      });
      peer.on("disconnected", () => {
        // Broker link dropped. The data channel (if open) keeps working;
        // reconnect to the broker so a re-pairing guest can still find us.
        if (!this.closed) peer.reconnect();
      });
    });
  }

  /** Dial the host's code. Resolves once the data channel is open. */
  join(code: string): Promise<void> {
    this.isHost = false;
    this.emitState("connecting");
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      this.peer = peer;
      peer.on("open", () => {
        const conn = peer.connect(peerIdFor(code), { reliable: true });
        this.setupConnection(conn);
        conn.on("open", () => resolve());
      });
      peer.on("error", (error) => {
        reject(error);
        this.fail();
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    this.conn = conn;
    conn.on("open", () => {
      if (this.closed) return;
      this.emitState("connected");
      this.startHeartbeat();
    });
    conn.on("data", (data) => {
      if (this.closed) return;
      const message = data as P2PMessage;
      if (message?.type === P2PMessageType.PING) {
        try {
          conn.send({ type: P2PMessageType.PONG });
        } catch {
          // Channel died mid-ping; the heartbeat timeout will notice.
        }
        this.resetHeartbeatTimeout();
        return;
      }
      if (message?.type === P2PMessageType.PONG) {
        this.resetHeartbeatTimeout();
        return;
      }
      this.messageHandlers.forEach((handler) => handler(message));
    });
    conn.on("close", () => {
      this.stopHeartbeat();
      if (!this.closed) this.emitState("disconnected");
    });
    conn.on("error", () => this.fail());
  }

  private fail() {
    this.stopHeartbeat();
    if (!this.closed) this.emitState("failed");
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.resetHeartbeatTimeout();
    if (this.isHost) {
      this.heartbeatIntervalId = setInterval(() => {
        try {
          this.conn?.send({ type: P2PMessageType.PING });
        } catch {
          this.stopHeartbeat();
          this.emitState("disconnected");
        }
      }, 5000);
    }
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeoutId) clearTimeout(this.heartbeatTimeoutId);
    this.heartbeatTimeoutId = setTimeout(() => {
      this.stopHeartbeat();
      if (!this.closed) this.emitState("disconnected");
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
    if (this.heartbeatTimeoutId) clearTimeout(this.heartbeatTimeoutId);
    this.heartbeatIntervalId = null;
    this.heartbeatTimeoutId = null;
  }

  private emitState(state: PeerConnectionState) {
    this.stateHandlers.forEach((handler) => handler(state));
  }

  send(message: P2PMessage): void {
    if (!this.conn || !this.conn.open) throw new Error("Data channel is not open");
    this.conn.send(message);
  }

  onMessage(callback: (message: P2PMessage) => void): () => void {
    this.messageHandlers.add(callback);
    return () => this.messageHandlers.delete(callback);
  }

  onConnectionStateChange(callback: (state: PeerConnectionState) => void): () => void {
    this.stateHandlers.add(callback);
    return () => this.stateHandlers.delete(callback);
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    try {
      this.conn?.close();
    } catch {
      // Already closed.
    }
    try {
      this.peer?.destroy();
    } catch {
      // Already destroyed.
    }
    this.conn = null;
    this.peer = null;
  }
}
