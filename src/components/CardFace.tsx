import { Card, Contract, GameType, Suit } from "../types";
import { getSuitEmoji, isTrump } from "../utils/gameLogic";

interface CardFaceProps {
  card: Card;
  contract: Contract | null;
  small?: boolean;
}

const SUIT_CLASS: Record<Suit, string> = {
  [Suit.ACORNS]: "suit-acorns",
  [Suit.LEAVES]: "suit-leaves",
  [Suit.HEARTS]: "suit-hearts",
  [Suit.BELLS]: "suit-bells",
};

/** Emoji-based Bavarian card face. */
export default function CardFace({ card, contract, small = false }: CardFaceProps) {
  const trump = isTrump(card, contract?.type ?? GameType.SAUSPIEL);
  const emoji = getSuitEmoji(card.suit);
  return (
    <span className={`card-face ${SUIT_CLASS[card.suit]} ${trump ? "trump" : ""} ${small ? "small" : ""}`}>
      {/* Rank + suit stacked in the corner: still readable when cards overlap. */}
      <span className="card-corner">
        {card.value}
        <span className="card-corner-suit">{emoji}</span>
      </span>
      <span className="card-emoji">{emoji}</span>
      <span className="card-corner flipped">
        {card.value}
        <span className="card-corner-suit">{emoji}</span>
      </span>
    </span>
  );
}
