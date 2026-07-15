import { Page } from "@playwright/test";
import { bootHome, de, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/**
 * Isolation note: Playwright's default `page`/`context` fixtures are
 * test-scoped, so each test below already gets a brand-new browser context
 * (and therefore fresh IndexedDB) — no explicit `describe.configure({mode:
 * "serial"})` or manual context plumbing is needed for the empty-state test
 * to stay unpolluted by the game-recording test.
 */

interface Standing {
  name: string;
  score: number;
}

/** Reads every player's name + running total off the currently visible
 * round-over/list-over score grid, in on-screen (sorted) order. */
async function readStandings(page: Page): Promise<Standing[]> {
  const rows = page.locator(".score-grid > div");
  const count = await rows.count();
  const standings: Standing[] = [];
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const name = ((await row.locator("strong").textContent()) ?? "").trim();
    const scoreText = ((await row.locator("span").nth(1).textContent()) ?? "0").trim();
    standings.push({ name, score: Number(scoreText) });
  }
  return standings;
}

/** Same "+N / N" formatting the UI uses for a signed score. */
function formatScore(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

/** Dev-skips every round of a list (bidding + all tricks in one call each)
 * and readies up after each, until the list-over summary is showing. */
async function fastForwardList(page: Page, rounds: number): Promise<void> {
  for (let round = 1; round <= rounds; round++) {
    await page.locator(".dev-round-btn").click();
    await expect(page.locator(".round-over-overlay h2")).toContainText(de.roundOver);
    const isLast = round === rounds;
    await page.getByRole("button", { name: isLast ? de.toFinalStandings : de.ready }).click();
  }
  await expect(page.locator(".round-over-overlay h2")).toContainText(de.listOver);
}

/** Home -> Stats screen text/tile checks re-run loadTotals()/loadGames() by
 * remounting StatsScreen (it only fetches once, on mount), which is how this
 * suite polls for the fire-and-forget IndexedDB write from ListRecorder. */
async function openStats(page: Page): Promise<void> {
  await page.getByTitle(de.home).click();
  await page.getByTitle(de.stats).click();
  await expect(page.locator(".stats-screen")).toBeVisible();
}

async function playedTileText(page: Page): Promise<string> {
  await openStats(page);
  return ((await page.locator(".stat-tiles > div").nth(0).locator("strong").textContent()) ?? "").trim();
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
  });

  test("a finished solo list is recorded and displayed correctly", async ({ page }) => {
    const name = "Wastl";
    await startSolo(page, { seed: 5, rounds: 4, name });

    await fastForwardList(page, 4);

    // Read the ground truth straight from the list-over DOM rather than
    // hardcoding numbers, so this stays robust across seed/AI changes.
    const standings = await readStandings(page);
    const p1 = standings.find((s) => s.name === name);
    expect(p1).toBeDefined();
    const top = Math.max(...standings.map((s) => s.score));
    // ListRecorder.ts: won = (state.scores[localId] === top) — a shared top
    // score counts as a win, matching the trophy shown in ListOverScreen.
    const expectedWon = p1!.score === top;

    // Scoped to the list-over panel — the in-game toolbar also has a
    // same-named quit icon button.
    await page.locator(".round-over-overlay").getByRole("button", { name: de.quit }).click();
    await expect(page.locator(".home-screen")).toBeVisible();

    // Wait a brief moment for the fire-and-forget IndexedDB write to settle, then open Stats.
    await page.waitForTimeout(1500);
    await openStats(page);

    // We're on the stats screen (fresh mount) with the write settled now.
    const tiles = page.locator(".stat-tiles > div strong");
    await expect(tiles.nth(0)).toHaveText("1"); // played
    await expect(tiles.nth(1)).toHaveText(expectedWon ? "1" : "0"); // won
    await expect(tiles.nth(2)).toHaveText(expectedWon ? "0" : "1"); // lost
    await expect(tiles.nth(3)).toHaveText(expectedWon ? "100%" : "0%");

    const rows = page.locator(".stats-game-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator(".stats-score")).toHaveText(formatScore(p1!.score));
    await expect(rows.first().locator(".stats-result")).toHaveText(expectedWon ? "W" : "L");
    await expect(rows.first().locator(".stats-result")).toHaveClass(expectedWon ? /won/ : /lost/);
    await expect(rows.first().locator(".stats-opponent")).toHaveText(de.statsSoloOpponent);

    // Solo filter still shows the game …
    await page.getByRole("tab", { name: de.soloGame }).click();
    await expect(page.locator(".stats-game-row")).toHaveCount(1);

    // … the multiplayer filter shows the empty state.
    await page.getByRole("tab", { name: de.statsMultiplayer }).click();
    await expect(page.locator(".stats-game-row")).toHaveCount(0);
    await expect(page.getByText(de.statsEmpty)).toBeVisible();
  });
});
