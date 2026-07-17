/**
 * Persistent local WebRTC identity (issue #71).
 *
 * A fresh `RTCPeerConnection` mints a throwaway DTLS certificate every session,
 * so the device's DTLS fingerprint changes on every pairing — which makes it
 * impossible for a returning peer to recognise us in advance. To enable the
 * 1-message fast reconnect, we generate ONE ECDSA P-256 certificate, persist it
 * in IndexedDB (an `RTCCertificate` is structured-cloneable, so it stores
 * as-is) and reuse it across sessions. Our fingerprint then stays stable and a
 * peer that saw it once can pin it.
 *
 * Lives in its own IndexedDB database (`schafplay-net`), independent of the
 * game-history DB (`schafplay`): a single IndexedDB name can only be open at
 * one version, so keeping identity separate avoids coupling its schema to the
 * `DB_VERSION` of the stats store.
 *
 * Silent degradation is mandatory (same contract as the rest of persistence):
 * if IndexedDB is unavailable, or the stored cert is expired, we transparently
 * mint a fresh (possibly ephemeral) certificate. Pairing then still works
 * exactly as before — only the fast path is unavailable until a cert sticks.
 */

import { openDB, promisifyRequest, txDone } from "../persistence/idb";

const DB_NAME = "schafplay-net";
const DB_VERSION = 1;
const STORE = "identity";
const CERT_KEY = "local-cert";

/**
 * Regenerate a bit before the certificate actually expires so a long-lived
 * install never hands out a cert that lapses mid-handshake. RTCCertificates
 * default to ~30 days; we roll over with a day to spare.
 */
const EXPIRY_SAFETY_MS = 24 * 60 * 60 * 1000;

const CERT_ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };

let cached: Promise<RTCCertificate> | null = null;

function dbHandle(): Promise<IDBDatabase> {
  return openDB(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
  });
}

async function readStored(): Promise<RTCCertificate | null> {
  try {
    const db = await dbHandle();
    const tx = db.transaction(STORE, "readonly");
    const cert = await promisifyRequest(
      tx.objectStore(STORE).get(CERT_KEY) as IDBRequest<RTCCertificate | undefined>,
    );
    if (!cert) return null;
    // A cert past (or about to reach) its expiry is useless — force a rollover.
    if (typeof cert.expires === "number" && cert.expires <= Date.now() + EXPIRY_SAFETY_MS) {
      return null;
    }
    return cert;
  } catch {
    return null;
  }
}

async function writeStored(cert: RTCCertificate): Promise<void> {
  try {
    const db = await dbHandle();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(cert, CERT_KEY);
    await txDone(tx);
  } catch {
    // Storage unavailable — the cert is still usable this session, it just
    // won't survive a reload. The fast path silently stays off until it sticks.
  }
}

async function generate(): Promise<RTCCertificate> {
  return RTCPeerConnection.generateCertificate(CERT_ALGORITHM);
}

/**
 * Resolve the device's persistent WebRTC certificate: reuse the stored one when
 * present and still valid, otherwise mint a fresh cert and persist it. The
 * result is memoised for the session so every RTCPeerConnection this device
 * builds shares one stable DTLS fingerprint.
 */
export function loadOrCreateCertificate(): Promise<RTCCertificate> {
  if (!cached) {
    cached = (async () => {
      const stored = await readStored();
      if (stored) return stored;
      const fresh = await generate();
      await writeStored(fresh);
      return fresh;
    })().catch(async (err) => {
      // Never let a storage hiccup break pairing: fall back to an ephemeral cert.
      cached = null;
      try {
        return await generate();
      } catch {
        throw err;
      }
    });
  }
  return cached;
}

/** Test/reset seam: drop the memoised cert so the next call re-reads storage. */
export function resetCertCache(): void {
  cached = null;
}
