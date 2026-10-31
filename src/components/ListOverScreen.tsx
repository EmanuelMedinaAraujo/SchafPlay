import { GameState, Language, PlayerAction, PlayerActionType } from "../types";
import { signed, translations } from "../lib/i18n";
import { TrophyIcon } from "./icons";
import { summaryInfo } from "./RoundOverScreen";

interface ListOverScreenProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onAction: (action: PlayerAction) => void;
  onQuit: () => void;
}

export default function ListOverScreen({ state, language, myPlayerId, onAction, onQuit }: ListOverScreenProps) {
  const t = translations[language];
  const { otherName, iAmReady, otherReady, sortedByScore: sortedPlayers } = summaryInfo(state, myPlayerId);
  const winner = sortedPlayers[0];

  function triggerRematch() {
    onAction({ type: PlayerActionType.REMATCH, playerId: myPlayerId });
  }

  return (
    <div className="round-over-overlay">
      <section className="round-over">
        <h2 className="list-over-title">
          <TrophyIcon size={24} />
          {t.listOver}
        </h2>

        <p className="round-headline list-over-headline">
          🏆 {t.winner}: <strong>{winner.name}</strong> ({state.scores[winner.id] ?? 0} {t.points})
        </p>

        <h3>{t.standings}</h3>
        <div className="score-grid list-over-grid">
          {sortedPlayers.map((player, idx) => {
            const total = state.scores[player.id] ?? 0;
            const isListWinner = player.id === winner.id;
            return (
              <div key={player.id} className={isListWinner ? "winner" : ""}>
                <span className="list-over-place">
                  {t.place} {idx + 1}
                </span>
                <strong>{player.name}</strong>
                <span className={total >= 0 ? "list-over-total" : "list-over-total negative"}>
                  {signed(total)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="list-over-actions">
          <button className="primary-button" onClick={triggerRematch} disabled={iAmReady} type="button">
            {iAmReady ? `⏳ ${t.readyWaiting}` : t.rematch}
          </button>
          <button className="secondary-button" onClick={onQuit} type="button">
            {t.quit}
          </button>
        </div>
        <p className="muted list-over-status">
          {otherName}: {otherReady ? `✓ ${t.isReady}` : `… ${t.notReady}`}
        </p>
      </section>
    </div>
  );
}
