import { de, handCards, startSolo } from "./helpers/fixtures";
import { alwaysWillPolicy, findSeed } from "./helpers/simulate";
import { performBids, playCardInTurn } from "./helpers/ui";
import { expect, test } from "./helpers/test";

/** A seed whose full 4-round game (p1 = always-will, first-legal) completes
 * cleanly — the same trajectory the browser's DEV "skip round" produces. */
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
    const changeTexts = await overlay.locator(".score-grid span.pos, .score-grid span.neg").allInnerTexts();
    const shown = changeTexts.map((t) => parseInt(t.replace("+", ""), 10)).sort((a, b) => a - b);
    const expected = Object.values(result.scoreChanges).sort((a, b) => a - b);
    expect(shown).toEqual(expected);
    expect(shown.reduce((a, b) => a + b, 0)).toBe(0);

    // Ready up → round 2 deals a fresh hand.
    await page.getByRole("button", { name: de.ready }).click();
    await expect(page.locator(".game-toolbar")).toContainText("2/4");
    await expect(handCards(page)).toHaveCount(8);
  });

  test("the whole list resolves via dev-skip and rematch clears it", async ({ page }) => {
    // dev-skip races the AI seats' own 40ms will-bids (whoever already bid
    // keeps their bid), so the exact trajectory is NOT the simulation's —
    // the list summary is asserted for internal consistency against the
    // standings the UI itself displays, not against predicted totals.
    await startSolo(page, { seed: 42, name: "Toni", rounds: 4 });

    for (let round = 1; round <= 4; round += 1) {
      await expect(page.locator(".game-toolbar")).toContainText(`${round}/4`);
      await page.getByRole("button", { name: de.devSkipRound }).click();
      await expect(page.locator(".round-over-overlay")).toBeVisible();
      await page.getByRole("button", { name: round < 4 ? de.ready : de.toFinalStandings }).click();
    }

    // List summary: the announced winner is the highest displayed standing.
    const overlay = page.locator(".round-over-overlay");
    await expect(overlay.locator("h2")).toContainText(de.listOver);

    const rows = overlay.locator(".score-grid > div");
    await expect(rows).toHaveCount(4);
    let maxScore = -Infinity;
    let maxName = "";
    for (let i = 0; i < 4; i += 1) {
      const name = await rows.nth(i).locator("strong").innerText();
      const spans = await rows.nth(i).locator("span").allInnerTexts();
      const value = parseInt(spans[spans.length - 1].replace("+", ""), 10);
      if (value > maxScore) {
        maxScore = value;
        maxName = name;
      }
    }
    await expect(overlay.locator(".round-headline")).toContainText(maxName);
    await expect(overlay.locator(".round-headline")).toContainText(String(maxScore));

    // Rematch resets to round 1 with a fresh deal.
    await page.getByRole("button", { name: de.rematch }).click();
    await expect(page.locator(".game-toolbar")).toContainText("1/4");
    await expect(page.locator(".round-over-overlay")).toHaveCount(0);
    await expect(handCards(page)).toHaveCount(8);
  });
});
