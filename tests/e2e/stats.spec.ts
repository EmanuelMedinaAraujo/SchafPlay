import { Page } from "@playwright/test";
import { signed } from "../../src/lib/i18n";
import { bootHome, de, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";
import { quitFinishedList, readStandings, skipRounds } from "./helpers/ui";

/**
 * Playwright's `page`/`context` fixtures are test-scoped, so each test gets a
 * fresh IndexedDB — no serial mode needed to keep the empty-state test clean.
 */

/** Remounting StatsScreen re-runs its one-shot fetch. */
async function openStats(page: Page): Promise<void> {
  await page.getByTitle(de.home).click();
  await page.getByTitle(de.stats).click();
  await expect(page.locator(".stats-screen")).toBeVisible();
}

test.describe("stats", () => {
  test("empty state before any finished game", async ({ page }) => {
    await bootHome(page);
    await openStats(page);

    await expect(page.getByText(de.statsEmpty)).toBeVisible();
    const tiles = page.locator(".stat-tiles > div strong");
    await expect(tiles.nth(0)).toHaveText("0"); // played
    await expect(tiles.nth(1)).toHaveText("0"); // won
    await expect(tiles.nth(2)).toHaveText("0"); // lost
    await expect(tiles.nth(3)).toHaveText("—"); // win rate
    await expect(tiles.nth(4)).toHaveText("0"); // rounds
    await expect(tiles.nth(5)).toHaveText("0"); // points balance

    // No stored games: the analysis panels (trend + contracts) stay hidden.
    await expect(page.locator(".stats-analysis")).toHaveCount(0);
  });

  test("a finished solo list is recorded and displayed correctly", async ({ page }) => {
    const name = "Wastl";
    await startSolo(page, { seed: 5, rounds: 4, name });

    await skipRounds(page, 4);

    // Read from the DOM, not hardcoded, so seed/AI changes can't break it.
    const standings = await readStandings(page);
    const p1 = standings.find((s) => s.name === name);
    expect(p1).toBeDefined();
    const top = Math.max(...standings.map((s) => s.score));
    // ListRecorder.ts: won = (state.scores[localId] === top) — a shared top
    // score counts as a win, matching the trophy shown in ListOverScreen.
    const expectedWon = p1!.score === top;

    await quitFinishedList(page);
    await openStats(page);

    const tiles = page.locator(".stat-tiles > div strong");
    await expect(tiles.nth(0)).toHaveText("1"); // played
    await expect(tiles.nth(1)).toHaveText(expectedWon ? "1" : "0"); // won
    await expect(tiles.nth(2)).toHaveText(expectedWon ? "0" : "1"); // lost
    await expect(tiles.nth(3)).toHaveText(expectedWon ? "100%" : "0%");
    await expect(tiles.nth(4)).toHaveText("4"); // rounds (one 4-round list)
    await expect(tiles.nth(5)).toHaveText(signed(p1!.score)); // points balance

    // With stored games the analysis section shows; a single list is not
    // enough for a trend chart, so the trend panel shows its hint text.
    await expect(page.locator(".stats-analysis")).toBeVisible();
    await expect(page.getByText(de.statsTrendEmpty)).toBeVisible();

    const rows = page.locator(".stats-game-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator(".stats-score")).toHaveText(signed(p1!.score));
    await expect(rows.first().locator(".stats-result")).toHaveText(expectedWon ? "W" : "L");
    await expect(rows.first().locator(".stats-result")).toHaveClass(expectedWon ? /won/ : /lost/);
    await expect(rows.first().locator(".stats-opponent")).toHaveText(de.statsSoloOpponent);

    // Expanding a game reveals its per-round detail (4 recorded rounds).
    await rows.first().click();
    await expect(page.locator(".stats-round-row")).toHaveCount(4);
    await rows.first().click();
    await expect(page.locator(".stats-round-row")).toHaveCount(0);

    // Solo filter still shows the game …
    await page.getByRole("tab", { name: de.soloGame }).click();
    await expect(page.locator(".stats-game-row")).toHaveCount(1);

    // … the multiplayer filter shows the empty state.
    await page.getByRole("tab", { name: de.statsMultiplayer }).click();
    await expect(page.locator(".stats-game-row")).toHaveCount(0);
    await expect(page.getByText(de.statsEmpty)).toBeVisible();
  });
});
