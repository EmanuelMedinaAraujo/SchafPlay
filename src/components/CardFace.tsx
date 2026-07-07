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
  return (
    <span className={`card-face ${SUIT_CLASS[card.suit]} ${trump ? "trump" : ""} ${small ? "small" : ""}`}>
      <span className="card-corner">{card.value}</span>
      <span className="card-emoji">{getSuitEmoji(card.suit)}</span>
      <span className="card-corner flipped">{card.value}</span>
    </span>
  );
}
