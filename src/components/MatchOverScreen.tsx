import { GameState, Language, PlayerAction, PlayerActionType } from "../types";
import { translations } from "../lib/i18n";

interface MatchOverScreenProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onAction: (action: PlayerAction) => void;
  onQuit: () => void;
}

const TrophyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

export default function MatchOverScreen({ state, language, myPlayerId, onAction, onQuit }: MatchOverScreenProps) {
  const t = translations[language];
  const sortedPlayers = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
  const winner = sortedPlayers[0];
  const isHost = myPlayerId === "p1";

  function triggerRematch() {
    onAction({ type: PlayerActionType.REMATCH, playerId: myPlayerId });
  }

  return (
    <div className="round-over-overlay">
      <section className="round-over">
        <h2 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--amber)", justifyContent: "center" }}>
          <TrophyIcon />
          {t.matchOver}
        </h2>

        <p className="round-headline" style={{ textAlign: "center", fontSize: "19px", margin: "12px 0 20px" }}>
          🏆 {t.winner}: <strong>{winner.name}</strong> ({state.scores[winner.id] ?? 0} {t.points})
        </p>

        <h3>{t.standings}</h3>
        <div className="score-grid" style={{ marginBottom: "20px" }}>
          {sortedPlayers.map((player, idx) => {
            const total = state.scores[player.id] ?? 0;
            const isMatchWinner = player.id === winner.id;
            return (
              <div key={player.id} className={isMatchWinner ? "winner" : ""}>
                <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: "bold" }}>
                  Platz {idx + 1}
                </span>
                <strong>{player.name}</strong>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: total >= 0 ? "var(--green)" : "var(--red-2)" }}>
                  {total > 0 ? "+" : ""}{total}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {isHost ? (
            <button className="primary-button" onClick={triggerRematch} type="button" style={{ width: "100%" }}>
              {t.rematch}
            </button>
          ) : (
            <button className="primary-button" disabled type="button" style={{ width: "100%" }}>
              ⏳ {translations[language].readyWaiting}
            </button>
          )}
          <button className="secondary-button" onClick={onQuit} type="button" style={{ width: "100%" }}>
            {t.quit}
          </button>
        </div>
      </section>
    </div>
  );
}
