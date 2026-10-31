import { Card, CardValue, Suit } from "./types";

/** Card point values (Augen) — the single source, also used to rebuild Cards from stored ids. */
const CARD_POINTS: Record<CardValue, number> = {
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

/** Suits high to low (Ober/Unter rank); also the fresh-deck order seeded shuffles depend on. */
export const SUITS: Suit[] = [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS];

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    DECK_VALUE_ORDER.map((value) => ({
      id: `${suit}-${value}`,
      suit,
      value,
      points: CARD_POINTS[value],
    })),
  );
}

/** `"ACORNS-A"` → a full `Card`. Returns null for an unparsable id. */
export function cardFromId(id: string): Card | null {
  const dash = id.lastIndexOf("-");
  if (dash <= 0) return null;
  const suit = id.slice(0, dash) as Suit;
  const value = id.slice(dash + 1) as CardValue;
  if (!Object.values(Suit).includes(suit)) return null;
  if (!Object.values(CardValue).includes(value)) return null;
  return { id, suit, value, points: CARD_POINTS[value] };
}

/** Fisher-Yates; `random` is injectable so seeded deals share this implementation. */
export function shuffleDeck(deck: Card[], random: () => number = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
