import { Contract, Language, Player, Trick } from "../types";
import { translations } from "../lib/i18n";
import CardFace from "./CardFace";

interface LastTrickPopupProps {
  trick: Trick;
  players: Player[];
  contract: Contract | null;
  language: Language;
  onClose: () => void;
}

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function LastTrickPopup({ trick, players, contract, language, onClose }: LastTrickPopupProps) {
  const t = translations[language];
  const winner = players.find((p) => p.id === trick.winnerId);

  return (
    <div className="rules-modal-overlay" style={{ zIndex: 70 }}>
      <div className="rules-modal-container" style={{ width: "min(400px, 92%)" }}>
        <div className="rules-modal-header" style={{ paddingBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>{t.lastTrick}</h3>
          <button onClick={onClose} className="rules-modal-close-btn" type="button">
            <XIcon />
          </button>
        </div>
        <div style={{ padding: "16px 0", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", justifyItems: "center" }}>
          {trick.playedCards.map((played) => {
            const player = players.find((p) => p.id === played.playerId);
            const isWinner = played.playerId === trick.winnerId;
            return (
              <div key={played.card.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <CardFace card={played.card} contract={contract} small />
                <span style={{ fontSize: "12px", fontWeight: isWinner ? "bold" : "normal", color: isWinner ? "var(--amber)" : "var(--text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "120px" }}>
                  {player?.name} {isWinner ? "🏆" : ""}
                </span>
              </div>
            );
          })}
        </div>
        {winner && (
          <div style={{ textAlign: "center", borderTop: "1px solid var(--line)", paddingTop: "12px", fontSize: "14px" }}>
            {t.winner}: <strong>{winner.name}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
