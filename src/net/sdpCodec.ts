/**
 * Compact, URL-safe encoding for signaling bundles: JSON → deflate →
 * base64url. Exported on its own so future pairing carriers (deep links,
 * QR codes — issue #7) can reuse the exact same code format.
 */

export async function compressSDP(obj: object): Promise<string> {
  const json = JSON.stringify(obj);
  const input = new Blob([json]);
  const cs = new CompressionStream("deflate");
  const compressed = input.stream().pipeThrough(cs);
  const buf = await new Response(compressed).arrayBuffer();
  // base64url (no padding) so the blob is safe to paste anywhere.
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function decompressSDP<T>(encoded: string): Promise<T> {
  // Codes travel through messengers/clipboards that like to inject line
  // breaks, spaces or invisible characters — strip everything that can't
  // be part of a base64url string before decoding.
  const cleaned = encoded.replace(/[^A-Za-z0-9_-]/g, "");
  // Undo base64url → standard base64
  let b64 = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const input = new Blob([raw]);
  const ds = new DecompressionStream("deflate");
  const decompressed = input.stream().pipeThrough(ds);
  const text = await new Response(decompressed).text();
  return JSON.parse(text) as T;
}
