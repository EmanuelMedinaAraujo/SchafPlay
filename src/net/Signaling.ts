/**
 * Out-of-band signaling: opaque codes exchanged between the players to
 * establish a Transport. Copy-paste, QR codes and deep links (#7) are
 * alternative carriers of the same two codes, so neither the Transport nor the
 * sessions know which one was used.
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
