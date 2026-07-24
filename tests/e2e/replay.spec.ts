import { Page } from "@playwright/test";
import { de, handCards, startSolo } from "./helpers/fixtures";
import { alwaysWillPolicy, findSeed } from "./helpers/simulate";
import { performBids, playCardInTurn } from "./helpers/ui";
import { expect, test } from "./helpers/test";
import { cardFromId } from "../../src/analysis";
import { determineTrickWinner } from "../../src/game/rules";

/**
 * Replay MVP (#85). Round 1 is played by hand so its trajectory matches the
 * simulation exactly (dev-skip races the AI's own will-bids and would not);
 * rounds 2-4 are dev-skipped only to reach LIST_OVER, which is what makes
 * ListRecorder persist the game. The replay of round 1 is then asserted card
 * by card against the simulated play order.
 */
function cleanSeed() {
  return findSeed((tr) => tr.length === 4 && tr.every((r) => r.result !== null), {
    limit: 200,
    totalRounds: 4,
    policy: alwaysWillPolicy,
  });
}

/** Card ids currently lying on the replay felt, in play order. */
async function feltCardIds(page: Page): Promise<string[]> {
  return page.locator(".replay-trick-card").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-card-id") ?? ""),
  );
}

/** On-screen name of a seat in the replay. */
async function seatName(page: Page, playerId: string): Promise<string> {
  return (await page.locator(`.replay-seat[data-player-id="${playerId}"] .replay-seat-name`).innerText()).trim();
}

test.describe("analysis replay", () => {
  test("a recorded round replays card by card", async ({ page }) => {
    const { seed, trace } = cleanSeed();
    const round = trace[0];
    const result = round.result!;
    const plays = round.plays;
    expect(plays).toHaveLength(32);

    await startSolo(page, { seed, name: "Toni", rounds: 4 });
    await performBids(page, round.bids);
    for (const turn of round.turns) await playCardInTurn(page, turn.chosenId);
    await expect(handCards(page)).toHaveCount(0);
    await page.getByRole("button", { name: de.ready }).click();

    // Rounds 2-4 only have to finish so the list gets recorded.
    for (let n = 2; n <= 4; n += 1) {
      await expect(page.locator(".game-toolbar")).toContainText(`${n}/4`);
      await page.getByRole("button", { name: de.devSkipRound }).click();
      await expect(page.locator(".round-over-overlay")).toBeVisible();
      await page.getByRole("button", { name: n < 4 ? de.ready : de.toFinalStandings }).click();
    }
    await expect(page.locator(".round-over-overlay h2")).toContainText(de.listOver);
    await page.locator(".round-over-overlay").getByRole("button", { name: de.quit }).click();
    await expect(page.locator(".home-screen")).toBeVisible();

    // Let the fire-and-forget IndexedDB write settle, then open the analysis view.
    await page.waitForTimeout(1500);
    await page.getByTitle(de.analysis).click();
    await expect(page.locator(".analysis-screen")).toBeVisible();

    // The game list carries the same row shape as the stats screen.
    const gameRow = page.locator(".stats-game-row").first();
    await expect(gameRow).toBeVisible();
    await expect(gameRow.locator(".stats-opponent")).toHaveText(de.statsSoloOpponent);

    // Expanding lists the four recorded rounds, each with a replay button.
    await gameRow.click();
    await expect(page.locator(".analysis-round-row")).toHaveCount(4);
    await page.locator(".analysis-replay-btn").first().click();

    // Step 0: the deal — all four hands open, nothing on the felt.
    await expect(page.locator(".replay-screen")).toBeVisible();
    await expect(page.locator(".replay-seat")).toHaveCount(4);
    await expect(page.locator(".replay-seat-hand .card-face")).toHaveCount(32);
    await expect(page.locator(".replay-trick-card")).toHaveCount(0);
    await expect(page.locator(".replay-step-label")).toHaveText(de.replayDeal);
    // The result of the round is on screen from the start (post-mortem view).
    await expect(page.locator(".replay-chip.result")).toContainText(
      `${result.declarerPoints}:${result.defenderPoints}`,
    );

    const next = page.getByTitle(de.replayNext);

    // First trick, card by card: each step deals exactly the simulated card
    // onto the felt and removes it from its owner's open hand.
    for (let step = 1; step <= 4; step += 1) {
      await next.click();
      await expect(page.locator(".replay-seat-hand .card-face")).toHaveCount(32 - step);
      expect(await feltCardIds(page)).toEqual(plays.slice(0, step).map((play) => play.cardId));
      await expect(page.locator(".replay-step-label")).toHaveText(`${de.replayStep} ${step}/32`);
    }

    // Trick complete: exactly one card is flagged as the winner's, and it is
    // the seat the rules say took the trick.
    const trickWinnerId = determineTrickWinner(
      plays.slice(0, 4).map((play) => ({ playerId: play.playerId, card: cardFromId(play.cardId)! })),
      round.contract!.type,
    );
    const winnerCardId = plays.slice(0, 4).find((play) => play.playerId === trickWinnerId)!.cardId;
    await expect(page.locator(".replay-trick-card.winner")).toHaveCount(1);
    await expect(page.locator(".replay-trick-card.winner")).toHaveAttribute("data-card-id", winnerCardId);
    await expect(page.locator(".replay-table-status")).toContainText(await seatName(page, trickWinnerId));

    // The fifth card starts the next trick — the finished one leaves the felt.
    await next.click();
    expect(await feltCardIds(page)).toEqual([plays[4].cardId]);
    await expect(page.locator(".replay-trick-card.winner")).toHaveCount(0);

    // Stepping back returns to the completed first trick.
    await page.getByTitle(de.replayPrev).click();
    expect(await feltCardIds(page)).toEqual(plays.slice(0, 4).map((play) => play.cardId));

    // Jump to the end: every hand is empty and the last trick lies on the felt.
    await page.getByTitle(de.replayLast).click();
    await expect(page.locator(".replay-seat-hand .card-face")).toHaveCount(0);
    await expect(page.locator(".replay-step-label")).toHaveText(`${de.replayStep} 32/32`);
    expect(await feltCardIds(page)).toEqual(plays.slice(28).map((play) => play.cardId));

    // Every seat is rendered under its recorded id, own seat first.
    expect(await seatName(page, "p1")).toBe("Toni");
    await expect(page.locator(".replay-seat").first()).toHaveAttribute("data-player-id", "p1");

    // Back returns to the game list with the replay closed.
    await page.getByTitle(de.replayBack).click();
    await expect(page.locator(".replay-screen")).toHaveCount(0);
    await expect(page.locator(".analysis-screen")).toBeVisible();
  });
});
