import { P2PMessage, P2PMessageType } from "./protocol";
import { GuestSignaling, HostSignaling, HostOptions } from "./Signaling";
import { Transport, TransportState } from "./Transport";
import {
  buildAnswerSdp,
  decodeInvite,
  decodeSignal,
  encodeInvite,
  encodeSignal,
  extractFingerprint,
  FastEntry,
  InvitePayload,
  SDPBundle,
} from "./sdpCodec";
import { loadOrCreateCertificate } from "./certStore";
import {
  deriveGuestIceCreds,
  getKnownPeer,
  listKnownPeers,
  newSalt,
  newSecret,
  normalizeFingerprint,
  rememberPeer,
} from "./knownPeers";

/**
 * Factory used by the pairing UI — the one line to touch when a
 * settings-driven transport choice arrives.
 */
export function createWebRTCPeer(): WebRTCPeer {
  return new WebRTCPeer();
}

/**
 * Deliberately no ICE servers: no STUN, no TURN, no third parties (#71 owner
 * decision). Codes only ever carry host (LAN) candidates, so both devices must
 * share a network at connection time — any network, not just the one they first
 * paired on: the persisted pairing data is pure identity (certificate
 * fingerprint + shared secret) and every invite gathers fresh candidates for
 * the current network. Internet-crossing pairing is out of scope.
 */

/** Upper bound on ICE gathering (LAN-only, so candidates arrive quickly). */
const GATHER_TIMEOUT_MS = 1500;

/** How long a returning guest waits for the 1-message fast path before falling back to a full reply. */
const FAST_TIMEOUT_MS = 5000;

/** Cap on how many remembered guests a host primes a fast offer for (newest first). */
const MAX_FAST_PAIRINGS = 3;

/**
 * One in-flight handshake path. A host runs several concurrently (the classic
 * "normal" offer plus one primed "fast" offer per remembered guest); a guest
 * runs one. The first data channel to open is adopted; the rest are discarded.
 * `remoteFingerprint`/`secret`/`peerName` are what we persist on success so the
 * pair can fast-reconnect next time.
 */
interface Attempt {
  pc: RTCPeerConnection;
  remoteFingerprint: string;
  secret: string;
  peerName: string;
}

function colonizeFingerprint(normalized: string): string {
  return normalized.replace(/(..)(?=.)/g, "$1:");
}

/** Replace the ICE ufrag/pwd of an SDP with deterministically derived values. */
function mungeIceCreds(sdp: string, ufrag: string, pwd: string): string {
  return sdp
    .replace(/a=ice-ufrag:.*(\r?\n)/, `a=ice-ufrag:${ufrag}$1`)
    .replace(/a=ice-pwd:.*(\r?\n)/, `a=ice-pwd:${pwd}$1`);
}

/**
 * One game link over serverless WebRTC. Signaling is copy-paste of compressed
 * SDP codes (no broker, no STUN, LAN-only). All game traffic afterwards is a
 * direct P2P data channel (DTLS-encrypted by the browser).
 *
 * Two pairing modes (issue #71):
 *   - First time: classic 2 messages (invite → reply).
 *   - Returning pair: 1 message. Both sides persist their DTLS certificate
 *     (stable fingerprint) and pin the peer's; the host primes an offer per
 *     remembered guest with the guest's ICE credentials *derived* from a shared
 *     secret, so the guest connects from the invite alone — no reply — and its
 *     address is learned via ICE peer-reflexive discovery.
 */
export class WebRTCPeer implements Transport, HostSignaling, GuestSignaling {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private isHost = false;
  private closed = false;
  private adopted = false;
  private attempts: Attempt[] = [];
  /** The host's classic-reply attempt (the one `acceptAnswer` completes). */
  private normalAttempt: Attempt | null = null;
  private adoptWaiter: (() => void) | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers = new Set<(message: P2PMessage) => void>();
  private stateHandlers = new Set<(state: TransportState) => void>();

  /**
   * Host side: create an offer (or several) and collect ICE candidates.
   * Returns the compressed invite code to display / copy. A brand-new host
   * emits a plain invite; a host that has paired before also primes one fast
   * offer per remembered guest so returning partners skip the reply step.
   */
  async host(opts?: HostOptions): Promise<string> {
    this.isHost = true;
    this.emitState("connecting");
    const cert = await loadOrCreateCertificate();
    const localName = opts?.localName ?? "";

    // Classic offer — always present, connects any guest via the reply flow.
    const normal: Attempt = { pc: this.newPc(cert), remoteFingerprint: "", secret: newSecret(), peerName: "" };
    this.normalAttempt = normal;
    this.attempts.push(normal);
    // Only the classic path surfaces ICE failure to the UI; a fast offer that
    // never connects (guest is new, or fell back) must stay silent.
    this.watchConnection(normal.pc);
    const normalBundle = await this.buildHostOffer(normal);

    // Fast offers — one per remembered guest, newest first, bounded.
    const known = listKnownPeers()
      .sort((a, b) => (a[1].updatedAt < b[1].updatedAt ? 1 : -1))
      .slice(0, MAX_FAST_PAIRINGS);
    const fast: FastEntry[] = [];
    for (const [guestFp, record] of known) {
      if (!record.secret) continue;
      const salt = newSalt();
      const attempt: Attempt = {
        pc: this.newPc(cert),
        remoteFingerprint: normalizeFingerprint(guestFp),
        secret: record.secret,
        peerName: record.name ?? "",
      };
      this.attempts.push(attempt);
      const bundle = await this.buildHostOffer(attempt);
      // Prime the connection: synthesise the guest's answer locally from the
      // pinned fingerprint + derived credentials, so incoming checks connect
      // with no reply. The guest's address arrives as a peer-reflexive candidate.
      const creds = await deriveGuestIceCreds(record.secret, salt);
      const answerSdp = buildAnswerSdp({
        ufrag: creds.ufrag,
        pwd: creds.pwd,
        fingerprint: colonizeFingerprint(normalizeFingerprint(guestFp)),
      });
      try {
        await attempt.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch {
        // If synthesising fails, drop this fast offer; the guest can still fall
        // back to the classic reply flow.
        try {
          attempt.pc.close();
        } catch {
          /* already closed */
        }
        this.attempts = this.attempts.filter((a) => a !== attempt);
        continue;
      }
      fast.push({ salt, bundle });
    }

    const payload: InvitePayload = {
      normal: normalBundle,
      meta: { secret: normal.secret, name: localName },
      fast,
    };
    return encodeInvite(payload);
  }

  /**
   * Host side, step 2: paste the guest's reply code to complete the classic
   * handshake. (A returning guest never reaches this — its fast offer already
   * connected.)
   */
  async acceptAnswer(replyCode: string): Promise<void> {
    const normal = this.normalAttempt;
    if (!normal) throw new Error("Call host() first");

    let bundle: SDPBundle;
    try {
      bundle = await decodeSignal(replyCode.trim());
    } catch {
      // The paste itself is garbage — the connection is still usable,
      // the user can simply paste again.
      throw new Error("INVALID_CODE");
    }
    normal.remoteFingerprint = normalizeFingerprint(extractFingerprint(bundle.sdp));
    await normal.pc.setRemoteDescription({ type: bundle.type, sdp: bundle.sdp });
    for (const c of bundle.candidates) {
      await normal.pc.addIceCandidate(c);
    }
  }

  /**
   * Guest side: accept the host's invite. For a returning pair whose host we've
   * pinned, connect directly and resolve to `""` (no reply needed). Otherwise
   * fall through to the classic flow and resolve to the reply code to hand back.
   */
  async join(inviteCode: string): Promise<string> {
    this.isHost = false;
    this.emitState("connecting");
    const cert = await loadOrCreateCertificate();

    let invite: InvitePayload;
    try {
      invite = await decodeInvite(inviteCode.trim());
    } catch {
      throw new Error("INVALID_CODE");
    }

    // Fast path: is any of the host's primed offers for a host we already know?
    for (const entry of invite.fast) {
      const hostFp = extractFingerprint(entry.bundle.sdp);
      const known = getKnownPeer(hostFp);
      if (!known?.secret) continue;
      const connected = await this.tryFastJoin(cert, entry, hostFp, known.secret, known.name ?? "");
      if (connected) return "";
      // Fast path timed out / failed — fall back to the classic reply flow.
      break;
    }

    return this.normalJoin(cert, invite);
  }

  /** Attempt a 1-message connect against a primed host offer. */
  private async tryFastJoin(
    cert: RTCCertificate,
    entry: FastEntry,
    hostFp: string,
    secret: string,
    peerName: string,
  ): Promise<boolean> {
    const attempt: Attempt = {
      pc: this.newPc(cert),
      remoteFingerprint: normalizeFingerprint(hostFp),
      secret,
      peerName,
    };
    attempt.pc.ondatachannel = (event) => this.setupDataChannel(event.channel, attempt);
    this.attempts = [attempt];

    try {
      await attempt.pc.setRemoteDescription({ type: entry.bundle.type, sdp: entry.bundle.sdp });
      for (const c of entry.bundle.candidates) await attempt.pc.addIceCandidate(c);
      const answer = await attempt.pc.createAnswer();
      // Force our ICE credentials to the values the host predicted from the
      // shared secret + salt, so its (reply-less) synthesised answer matches.
      const creds = await deriveGuestIceCreds(secret, entry.salt);
      await attempt.pc.setLocalDescription({
        type: "answer",
        sdp: mungeIceCreds(answer.sdp ?? "", creds.ufrag, creds.pwd),
      });
      await this.gatherCandidates(attempt.pc);
      const connected = await this.waitForAdoptOrTimeout(FAST_TIMEOUT_MS);
      if (connected) return true;
    } catch {
      // Any failure just means: give up the fast path, fall back.
    }

    // Fast path did not connect — tear it down so the classic flow starts fresh.
    try {
      attempt.pc.close();
    } catch {
      /* already closed */
    }
    this.attempts = [];
    this.adopted = false;
    return false;
  }

  /** Classic guest flow: answer the host's normal offer, return the reply code. */
  private async normalJoin(cert: RTCCertificate, invite: InvitePayload): Promise<string> {
    const attempt: Attempt = {
      pc: this.newPc(cert),
      remoteFingerprint: normalizeFingerprint(extractFingerprint(invite.normal.sdp)),
      // A new guest remembers this pairing so it can fast-reconnect next time.
      secret: invite.meta?.secret ?? "",
      peerName: invite.meta?.name ?? "",
    };
    attempt.pc.ondatachannel = (event) => this.setupDataChannel(event.channel, attempt);
    this.attempts = [attempt];
    this.watchConnection(attempt.pc);

    await attempt.pc.setRemoteDescription({ type: invite.normal.type, sdp: invite.normal.sdp });
    for (const c of invite.normal.candidates) await attempt.pc.addIceCandidate(c);

    const answer = await attempt.pc.createAnswer();
    const gather = this.gatherCandidates(attempt.pc);
    await attempt.pc.setLocalDescription(answer);
    const candidates = await gather;

    return encodeSignal({
      sdp: attempt.pc.localDescription!.sdp,
      type: attempt.pc.localDescription!.type,
      candidates,
    });
  }

  private newPc(cert: RTCCertificate): RTCPeerConnection {
    // host()/join() await storage (certificate load, invite decode) before any
    // RTCPeerConnection exists. A disconnect() landing in that window must kill
    // the whole handshake — otherwise the flow would carry on over connections
    // the disconnect can no longer see (and, e.g., the pairing UI would show a
    // reply code for a peer that was already torn down).
    if (this.closed) throw new Error("DISCONNECTED");
    return new RTCPeerConnection({ iceServers: [], certificates: [cert] });
  }

  /** Create the data channel + offer for a host attempt and gather candidates. */
  private async buildHostOffer(attempt: Attempt): Promise<SDPBundle> {
    const pc = attempt.pc;
    const dc = pc.createDataChannel("game", { ordered: true });
    this.setupDataChannel(dc, attempt);
    const offer = await pc.createOffer();
    const gather = this.gatherCandidates(pc);
    await pc.setLocalDescription(offer);
    const candidates = await gather;
    return { sdp: pc.localDescription!.sdp, type: pc.localDescription!.type, candidates };
  }

  /**
   * Adopt the first data channel that opens as the live transport, discard the
   * other in-flight attempts, and persist the pairing for next time.
   */
  private adopt(attempt: Attempt, dc: RTCDataChannel): void {
    if (this.adopted || this.closed) return;
    this.adopted = true;
    this.pc = attempt.pc;
    this.dc = dc;
    for (const other of this.attempts) {
      if (other !== attempt) {
        try {
          other.pc.close();
        } catch {
          /* already closed */
        }
      }
    }
    this.attempts = [attempt];
    this.persistPairing(attempt);
    this.emitState("connected");
    this.startHeartbeat();
    this.adoptWaiter?.();
  }

  /** Remember the peer's pinned fingerprint + shared secret for 1-message reconnects. */
  private persistPairing(attempt: Attempt): void {
    if (!attempt.remoteFingerprint || !attempt.secret) return;
    try {
      rememberPeer(attempt.remoteFingerprint, { secret: attempt.secret, name: attempt.peerName });
    } catch {
      // Storage unavailable — the fast path just stays off. Never throws.
    }
  }

  private waitForAdoptOrTimeout(ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.adopted) return resolve(true);
      let done = false;
      const finish = (value: boolean) => {
        if (done) return;
        done = true;
        this.adoptWaiter = null;
        resolve(value);
      };
      this.adoptWaiter = () => finish(true);
      setTimeout(() => finish(false), ms);
    });
  }

  private setupDataChannel(dc: RTCDataChannel, attempt: Attempt) {
    dc.onopen = () => {
      if (this.closed) return;
      this.adopt(attempt, dc);
    };
    dc.onmessage = (event) => {
      if (this.closed || dc !== this.dc) return;
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
      // Only the adopted channel closing means we lost the game link.
      if (dc !== this.dc) return;
      this.stopHeartbeat();
      if (!this.closed) this.emitState("disconnected");
    };
    dc.onerror = () => {
      if (dc === this.dc) this.fail();
    };
  }

  /**
   * Gather ICE candidates until gathering is complete.
   * With no ICE servers on a LAN this resolves almost instantly.
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

      // Safety timeout (candidate gathering is LAN-only and fast).
      const timeoutId = setTimeout(done, GATHER_TIMEOUT_MS);

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
   * Surface ICE-level failures for a primary attempt. Without this, a handshake
   * whose ICE never connects (wrong network, stale code) sits in "connecting"
   * forever. A fast offer that another attempt supersedes must stay silent, so
   * we ignore failures once a *different* attempt has been adopted.
   */
  private watchConnection(pc: RTCPeerConnection) {
    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      if (this.adopted && this.pc !== pc) return; // another attempt won; ignore.
      if (pc.connectionState === "failed") this.fail();
      if (pc.connectionState === "closed" && this.pc === pc) this.emitState("disconnected");
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
    for (const attempt of this.attempts) {
      try {
        attempt.pc.close();
      } catch {
        // Already closed.
      }
    }
    try {
      this.pc?.close();
    } catch {
      // Already closed.
    }
    this.attempts = [];
    this.dc = null;
    this.pc = null;
  }
}
