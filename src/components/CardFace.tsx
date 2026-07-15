import { Card, Contract, GameType } from "../types";
import { isTrump } from "../game/rules";

interface CardFaceProps {
  card: Card;
  contract: Contract | null;
  small?: boolean;
}

/** A single card face, drawn from the traditional Bavarian SVG art (#15).
 * Trump cards get an amber border via `.card-face.trump`. */
export default function CardFace({ card, contract, small = false }: CardFaceProps) {
  const trump = isTrump(card, contract?.type ?? GameType.SAUSPIEL);
  const classes = `card-face ${trump ? "trump" : ""} ${small ? "small" : ""}`;
  const filename = `${card.suit.toLowerCase()}-${card.value.toLowerCase()}.svg`;
  const src = `${import.meta.env.BASE_URL}bavarian-cards/${filename}`;

  return (
    <span className={classes}>
      <img
        src={src}
        alt={`${card.value} of ${card.suit}`}
        className="bavarian-card-img"
        draggable={false}
      />
    </span>
  );
}
