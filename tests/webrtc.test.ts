import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebRTCPeer, WebRTCCallbacks } from "../src/utils/webrtc";

// --- WebRTC Mock Classes ---
class MockRTCDataChannel {
  public label: string;
  public readyState: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  public onopen: (() => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: ((event: any) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public remoteChannel: MockRTCDataChannel | null = null;

  constructor(label: string) {
    this.label = label;
  }

  send(data: string) {
    if (this.readyState !== 'open') {
      throw new Error("Data channel not open");
    }
    // Simulate asynchronous packet transmission
    setTimeout(() => {
      if (this.remoteChannel && this.remoteChannel.readyState === 'open') {
        if (this.remoteChannel.onmessage) {
          this.remoteChannel.onmessage({ data });
        }
      }
    }, 0);
  }

  close() {
    if (this.readyState === 'closed') return;
    this.readyState = 'closed';
    if (this.onclose) this.onclose();
    if (this.remoteChannel) {
      this.remoteChannel.readyState = 'closed';
      if (this.remoteChannel.onclose) this.remoteChannel.onclose();
    }
  }

  // Test helper to simulate channel opening
  simOpen() {
    this.readyState = 'open';
    if (this.onopen) this.onopen();
  }
}

class MockRTCPeerConnection {
  public connectionState: RTCPeerConnectionState = 'new';
  public iceConnectionState: RTCIceConnectionState = 'new';
  public iceGatheringState: RTCIceGatheringState = 'new';
  
  public onconnectionstatechange: (() => void) | null = null;
  public oniceconnectionstatechange: (() => void) | null = null;
  public ondatachannel: ((event: { channel: any }) => void) | null = null;
  public onicecandidate: ((event: any) => void) | null = null;

  public localDescription: RTCSessionDescriptionInit | null = null;
  public remoteDescription: RTCSessionDescriptionInit | null = null;

  private listeners: Record<string, Set<Function>> = {};
  public channelCreated: MockRTCDataChannel | null = null;
  public static instances: MockRTCPeerConnection[] = [];

  constructor() {
    MockRTCPeerConnection.instances.push(this);
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  public trigger(event: string, arg: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(arg));
    }
  }

  createDataChannel(label: string, options?: any) {
    const channel = new MockRTCDataChannel(label);
    this.channelCreated = channel;
    return channel as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'mock-offer-sdp' };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: 'mock-answer-sdp' };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
    this.iceGatheringState = 'gathering';
    
    // Simulate ICE candidate gathering async
    setTimeout(() => {
      this.iceGatheringState = 'complete';
      const event = { candidate: null };
      if (this.onicecandidate) this.onicecandidate(event);
      this.trigger('icecandidate', event);
    }, 10);
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = desc;
  }

  close() {
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    if (this.onconnectionstatechange) this.onconnectionstatechange();
    if (this.oniceconnectionstatechange) this.oniceconnectionstatechange();
  }

  // Link host and guest connections
  static linkPeers(hostPc: MockRTCPeerConnection, guestPc: MockRTCPeerConnection) {
    hostPc.connectionState = 'connected';
    hostPc.iceConnectionState = 'connected';
    guestPc.connectionState = 'connected';
    guestPc.iceConnectionState = 'connected';

    if (hostPc.onconnectionstatechange) hostPc.onconnectionstatechange();
    if (guestPc.onconnectionstatechange) guestPc.onconnectionstatechange();

    if (hostPc.channelCreated) {
      const guestChannel = new MockRTCDataChannel("schafplay-channel");
      
      // Link them together
      hostPc.channelCreated.remoteChannel = guestChannel;
      guestChannel.remoteChannel = hostPc.channelCreated;
      
      // Trigger guest's ondatachannel
      if (guestPc.ondatachannel) {
        guestPc.ondatachannel({ channel: guestChannel });
      }

      // Open channels
      hostPc.channelCreated.simOpen();
      guestChannel.simOpen();
    }
  }
}

// Stub the global WebRTC classes
vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
vi.stubGlobal('RTCSessionDescription', class {
  constructor(public init: any) {}
});

describe("WebRTC Connection Layer Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockRTCPeerConnection.instances = [];
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  it("should establish a connection between two local WebRTCPeer instances (Happy Path)", async () => {
    const hostStates: string[] = [];
    const guestStates: string[] = [];
    const hostMessages: any[] = [];
    const guestMessages: any[] = [];
    const hostErrors: Error[] = [];
    const guestErrors: Error[] = [];

    const hostCallbacks: WebRTCCallbacks = {
      onConnectionStateChange: (state) => hostStates.push(state),
      onMessage: (msg) => hostMessages.push(msg),
      onError: (err) => hostErrors.push(err),
    };

    const guestCallbacks: WebRTCCallbacks = {
      onConnectionStateChange: (state) => guestStates.push(state),
      onMessage: (msg) => guestMessages.push(msg),
      onError: (err) => guestErrors.push(err),
    };

    const host = new WebRTCPeer(true, hostCallbacks);
    const guest = new WebRTCPeer(false, guestCallbacks);

    // 1. Host generates offer
    const offerPromise = host.generateOffer();
    // Advance timers so ICE gathering completes
    await vi.advanceTimersByTimeAsync(50);
    const offer = await offerPromise;
    expect(offer).toBeDefined();
    expect(typeof offer).toBe("string");

    // 2. Guest accepts offer and generates answer
    const answerPromise = guest.acceptOfferAndGenerateAnswer(offer);
    await vi.advanceTimersByTimeAsync(50);
    const answer = await answerPromise;
    expect(answer).toBeDefined();

    // 3. Host accepts answer
    await host.acceptAnswer(answer);

    // 4. Retrieve mock instances and link them to simulate WebRTC connectivity
    const hostPc = MockRTCPeerConnection.instances[0];
    const guestPc = MockRTCPeerConnection.instances[1];
    expect(hostPc).toBeDefined();
    expect(guestPc).toBeDefined();

    MockRTCPeerConnection.linkPeers(hostPc, guestPc);

    // Give microtasks time to execute for async messages
    await vi.advanceTimersByTimeAsync(10);

    // Both should transition to connected state
    expect(hostStates).toContain('connected');
    expect(guestStates).toContain('connected');

    // 5. Test message transmission
    host.send({ type: "GAME_STATE", dealer: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(guestMessages).toContainEqual({ type: "GAME_STATE", dealer: 1 });

    guest.send({ type: "PLAY_CARD", card: "Eichel-Ober" });
    await vi.advanceTimersByTimeAsync(10);
    expect(hostMessages).toContainEqual({ type: "PLAY_CARD", card: "Eichel-Ober" });

    // Verify no errors occurred
    expect(hostErrors.length).toBe(0);
    expect(guestErrors.length).toBe(0);

    host.close();
    guest.close();
  });

  it("should handle heartbeat PING/PONG and detect timeout disconnect", async () => {
    const hostStates: string[] = [];
    const guestStates: string[] = [];
    
    const host = new WebRTCPeer(true, {
      onConnectionStateChange: (state) => hostStates.push(state),
      onMessage: () => {},
      onError: () => {},
    });
    const guest = new WebRTCPeer(false, {
      onConnectionStateChange: (state) => guestStates.push(state),
      onMessage: () => {},
      onError: () => {},
    });

    const offerPromise = host.generateOffer();
    await vi.advanceTimersByTimeAsync(50);
    const offer = await offerPromise;

    const answerPromise = guest.acceptOfferAndGenerateAnswer(offer);
    await vi.advanceTimersByTimeAsync(50);
    const answer = await answerPromise;

    await host.acceptAnswer(answer);

    const hostPc = MockRTCPeerConnection.instances[0];
    const guestPc = MockRTCPeerConnection.instances[1];
    MockRTCPeerConnection.linkPeers(hostPc, guestPc);
    await vi.advanceTimersByTimeAsync(10);

    expect(hostStates).toContain('connected');
    expect(guestStates).toContain('connected');

    // Simulate 5 seconds passing -> host sends PING to guest, guest replies PONG
    const initialSend = vi.spyOn(hostPc.channelCreated!, 'send');
    await vi.advanceTimersByTimeAsync(5000);
    expect(initialSend).toHaveBeenCalled();

    // Now, let's stop guest from responding or break the link
    // We break the connection link
    hostPc.channelCreated!.remoteChannel = null;

    // Advance by 15 more seconds (total 20 seconds)
    // The heartbeat timeout should fire on both sides because they didn't receive PING/PONG
    await vi.advanceTimersByTimeAsync(15000);

    expect(hostStates).toContain('disconnected');
    expect(guestStates).toContain('disconnected');

    host.close();
    guest.close();
  });

  it("should handle invalid Base64 offers and verify the double-onError call behavior", async () => {
    const errors: Error[] = [];
    const states: string[] = [];
    
    const peer = new WebRTCPeer(false, {
      onConnectionStateChange: (state) => states.push(state),
      onMessage: () => {},
      onError: (err) => errors.push(err),
    });

    // Pass invalid Base64 to acceptOfferAndGenerateAnswer
    await expect(peer.acceptOfferAndGenerateAnswer("invalid-base-64!!!")).rejects.toThrow();

    // Double onError call analysis
    expect(errors.length).toBe(2);
    expect(errors[0].message).toContain("Invalid base64 offer/answer");
    expect(errors[1].message).toContain("Invalid base64 offer/answer");
    expect(states).toContain('failed');

    peer.close();
  });

  it("should gracefully handle ICE gathering timeout", async () => {
    // Override setLocalDescription mock to NEVER complete ICE candidate gathering
    const originalSetLocal = MockRTCPeerConnection.prototype.setLocalDescription;
    MockRTCPeerConnection.prototype.setLocalDescription = async function(desc) {
      this.localDescription = desc;
      this.iceGatheringState = 'gathering';
      // Do NOT trigger icecandidate null event
    };

    const host = new WebRTCPeer(true, {
      onConnectionStateChange: () => {},
      onMessage: () => {},
      onError: () => {},
    });

    const offerPromise = host.generateOffer();
    
    // Advance timers by 5000ms (safety timeout is 5s)
    await vi.advanceTimersByTimeAsync(5000);
    
    const offer = await offerPromise;
    expect(offer).toBeDefined();
    
    // Restore mock behavior
    MockRTCPeerConnection.prototype.setLocalDescription = originalSetLocal;
    host.close();
  });

  it("should verify close cleans up event listeners and intervals", async () => {
    const host = new WebRTCPeer(true, {
      onConnectionStateChange: () => {},
      onMessage: () => {},
      onError: () => {},
    });

    const offerPromise = host.generateOffer();
    await vi.advanceTimersByTimeAsync(50);
    await offerPromise;

    const hostPc = MockRTCPeerConnection.instances[0];
    expect(hostPc.onconnectionstatechange).not.toBeNull();
    
    host.close();

    // After close, event listeners on RTCPeerConnection should be cleared/nulled out
    expect(hostPc.onconnectionstatechange).toBeNull();
    expect(hostPc.oniceconnectionstatechange).toBeNull();
    expect(hostPc.ondatachannel).toBeNull();
    expect(hostPc.onicecandidate).toBeNull();
  });

  it("should test large payload size robustness", async () => {
    const guestMessages: any[] = [];
    const host = new WebRTCPeer(true, {
      onConnectionStateChange: () => {},
      onMessage: () => {},
      onError: () => {},
    });
    const guest = new WebRTCPeer(false, {
      onConnectionStateChange: () => {},
      onMessage: (msg) => guestMessages.push(msg),
      onError: () => {},
    });

    const offerPromise = host.generateOffer();
    await vi.advanceTimersByTimeAsync(50);
    const offer = await offerPromise;

    const answerPromise = guest.acceptOfferAndGenerateAnswer(offer);
    await vi.advanceTimersByTimeAsync(50);
    const answer = await answerPromise;

    await host.acceptAnswer(answer);

    const hostPc = MockRTCPeerConnection.instances[0];
    const guestPc = MockRTCPeerConnection.instances[1];
    MockRTCPeerConnection.linkPeers(hostPc, guestPc);
    await vi.advanceTimersByTimeAsync(10);

    // Create a 100KB payload (large game state)
    const largeData = "x".repeat(100 * 1024);
    host.send({ type: "GAME_STATE_LARGE", data: largeData });
    await vi.advanceTimersByTimeAsync(10);

    expect(guestMessages.length).toBe(1);
    expect(guestMessages[0].data.length).toBe(100 * 1024);

    host.close();
    guest.close();
  });
});
