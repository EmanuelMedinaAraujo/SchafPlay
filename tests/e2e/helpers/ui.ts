import { Page } from "@playwright/test";
import { expect } from "./test";
import { de, handCard } from "./fixtures";
import { gameLabel } from "../../../src/lib/i18n";
import { HumanBid } from "./simulate";

/** Click a specific hand card through its real pointer handlers (PlayerHand
 * plays on pointerup, not the keyboard-only onClick path). */
export async function clickHandCard(page: Page, cardId: string): Promise<void> {
  const card = handCard(page, cardId);
  await expect(card).toBeVisible();
  await card.click();
}

/** Wait until the local hand is unlocked (this seat's turn to play). */
export async function waitMyTurn(page: Page): Promise<void> {
  await expect(page.locator(".player-hand-container.my-turn")).toBeVisible();
}

/** Play one card once it is this seat's turn, then wait for it to leave the hand. */
export async function playCardInTurn(page: Page, cardId: string): Promise<void> {
  await waitMyTurn(page);
  await clickHandCard(page, cardId);
  await expect(handCard(page, cardId)).toHaveCount(0);
}

/**
 * Replay a seat's recorded bidding decisions through the BiddingPanel. Each
 * click auto-waits for the control to appear, so the AI seats' turns (fast
 * pacing) resolve in between without an explicit sleep.
 */
export async function performBids(page: Page, bids: HumanBid[]): Promise<void> {
  for (const bid of bids) {
    if (bid.kind === "will") {
      await page.getByRole("button", { name: bid.will ? de.willPlay : de.pass, exact: true }).click();
    } else if (!bid.declaration) {
      await page.getByRole("button", { name: de.retreat, exact: true }).click();
    } else {
      const label = gameLabel("de", bid.declaration.type, bid.declaration.calledSuit, bid.declaration.isTout);
      await page.getByRole("button", { name: label, exact: true }).click();
    }
  }
}

/** Assert a card is refused: it grays out, stays in hand and never reaches the table. */
export async function expectRefused(page: Page, cardId: string): Promise<void> {
  await clickHandCard(page, cardId);
  await expect(handCard(page, cardId)).toHaveCount(1);
  await expect(handCard(page, cardId)).toHaveClass(/grayed-out/);
  await expect(page.locator(`.trick-area [data-card-id="${cardId}"]`)).toHaveCount(0);
}

/** Assert a card is accepted: it leaves the hand and lands in the trick. */
export async function expectPlayed(page: Page, cardId: string): Promise<void> {
  await expect(handCard(page, cardId)).not.toHaveClass(/grayed-out/);
  await clickHandCard(page, cardId);
  await expect(handCard(page, cardId)).toHaveCount(0);
  await expect(page.locator(`.trick-area [data-card-id="${cardId}"]`)).toBeVisible();
}

/**
 * DEV-skip `count` rounds of a `total`-round list from round 1 (bidding and
 * every trick in one click each), readying up in between. Skipping the last
 * round opens the final standings. A skipped round races the AI seats'
 * will-bids, so its trajectory is not the simulation's.
 */
export async function skipRounds(page: Page, count: number, total = count): Promise<void> {
  const heading = page.locator(".round-over-overlay h2");
  for (let round = 1; round <= count; round += 1) {
    await expect(page.locator(".game-toolbar")).toContainText(`${round}/${total}`);
    await page.locator(".dev-round-btn").click();
    await expect(heading).toContainText(de.roundOver);
    await page.getByRole("button", { name: round < total ? de.ready : de.toFinalStandings }).click();
  }
  if (count === total) await expect(heading).toContainText(de.listOver);
}

/** The per-player score changes on the round summary, ascending. */
export async function readScoreChanges(page: Page): Promise<number[]> {
  const grid = page.locator(".round-over-overlay .score-grid");
  const texts = await grid.locator("span.pos, span.neg").allInnerTexts();
  return texts.map((text) => Number.parseInt(text, 10)).sort((a, b) => a - b);
}

export interface Standing {
  name: string;
  score: number;
}

/** Every player's name and list total off the final standings, in on-screen
 * (best-first) order. Each row's last span is the total — the first is its rank. */
export async function readStandings(page: Page): Promise<Standing[]> {
  const rows = page.locator(".round-over-overlay .score-grid > div");
  const standings: Standing[] = [];
  for (const row of await rows.all()) {
    const name = (await row.locator("strong").innerText()).trim();
    const score = Number.parseInt(await row.locator("span").last().innerText(), 10);
    standings.push({ name, score });
  }
  return standings;
}

/**
 * Finished lists in the history store. Deliberately does not open a database
 * that does not exist yet — a versionless `open` would create an empty
 * `schafplay` at version 1 the app could never upgrade into its stores.
 * Runs in the page.
 */
function countStoredGames(): Promise<number> {
  return new Promise<number>((resolve) => {
    indexedDB.databases().then((databases) => {
      if (!databases.some((entry) => entry.name === "schafplay")) return resolve(0);
      const open = indexedDB.open("schafplay");
      open.onerror = () => resolve(0);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("games")) {
          db.close();
          return resolve(0);
        }
        const counter = db.transaction("games", "readonly").objectStore("games").count();
        counter.onsuccess = () => {
          db.close();
          resolve(counter.result);
        };
        counter.onerror = () => {
          db.close();
          resolve(0);
        };
      };
    }, () => resolve(0));
  });
}

/**
 * Wait for ListRecorder's fire-and-forget IndexedDB write. Screens that read
 * history once on mount show a stale list *for good* if opened before it lands.
 */
export async function waitForStoredGames(page: Page, count: number): Promise<void> {
  await expect
    .poll(() => page.evaluate(countStoredGames), { message: "recorded list to reach IndexedDB" })
    .toBe(count);
}
