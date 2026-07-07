import { GameState, Language, PlayerAction, PlayerActionType } from "../types";
import { translations } from "../lib/i18n";
import { TrophyIcon } from "./icons";

interface MatchOverScreenProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onAction: (action: PlayerAction) => void;
  onQuit: () => void;
}

export default function MatchOverScreen({ state, language, myPlayerId, onAction, onQuit }: MatchOverScreenProps) {
  const t = translations[language];
  const sortedPlayers = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
  const winner = sortedPlayers[0];
  const iAmReady = Boolean(state.readyState[myPlayerId]);
  const otherId = myPlayerId === "p1" ? "p3" : "p1";
  const otherReady = Boolean(state.readyState[otherId]);
  const otherName = state.players.find((player) => player.id === otherId)?.name ?? "";

  function triggerRematch() {
    onAction({ type: PlayerActionType.REMATCH, playerId: myPlayerId });
  }

  return (
    <div className="round-over-overlay">
      <section className="round-over">
        <h2 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--amber)", justifyContent: "center" }}>
          <TrophyIcon size={24} />
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
          <button
            className="primary-button"
            onClick={triggerRematch}
            disabled={iAmReady}
            type="button"
            style={{ width: "100%" }}
          >
            {iAmReady ? `⏳ ${t.readyWaiting}` : t.rematch}
          </button>
          <button className="secondary-button" onClick={onQuit} type="button" style={{ width: "100%" }}>
            {t.quit}
          </button>
        </div>
        <p className="muted" style={{ textAlign: "center", marginTop: "8px", fontSize: "13px" }}>
          {otherName}: {otherReady ? `✓ ${t.isReady}` : `… ${t.notReady}`}
        </p>
      </section>
    </div>
  );
}
