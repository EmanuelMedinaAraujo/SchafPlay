import { Page } from "@playwright/test";
import { replayDecisions } from "../../src/analysis/replaySuggestions";
import { cardFromId } from "../../src/game/deck";
import { getLegalCards } from "../../src/game/rules";
import { GameType, Suit } from "../../src/game/types";
import { GameRecord } from "../../src/persistence/GameHistoryStore";
import { bootHome, de, startSolo } from "./helpers/fixtures";
import { quitFinishedList, skipRounds } from "./helpers/ui";
import { expect, test } from "./helpers/test";

/**
 * Analysis view + round replay (#85). Plays a real seeded list to completion
 * first, then drives the replay through the UI. Numbers are read off the DOM
 * rather than hardcoded, so a seed/AI change can't break it.
 */

/** Quits a finished list and opens the analysis screen with the game listed. */
async function openAnalysisAfterList(page: Page): Promise<void> {
  await quitFinishedList(page);

  await page.getByTitle(de.analysis).click();
  await expect(page.locator(".analysis-screen")).toBeVisible();
  await expect(page.locator(".stats-game-row")).toHaveCount(1);
}

async function readReplayGame(page: Page, makeLegacy = false): Promise<GameRecord> {
  return page.evaluate((legacy) => new Promise<GameRecord>((resolve, reject) => {
    const open = indexedDB.open("schafplay");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("games", legacy ? "readwrite" : "readonly");
      const store = tx.objectStore("games");
      const read = store.getAll();
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => {
        db.close();
        resolve(read.result[0]);
      };
      read.onsuccess = () => {
        if (!legacy) return;
        const game: GameRecord = read.result[0];
        delete game.rounds[0].bids;
        delete game.rounds[0].declarations;
        game.rounds[0].initialHand = [];
        game.rounds[1].tricks = game.rounds[1].tricks.slice(0, 1);
        delete game.rounds[1].declarations;
        store.put(game);
      };
    };
  }), makeLegacy);
}

test.describe("analysis replay", () => {
  test("empty state before any finished game", async ({ page }) => {
    await bootHome(page);
    await page.getByTitle(de.analysis).click();
    await expect(page.locator(".analysis-screen")).toBeVisible();
    await expect(page.getByText(de.analysisEmpty)).toBeVisible();
    await expect(page.locator(".stats-game-row")).toHaveCount(0);
  });

  test("a recorded round replays trick by trick with all four hands face-up", async ({ page }) => {
    await startSolo(page, { seed: 5, rounds: 4, name: "Wastl" });
    await skipRounds(page, 4);

    await openAnalysisAfterList(page);
    const recorded = await readReplayGame(page);
    const round = recorded.rounds[0];

    // A local Sauspiel hand passes if an earlier seat already wants to play.
    // If it said yes anyway, it must overbid a standing Sauspiel. Once another
    // seat tops that with Wenz, the same hand may legally retreat.
    const bidContext = {
      ...round,
      initialHand: ["ACORNS-O", "LEAVES-O", "HEARTS-U", "HEARTS-7", "ACORNS-7", "LEAVES-7", "BELLS-7", "BELLS-8"],
      tricks: [{ leaderId: "p2", plays: [] }],
      bids: ["p2", "p3", "p4", "p1"].map((playerId) => ({ playerId, wantsToPlay: playerId !== "p4" })),
      declarations: [
        { playerId: "p2", declaration: { type: GameType.SAUSPIEL, calledSuit: Suit.ACORNS } },
        { playerId: "p3", declaration: { type: GameType.WENZ } },
        { playerId: "p1", declaration: null },
      ],
    };
    expect(replayDecisions(recorded, bidContext).will.at(-1)?.suggestion).toBe(false);
    expect(replayDecisions(recorded, bidContext).declarations.at(-1)?.suggestion).toBeNull();
    bidContext.declarations.splice(1, 2, { playerId: "p1", declaration: { type: GameType.WENZ } });
    expect(replayDecisions(recorded, bidContext).declarations.at(-1)?.suggestion).toEqual({ type: GameType.SOLO_BELLS });

    const rows = page.locator(".stats-game-row");
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

    const toggle = page.getByRole("button", { name: de.replayAiSuggestions });
    const suggestion = page.locator(".replay-card-suggestion");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(suggestion).toHaveCount(0);
    await toggle.click();

    const bidding = page.getByRole("button", { name: de.bidding, exact: true });
    await bidding.click();
    await expect(page.locator(".replay-bid-suggestion")).toHaveCount(round.bids!.length + round.declarations!.length);
    await page.keyboard.press("Escape");
    await expect(page.locator(".replay-bidding")).toHaveCount(0);

    // Check every upcoming decision against the actual actor's remaining legal
    // cards, including the next lead while the last trick is still on the felt.
    const next = page.getByRole("button", { name: de.replayNext, exact: true });
    const tricks = round.tricks.map((trick, index) => ({
      id: index + 1,
      leaderId: trick.leaderId,
      winnerId: trick.winnerId,
      playedCards: trick.plays.map(({ playerId, card }) => ({ playerId, card: cardFromId(card)! })),
    }));
    const plays = tricks.flatMap((trick) => trick.playedCards);
    for (let index = 0; index < plays.length; index++) {
      const trickIndex = Math.floor(index / 4);
      const alreadyPlayed = index % 4;
      const { playerId, card } = plays[index];
      const seatIndex = recorded.players.findIndex((player) => player.id === playerId);
      const hand = plays.slice(index).filter((play) => play.playerId === playerId).map((play) => play.card);
      const trick = { ...tricks[trickIndex], playedCards: tricks[trickIndex].playedCards.slice(0, alreadyPlayed) };
      const legal = getLegalCards(hand, trick, round.contract, tricks.slice(0, trickIndex));

      const suggested = seats.nth(seatIndex).locator(".replay-hand-card:has(.replay-card-suggestion)");
      await expect(suggestion).toHaveCount(1);
      await expect(suggested).toBeVisible();
      expect(legal.map((candidate) => candidate.id)).toContain(await suggested.getAttribute("data-card-id"));
      if (index === 4) await expect(page.locator(".replay-trick-slot.winner")).toHaveCount(1);

      await next.click();
      await expect(page.locator(`.replay-trick-card[data-card-id="${card.id}"]`)).toBeVisible();
      await expect(page.locator(".replay-trick-card")).toHaveCount(alreadyPlayed + 1);
      await expect(page.locator(".replay-hand-card")).toHaveCount(31 - index);
      await expect(page.locator(".replay-progress")).toContainText(`${de.trick} ${trickIndex + 1}/8`);
    }
    await expect(suggestion).toHaveCount(0);
    await expect(page.locator(".replay-result")).toBeVisible();

    // The last trick banks immediately, so the seat totals reach 120 — held
    // back they would contradict the result strip right below them.
    const totals = await page.locator(".replay-seat-points").allTextContents();
    expect(totals.reduce((sum, text) => sum + Number.parseInt(text, 10), 0)).toBe(120);

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

  test("older replay data works in landscape and rotated phone layouts", async ({ page }) => {
    await startSolo(page, { seed: 5, rounds: 4, name: "Wastl" });
    await skipRounds(page, 4);
    await quitFinishedList(page);
    await readReplayGame(page, true);

    await page.getByTitle(de.analysis).click();
    await page.locator(".analysis-play-game").click();
    const bidding = page.getByRole("button", { name: de.bidding, exact: true });
    const suggestion = page.locator(".replay-card-suggestion");
    await expect(bidding).toHaveCount(0);
    await expect(suggestion).toBeVisible();

    // A partial trick log can't recover the other hands or the card context.
    // The recorded local deal still supports that seat's will suggestion.
    await page.getByTitle(de.replayNextRound).click();
    await expect(suggestion).toHaveCount(0);
    for (const viewport of [{ width: 568, height: 320 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await bidding.click();
      await expect(page.locator(".replay-bid-suggestion")).toHaveCount(1);
      await expect(page.getByText(de.replayBidNoSuggestion)).toHaveCount(3);
      await expect(page.getByText(de.declarePhaseTitle)).toHaveCount(0);
      const controls = await page.locator(".replay-controls").boundingBox();
      expect(controls!.x + controls!.width).toBeLessThanOrEqual(viewport.width);
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(viewport.height);
      await bidding.click();
      await expect(page.locator(".replay-bidding")).toHaveCount(0);
    }
  });

  test("playback runs across round borders through the whole list", async ({ page }) => {
    await startSolo(page, { seed: 5, rounds: 4, name: "Wastl" });
    await skipRounds(page, 4);
    await openAnalysisAfterList(page);
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
