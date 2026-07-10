import { Suit } from "../game/types";

export function getSuitEmoji(suit: Suit): string {
  return {
    [Suit.ACORNS]: "🌰",
    [Suit.LEAVES]: "🍃",
    [Suit.HEARTS]: "❤️",
    [Suit.BELLS]: "🔔",
  }[suit];
}
