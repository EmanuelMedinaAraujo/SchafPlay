/**
 * Compact, URL-safe encoding for signaling bundles.
 *
 * ## Why not "compress twice"?
 *
 * The obvious idea (issue #33) is to run the code through deflate a second
 * time. That cannot help: deflate output is already near-maximal-entropy, so a
 * second pass only adds framing overhead and usually grows the blob. The win
 * has to come from feeding the compressor *less* data in the first place.
 *
 * ## What we do instead: minify the SDP before compressing.
 *
 * A browser offer/answer for a single data channel is ~600-800 characters, but
 * almost all of it is fixed boilerplate that we can regenerate deterministically
 * (`v=0`, the `m=application … webrtc-datachannel` line, `c=`, `t=`, …). The only
 * per-session entropy is: ice-ufrag, ice-pwd, the DTLS fingerprint, the setup
 * role, a handful of numeric shape fields, and the ICE candidates.
 *
 * So we extract just those fields into a positional array (no JSON keys), store
 * the fingerprint as raw bytes instead of colon-separated hex, then deflate +
 * base64url as before. On decode we rebuild a canonical SDP that
 * `setRemoteDescription` accepts for a single UDP/DTLS/SCTP data-channel
 * m-section. Both players run this same PWA and update together, so the rebuilt
 * SDP only has to be valid — it need not byte-match the browser's original.
 *
 * The encoded string carries a short version prefix (`SP1`) so future format
 * changes are detectable and codes from an old version fail with a clear
 * `INVALID_CODE` error instead of a JSON-parse crash.
 *
 * Exported on its own so future pairing carriers (deep links, QR codes —
 * issue #7) can reuse the exact same code format.
 */

/** Current on-the-wire format version prefix. Bump on any layout change. */
const CODE_PREFIX = "SP1";

export interface SDPBundle {
  sdp: string;
  type: RTCSdpType;
  candidates: RTCIceCandidateInit[];
}

// --- low-level deflate + base64url -----------------------------------------

async function deflateToBase64Url(bytes: Uint8Array): Promise<string> {
  const cs = new CompressionStream("deflate");
  const compressed = new Blob([bytes as any]).stream().pipeThrough(cs);
  const buf = await new Response(compressed).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(buf));
}

async function inflateFromBase64Url(b64url: string): Promise<Uint8Array> {
  const raw = base64UrlToBytes(b64url);
  const ds = new DecompressionStream("deflate");
  const decompressed = new Blob([raw as any]).stream().pipeThrough(ds);
  const buf = await new Response(decompressed).arrayBuffer();
  return new Uint8Array(buf);
}

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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bytesToHexColon(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

// --- SDP field extraction ---------------------------------------------------

// Fingerprint hash algorithms, indexed by the code we store.
const FP_ALGOS = ["sha-256", "sha-1", "sha-384", "sha-512"] as const;
const SETUP_ROLES = ["actpass", "active", "passive", "holdconn"] as const;
const CAND_TYPES = ["host", "srflx", "prflx", "relay"] as const;

function firstMatch(sdp: string, re: RegExp): string {
  const m = sdp.match(re);
  return m ? m[1] : "";
}

interface MinCandidate {
  foundation: string;
  component: number;
  protocol: string; // "udp" | "tcp"
  priority: number;
  ip: string;
  port: number;
  type: string; // host | srflx | prflx | relay
  tcptype?: string;
  raddr?: string;
  rport?: number;
}

function parseCandidate(candidate: string): MinCandidate | null {
  // "candidate:<foundation> <component> <proto> <priority> <ip> <port> typ <type> [ ... ]"
  const body = candidate.replace(/^(a=)?candidate:/, "").trim();
  const parts = body.split(/\s+/);
  if (parts.length < 8 || parts[6] !== "typ") return null;
  const cand: MinCandidate = {
    foundation: parts[0],
    component: Number(parts[1]),
    protocol: parts[2].toLowerCase(),
    priority: Number(parts[3]),
    ip: parts[4],
    port: Number(parts[5]),
    type: parts[7],
  };
  // Preserve the extension tokens we actually need to reconstruct a valid line.
  for (let i = 8; i + 1 < parts.length; i += 2) {
    const key = parts[i];
    const val = parts[i + 1];
    if (key === "tcptype") cand.tcptype = val;
    else if (key === "raddr") cand.raddr = val;
    else if (key === "rport") cand.rport = Number(val);
  }
  return cand;
}

function candidateToTuple(c: MinCandidate): (string | number)[] {
  // [foundation, component, proto(0=udp,1=tcp), priority, ip, port, typeIdx, ...ext]
  const protoCode = c.protocol === "tcp" ? 1 : 0;
  const typeIdx = CAND_TYPES.indexOf(c.type as (typeof CAND_TYPES)[number]);
  const tuple: (string | number)[] = [
    c.foundation,
    c.component,
    protoCode,
    c.priority,
    c.ip,
    c.port,
    typeIdx < 0 ? c.type : typeIdx,
  ];
  // Only non-host candidates need raddr/rport; TCP needs tcptype.
  if (c.tcptype) tuple.push("tt", c.tcptype);
  if (c.raddr) tuple.push("ra", c.raddr);
  if (c.rport !== undefined) tuple.push("rp", c.rport);
  return tuple;
}

function tupleToCandidate(tuple: (string | number)[]): MinCandidate {
  const [foundation, component, protoCode, priority, ip, port, typeIdx, ...ext] = tuple;
  const c: MinCandidate = {
    foundation: String(foundation),
    component: Number(component),
    protocol: protoCode === 1 ? "tcp" : "udp",
    priority: Number(priority),
    ip: String(ip),
    port: Number(port),
    type: typeof typeIdx === "number" ? CAND_TYPES[typeIdx] ?? "host" : String(typeIdx),
  };
  for (let i = 0; i + 1 < ext.length; i += 2) {
    const key = ext[i];
    const val = ext[i + 1];
    if (key === "tt") c.tcptype = String(val);
    else if (key === "ra") c.raddr = String(val);
    else if (key === "rp") c.rport = Number(val);
  }
  return c;
}

function candidateToString(c: MinCandidate): string {
  let s = `candidate:${c.foundation} ${c.component} ${c.protocol} ${c.priority} ${c.ip} ${c.port} typ ${c.type}`;
  if (c.type !== "host" && c.raddr) s += ` raddr ${c.raddr} rport ${c.rport ?? 0}`;
  if (c.protocol === "tcp" && c.tcptype) s += ` tcptype ${c.tcptype}`;
  return s;
}

// --- bundle <-> minified positional array -----------------------------------

type MinBundle = [
  ufrag: string,
  pwd: string,
  fpAlgo: number,
  fpBytes: string, // base64url of the raw fingerprint bytes
  setup: number,
  mid: string,
  sctpPort: number,
  maxMessageSize: number,
  isAnswer: 0 | 1,
  candidates: (string | number)[][],
];

function minifyBundle(bundle: SDPBundle): MinBundle {
  const { sdp } = bundle;
  const ufrag = firstMatch(sdp, /a=ice-ufrag:(\S+)/);
  const pwd = firstMatch(sdp, /a=ice-pwd:(\S+)/);
  const fpLine = firstMatch(sdp, /a=fingerprint:(\S+ [0-9A-Fa-f:]+)/);
  const [fpAlgoRaw, fpHex] = fpLine.split(/\s+/);
  const setup = firstMatch(sdp, /a=setup:(\S+)/);
  const mid = firstMatch(sdp, /a=mid:(\S+)/) || "0";
  const sctpPort = Number(firstMatch(sdp, /a=sctp-port:(\d+)/)) || 5000;
  const maxMessageSize = Number(firstMatch(sdp, /a=max-message-size:(\d+)/)) || 262144;

  const fpAlgo = Math.max(0, FP_ALGOS.indexOf(fpAlgoRaw as (typeof FP_ALGOS)[number]));
  const setupCode = Math.max(0, SETUP_ROLES.indexOf(setup as (typeof SETUP_ROLES)[number]));

  const cands = bundle.candidates
    .map((c) => (c.candidate ? parseCandidate(c.candidate) : null))
    .filter((c): c is MinCandidate => c !== null)
    .map(candidateToTuple);

  return [
    ufrag,
    pwd,
    fpAlgo,
    bytesToBase64Url(hexToBytes(fpHex ?? "")),
    setupCode,
    mid,
    sctpPort,
    maxMessageSize,
    bundle.type === "answer" ? 1 : 0,
    cands,
  ];
}

// A fixed session origin — the value is irrelevant to setRemoteDescription for a
// single one-shot negotiation, so we regenerate a constant rather than store it.
const SDP_ORIGIN = "o=- 1 2 IN IP4 127.0.0.1";

function reconstructBundle(min: MinBundle): SDPBundle {
  const [ufrag, pwd, fpAlgo, fpB64, setup, mid, sctpPort, maxMessageSize, isAnswer, candTuples] =
    min;

  const fpAlgoName = FP_ALGOS[fpAlgo] ?? "sha-256";
  const fpHex = bytesToHexColon(base64UrlToBytes(fpB64));
  const setupRole = SETUP_ROLES[setup] ?? "actpass";

  const lines = [
    "v=0",
    SDP_ORIGIN,
    "s=-",
    "t=0 0",
    `a=group:BUNDLE ${mid}`,
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    "a=ice-options:trickle",
    `a=fingerprint:${fpAlgoName} ${fpHex}`,
    `a=setup:${setupRole}`,
    `a=mid:${mid}`,
    `a=sctp-port:${sctpPort}`,
    `a=max-message-size:${maxMessageSize}`,
  ];
  const sdp = lines.join("\r\n") + "\r\n";

  const candidates: RTCIceCandidateInit[] = candTuples.map((tuple) => ({
    candidate: candidateToString(tupleToCandidate(tuple)),
    sdpMid: mid,
    sdpMLineIndex: 0,
    usernameFragment: ufrag,
  }));

  return {
    sdp,
    type: isAnswer ? "answer" : "offer",
    candidates,
  };
}

// --- public API -------------------------------------------------------------

/** Minify + compress a signaling bundle into a short, paste-safe code. */
export async function encodeSignal(bundle: SDPBundle): Promise<string> {
  const json = JSON.stringify(minifyBundle(bundle));
  const payload = await deflateToBase64Url(new TextEncoder().encode(json));
  return CODE_PREFIX + payload;
}

/**
 * Decode a code produced by {@link encodeSignal} back into a full SDP bundle.
 * Throws `Error("INVALID_CODE")` on a malformed code or one from an
 * incompatible (older) version — the pairing UI surfaces this as "invalid code".
 */
export async function decodeSignal(code: string): Promise<SDPBundle> {
  // Codes travel through messengers/clipboards that inject line breaks, spaces
  // or invisible characters — strip everything that can't be part of the code.
  const cleaned = code.replace(/[^A-Za-z0-9_-]/g, "");
  if (!cleaned.startsWith(CODE_PREFIX)) throw new Error("INVALID_CODE");
  const payload = cleaned.slice(CODE_PREFIX.length);
  try {
    const bytes = await inflateFromBase64Url(payload);
    const min = JSON.parse(new TextDecoder().decode(bytes)) as MinBundle;
    if (!Array.isArray(min) || min.length < 10) throw new Error("INVALID_CODE");
    return reconstructBundle(min);
  } catch {
    throw new Error("INVALID_CODE");
  }
}
