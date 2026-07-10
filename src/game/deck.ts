import { Card, CardValue, Suit } from "./types";

export function createDeck(): Card[] {
  const values: Array<{ value: CardValue; points: number }> = [
    { value: CardValue.SEVEN, points: 0 },
    { value: CardValue.EIGHT, points: 0 },
    { value: CardValue.NINE, points: 0 },
    { value: CardValue.UNTER, points: 2 },
    { value: CardValue.OBER, points: 3 },
    { value: CardValue.KING, points: 4 },
    { value: CardValue.TEN, points: 10 },
    { value: CardValue.ACE, points: 11 },
  ];

  return [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS].flatMap((suit) =>
    values.map(({ value, points }) => ({
      id: `${suit}-${value}`,
      suit,
      value,
      points,
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
