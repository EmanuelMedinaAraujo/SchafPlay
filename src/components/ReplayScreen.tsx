import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, GameType, Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord } from "../persistence";
import { isReplayable, replayStep, stepCount } from "../analysis/replay";
import CardFace from "./CardFace";
import { BotIcon, ChevronLeftIcon, ChevronRightIcon, SkipBackIcon, SkipForwardIcon, UserIcon } from "./icons";

interface ReplayScreenProps {
  game: GameRecord;
  /** Index into `game.rounds` to open on; playback continues from there. */
  startRoundIndex: number;
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
 * The nearest replayable round at or after `from`; -1 when there is none.
 * Rounds with an empty trick log are skipped rather than landed on: the
 * fallback panel has no nav, so stopping on one strands the viewer.
 */
function nearestReplayable(rounds: RoundRecord[], from: number, direction: 1 | -1): number {
  for (let i = from; i >= 0 && i < rounds.length; i += direction) {
    if (isReplayable(rounds[i])) return i;
  }
  return -1;
}

/**
 * Post-mortem replay of a stored game (#85). Deliberately *not* a GameBoard
 * "replay mode" — GameBoard is wired to a live `onAction` and a redacted
 * `GameState`. Playback spans the whole list: the round is part of the cursor,
 * so stepping rolls across round borders in both directions.
 */
export default function ReplayScreen({ game, startRoundIndex, language, onBack }: ReplayScreenProps) {
  const t = translations[language];
  const rounds = game.rounds;
  const [roundIndex, setRoundIndex] = useState(() => {
    const start = Math.max(0, Math.min(startRoundIndex, rounds.length - 1));
    const forward = nearestReplayable(rounds, start, 1);
    return forward >= 0 ? forward : Math.max(0, nearestReplayable(rounds, start, -1));
  });
  const [step, setStep] = useState(0);

  const round = rounds[roundIndex];
  const total = round ? stepCount(round) : 1;
  const view = useMemo(() => (round ? replayStep(round, step) : null), [round, step]);

  const atRoundEnd = step >= total - 1;
  const nextRound = nearestReplayable(rounds, roundIndex + 1, 1);
  const prevRound = nearestReplayable(rounds, roundIndex - 1, -1);
  const hasNextRound = nextRound >= 0;
  const hasPrevRound = prevRound >= 0;
  const atGameEnd = atRoundEnd && !hasNextRound;

  /** Jump to a (already resolved, replayable) round's deal or its last card. */
  const openRound = useCallback(
    (index: number, atLastStep = false) => {
      const target = rounds[index];
      if (!target || !isReplayable(target)) return;
      setRoundIndex(index);
      setStep(atLastStep ? stepCount(target) - 1 : 0);
    },
    [rounds],
  );

  /** One step forward/back across the whole list, rolling over round borders. */
  const go = useCallback(
    (next: number) => {
      if (next > total - 1) {
        if (hasNextRound) openRound(nextRound);
        return;
      }
      if (next < 0) {
        if (hasPrevRound) openRound(prevRound, true);
        return;
      }
      setStep(next);
    },
    [hasNextRound, hasPrevRound, nextRound, openRound, prevRound, total],
  );

  // Arrow keys drive playback; Home/End jump to this round's deal and last card.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(step + 1);
      else if (event.key === "ArrowLeft") go(step - 1);
      else if (event.key === "Home") setStep(0);
      else if (event.key === "End") setStep(total - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step, total]);

  const contract = round?.contract ?? null;
  const localIdx = game.players.findIndex((player) => player.id === game.localPlayerId);
  const seats = game.players.map((player, index) => ({
    player,
    position: POSITIONS[((index - Math.max(0, localIdx)) % 4 + 4) % 4],
  }));
  const positionOf = (playerId: string): Position =>
    seats.find((seat) => seat.player.id === playerId)?.position ?? "bottom";

  const label = contract ? gameLabel(language, contract.type, contract.calledSuit, contract.isTout) : "—";
  const declarer = contract ? game.players.find((player) => player.id === contract.declarerId) : undefined;

  const backButton = (
    <button className="secondary-button" type="button" onClick={onBack}>
      <ChevronLeftIcon size={14} />
      {t.replayBack}
    </button>
  );

  if (!round || !view || !isReplayable(round)) {
    return (
      <main className="replay-screen">
        <div className="replay-header">{backButton}</div>
        <p className="muted">{t.replayNoData}</p>
      </main>
    );
  }

  return (
    <main className="replay-screen">
      <div className="replay-header">
        {backButton}
        <div className="replay-round-nav">
          <button
            className="icon-button"
            type="button"
            onClick={() => openRound(prevRound)}
            disabled={!hasPrevRound}
            title={t.replayPrevRound}
          >
            <ChevronLeftIcon size={14} />
          </button>
          <span className="replay-chip round">
            {t.round} {round.roundNumber}/{rounds.length}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => openRound(nextRound)}
            disabled={!hasNextRound}
            title={t.replayNextRound}
          >
            <ChevronRightIcon size={14} />
          </button>
        </div>
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
              <span className="replay-seat-points">
                {view.pointsByPlayer[player.id] ?? 0} {t.points}
              </span>
              {contract?.declarerId === player.id && <span className="role-badge declarer">{t.caller}</span>}
              {contract?.type === GameType.SAUSPIEL && contract.partnerId === player.id && (
                <span className="role-badge partner">{t.partner}</span>
              )}
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
              className={`replay-trick-slot replay-slot-${positionOf(play.playerId)} ${
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

      {atRoundEnd && (
        <section className="replay-result">
          <strong>{t.replayResult}</strong>
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
        </section>
      )}

      <div className="replay-controls">
        <button
          className="icon-button"
          type="button"
          onClick={() => setStep(0)}
          disabled={step === 0}
          title={t.replayStart}
        >
          <SkipBackIcon size={16} />
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0 && !hasPrevRound}
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
          onChange={(event) => setStep(Number(event.target.value))}
          aria-label={t.replayTitle}
        />
        {/* At a round's last card the primary action rolls into the next round,
            so a whole game plays through without leaving the screen. */}
        <button
          className="primary-button"
          type="button"
          onClick={() => go(step + 1)}
          disabled={atGameEnd}
        >
          {atRoundEnd ? t.replayNextRound : t.replayNext}
          <ChevronRightIcon size={14} />
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={() => setStep(total - 1)}
          disabled={atRoundEnd}
          title={t.replayEnd}
        >
          <SkipForwardIcon size={16} />
        </button>
      </div>
    </main>
  );
}
