import { Contract, Language, Player, Trick } from "../types";
import { translations } from "../lib/i18n";
import CardFace from "./CardFace";
import { XIcon } from "./icons";

interface LastTrickPopupProps {
  trick: Trick;
  players: Player[];
  contract: Contract | null;
  language: Language;
  onClose: () => void;
}

export default function LastTrickPopup({ trick, players, contract, language, onClose }: LastTrickPopupProps) {
  const t = translations[language];
  const winner = players.find((p) => p.id === trick.winnerId);

  return (
    <div
      className="rules-modal-overlay last-trick-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="rules-modal-container last-trick-container">
        <div className="rules-modal-header last-trick-header">
          <h3>{t.lastTrick}</h3>
          <button onClick={onClose} className="rules-modal-close-btn" type="button">
            <XIcon />
          </button>
        </div>
        <div className="last-trick-cards">
          {trick.playedCards.map((played) => {
            const player = players.find((p) => p.id === played.playerId);
            const isWinner = played.playerId === trick.winnerId;
            return (
              <div key={played.card.id} className="last-trick-play">
                <CardFace card={played.card} contract={contract} small />
                <span className={isWinner ? "last-trick-name winner" : "last-trick-name"}>
                  {player?.name} {isWinner ? "🏆" : ""}
                </span>
              </div>
            );
          })}
        </div>
        {winner && (
          <div className="last-trick-winner">
            {t.winner}: <strong>{winner.name}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
