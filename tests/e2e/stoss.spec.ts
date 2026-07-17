import { Page } from "@playwright/test";
import { Contract, GameType } from "../../src/game/types";
import { getAIStoss } from "../../src/players/aiHeuristics";
import { de, startSolo } from "./helpers/fixtures";
import { findSeed, RoundTrace, Trace } from "./helpers/simulate";
import { performBids } from "./helpers/ui";
import { expect, test } from "./helpers/test";

/**
 * Locate a 4-round solo seed where round 3 is a Stoß-testable scenario:
 *
 * - rounds 1 & 2: p1 says "will", so those rounds never all-pass and consume
 *   exactly one deal each. The dev-skip trajectory (p1 always-will) matches, so
 *   round 3 is dealt from the identical (3rd) shuffle in browser and simulation.
 * - round 3: an AI declares a Sauspiel, p1 passes and is therefore an eligible
 *   defender who does NOT hold the called Ace (partnerId !== p1). By the fixed
 *   dealer rotation p1 sits second in play order, so once the forehand AI has
 *   led, the engine simply waits for p1 — the Stoß window stays open, no race.
 * - no auto-double: the base round is un-Stoßed (multiplier 1) and the AI
 *   declarer would not answer p1's Stoß with a Retour, so the manual Stoß
 *   doubles the round exactly once (x2).
 */
function findStossSeed() {
  return findSeed(
    (trace: Trace) => {
      if (trace.length < 3) return false;
      const [r1, r2, r3] = trace;
      if (!p1Wills(r1) || !p1Wills(r2)) return false;
      if (!r3.contract || r3.contract.type !== GameType.SAUSPIEL) return false;
      if (r3.contract.declarerId === "p1" || r3.contract.partnerId === "p1") return false;
      if (!r3.result || r3.stossMultiplier !== 1) return false;
      // p1 passes round 3 (a single will:false, no declare turn).
      const p1Bids = r3.bids.filter((b) => b.seat === "p1");
      if (p1Bids.length !== 1 || p1Bids[0].kind !== "will" || p1Bids[0].will !== false) return false;
      // p1 is second in the first trick (forehand AI leads, then p1).
      if (r3.plays[0]?.playerId === "p1" || r3.plays[1]?.playerId !== "p1") return false;
      // The AI declarer must not Retour after p1's Stoß, so the round stays x2.
      const declarerHand = r3.hands[r3.contract.declarerId];
      const contract = { type: r3.contract.type, declarerId: r3.contract.declarerId } as Contract;
      if (getAIStoss(declarerHand, contract, "retour")) return false;
      return true;
    },
    { start: 1, limit: 800, totalRounds: 4 },
  );
}

function p1Wills(round: RoundTrace): boolean {
  return round.bids.find((b) => b.seat === "p1" && b.kind === "will")?.will === true;
}

const { seed, trace } = findStossSeed();
const round3 = trace[2];

/** Dev-skip rounds 1 & 2, then drive round 3's bidding until p1 (a defender)
 * has passed and the AI's Sauspiel contract is in play. */
async function reachRound3Defender(page: Page): Promise<void> {
  await startSolo(page, { seed, name: "Toni", rounds: 4 });
  for (let round = 1; round <= 2; round += 1) {
    await expect(page.locator(".game-toolbar")).toContainText(`${round}/4`);
    await page.getByRole("button", { name: de.devSkipRound }).click();
    await expect(page.locator(".round-over-overlay")).toBeVisible();
    await page.getByRole("button", { name: de.ready }).click();
  }
  await expect(page.locator(".game-toolbar")).toContainText("3/4");
  await performBids(page, round3.bids); // p1 passes; the AI seats bid on their own
}

test.describe("Stoß (double)", () => {
  test("an eligible defender may Stoß and it doubles the round", async ({ page }) => {
    await reachRound3Defender(page);

    // The Stoß button appears beneath the local player's name plate.
    const stossButton = page.locator(".player-hand-col-left .player-hand-stoss");
    await expect(stossButton).toBeVisible();
    await expect(stossButton).toHaveText(de.stoss);

    await stossButton.click();

    // Once announced it becomes a static badge and the button is gone.
    await expect(page.locator(".player-hand-stoss.announced")).toHaveText(de.stoss);

    // Finish the round; the contract's plays are the same first-legal / AI
    // trajectory the simulation scored, so the only difference is the x2.
    await page.getByRole("button", { name: de.devSkipRound }).click();
    const overlay = page.locator(".round-over-overlay");
    await expect(overlay).toBeVisible();
    const detail = overlay.locator("p.muted").first();
    await expect(detail).toContainText(de.stoss);
    await expect(detail).toContainText("×2");

    // Every displayed score change is exactly twice the simulated base and the
    // doubled deltas still sum to zero.
    const changeTexts = await overlay.locator(".score-grid span.pos, .score-grid span.neg").allInnerTexts();
    const shown = changeTexts.map((t) => parseInt(t.replace("+", ""), 10)).sort((a, b) => a - b);
    const expected = Object.values(round3.result!.scoreChanges)
      .map((v) => v * 2)
      .sort((a, b) => a - b);
    expect(shown).toEqual(expected);
    expect(shown.reduce((a, b) => a + b, 0)).toBe(0);
  });

  test("disabling the Stoß setting hides the feature", async ({ page }) => {
    // Turn the house rule off in settings (default is on) and confirm it sticks.
    await page.goto("/");
    await page.getByTitle(de.settings).click();
    const group = page.getByRole("group", { name: de.settingsStoss });
    await expect(group.getByRole("button", { name: de.settingsStossPlay })).toHaveAttribute("aria-pressed", "true");
    await group.getByRole("button", { name: de.settingsStossOff }).click();
    await expect(group.getByRole("button", { name: de.settingsStossOff })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(
      page.getByRole("group", { name: de.settingsStoss }).getByRole("button", { name: de.settingsStossOff }),
    ).toHaveAttribute("aria-pressed", "true");

    // In the very same defender scenario, no Stoß control is offered.
    await reachRound3Defender(page);
    await expect(page.locator(".player-hand-container.my-turn")).toBeVisible();
    await expect(page.locator(".player-hand-stoss")).toHaveCount(0);
  });
});
