import { Page } from "@playwright/test";
import { de, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/**
 * Analysis view + round replay (#85).
 *
 * The replay reads exclusively from the stored `RoundRecord`, so this spec
 * plays a real seeded list to completion first (dev-skip drives the same
 * engine, so the trick log it records is a genuine one), then drives the
 * replay purely through the UI. Numbers are read off the DOM rather than
 * hardcoded, so a seed/AI change can't break it.
 */

/** Dev-skips every round of a list and readies up, until list-over shows. */
async function fastForwardList(page: Page, rounds: number): Promise<void> {
  for (let round = 1; round <= rounds; round++) {
    await page.locator(".dev-round-btn").click();
    await expect(page.locator(".round-over-overlay h2")).toContainText(de.roundOver);
    const isLast = round === rounds;
    await page.getByRole("button", { name: isLast ? de.toFinalStandings : de.ready }).click();
  }
  await expect(page.locator(".round-over-overlay h2")).toContainText(de.listOver);
}

test.describe("analysis replay", () => {
  test("empty state before any finished game", async ({ page }) => {
    await page.goto("/");
    await page.getByTitle(de.analysis).click();
    await expect(page.locator(".analysis-screen")).toBeVisible();
    await expect(page.getByText(de.analysisEmpty)).toBeVisible();
    await expect(page.locator(".stats-game-row")).toHaveCount(0);
  });

  test("a recorded round replays trick by trick with all four hands face-up", async ({ page }) => {
    await startSolo(page, { seed: 5, rounds: 4, name: "Wastl" });
    await fastForwardList(page, 4);

    await page.locator(".round-over-overlay").getByRole("button", { name: de.quit }).click();
    await expect(page.locator(".home-screen")).toBeVisible();
    // The IndexedDB write from ListRecorder is fire-and-forget.
    await page.waitForTimeout(1500);

    await page.getByTitle(de.analysis).click();
    await expect(page.locator(".analysis-screen")).toBeVisible();

    const rows = page.locator(".stats-game-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator(".stats-opponent")).toHaveText(de.statsSoloOpponent);

    // The collapsed row offers the whole list in one click; expanding swaps
    // that for the per-round buttons.
    await expect(page.locator(".analysis-play-game")).toHaveCount(1);
    await rows.first().click();
    await expect(page.locator(".analysis-round-row")).toHaveCount(4);
    await expect(page.locator(".analysis-play-game")).toHaveCount(0);

    await page.locator(".analysis-round-row .analysis-replay-button").first().click();
    await expect(page.locator(".replay-screen")).toBeVisible();
    // The replay runs chrome-free: App drops the topbar for it.
    await expect(page.locator(".topbar")).toHaveCount(0);

    // Step 0: four seats, every hand complete, nothing on the felt.
    const seats = page.locator(".replay-seat");
    await expect(seats).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(seats.nth(i).locator(".replay-hand-card")).toHaveCount(8);
    }
    await expect(page.locator(".replay-trick-card")).toHaveCount(0);
    await expect(page.locator(".replay-progress")).toContainText(`${de.trick} 1/8`);
    await expect(page.getByRole("button", { name: de.replayPrev, exact: true })).toBeDisabled();

    // Each click plays exactly one card: it leaves a hand and hits the felt.
    const next = page.getByRole("button", { name: de.replayNext, exact: true });
    for (let card = 1; card <= 4; card++) {
      await next.click();
      await expect(page.locator(".replay-trick-card")).toHaveCount(card);
      await expect(page.locator(".replay-hand-card")).toHaveCount(32 - card);
      await expect(page.locator(".replay-progress")).toContainText(`${de.replayCard} ${card}/4`);
    }

    // The completed trick names its winner and stays on the table one step.
    await expect(page.locator(".replay-trick-slot.winner")).toHaveCount(1);

    // The winner's banked points appear once the next card is played.
    await next.click();
    await expect(page.locator(".replay-progress")).toContainText(`${de.trick} 2/8`);
    const banked = await page.locator(".replay-seat-points").allTextContents();
    expect(banked.some((text) => !text.startsWith("0 "))).toBe(true);

    // Jump to the end: every card played, the stored result on screen.
    await page.getByTitle(de.replayEnd).click();
    await expect(page.locator(".replay-hand-card")).toHaveCount(0);
    await expect(page.locator(".replay-progress")).toContainText(`${de.trick} 8/8`);
    await expect(page.locator(".replay-result")).toBeVisible();

    // Rewinding restores the full deal — the derivation is pure, not stateful.
    await page.getByTitle(de.replayStart).click();
    await expect(page.locator(".replay-hand-card")).toHaveCount(32);
    await expect(page.locator(".replay-trick-card")).toHaveCount(0);
    await expect(page.locator(".replay-result")).toHaveCount(0);

    // Back returns to the round list with the game still expanded.
    await page.getByRole("button", { name: de.replayBack, exact: true }).click();
    await expect(page.locator(".analysis-screen")).toBeVisible();
    await expect(page.locator(".stats-game-row")).toHaveCount(1);
  });

  test("playback runs across round borders through the whole list", async ({ page }) => {
    await startSolo(page, { seed: 5, rounds: 4, name: "Wastl" });
    await fastForwardList(page, 4);
    await page.locator(".round-over-overlay").getByRole("button", { name: de.quit }).click();
    await expect(page.locator(".home-screen")).toBeVisible();
    await page.waitForTimeout(1500);

    await page.getByTitle(de.analysis).click();
    await page.locator(".analysis-play-game").first().click();
    await expect(page.locator(".replay-screen")).toBeVisible();

    const primary = page.locator(".replay-controls .primary-button");
    const roundChip = page.locator(".replay-chip.round");
    await expect(roundChip).toHaveText(`${de.round} 1/4`);

    // At a round's last card the primary action rolls into the next round.
    await page.getByTitle(de.replayEnd).click();
    await expect(primary).toContainText(de.replayNextRound);
    await primary.click();
    await expect(roundChip).toHaveText(`${de.round} 2/4`);
    // A fresh deal: all 32 cards back in hands, nothing on the felt.
    await expect(page.locator(".replay-hand-card")).toHaveCount(32);
    await expect(page.locator(".replay-trick-card")).toHaveCount(0);

    // Stepping back from a deal returns to the previous round's last card.
    await page.getByRole("button", { name: de.replayPrev, exact: true }).click();
    await expect(roundChip).toHaveText(`${de.round} 1/4`);
    await expect(page.locator(".replay-hand-card")).toHaveCount(0);

    // The round arrows jump a whole round at a time, up to the last one.
    await page.getByTitle(de.replayNextRound).click();
    await page.getByTitle(de.replayNextRound).click();
    await page.getByTitle(de.replayNextRound).click();
    await expect(roundChip).toHaveText(`${de.round} 4/4`);
    await expect(page.getByTitle(de.replayNextRound)).toBeDisabled();

    // End of the last round is the end of the list — nothing left to advance.
    await page.getByTitle(de.replayEnd).click();
    await expect(primary).toBeDisabled();
  });
});
