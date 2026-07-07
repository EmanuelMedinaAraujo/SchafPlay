import { GameState, Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";

/** Inline SVG icons — replaces lucide-react Check/Trophy */
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const TrophyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

interface RoundOverScreenProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onReady: () => void;
}

export default function RoundOverScreen({ state, language, myPlayerId, onReady }: RoundOverScreenProps) {
  const result = state.lastResult;
  const t = translations[language];
  if (!result) return null;

  const otherId = myPlayerId === "p1" ? "p3" : "p1";
  const otherName = state.players.find((player) => player.id === otherId)?.name ?? "";
  const iAmReady = Boolean(state.readyState[myPlayerId]);
  const otherReady = Boolean(state.readyState[otherId]);

  const sortedByScore = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  return (
    <div className="round-over-overlay">
      <section className="round-over">
        <h2>
          <TrophyIcon />
          {t.roundOver}
        </h2>
        <p className="round-headline">
          {result.declarerWon ? t.declarersWin : t.defendersWin} · {result.declarerPoints}:{result.defenderPoints} {t.points}
        </p>
        <p className="muted">
          {t.game}: {gameLabel(language, result.contract.type, result.contract.calledSuit, result.contract.isTout)}
          {result.isSchwarz ? ` · ${t.schwarz}` : result.isSchneider ? ` · ${t.schneider}` : ""}
          {result.laufende > 0 ? ` · ${result.laufende} ${t.laufende}` : ""}
        </p>

        <h3>{t.standings}</h3>
        <div className="score-grid">
          {sortedByScore.map((player) => {
            const change = result.scoreChanges[player.id] ?? 0;
            const total = state.scores[player.id] ?? 0;
            return (
              <div key={player.id} className={result.winnerIds.includes(player.id) ? "winner" : ""}>
                <strong>{player.name}</strong>
                <span className={change >= 0 ? "pos" : "neg"}>
                  {change >= 0 ? "+" : ""}
                  {change}
                </span>
                <small>
                  Σ {total > 0 ? "+" : ""}
                  {total}
                </small>
              </div>
            );
          })}
        </div>

        <button className="primary-button" onClick={onReady} disabled={iAmReady} type="button">
          {iAmReady ? <CheckIcon /> : null}
          {iAmReady ? t.readyWaiting : t.ready}
        </button>
        <p className="muted">
          {otherName}: {otherReady ? `✓ ${t.isReady}` : `… ${t.notReady}`}
        </p>
      </section>
    </div>
  );
}
