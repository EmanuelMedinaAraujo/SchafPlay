import { P2PMessage, P2PMessageType } from "../types";

export type PeerConnectionState = "connecting" | "connected" | "disconnected" | "failed";

/**
 * Compress an SDP + ICE-candidates bundle into a short-ish URL-safe string.
 * JSON → deflate → base64url. The browser's CompressionStream API handles
 * the heavy lifting; no extra dependency needed.
 */
async function compressSDP(obj: object): Promise<string> {
  const json = JSON.stringify(obj);
  const input = new Blob([json]);
  const cs = new CompressionStream("deflate");
  const compressed = input.stream().pipeThrough(cs);
  const buf = await new Response(compressed).arrayBuffer();
  // base64url (no padding) so the blob is safe to paste anywhere.
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function decompressSDP<T>(encoded: string): Promise<T> {
  // Undo base64url → standard base64
  let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const input = new Blob([raw]);
  const ds = new DecompressionStream("deflate");
  const decompressed = input.stream().pipeThrough(ds);
  const text = await new Response(decompressed).text();
  return JSON.parse(text) as T;
}

interface SDPBundle {
  sdp: string;
  type: RTCSdpType;
  candidates: RTCIceCandidateInit[];
}

/**
 * One game link. Signaling runs via copy-paste of compressed SDP blobs
 * (no broker, no STUN, LAN-only). All game traffic afterwards is a
 * direct P2P WebRTC data channel (DTLS-encrypted by the browser).
 */
export class PeerConnection {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private isHost = false;
  private closed = false;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<(message: P2PMessage) => void>();
  private stateHandlers = new Set<(state: PeerConnectionState) => void>();

  /**
   * Host side: create an offer and collect ICE candidates.
   * Returns the compressed invite code string to display / copy.
   */
  async host(): Promise<string> {
    this.isHost = true;
    this.emitState("connecting");

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;

    // Create the data channel before creating the offer so it's included in SDP.
    const dc = pc.createDataChannel("game", { ordered: true });
    this.setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Gather all ICE candidates (LAN-only, so they arrive quickly).
    const candidates = await this.gatherCandidates(pc);

    return compressSDP({
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

    const bundle = await decompressSDP<SDPBundle>(replyCode.trim());
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

    // The host's data channel arrives via ondatachannel.
    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    const bundle = await decompressSDP<SDPBundle>(inviteCode.trim());
    await pc.setRemoteDescription({ type: bundle.type, sdp: bundle.sdp });

    for (const c of bundle.candidates) {
      await pc.addIceCandidate(c);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const candidates = await this.gatherCandidates(pc);

    return compressSDP({
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
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate.toJSON());
        } else {
          // null candidate = gathering complete.
          resolve(candidates);
        }
      };
      // Safety: if gathering is already complete by the time we attach.
      if (pc.iceGatheringState === "complete") {
        resolve(candidates);
      }
    });
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

  private emitState(state: PeerConnectionState) {
    this.stateHandlers.forEach((handler) => handler(state));
  }

  send(message: P2PMessage): void {
    if (!this.dc || this.dc.readyState !== "open") throw new Error("Data channel is not open");
    this.dc.send(JSON.stringify(message));
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
