import { expect, test } from "@playwright/test";
import { encodeSignal, decodeSignal, SDPBundle } from "../../src/net/sdpCodec";

test.describe("SDP Codec Round-Trip", () => {
  const originalSDP = [
    "v=0",
    "o=- 83749281374921 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0",
    "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    "a=ice-ufrag:testufrag123",
    "a=ice-pwd:testpwd1234567890abcdefghijklmnop",
    "a=ice-options:trickle",
    "a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF",
    "a=setup:active",
    "a=mid:0",
    "a=sctp-port:6000",
    "a=max-message-size:131072"
  ].join("\r\n") + "\r\n";

  const originalCandidates = [
    {
      candidate: "candidate:4 1 udp 2122260223 192.168.1.10 54321 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "testufrag123"
    },
    {
      candidate: "candidate:8 1 tcp 1686052607 93.184.216.34 80 typ srflx raddr 192.168.1.10 rport 54321 tcptype active",
      sdpMid: "0",
      sdpMLineIndex: 0,
      usernameFragment: "testufrag123"
    }
  ];

  const originalBundle: SDPBundle = {
    sdp: originalSDP,
    type: "answer",
    candidates: originalCandidates
  };

  test("preserves all key SDP and candidate fields", async () => {
    const code = await encodeSignal(originalBundle);
    const decompressed = await decodeSignal(code);

    // Verify key SDP properties
    expect(decompressed.type).toBe(originalBundle.type);
    expect(decompressed.sdp).toContain("a=ice-ufrag:testufrag123");
    expect(decompressed.sdp).toContain("a=ice-pwd:testpwd1234567890abcdefghijklmnop");
    expect(decompressed.sdp).toContain("a=setup:active");
    expect(decompressed.sdp).toContain("a=mid:0");
    expect(decompressed.sdp).toContain("a=sctp-port:6000");
    expect(decompressed.sdp).toContain("a=max-message-size:131072");
    expect(decompressed.sdp).toContain(
      "a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99:00:AA:BB:CC:DD:EE:FF"
    );

    // Verify candidates
    expect(decompressed.candidates).toHaveLength(originalCandidates.length);
    expect(decompressed.candidates[0].candidate!.toLowerCase()).toBe(
      originalCandidates[0].candidate.toLowerCase()
    );
    expect(decompressed.candidates[1].candidate!.toLowerCase()).toBe(
      originalCandidates[1].candidate.toLowerCase()
    );
  });

  test("is character-for-character identical on a second round-trip", async () => {
    const firstCode = await encodeSignal(originalBundle);
    const firstDecompressed = await decodeSignal(firstCode);

    const secondCode = await encodeSignal(firstDecompressed);
    const secondDecompressed = await decodeSignal(secondCode);

    expect(secondDecompressed.type).toBe(firstDecompressed.type);
    expect(secondDecompressed.sdp).toBe(firstDecompressed.sdp);
    expect(secondDecompressed.candidates).toEqual(firstDecompressed.candidates);
  });

  test("rejects malformed or invalid version codes cleanly", async () => {
    await expect(decodeSignal("SP1invalidpayload")).rejects.toThrow("INVALID_CODE");
    await expect(decodeSignal("OLD1abcde")).rejects.toThrow("INVALID_CODE");
  });
});
