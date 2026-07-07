import { P2PMessage } from "../types";
import { WebRTCCallbacks, WebRTCPeer } from "../utils/webrtc";

export type PeerConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export class PeerConnection {
  private peer: WebRTCPeer;
  private messageHandlers = new Set<(message: P2PMessage) => void>();
  private stateHandlers = new Set<(state: PeerConnectionState) => void>();

  constructor(isHost: boolean) {
    const callbacks: WebRTCCallbacks = {
      onConnectionStateChange: (state) => {
        this.stateHandlers.forEach((handler) => handler(state));
      },
      onMessage: (message) => {
        this.messageHandlers.forEach((handler) => handler(message));
      },
      onError: (error) => {
        this.stateHandlers.forEach((handler) => handler("failed"));
        console.error(error);
      },
    };
    this.peer = new WebRTCPeer(isHost, callbacks);
  }

  createOffer(): Promise<string> {
    return this.peer.generateOffer();
  }

  acceptOffer(offerString: string): Promise<string> {
    return this.peer.acceptOfferAndGenerateAnswer(offerString);
  }

  completeConnection(answerString: string): Promise<void> {
    return this.peer.acceptAnswer(answerString);
  }

  send(message: P2PMessage): void {
    this.peer.send(message);
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
    this.peer.close();
  }
}
