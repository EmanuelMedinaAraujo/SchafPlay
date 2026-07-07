/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WebRTCCallbacks {
  onConnectionStateChange(state: 'connecting' | 'connected' | 'disconnected' | 'failed'): void;
  onMessage(message: any): void;
  onError(error: Error): void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ]
};

export class WebRTCPeer {
  private isHost: boolean;
  private callbacks: WebRTCCallbacks;
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private heartbeatIntervalId: any = null;
  private heartbeatTimeoutId: any = null;
  private isClosed = false;

  constructor(isHost: boolean, callbacks: WebRTCCallbacks) {
    this.isHost = isHost;
    this.callbacks = callbacks;
    this.initPeerConnection();
  }

  private initPeerConnection() {
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.pc.onconnectionstatechange = () => {
      if (this.isClosed || !this.pc) return;
      const state = this.pc.connectionState;
      if (state === 'failed' || state === 'closed') {
        this.handleDisconnect('failed');
      } else if (state === 'disconnected') {
        this.handleDisconnect('disconnected');
      } else if (state === 'connecting') {
        this.callbacks.onConnectionStateChange('connecting');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.isClosed || !this.pc) return;
      const state = this.pc.iceConnectionState;
      if (state === 'failed' || state === 'closed') {
        this.handleDisconnect('failed');
      } else if (state === 'disconnected') {
        this.handleDisconnect('disconnected');
      }
    };

    if (this.isHost) {
      // Host creates the data channel
      this.channel = this.pc.createDataChannel("schafplay-channel", { ordered: true });
      this.setupDataChannel(this.channel);
    } else {
      // Guest listens for the data channel
      this.pc.ondatachannel = (event) => {
        if (this.isClosed) return;
        this.channel = event.channel;
        this.setupDataChannel(this.channel);
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      if (this.isClosed) return;
      this.callbacks.onConnectionStateChange('connected');
      this.startHeartbeat();
    };

    channel.onclose = () => {
      this.handleDisconnect('disconnected');
    };

    channel.onerror = (event: any) => {
      if (this.isClosed) return;
      const errorMsg = event.message || "Data channel error";
      this.callbacks.onError(new Error(errorMsg));
    };

    channel.onmessage = (event) => {
      if (this.isClosed) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "PING") {
          this.send({ type: "PONG" });
          this.resetHeartbeatTimeout();
          return;
        }
        if (message.type === "PONG") {
          this.resetHeartbeatTimeout();
          return;
        }
        this.callbacks.onMessage(message);
      } catch (err: any) {
        this.callbacks.onError(new Error("Failed to parse incoming message: " + err.message));
      }
    };
  }

  private handleDisconnect(state: 'disconnected' | 'failed') {
    this.stopHeartbeat();
    this.callbacks.onConnectionStateChange(state);
  }

  // --- Heartbeat Mechanisms ---
  private startHeartbeat() {
    this.stopHeartbeat();
    this.resetHeartbeatTimeout();

    if (this.isHost) {
      this.heartbeatIntervalId = setInterval(() => {
        try {
          if (this.channel && this.channel.readyState === 'open') {
            this.send({ type: "PING" });
          }
        } catch {
          this.handleDisconnect('disconnected');
        }
      }, 5000); // Send PING every 5s
    }
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeoutId) clearTimeout(this.heartbeatTimeoutId);
    this.heartbeatTimeoutId = setTimeout(() => {
      this.handleDisconnect('disconnected');
    }, 15000); // 15s timeout for PONG or PING
  }

  private stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  // --- SDP Helpers ---
  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc) return resolve();
      if (this.pc.iceGatheringState === 'complete') {
        return resolve();
      }

      const timeoutId = setTimeout(() => {
        if (this.pc) {
          this.pc.removeEventListener('icecandidate', onIceCandidate);
        }
        resolve();
      }, 5000); // 5s safety timeout

      const onIceCandidate = (event: RTCPeerConnectionIceEvent) => {
        if (!this.pc) return;
        if (event.candidate === null || this.pc.iceGatheringState === 'complete') {
          clearTimeout(timeoutId);
          this.pc.removeEventListener('icecandidate', onIceCandidate);
          resolve();
        }
      };

      this.pc.addEventListener('icecandidate', onIceCandidate);
    });
  }

  private encodeSDP(desc: RTCSessionDescriptionInit): string {
    const jsonStr = JSON.stringify(desc);
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(jsonStr)));
    } else {
      return Buffer.from(jsonStr, 'utf8').toString('base64');
    }
  }

  private decodeSDP(base64: string): RTCSessionDescriptionInit {
    const clean = base64.trim();
    let jsonStr: string;
    try {
      if (typeof atob !== 'undefined') {
        jsonStr = decodeURIComponent(escape(atob(clean)));
      } else {
        jsonStr = Buffer.from(clean, 'base64').toString('utf8');
      }
      return JSON.parse(jsonStr);
    } catch (e: any) {
      const err = new Error("Invalid base64 offer/answer: " + e.message);
      this.callbacks.onError(err);
      throw err;
    }
  }

  // --- API Methods ---
  public async generateOffer(): Promise<string> {
    if (!this.pc) throw new Error("PeerConnection is closed");
    this.callbacks.onConnectionStateChange('connecting');
    
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      
      await this.waitForIceGathering();
      
      if (!this.pc.localDescription) {
        throw new Error("Failed to gather ICE candidates for offer");
      }
      return this.encodeSDP(this.pc.localDescription);
    } catch (error: any) {
      this.callbacks.onConnectionStateChange('failed');
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError(err);
      throw err;
    }
  }

  public async acceptOfferAndGenerateAnswer(base64Offer: string): Promise<string> {
    if (!this.pc) throw new Error("PeerConnection is closed");
    this.callbacks.onConnectionStateChange('connecting');

    try {
      const offerDesc = this.decodeSDP(base64Offer);
      await this.pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
      
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      
      await this.waitForIceGathering();

      if (!this.pc.localDescription) {
        throw new Error("Failed to gather ICE candidates for answer");
      }
      return this.encodeSDP(this.pc.localDescription);
    } catch (error: any) {
      this.callbacks.onConnectionStateChange('failed');
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError(err);
      throw err;
    }
  }

  public async acceptAnswer(base64Answer: string): Promise<void> {
    if (!this.pc) throw new Error("PeerConnection is closed");
    
    try {
      const answerDesc = this.decodeSDP(base64Answer);
      await this.pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
    } catch (error: any) {
      this.callbacks.onConnectionStateChange('failed');
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError(err);
      throw err;
    }
  }

  public send(message: any): void {
    if (this.isClosed || !this.channel || this.channel.readyState !== 'open') {
      throw new Error("Data channel is not open");
    }
    this.channel.send(JSON.stringify(message));
  }

  public close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    
    this.stopHeartbeat();
    
    if (this.channel) {
      this.channel.onopen = null;
      this.channel.onclose = null;
      this.channel.onerror = null;
      this.channel.onmessage = null;
      try {
        this.channel.close();
      } catch (e) {
        // ignore
      }
      this.channel = null;
    }
    
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.ondatachannel = null;
      this.pc.onicecandidate = null;
      try {
        this.pc.close();
      } catch (e) {
        // ignore
      }
      this.pc = null;
    }
  }
}
