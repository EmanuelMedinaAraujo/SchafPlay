import { de, handCards, startSolo } from "./helpers/fixtures";
import { alwaysWillPolicy, findSeed } from "./helpers/simulate";
import { performBids, playCardInTurn, readScoreChanges, readStandings, skipRounds } from "./helpers/ui";
import { expect, test } from "./helpers/test";

/** A seed whose full 4-round game (p1 = always-will, first-legal) completes cleanly. */
function cleanSeed() {
  return findSeed((tr) => tr.length === 4 && tr.every((r) => r.result !== null), {
    limit: 200,
    totalRounds: 4,
    policy: alwaysWillPolicy,
  });
}

test.describe("gameplay (solo, 4 rounds)", () => {
  test("a full round is played and scored exactly as simulated", async ({ page }) => {
    const { seed, trace } = cleanSeed();
    const round = trace[0];
    const result = round.result!;
    const p1Cards = round.turns.filter((t) => t.seat === "p1").map((t) => t.chosenId);

    await startSolo(page, { seed, name: "Toni", rounds: 4 });
    await expect(handCards(page)).toHaveCount(8);

    await performBids(page, round.bids);
    for (const id of p1Cards) await playCardInTurn(page, id);
    await expect(handCards(page)).toHaveCount(0);

    // Round summary matches the simulated result.
    const overlay = page.locator(".round-over-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay.locator(".round-headline")).toContainText(result.declarerWon ? de.declarersWin : de.defendersWin);
    await expect(overlay.locator(".round-headline")).toContainText(`${result.declarerPoints}:${result.defenderPoints}`);

    // Per-player score changes: the four deltas match the simulation and sum to 0.
    const shown = await readScoreChanges(page);
    const expected = Object.values(result.scoreChanges).sort((a, b) => a - b);
    expect(shown).toEqual(expected);
    expect(shown.reduce((a, b) => a + b, 0)).toBe(0);

    // Ready up → round 2 deals a fresh hand.
    await page.getByRole("button", { name: de.ready }).click();
    await expect(page.locator(".game-toolbar")).toContainText("2/4");
    await expect(handCards(page)).toHaveCount(8);
  });

  test("the whole list resolves via dev-skip and rematch clears it", async ({ page }) => {
    // dev-skip races the AI seats' 40ms will-bids, so the trajectory is NOT the
    // simulation's — assert internal consistency against the displayed standings.
    await startSolo(page, { seed: 42, name: "Toni", rounds: 4 });
    await skipRounds(page, 4);

    // List summary: the announced winner is the highest displayed standing.
    const standings = await readStandings(page);
    expect(standings).toHaveLength(4);
    const top = standings.reduce((best, standing) => (standing.score > best.score ? standing : best));
    const headline = page.locator(".round-over-overlay .round-headline");
    await expect(headline).toContainText(top.name);
    await expect(headline).toContainText(String(top.score));

    // Rematch resets to round 1 with a fresh deal.
    await page.getByRole("button", { name: de.rematch }).click();
    await expect(page.locator(".game-toolbar")).toContainText("1/4");
    await expect(page.locator(".round-over-overlay")).toHaveCount(0);
    await expect(handCards(page)).toHaveCount(8);
  });
});
