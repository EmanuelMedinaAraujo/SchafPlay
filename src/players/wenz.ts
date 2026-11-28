import { createDeck, SUITS } from "../game/deck";
import { isTrump, sortCardsForHand } from "../game/rules";
import { Card, CardValue, GameType, Trick } from "../game/types";

const wenzDeck = sortCardsForHand(createDeck(), GameType.WENZ);
const [topTrump, secondTrump] = wenzDeck.filter((card) => isTrump(card, GameType.WENZ));
const plainSuits = SUITS.map((suit) =>
  wenzDeck.filter((card) => card.suit === suit && !isTrump(card, GameType.WENZ)),
);

/** Consecutive highest outstanding cards of each plain suit, before considering ruffs. */
export function getWenzPlainMasters(hand: Card[], tricks: Trick[] = []): Card[] {
  const played = new Set(tricks.flatMap((trick) => trick.playedCards.map(({ card }) => card.id)));
  const masters: Card[] = [];

  for (const suit of plainSuits) {
    for (const card of suit) {
      if (played.has(card.id)) continue;
      const heldCard = hand.find((candidate) => candidate.id === card.id);
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

  const hasTopTrump = hand.some((card) => card.id === topTrump.id);
  const winners = trumps + getWenzPlainMasters(hand).length;
  if (trumps >= 3) {
    // With three trumps, the missing trump can take one trick. Leading the
    // highest from the start prevents that loss. Otherwise a retained trump
    // gives the declarer a way back on lead after the loss.
    const possibleLoss = trumps === 3 && !(leadsOpeningTrick && hasTopTrump);
    return possibleLoss ? winners - 1 : winners;
  }

  if (!hasTopTrump) return 0;
  const hasSecondTrump = hand.some((card) => card.id === secondTrump.id);
  if (leadsOpeningTrick && hasSecondTrump) return winners;
  if (hand.filter((card) => card.value === CardValue.ACE).length !== SUITS.length) return 0;

  // Four Aces give a way back on any suit if the second trump lead loses.
  if (leadsOpeningTrick) return winners - 1;

  // Before our first win, a void in any suit means a defender already ruffed
  // our Ace. Winning by trumping therefore spends at least one opposing trump
  // (either an earlier ruff or a trump lead), so our remaining top trump suffices.
  return hasSecondTrump ? winners - 2 : 0;
}
