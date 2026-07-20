import { Card, CardValue, Suit } from "./types";

/** Card point values (Augen) — the single source, also used to rebuild Cards from stored ids. */
export const CARD_POINTS: Record<CardValue, number> = {
  [CardValue.SEVEN]: 0,
  [CardValue.EIGHT]: 0,
  [CardValue.NINE]: 0,
  [CardValue.UNTER]: 2,
  [CardValue.OBER]: 3,
  [CardValue.KING]: 4,
  [CardValue.TEN]: 10,
  [CardValue.ACE]: 11,
};

/** Value order within each suit of a fresh deck — do not reorder, seeded shuffles depend on it. */
const DECK_VALUE_ORDER: CardValue[] = [
  CardValue.SEVEN,
  CardValue.EIGHT,
  CardValue.NINE,
  CardValue.UNTER,
  CardValue.OBER,
  CardValue.KING,
  CardValue.TEN,
  CardValue.ACE,
];

export function createDeck(): Card[] {
  return [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS].flatMap((suit) =>
    DECK_VALUE_ORDER.map((value) => ({
      id: `${suit}-${value}`,
      suit,
      value,
      points: CARD_POINTS[value],
    })),
  );
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
