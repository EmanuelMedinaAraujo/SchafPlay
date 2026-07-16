import { GameType, Suit } from "../../src/game/types";
import { getCallableSuits } from "../../src/game/rules";
import { gameLabel } from "../../src/lib/i18n";
import { de, handCard, startSolo } from "./helpers/fixtures";
import { findSeed, RoundTrace } from "./helpers/simulate";
import { performBids, playCardInTurn, waitMyTurn, clickHandCard } from "./helpers/ui";
import { expect, test } from "./helpers/test";

const DECLARABLE = [Suit.ACORNS, Suit.LEAVES, Suit.BELLS];

test.describe("rules enforcement (solo)", () => {
  test("bidding panel only enables callable Sauspiel suits", async ({ page }) => {
    // A round 1 where p1 is the sole bidder (others pass will), holding at least
    // one callable and one non-callable plain suit — so the panel opens with
    // high bid null and a clear enabled/disabled split.
    const { seed, trace } = findSeed(
      (tr) => {
        const r = tr[0];
        if (!r.contract) return false;
        const others = r.willBids.filter((w) => w.playerId !== "p1");
        if (!(others.length === 3 && others.every((w) => !w.wantsToPlay))) return false;
        if (!r.willBids.find((w) => w.playerId === "p1")?.wantsToPlay) return false;
        const callable = getCallableSuits(r.hands.p1);
        const nonCallable = DECLARABLE.filter((s) => !callable.includes(s));
        return callable.length >= 1 && nonCallable.length >= 1;
      },
      { limit: 400, totalRounds: 8 },
    );

    const callable = getCallableSuits(trace[0].hands.p1);
    await startSolo(page, { seed, name: "Toni" });

    // Walk to DECLARE_PHASE: p1 is the only interested seat.
    await page.getByRole("button", { name: de.willPlay, exact: true }).click();

    for (const suit of DECLARABLE) {
      const button = page.getByRole("button", { name: gameLabel("de", GameType.SAUSPIEL, suit), exact: true });
      if (callable.includes(suit)) await expect(button).toBeEnabled();
      else await expect(button).toBeDisabled();
    }
  });

  test("following suit is enforced: illegal card grays out, legal card plays", async ({ page }) => {
    // A round 1 with a p1 turn where the follow-suit rule restricts the legal
    // set below the full hand.
    const { seed, trace } = findSeed(
      (tr) => tr[0].turns.some((t) => t.seat === "p1" && t.legalIds.length < t.handIds.length),
      { limit: 200, totalRounds: 4 },
    );
    const round: RoundTrace = trace[0];
    const p1Turns = round.turns.filter((t) => t.seat === "p1");
    const targetIdx = p1Turns.findIndex((t) => t.legalIds.length < t.handIds.length);
    const target = p1Turns[targetIdx];
    const illegalId = target.handIds.find((id) => !target.legalIds.includes(id))!;
    const legalId = target.chosenId; // first legal card

    await startSolo(page, { seed, name: "Toni" });
    await performBids(page, round.bids);

    // Script p1 to the exact restricted moment.
    for (let i = 0; i < targetIdx; i += 1) await playCardInTurn(page, p1Turns[i].chosenId);
    await waitMyTurn(page);

    // Illegal card: grays out, stays in hand, never reaches the table.
    await clickHandCard(page, illegalId);
    await expect(handCard(page, illegalId)).toHaveClass(/grayed-out/);
    await expect(handCard(page, illegalId)).toHaveCount(1);
    await expect(page.locator(`.trick-area [data-card-id="${illegalId}"]`)).toHaveCount(0);

    // Legal card: leaves the hand and lands in the trick.
    await clickHandCard(page, legalId);
    await expect(handCard(page, legalId)).toHaveCount(0);
    await expect(page.locator(`.trick-area [data-card-id="${legalId}"]`)).toBeVisible();
  });

  test("hand stays locked until it is the local player's turn to play", async ({ page }) => {
    // The UI locks the hand through one mechanism (PlayerHand's `disabled` =
    // not PLAYING or not my turn), so the stable will-phase state — where the
    // engine waits indefinitely for p1's bid — is the deterministic place to
    // assert the lock; an AI seat's 40ms turn window would be a race.
    const { seed, trace } = findSeed((tr) => Boolean(tr[0].contract), { totalRounds: 4 });

    await startSolo(page, { seed, name: "Toni", rounds: 4 });
    await expect(page.getByRole("button", { name: de.willPlay, exact: true })).toBeVisible();
    const cards = page.locator(".player-hand-cards .playing-card");
    await expect(cards).toHaveCount(8);
    await expect(page.locator(".player-hand-container")).not.toHaveClass(/my-turn/);
    await expect(cards.first()).toBeDisabled();
    await expect(cards.last()).toBeDisabled();

    // Once bidding resolves and it becomes p1's turn, the same cards unlock.
    await performBids(page, trace[0].bids);
    await waitMyTurn(page);
    await expect(cards.first()).toBeEnabled();
  });
});
