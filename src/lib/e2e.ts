import { Card } from "../game/types";
import { seededShuffle } from "./seededShuffle";

/**
 * E2E test hooks — dev builds only, and only when the page URL carries
 * `?e2e-seed=<integer>`. The Playwright suite (tests/e2e/) boots the app with
 * that parameter to get a deterministic deal (seeded shuffle, mirrored by the
 * test-side simulation helper) and fast AI/trick pacing so scripted games run
 * in seconds. Production builds compile `import.meta.env.DEV` to false, so
 * this whole hook is dead code there and the tree stays untouched.
 */
export interface E2EEngineOverrides {
  aiDelayMs: number;
  trickHoldMs: number;
  shuffleFn: (deck: Card[]) => Card[];
}

/** Pacing the E2E suite runs at; mirrored in tests/e2e/helpers/simulate.ts. */
export const E2E_AI_DELAY_MS = 40;
export const E2E_TRICK_HOLD_MS = 120;

export function getE2EOverrides(): E2EEngineOverrides | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get("e2e-seed");
  if (raw === null) return null;
  const seed = Number(raw);
  if (!Number.isInteger(seed)) return null;
  return {
    aiDelayMs: E2E_AI_DELAY_MS,
    trickHoldMs: E2E_TRICK_HOLD_MS,
    shuffleFn: seededShuffle(seed),
  };
}
