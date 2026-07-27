import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, GameType, Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord } from "../persistence";
import { isReplayable, replayStep, stepCount } from "../analysis/replay";
import CardFace from "./CardFace";
import { BotIcon, ChevronLeftIcon, ChevronRightIcon, SkipBackIcon, SkipForwardIcon, UserIcon } from "./icons";

interface ReplayScreenProps {
  game: GameRecord;
  round: RoundRecord;
  language: Language;
  onBack: () => void;
}

type Position = "bottom" | "left" | "top" | "right";
const POSITIONS: Position[] = ["bottom", "left", "top", "right"];

/** "+N" / "N" — the same signed-score formatting used across the app. */
function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

/**
 * Post-mortem replay of a single stored round (#85).
 *
 * Deliberately *not* a GameBoard "replay mode": GameBoard is wired to a live
 * `onAction` and a redacted `GameState`. This screen renders the pure
 * derivation from `analysis/replay.ts` instead — all four hands face-up,
 * shrinking card by card as the trick log is stepped through.
 */
export default function ReplayScreen({ game, round, language, onBack }: ReplayScreenProps) {
  const t = translations[language];
  const [step, setStep] = useState(0);

  const total = stepCount(round);
  const view = useMemo(() => replayStep(round, step), [round, step]);
  const atEnd = step >= total - 1;

  const go = useCallback(
    (next: number) => setStep(Math.max(0, Math.min(next, total - 1))),
    [total],
  );

  // Arrow keys drive playback; Home/End jump to the deal and the final card.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(step + 1);
      else if (event.key === "ArrowLeft") go(step - 1);
      else if (event.key === "Home") go(0);
      else if (event.key === "End") go(total - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step, total]);

  const contract = round.contract;
  const localIdx = game.players.findIndex((player) => player.id === game.localPlayerId);
  const seats = game.players.map((player, index) => ({
    player,
    position: POSITIONS[((index - Math.max(0, localIdx)) % 4 + 4) % 4],
  }));
  const positionOf = (playerId: string): Position =>
    seats.find((seat) => seat.player.id === playerId)?.position ?? "bottom";

  const label = contract ? gameLabel(language, contract.type, contract.calledSuit, contract.isTout) : "—";
  const declarer = contract ? game.players.find((player) => player.id === contract.declarerId) : undefined;

  if (!isReplayable(round)) {
    return (
      <main className="home-screen replay-screen">
        <div className="replay-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            <ChevronLeftIcon size={14} />
            {t.replayBack}
          </button>
        </div>
        <p className="muted">{t.replayNoData}</p>
      </main>
    );
  }

  return (
    <main className="home-screen replay-screen">
      <div className="replay-header">
        <button className="secondary-button" type="button" onClick={onBack}>
          <ChevronLeftIcon size={14} />
          {t.replayBack}
        </button>
        <span className="replay-chip round">
          {t.round} {round.roundNumber}
        </span>
        <span className="replay-chip contract">
          {label}
          {declarer ? ` · ${declarer.name}` : ""}
        </span>
        <span className="replay-progress">
          {t.trick} {view.trickNumber}/{round.tricks.length} · {t.replayCard} {view.cardNumber}/{view.trickSize}
        </span>
      </div>

      <div className="replay-table">
        {seats.map(({ player, position }) => (
          <div
            key={player.id}
            className={`replay-seat replay-seat-${position} ${
              contract?.declarerId === player.id ? "declarer" : ""
            }`}
          >
            <div className="replay-seat-head">
              {player.isHuman ? <UserIcon size={13} /> : <BotIcon size={13} />}
              <strong>{player.name}</strong>
              {contract?.declarerId === player.id && <span className="role-badge declarer">{t.caller}</span>}
              {contract?.type === GameType.SAUSPIEL && contract.partnerId === player.id && (
                <span className="role-badge partner">{t.partner}</span>
              )}
              <span className="replay-seat-points">
                {view.pointsByPlayer[player.id] ?? 0} {t.points}
              </span>
            </div>
            <div className="replay-hand">
              {(view.hands[player.id] ?? []).map((card: Card) => (
                <span key={card.id} className="replay-hand-card" data-card-id={card.id}>
                  <CardFace card={card} contract={contract} small />
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="replay-felt">
          {view.trick.plays.map((play) => (
            <div
              key={play.card.id}
              className={`replay-trick-slot slot-${positionOf(play.playerId)} ${
                view.trick.complete && view.trick.winnerId === play.playerId ? "winner" : ""
              }`}
            >
              <div className="replay-trick-card" data-card-id={play.card.id}>
                <CardFace card={play.card} contract={contract} small />
              </div>
            </div>
          ))}
          {view.trick.plays.length > 0 && (
            <span className="replay-trick-points">
              {view.trick.points} {t.points}
            </span>
          )}
        </div>
      </div>

      <div className="replay-controls">
        <button className="icon-button" type="button" onClick={() => go(0)} disabled={step === 0} title={t.replayStart}>
          <SkipBackIcon size={16} />
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
        >
          <ChevronLeftIcon size={14} />
          {t.replayPrev}
        </button>
        <input
          className="replay-scrub"
          type="range"
          min={0}
          max={total - 1}
          value={step}
          onChange={(event) => go(Number(event.target.value))}
          aria-label={t.replayTitle}
        />
        <button
          className="primary-button"
          type="button"
          onClick={() => go(step + 1)}
          disabled={atEnd}
        >
          {t.replayNext}
          <ChevronRightIcon size={14} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => go(total - 1)}
          disabled={atEnd}
          title={t.replayEnd}
        >
          <SkipForwardIcon size={16} />
        </button>
      </div>

      {atEnd && (
        <section className="panel replay-result">
          <h2>{t.replayResult}</h2>
          <div className="replay-result-body">
            <span>
              {t.points}: {round.result.declarerPoints} : {round.result.defenderPoints}
            </span>
            {round.result.laufende > 0 && (
              <span>
                {t.laufende}: {round.result.laufende}
              </span>
            )}
            {round.result.isSchwarz ? <span>{t.schwarz}</span> : round.result.isSchneider ? <span>{t.schneider}</span> : null}
            {(round.result.stossMultiplier ?? 1) > 1 && <span>{t.stoss} ×{round.result.stossMultiplier}</span>}
            <span className="replay-result-spacer" />
            {game.players.map((player) => {
              const change = round.result.scoreChanges[player.id] ?? 0;
              return (
                <span key={player.id} className={`stats-score ${change >= 0 ? "positive" : "negative"}`}>
                  {player.name} {signed(change)}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
