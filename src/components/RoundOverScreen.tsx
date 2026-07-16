import { useState } from "react";
import { GameState, Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { CheckIcon, TrophyIcon } from "./icons";
import RoundCardsPopup from "./RoundCardsPopup";

interface RoundOverScreenProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onReady: () => void;
}

export default function RoundOverScreen({ state, language, myPlayerId, onReady }: RoundOverScreenProps) {
  const result = state.lastResult;
  const t = translations[language];
  const [cardsOpen, setCardsOpen] = useState(false);
  if (!result) return null;

  const otherId = myPlayerId === "p1" ? "p3" : "p1";
  const otherName = state.players.find((player) => player.id === otherId)?.name ?? "";
  const iAmReady = Boolean(state.readyState[myPlayerId]);
  const otherReady = Boolean(state.readyState[otherId]);
  // The last round shows its summary first; readying up then reveals the list
  // summary rather than dealing a new round (#27).
  const isLastRound = state.roundNumber >= state.totalRounds;

  const sortedByScore = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));

  // Ramsch (#11) has no declaring side — the headline names the key player
  // (the loser who pays all, or a Durchmarsch winner who takes all) instead.
  const ramsch = result.ramsch;
  const ramschName = ramsch ? state.players.find((player) => player.id === ramsch.playerId)?.name ?? "" : "";
  const headline = ramsch
    ? `${ramschName} ${ramsch.isDurchmarsch ? t.ramschDurchmarsch : t.ramschLoses} · ${result.declarerPoints} ${t.points}`
    : `${result.declarerWon ? t.declarersWin : t.defendersWin} · ${result.declarerPoints}:${result.defenderPoints} ${t.points}`;
  const detail = ramsch
    ? `${t.game}: ${gameLabel(language, result.contract.type)}${
        ramsch.jungfrauIds.length > 0 ? ` · ${ramsch.jungfrauIds.length}× ${t.jungfrau}` : ""
      }`
    : `${t.game}: ${gameLabel(language, result.contract.type, result.contract.calledSuit, result.contract.isTout)}${
        result.isSchwarz ? ` · ${t.schwarz}` : result.isSchneider ? ` · ${t.schneider}` : ""
      }${result.laufende > 0 ? ` · ${result.laufende} ${t.laufende}` : ""}`;

  return (
    <>
    <div className="round-over-overlay">
      <section className="round-over">
        <h2>
          <TrophyIcon />
          {t.roundOver}
        </h2>
        <p className="round-headline">{headline}</p>
        <p className="muted">{detail}</p>

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

        <div className="round-over-footer">
          <button className="secondary-button" onClick={() => setCardsOpen(true)} type="button">
            {t.showCards}
          </button>
          <p className="muted round-over-status">
            {otherName}: {otherReady ? `✓ ${t.isReady}` : `… ${t.notReady}`}
          </p>
        </div>
        <button className="primary-button" onClick={onReady} disabled={iAmReady} type="button">
          {iAmReady ? <CheckIcon size={18} /> : null}
          {iAmReady ? t.readyWaiting : isLastRound ? t.toFinalStandings : t.ready}
        </button>
      </section>
    </div>
    {cardsOpen && (
      <RoundCardsPopup
        players={state.players}
        tricks={state.tricks}
        contract={result.contract}
        language={language}
        onClose={() => setCardsOpen(false)}
      />
    )}
    </>
  );
}
