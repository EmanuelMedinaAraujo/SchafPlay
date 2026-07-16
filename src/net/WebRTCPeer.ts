import { P2PMessage, P2PMessageType } from "./protocol";
import { GuestSignaling, HostSignaling } from "./Signaling";
import { Transport, TransportState } from "./Transport";
import { decodeSignal, encodeSignal, SDPBundle } from "./sdpCodec";

/**
 * Factory used by the pairing UI — the one line to touch when a
 * settings-driven transport choice arrives.
 */
export function createWebRTCPeer(): WebRTCPeer {
  return new WebRTCPeer();
}

/**
 * One game link over serverless WebRTC. Signaling runs via copy-paste of
 * compressed SDP blobs (no broker, no STUN, LAN-only). All game traffic
 * afterwards is a direct P2P data channel (DTLS-encrypted by the browser).
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

  /**
   * Host side: create an offer and collect ICE candidates.
   * Returns the compressed invite code string to display / copy.
   */
  async host(): Promise<string> {
    this.isHost = true;
    this.emitState("connecting");

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    this.watchConnection(pc);

    // Create the data channel before creating the offer so it's included in SDP.
    const dc = pc.createDataChannel("game", { ordered: true });
    this.setupDataChannel(dc);

    const offer = await pc.createOffer();
    const candidatesPromise = this.gatherCandidates(pc);
    await pc.setLocalDescription(offer);

    // Gather all ICE candidates (LAN-only, so they arrive quickly).
    const candidates = await candidatesPromise;

    return encodeSignal({
      sdp: pc.localDescription!.sdp,
      type: pc.localDescription!.type,
      candidates,
    });
  }

  /**
   * Host side, step 2: paste the guest's reply code to complete the handshake.
   */
  async acceptAnswer(replyCode: string): Promise<void> {
    const pc = this.pc;
    if (!pc) throw new Error("Call host() first");

    let bundle: SDPBundle;
    try {
      bundle = await decodeSignal(replyCode.trim());
    } catch {
      // The paste itself is garbage — the connection is still usable,
      // the user can simply paste again.
      throw new Error("INVALID_CODE");
    }
    await pc.setRemoteDescription({ type: bundle.type, sdp: bundle.sdp });
    for (const c of bundle.candidates) {
      await pc.addIceCandidate(c);
    }
  }

  /**
   * Guest side: accept the host's invite code, create an answer.
   * Returns the compressed reply code string.
   */
  async join(inviteCode: string): Promise<string> {
    this.isHost = false;
    this.emitState("connecting");

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    this.watchConnection(pc);

    // The host's data channel arrives via ondatachannel.
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    const bundle = await decodeSignal(inviteCode.trim());
    await pc.setRemoteDescription({ type: bundle.type, sdp: bundle.sdp });

    for (const c of bundle.candidates) {
      await pc.addIceCandidate(c);
    }

    const answer = await pc.createAnswer();
    const candidatesPromise = this.gatherCandidates(pc);
    await pc.setLocalDescription(answer);

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

  /**
   * Gather ICE candidates until gathering is complete.
   * With iceServers: [] on a LAN this resolves almost instantly.
   */
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

  /**
   * Surface ICE-level failures. Without this, a handshake whose ICE never
   * connects (wrong network, stale code) sits in "connecting" forever.
   */
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
