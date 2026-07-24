import { useEffect, useMemo, useState } from "react";
import { GameType, Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord } from "../persistence";
import { buildReplay, replayViewAt } from "../analysis";
import CardFace from "./CardFace";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "./icons";

interface ReplayScreenProps {
  game: GameRecord;
  round: RoundRecord;
  language: Language;
  onBack: () => void;
}

/** "+N" / "N" — the same signed-score formatting used across the app. */
function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

/**
 * Trick-by-trick replay of one recorded round (#85). A post-mortem view: all
 * four hands lie face-up and shrink as their cards are played, the current
 * trick sits on the felt, and the running Augen/trick counts update as each
 * trick completes.
 *
 * Deliberately not a GameBoard "replay mode" — GameBoard is wired to a live
 * onAction/engine. Everything here derives from the stored RoundRecord via the
 * pure analysis/replay module; this component only renders and steps.
 */
export default function ReplayScreen({ game, round, language, onBack }: ReplayScreenProps) {
  const t = translations[language];
  const [step, setStep] = useState(0);

  const replay = useMemo(() => buildReplay(round), [round]);
  const view = useMemo(() => replayViewAt(replay, step), [replay, step]);

  // Restart from the deal whenever a different round is opened.
  useEffect(() => setStep(0), [replay]);

  const atStart = step === 0;
  const atEnd = step >= replay.totalSteps;
  const goto = (next: number) => setStep(Math.max(0, Math.min(next, replay.totalSteps)));

  // Arrow keys step through the round on a keyboard; touch uses the buttons.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goto(step + 1);
      else if (event.key === "ArrowLeft") goto(step - 1);
      else if (event.key === "Home") goto(0);
      else if (event.key === "End") goto(replay.totalSteps);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, replay.totalSteps]);

  const contract = replay.contract;
  const isRamsch = contract?.type === GameType.RAMSCH;
  const nameOf = (playerId: string | null | undefined): string =>
    (playerId && game.players.find((player) => player.id === playerId)?.name) || "";
  const contractLabel = contract
    ? gameLabel(language, contract.type, contract.calledSuit, contract.isTout)
    : "—";

  // Seats in table order, rotated so the recording device's own seat is first.
  const seats = useMemo(() => {
    const ordered = game.players.filter((player) => replay.seatIds.includes(player.id));
    const mine = ordered.findIndex((player) => player.id === game.localPlayerId);
    return mine <= 0 ? ordered : [...ordered.slice(mine), ...ordered.slice(0, mine)];
  }, [game.players, game.localPlayerId, replay.seatIds]);

  const result = round.result;
  const myChange = result.scoreChanges[game.localPlayerId] ?? 0;
  const headline = isRamsch
    ? `${nameOf(result.ramsch?.playerId)} ${result.ramsch?.isDurchmarsch ? t.ramschDurchmarsch : t.ramschLoses}`
    : `${result.declarerWon ? t.declarersWin : t.defendersWin} · ${result.declarerPoints}:${result.defenderPoints}`;

  const trickNumber = replay.tricks.length === 0 ? 0 : view.trickIndex + 1;

  return (
    <main className="home-screen replay-screen">
      <div className="replay-header">
        <button className="icon-button" onClick={onBack} title={t.replayBack} type="button">
          <ArrowLeftIcon />
        </button>
        <span className="replay-chip strong">
          {t.round} {round.roundNumber}
        </span>
        <span className="replay-chip contract">
          {contractLabel}
          {!isRamsch && contract ? ` · ${nameOf(contract.declarerId)}` : ""}
          {!isRamsch && contract?.partnerId ? ` + ${nameOf(contract.partnerId)}` : ""}
        </span>
        <span className="replay-chip">
          {t.trick} {trickNumber}/{replay.tricks.length}
        </span>
        <span className="replay-spacer" />
        <span className={`replay-chip result ${myChange >= 0 ? "positive" : "negative"}`}>
          {headline} · {signed(myChange)}
        </span>
      </div>

      {replay.totalSteps === 0 ? (
        <p className="muted">{t.replayNoTricks}</p>
      ) : (
        <>
          <div className="replay-body">
            <div className="replay-seats">
              {seats.map((player) => {
                const hand = view.hands[player.id] ?? [];
                const role = isRamsch
                  ? null
                  : contract?.declarerId === player.id
                    ? t.caller
                    : contract?.partnerId === player.id
                      ? t.partner
                      : null;
                return (
                  <div
                    key={player.id}
                    className={`replay-seat ${view.nextPlayerId === player.id ? "to-play" : ""}`}
                    data-player-id={player.id}
                  >
                    <span className="replay-seat-info">
                      <span className="replay-seat-name">{player.name}</span>
                      {role && <span className="replay-seat-role">{role}</span>}
                      <span className="replay-seat-stats">
                        {view.points[player.id] ?? 0} {t.points} · {view.tricksWon[player.id] ?? 0} {t.replayTricks}
                      </span>
                    </span>
                    <span className="replay-seat-hand">
                      {hand.map((card) => (
                        <CardFace key={card.id} card={card} contract={contract} small />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="replay-table">
              <div className="replay-trick-felt">
                {view.tableCards.map((played) => (
                  <div
                    key={played.card.id}
                    className={`replay-trick-card ${view.lastPlay?.card.id === played.card.id ? "latest" : ""} ${
                      view.trickWinnerId === played.playerId ? "winner" : ""
                    }`}
                    data-card-id={played.card.id}
                  >
                    <span className="replay-trick-name">{nameOf(played.playerId)}</span>
                    <CardFace card={played.card} contract={contract} small />
                  </div>
                ))}
              </div>
              <p className="muted replay-table-status">
                {view.trickWinnerId
                  ? `${t.replayTrickTo} ${nameOf(view.trickWinnerId)}`
                  : view.nextPlayerId
                    ? `${t.replayToPlay}: ${nameOf(view.nextPlayerId)}`
                    : t.roundOver}
              </p>
            </div>
          </div>

          <div className="replay-controls">
            <button className="icon-button" onClick={() => goto(0)} disabled={atStart} title={t.replayFirst} type="button">
              <SkipBackIcon />
            </button>
            <button
              className="icon-button"
              onClick={() => goto(step - 1)}
              disabled={atStart}
              title={t.replayPrev}
              type="button"
            >
              <ChevronLeftIcon />
            </button>
            <span className="replay-step-label">
              {atStart ? t.replayDeal : `${t.replayStep} ${step}/${replay.totalSteps}`}
            </span>
            <button
              className="icon-button replay-next"
              onClick={() => goto(step + 1)}
              disabled={atEnd}
              title={t.replayNext}
              type="button"
            >
              <ChevronRightIcon />
            </button>
            <button
              className="icon-button"
              onClick={() => goto(replay.totalSteps)}
              disabled={atEnd}
              title={t.replayLast}
              type="button"
            >
              <SkipForwardIcon />
            </button>
          </div>
        </>
      )}
    </main>
  );
}
