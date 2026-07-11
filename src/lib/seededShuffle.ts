import { Card } from "../game/types";

/**
 * Deterministic PRNG (mulberry32) + Fisher-Yates shuffle, used by the E2E
 * test hooks (`lib/e2e.ts`) instead of the Math.random shuffle in
 * `game/deck.ts`. Kept in its own dependency-free module so the Playwright
 * helpers can import the *identical* implementation to precompute deals in
 * Node — this file must stay free of `import.meta` and other Vite-only APIs.
 *
 * The returned shuffle advances one shared RNG stream across calls, so
 * successive deals (round 2, redeals) differ from round 1 but are still
 * fully determined by the seed.
 */
export function seededShuffle(seed: number): (deck: Card[]) => Card[] {
  const rand = mulberry32(seed);
  return (deck: Card[]) => {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
