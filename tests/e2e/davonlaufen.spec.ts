import { GameType, CardValue } from "../../src/game/types";
import { de, handCard, startSolo } from "./helpers/fixtures";
import { simulateSolo } from "./helpers/simulate";
import { clickHandCard, playCardInTurn, performBids, waitMyTurn } from "./helpers/ui";
import { expect, test } from "./helpers/test";

const SOLO_SEAT: Record<string, string> = { p2: ".seat-left", p3: ".seat-top", p4: ".seat-right" };

test.describe("Called Ace & Davonlaufen rules", () => {
  test("partner can davonlaufen and is revealed immediately", async ({ page }) => {
    const seed = 47;
    const trace = simulateSolo(seed, { totalRounds: 8 });

    const round = trace[0];
    const calledSuit = round.contract!.calledSuit!;
    const partnerId = round.contract!.partnerId!;
    const calledAceId = `${calledSuit}-A`;
    const partnerSeat = SOLO_SEAT[partnerId];

    // Find the card details helper
    const findCard = (cardId: string) => {
      for (const playerHand of Object.values(round.hands) as any[]) {
        const card = playerHand.find((c: any) => c.id === cardId);
        if (card) return card;
      }
      return null;
    };

    const isTrumpCard = (card: any) => {
      if (card.value === "O" || card.value === "U") return true;
      return card.suit === "HEARTS";
    };

    // Find the play index of davonlaufen in round.plays
    const davonlaufenPlayIdx = round.plays.findIndex(
      (p: any) => {
        if (p.playerId !== partnerId) return false;
        const card = findCard(p.cardId);
        return card && card.suit === calledSuit && card.value !== CardValue.ACE && !isTrumpCard(card);
      }
    );

    await startSolo(page, { seed, name: "Toni", rounds: 8 });
    await performBids(page, round.bids);

    // Replay p1's turns that happen strictly before the davonlaufen play
    const p1TurnsBefore = round.turns.filter((turn: any) => {
      const playIdx = round.plays.findIndex((p: any) => p.playerId === "p1" && p.cardId === turn.chosenId);
      return playIdx < davonlaufenPlayIdx;
    });

    for (const turn of p1TurnsBefore) {
      await playCardInTurn(page, turn.chosenId);
    }

    // Before the davonlaufen play, the partner badge is not visible
    await expect(page.locator(`${partnerSeat} .role-badge.partner`)).toHaveCount(0);

    // Play p1's card in the davonlaufen trick if p1 plays before the partner in this trick
    const p1TurnInTrick = round.turns.find((turn: any) => {
      const playIdx = round.plays.findIndex((p: any) => p.playerId === "p1" && p.cardId === turn.chosenId);
      return Math.floor(playIdx / 4) === Math.floor(davonlaufenPlayIdx / 4) && playIdx < davonlaufenPlayIdx;
    });

    if (p1TurnInTrick) {
      await playCardInTurn(page, p1TurnInTrick.chosenId);
    }

    // Now the partner plays their davonlaufen card, revealing themselves immediately
    await expect(page.locator(`${partnerSeat} .role-badge.partner`)).toBeVisible();
    await expect(page.locator(".role-badge.partner")).toHaveCount(1);
  });

  test("called Ace play restrictions when partner has < 4 cards of the called suit", async ({ page }) => {
    const seed = 39;
    const trace = simulateSolo(seed, { totalRounds: 8 });
    const round = trace[0];
    const calledSuit = round.contract!.calledSuit!;
    const calledAceId = `${calledSuit}-A`;

    // Find the card details helper
    const findCard = (cardId: string) => {
      for (const playerHand of Object.values(round.hands) as any[]) {
        const card = playerHand.find((c: any) => c.id === cardId);
        if (card) return card;
      }
      return null;
    };

    const isTrumpCard = (card: any) => {
      if (card.value === "O" || card.value === "U") return true;
      return card.suit === "HEARTS";
    };

    // Find target turn index
    let calledSuitSearched = false;
    let targetTurnIdx = -1;
    for (let t = 0; t < 8; t++) {
      const trickPlays = round.plays.slice(t * 4, t * 4 + 4);
      const ledCard = findCard(trickPlays[0].cardId);
      
      const p1TurnIndex = round.turns.findIndex((tn: any) => tn.handIds.includes(calledAceId) && tn.positionInTrick === 0 && tn.handIds.length === 8 - t);
      if (p1TurnIndex !== -1 && !calledSuitSearched) {
        targetTurnIdx = p1TurnIndex;
        break;
      }

      if (ledCard && ledCard.suit === calledSuit && !isTrumpCard(ledCard)) {
        calledSuitSearched = true;
      }
    }

    await startSolo(page, { seed, name: "Toni", rounds: 8 });
    await performBids(page, round.bids);

    // Replay p1's turns until target turn
    const p1Turns = round.turns;
    for (let i = 0; i < targetTurnIdx; i++) {
      await playCardInTurn(page, p1Turns[i].chosenId);
    }

    await waitMyTurn(page);

    // Toni leads and has the called Ace.
    // Verify the called Ace is not grayed-out initially
    await expect(handCard(page, calledAceId)).not.toHaveClass(/grayed-out/);

    // Clicking the called Ace should not play it and should mark it as grayed-out
    await clickHandCard(page, calledAceId);
    await expect(handCard(page, calledAceId)).toBeVisible();
    await expect(handCard(page, calledAceId)).toHaveClass(/grayed-out/);
    await expect(page.locator(`.trick-area [data-card-id="${calledAceId}"]`)).toHaveCount(0);
  });
});
