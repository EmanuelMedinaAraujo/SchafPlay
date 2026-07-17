/**
 * Remembered pairings for the 1-message fast reconnect (issue #71).
 *
 * After a first successful pairing each device stores, keyed by the *peer's*
 * DTLS certificate fingerprint (the thing that stays stable now that both sides
 * persist their certificate — see certStore.ts):
 *   - `secret`: a shared random value established by the host on first pairing
 *     and carried to the guest inside the invite. Both sides keep the same
 *     value; it seeds the deterministic ICE credentials used on reconnect.
 *   - `name`:   the peer's display name, best-effort, purely cosmetic.
 *
 * The issue asks for the fingerprint pin to live in localStorage, so the whole
 * record does. It degrades silently exactly like the settings store: if
 * localStorage is unavailable every read returns empty and every write no-ops,
 * which simply keeps the fast path off and leaves the classic 2-message flow
 * untouched.
 *
 * ## Why deterministic ICE credentials?
 *
 * For a true 1-message reconnect the guest must not send a reply, yet the host
 * still needs the guest's live ICE ufrag/pwd to accept its connectivity checks.
 * Those are normally random per session. Instead both sides DERIVE them from the
 * shared `secret` plus a fresh per-session `salt` (carried in the invite):
 * `HMAC-SHA256(secret, salt)`. The guest munges its local answer to use the
 * derived credentials; the host, knowing the same secret and salt, synthesises
 * the guest's answer locally and discovers the guest's address via ICE
 * peer-reflexive candidates. The secret is not a security boundary — DTLS
 * fingerprint pinning is — so carrying it in the first invite is acceptable.
 */

const STORAGE_KEY = "schafplay.knownPeers";

export interface KnownPeer {
  /** Shared secret (base64url) seeding the derived ICE credentials. */
  secret: string;
  /** Peer display name, best-effort/cosmetic. */
  name?: string;
  /** Last time this pairing was seen/refreshed (ISO), for pruning. */
  updatedAt: string;
}

/** Keep the map bounded so a chatty tester never grows localStorage unboundedly. */
const MAX_PEERS = 20;

type PeerMap = Record<string, KnownPeer>;

function read(): PeerMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PeerMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(map: PeerMap): void {
  try {
    // Prune oldest beyond the cap before persisting.
    const entries = Object.entries(map);
    if (entries.length > MAX_PEERS) {
      entries.sort((a, b) => (a[1].updatedAt < b[1].updatedAt ? 1 : -1));
      map = Object.fromEntries(entries.slice(0, MAX_PEERS));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // No persistence — the fast path just stays off. Never throws.
  }
}

/** Normalise a fingerprint to a stable lookup key (upper-case, colon-free). */
export function normalizeFingerprint(fp: string): string {
  return fp.replace(/:/g, "").toUpperCase();
}

export function getKnownPeer(fingerprint: string): KnownPeer | null {
  return read()[normalizeFingerprint(fingerprint)] ?? null;
}

export function rememberPeer(fingerprint: string, record: Omit<KnownPeer, "updatedAt">): void {
  const key = normalizeFingerprint(fingerprint);
  const map = read();
  map[key] = { ...record, updatedAt: new Date().toISOString() };
  write(map);
}

export function forgetPeer(fingerprint: string): void {
  const map = read();
  delete map[normalizeFingerprint(fingerprint)];
  write(map);
}

/** Every remembered pairing, as `[fingerprint, record]` pairs. */
export function listKnownPeers(): Array<[string, KnownPeer]> {
  return Object.entries(read());
}

export function forgetAllPeers(): void {
  write({});
}

// --- crypto helpers ---------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** A fresh shared pairing secret (256 bits, base64url). */
export function newSecret(): string {
  return bytesToBase64Url(randomBytes(32));
}

/** A fresh per-session salt (128 bits, base64url) carried in a fast invite. */
export function newSalt(): string {
  return bytesToBase64Url(randomBytes(16));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IceCreds {
  ufrag: string;
  pwd: string;
}

/**
 * Deterministically derive the guest's ICE credentials from the shared secret
 * and the invite's per-session salt. Both peers run this identically so the
 * host can predict exactly what the (silent) guest will use locally.
 *
 * Output is hex — a subset of the RFC 5245 `ice-char` set — so the values are
 * always valid ufrag/pwd. SHA-256 gives 64 hex chars: an 8-char ufrag (≥4
 * required) and a 32-char pwd (≥22 required), from disjoint halves.
 */
export async function deriveGuestIceCreds(secret: string, salt: string): Promise<IceCreds> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`ice:${salt}`) as unknown as ArrayBuffer,
  );
  const hex = bytesToHex(new Uint8Array(mac));
  return { ufrag: hex.slice(0, 8), pwd: hex.slice(8, 40) };
}
