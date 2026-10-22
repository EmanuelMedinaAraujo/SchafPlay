import { GameType, Player, SeatId } from "../../src/game/types";
import { getAIBid } from "../../src/players/aiHeuristics";
import { gameLabel } from "../../src/lib/i18n";
import { de, startSolo } from "./helpers/fixtures";
import { findSeed, RoundTrace } from "./helpers/simulate";
import { performBids, playCardInTurn } from "./helpers/ui";
import { expect, test } from "./helpers/test";

/**
 * AI seats asked "will you play?" after p1 already said yes, whose best game is
 * a Sauspiel: one they would announce if nobody else wanted to, and with no
 * Wenz or Solo to top a standing Sauspiel. Located from the bidding heuristic
 * and the dealt hand only, never from the will-bids under test.
 */
function sauspielOnlyAfterP1(round: RoundTrace): SeatId[] {
  const p1 = round.willBids.findIndex((bid) => bid.playerId === "p1");
  if (p1 < 0 || !round.willBids[p1].wantsToPlay) return [];
  return round.willBids
    .slice(p1 + 1)
    .map((bid) => bid.playerId as SeatId)
    .filter((id) => {
      const seat = { id, cards: round.hands[id] } as Player;
      const alone = getAIBid(seat, null, true);
      return alone?.type === GameType.SAUSPIEL && getAIBid(seat, alone, true) === null;
    });
}

test.describe("AI bidding behavior", () => {
  test("AI does not bid Sauspiel if another player already bid wantsToPlay", async ({ page }) => {
    // p1 bids last in round 1, so the situation first arises in round 2, where
    // p2 follows p1. Round 1 is played out exactly as simulated so the browser
    // deals round 2 from the same shuffle.
    const { seed, trace } = findSeed(
      (tr) => tr.length >= 2 && tr[0].result !== null && sauspielOnlyAfterP1(tr[1]).length > 0,
      { totalRounds: 4 },
    );
    const [round1, round2] = trace;

    // The claim, on the engine's own trajectory: each of those seats passes
    // instead of competing with a Sauspiel it could not get past p1's.
    for (const id of sauspielOnlyAfterP1(round2)) {
      expect(round2.willBids.find((bid) => bid.playerId === id)?.wantsToPlay, `${id} said "will"`).toBe(false);
    }

    // The browser walks the same bidding to the simulated contract.
    await startSolo(page, { seed, name: "Toni", rounds: 4 });
    await performBids(page, round1.bids);
    for (const turn of round1.turns) await playCardInTurn(page, turn.chosenId);
    await page.getByRole("button", { name: de.ready }).click();
    await expect(page.locator(".game-toolbar")).toContainText("2/4");

    await performBids(page, round2.bids);
    // The trace does not record Tout, which only appends to the label.
    const { type, calledSuit } = round2.contract!;
    await expect(page.locator(".contract-chip")).toContainText(gameLabel("de", type, calledSuit));
  });
});
