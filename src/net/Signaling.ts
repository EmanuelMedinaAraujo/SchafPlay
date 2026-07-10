/**
 * Out-of-band signaling: opaque codes exchanged between the players to
 * establish a Transport. Copy-paste today; deep links, QR scanning or
 * clipboard auto-detect (issue #7) become alternative carriers of the same
 * two codes without touching the Transport or the sessions.
 */
export interface HostSignaling {
  /** Create an offer; resolves to the invite code to hand to the guest. */
  host(): Promise<string>;
  /** Complete the handshake with the guest's reply code. */
  acceptAnswer(replyCode: string): Promise<void>;
}

export interface GuestSignaling {
  /** Accept an invite code; resolves to the reply code to hand back to the host. */
  join(inviteCode: string): Promise<string>;
}
