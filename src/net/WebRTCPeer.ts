import { P2PMessage, P2PMessageType } from "./protocol";
import { GuestSignaling, HostSignaling } from "./Signaling";
import { Transport, TransportState } from "./Transport";
import { decodeSignal, encodeSignal } from "./sdpCodec";

/**
 * One game link over serverless WebRTC. Signaling exchanges compressed SDP
 * codes out of band — pasted, scanned as QR or opened as a link (no broker,
 * no STUN, LAN-only). All game traffic afterwards is a direct P2P data channel
 * (DTLS-encrypted by the browser).
 */
export class WebRTCPeer implements Transport, HostSignaling, GuestSignaling {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private isHost = false;
  private closed = false;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<(message: P2PMessage) => void>();
  private stateHandlers = new Set<(state: TransportState) => void>();

  /** Host: create an offer, returning the compressed invite code. */
  async host(): Promise<string> {
    this.isHost = true;
    const pc = this.newPeerConnection();

    // Create the data channel before creating the offer so it's included in SDP.
    this.setupDataChannel(pc.createDataChannel("game", { ordered: true }));

    return this.localCode(pc, await pc.createOffer());
  }

  /**
   * Host, step 2: the guest's reply code completes the handshake. A garbage
   * paste rejects with INVALID_CODE and leaves the connection usable for a retry.
   */
  async acceptAnswer(replyCode: string): Promise<void> {
    const pc = this.pc;
    if (!pc) throw new Error("Call host() first");
    await this.applyRemoteCode(pc, replyCode);
  }

  /** Guest: answer the host's invite code, returning the reply code. */
  async join(inviteCode: string): Promise<string> {
    this.isHost = false;
    const pc = this.newPeerConnection();

    // The host's data channel arrives via ondatachannel.
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    await this.applyRemoteCode(pc, inviteCode);
    return this.localCode(pc, await pc.createAnswer());
  }

  private newPeerConnection(): RTCPeerConnection {
    this.emitState("connecting");
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    this.watchConnection(pc);
    return pc;
  }

  /** `decodeSignal` sanitizes the code and rejects garbage with INVALID_CODE. */
  private async applyRemoteCode(pc: RTCPeerConnection, code: string): Promise<void> {
    const bundle = await decodeSignal(code);
    await pc.setRemoteDescription({ type: bundle.type, sdp: bundle.sdp });
    for (const c of bundle.candidates) {
      await pc.addIceCandidate(c);
    }
  }

  /** Set the local offer/answer and encode it with every ICE candidate (LAN-only, so they arrive quickly). */
  private async localCode(pc: RTCPeerConnection, description: RTCSessionDescriptionInit): Promise<string> {
    const candidatesPromise = this.gatherCandidates(pc);
    await pc.setLocalDescription(description);
    const candidates = await candidatesPromise;
    return encodeSignal({
      sdp: pc.localDescription!.sdp,
      type: pc.localDescription!.type,
      candidates,
    });
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => {
      if (this.closed) return;
      this.emitState("connected");
      this.startHeartbeat();
    };
    dc.onmessage = (event) => {
      if (this.closed) return;
      let message: P2PMessage;
      try {
        message = JSON.parse(event.data) as P2PMessage;
      } catch {
        return;
      }
      if (message?.type === P2PMessageType.PING) {
        try {
          dc.send(JSON.stringify({ type: P2PMessageType.PONG }));
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
    };
    dc.onclose = () => {
      this.stopHeartbeat();
      if (!this.closed) this.emitState("disconnected");
    };
    dc.onerror = () => this.fail();
  }

  /** With `iceServers: []` on a LAN this resolves almost instantly. */
  private gatherCandidates(pc: RTCPeerConnection): Promise<RTCIceCandidateInit[]> {
    return new Promise((resolve) => {
      const candidates: RTCIceCandidateInit[] = [];
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve(candidates);
      };

      // Safety timeout of 1.5s (candidate gathering is LAN-only and fast)
      const timeoutId = setTimeout(done, 1500);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate.toJSON());
        } else {
          // null candidate = gathering complete.
          clearTimeout(timeoutId);
          done();
        }
      };

      // Safety: if gathering is already complete by the time we attach.
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeoutId);
        done();
      }
    });
  }

  private fail() {
    this.stopHeartbeat();
    if (!this.closed) this.emitState("failed");
  }

  /** Without this, a handshake whose ICE never connects hangs in "connecting". */
  private watchConnection(pc: RTCPeerConnection) {
    pc.onconnectionstatechange = () => {
      if (this.closed || this.pc !== pc) return;
      if (pc.connectionState === "failed") this.fail();
      if (pc.connectionState === "closed") this.emitState("disconnected");
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.resetHeartbeatTimeout();
    if (this.isHost) {
      this.heartbeatIntervalId = setInterval(() => {
        try {
          this.dc?.send(JSON.stringify({ type: P2PMessageType.PING }));
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

  private emitState(state: TransportState) {
    this.stateHandlers.forEach((handler) => handler(state));
  }

  isConnected(): boolean {
    return this.dc?.readyState === "open";
  }

  send(message: P2PMessage): void {
    if (!this.dc || this.dc.readyState !== "open") throw new Error("Data channel is not open");
    this.dc.send(JSON.stringify(message));
  }

  onMessage(callback: (message: P2PMessage) => void): () => void {
    this.messageHandlers.add(callback);
    return () => this.messageHandlers.delete(callback);
  }

  onConnectionStateChange(callback: (state: TransportState) => void): () => void {
    this.stateHandlers.add(callback);
    return () => this.stateHandlers.delete(callback);
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    try {
      this.dc?.close();
    } catch {
      // Already closed.
    }
    try {
      this.pc?.close();
    } catch {
      // Already closed.
    }
    this.dc = null;
    this.pc = null;
  }
}
