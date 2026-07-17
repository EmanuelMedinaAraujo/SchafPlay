/**
 * Out-of-band signaling: opaque codes exchanged between the players to
 * establish a Transport. Copy-paste today; deep links, QR scanning or
 * clipboard auto-detect (issue #7) become alternative carriers of the same
 * two codes without touching the Transport or the sessions.
 */
/** Optional host-side hints carried into the invite (issue #71). */
export interface HostOptions {
  /** This device's display name, embedded so a new guest can label the saved pairing. */
  localName?: string;
}

export interface HostSignaling {
  /** Create an offer; resolves to the invite code to hand to the guest. */
  host(opts?: HostOptions): Promise<string>;
  /** Complete the handshake with the guest's reply code. */
  acceptAnswer(replyCode: string): Promise<void>;
}

export interface GuestSignaling {
  /**
   * Accept an invite code. Resolves to the reply code to hand back to the host,
   * or to `""` when a 1-message fast reconnect (issue #71) connected directly
   * and no reply is needed.
   */
  join(inviteCode: string): Promise<string>;
}
