import { Card, Contract, GameType, Language, Player, Trick } from "../types";
import { translations } from "../lib/i18n";
import { sortCardsForHand } from "../game/rules";
import CardFace from "./CardFace";
import { XIcon } from "./icons";

interface RoundCardsPopupProps {
  players: Player[];
  tricks: Trick[];
  contract: Contract | null;
  language: Language;
  onClose: () => void;
}

/**
 * Shows the hand every player was dealt in the round that just finished — one
 * row per player. The hands are reconstructed from the completed tricks (every
 * card carries the id of the seat that played it), so it works from the
 * redacted guest view just as well as the host's full state.
 *
 * Kept deliberately compact — no title bar, the close button shares the first
 * row — so all four hands fit an iPhone 13 in landscape without scrolling (#25).
 */
export default function RoundCardsPopup({ players, tricks, contract, language, onClose }: RoundCardsPopupProps) {
  const t = translations[language];
  const gameType = contract?.type ?? GameType.SAUSPIEL;

  const handByPlayer: Record<string, Card[]> = {};
  for (const trick of tricks) {
    for (const played of trick.playedCards) {
      (handByPlayer[played.playerId] ??= []).push(played.card);
    }
  }

  return (
    <div
      className="round-cards-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="round-cards-panel">
        <button onClick={onClose} className="round-cards-close" type="button" aria-label={t.dealtCards}>
          <XIcon />
        </button>
        <div className="round-cards-rows">
          {players.map((player) => (
            <div key={player.id} className="round-cards-row">
              <span className="round-cards-name">{player.name}</span>
              <div className="round-cards-hand">
                {sortCardsForHand(handByPlayer[player.id] ?? [], gameType).map((card) => (
                  <CardFace key={card.id} card={card} contract={contract} small />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
