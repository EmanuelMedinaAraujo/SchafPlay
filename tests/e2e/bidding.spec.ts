import { test, expect } from "@playwright/test";
import { simulateMultiplayer } from "./helpers/simulate";

/**
 * Engine-only, like sdpCodec.spec.ts: no browser needed. `findSeed` skips any
 * seed whose simulation throws, so a stall in the engine would never surface
 * in the browser specs — this sweep is what catches one.
 */
test.describe("bidding (engine)", () => {
  test("every seeded multiplayer list plays to the end", () => {
    // Seeds 85, 131, 180, 230 and 360 used to hang: after a retreat from the
    // middle of the declaring order, the turn went back to the high bidder.
    for (let seed = 1; seed <= 400; seed += 1) {
      expect(() => simulateMultiplayer(seed, { totalRounds: 8 }), `seed ${seed}`).not.toThrow();
    }
  });
});
