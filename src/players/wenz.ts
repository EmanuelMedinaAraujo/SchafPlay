import { createDeck, SUITS } from "../game/deck";
import { isTrump, sortCardsForHand } from "../game/rules";
import { Card, CardValue, GameType, Trick } from "../game/types";

const wenzDeck = sortCardsForHand(createDeck(), GameType.WENZ);
const wenzTrumps = wenzDeck.filter((card) => isTrump(card, GameType.WENZ));
const plainSuits = SUITS.map((suit) =>
  wenzDeck.filter((card) => card.suit === suit && !isTrump(card, GameType.WENZ)),
);

/** Consecutive highest outstanding cards of each plain suit, before considering ruffs. */
export function getWenzPlainMasters(hand: Card[], tricks: Trick[] = []): Card[] {
  const held = new Map(hand.map((card) => [card.id, card]));
  const played = new Set(tricks.flatMap((trick) => trick.playedCards.map(({ card }) => card.id)));
  const masters: Card[] = [];

  for (const suit of plainSuits) {
    for (const card of suit) {
      if (played.has(card.id)) continue;
      const heldCard = held.get(card.id);
      if (!heldCard) break;
      masters.push(heldCard);
    }
  }
  return masters;
}

/** A lower bound against any legal play and deal, using only the hand and opening lead. */
export function countGuaranteedWenzTricks(hand: Card[], leadsOpeningTrick: boolean): number {
  const trumps = hand.filter((card) => isTrump(card, GameType.WENZ)).length;
  if (trumps < 2) return 0;

  const hasTopTrump = hand.some((card) => card.id === wenzTrumps[0].id);
  const masters = getWenzPlainMasters(hand);
  const winners = trumps + masters.length;

  if (trumps === 2) {
    if (!hasTopTrump) return 0;
    const hasSecondTrump = hand.some((card) => card.id === wenzTrumps[1].id);
    // With the lead, the top two draw every opposing trump without losing a trick.
    if (leadsOpeningTrick && hasSecondTrump) return winners;

    const hasEveryAce = masters.filter((card) => card.value === CardValue.ACE).length === SUITS.length;
    if (!hasEveryAce) return 0;

    // The opening leads force out both opposing trumps, with at most one loss.
    // The Aces provide a way back on any plain suit after trumps are gone.
    if (leadsOpeningTrick) return winners - 1;

    // As follower, ruffing to gain the lead means a defender already ruffed our
    // last card (a master) in that suit. Winning on a trump lead also spends an
    // opposing trump. The remaining top trump(s) can then draw the rest.
    return hasSecondTrump ? winners - 2 : 0;
  }

  // With three trumps, only one opposing trump can beat a trump or ruff a master.
  // Trumping in and then leading trumps uses at most two of ours to force it out,
  // leaving an unbeatable trump to regain the lead if it took a trick.
  // From the opening lead, the highest trump can force it out without a loss.
  const possibleLoss = trumps === 3 && !(leadsOpeningTrick && hasTopTrump) ? 1 : 0;
  return winners - possibleLoss;
}
