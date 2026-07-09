import { Card, Contract, GameType, Language, Player, Trick } from "../types";
import { translations } from "../lib/i18n";
import { sortCardsForHand } from "../utils/gameLogic";
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
      className="rules-modal-overlay"
      style={{ zIndex: 80 }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="rules-modal-container" style={{ width: "min(680px, 94%)" }}>
        <div className="rules-modal-header" style={{ paddingBottom: "8px" }}>
          <h3 style={{ margin: 0 }}>{t.dealtCards}</h3>
          <button onClick={onClose} className="rules-modal-close-btn" type="button">
            <XIcon />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 0" }}>
          {players.map((player) => (
            <div key={player.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  flex: "0 0 88px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                {player.name}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", flex: 1 }}>
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
