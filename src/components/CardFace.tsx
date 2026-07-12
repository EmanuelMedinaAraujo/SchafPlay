import { Card, Contract, GameType, Suit } from "../types";
import { isTrump } from "../game/rules";
import { getSuitEmoji } from "../lib/cardDisplay";
import { CardDesign } from "../lib/settings";
import BavarianCardArt from "./BavarianCardArt";

interface CardFaceProps {
  card: Card;
  contract: Contract | null;
  design?: CardDesign;
  small?: boolean;
}

const SUIT_CLASS: Record<Suit, string> = {
  [Suit.ACORNS]: "suit-acorns",
  [Suit.LEAVES]: "suit-leaves",
  [Suit.HEARTS]: "suit-hearts",
  [Suit.BELLS]: "suit-bells",
};

/** A single card face. `design` picks the hand-drawn Bavarian art (#15) or the
 * original emoji layout; both share the outer `.card-face` box for sizing. */
export default function CardFace({ card, contract, design = "bavarian", small = false }: CardFaceProps) {
  const trump = isTrump(card, contract?.type ?? GameType.SAUSPIEL);
  const classes = `card-face ${SUIT_CLASS[card.suit]} ${design === "bavarian" ? "bavarian" : ""} ${
    trump ? "trump" : ""
  } ${small ? "small" : ""}`;

  if (design === "bavarian") {
    return (
      <span className={classes}>
        <BavarianCardArt suit={card.suit} value={card.value} trump={trump} />
      </span>
    );
  }

  const emoji = getSuitEmoji(card.suit);
  return (
    <span className={classes}>
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
