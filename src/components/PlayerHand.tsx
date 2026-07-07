import { Card, Contract, GameType, Suit, Trick } from "../types";
import { getCardRank, getLegalCards, isTrump } from "../utils/gameLogic";
import CardFace from "./CardFace";

interface PlayerHandProps {
  hand: Card[];
  currentTrick: Trick | null;
  contract: Contract | null;
  disabled: boolean;
  onPlay: (cardId: string) => void;
}

const SUIT_ORDER: Record<Suit, number> = {
  [Suit.ACORNS]: 0,
  [Suit.LEAVES]: 1,
  [Suit.HEARTS]: 2,
  [Suit.BELLS]: 3,
};

export default function PlayerHand({ hand, currentTrick, contract, disabled, onPlay }: PlayerHandProps) {
  const gameType = contract?.type ?? GameType.SAUSPIEL;
  const legalCards = disabled ? [] : getLegalCards(hand, currentTrick, contract);

  // Trumps first (highest left), then plain suits grouped Acorns/Leaves/Hearts/Bells.
  const sorted = [...hand].sort((a, b) => {
    const aTrump = isTrump(a, gameType);
    const bTrump = isTrump(b, gameType);
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (!aTrump && a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return getCardRank(b, gameType) - getCardRank(a, gameType);
  });

  return (
    <div className={`player-hand ${disabled ? "" : "my-turn"}`}>
      {sorted.map((card) => {
        const legal = legalCards.some((candidate) => candidate.id === card.id);
        return (
          <button
            key={card.id}
            className={`playing-card ${disabled ? "" : legal ? "legal" : "illegal"}`}
            onClick={() => legal && onPlay(card.id)}
            disabled={disabled || !legal}
            type="button"
          >
            <CardFace card={card} contract={contract} />
          </button>
        );
      })}
    </div>
  );
}
