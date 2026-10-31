import { useState } from "react";
import { Language } from "../types";
import { declarationLabel, signed, translations } from "../lib/i18n";
import { GameRecord, RoundRecord } from "../persistence";
import { isReplayable } from "../analysis/replay";
import { BotIcon, PlayIcon, UsersIcon } from "./icons";

/** Newest games listed in the stats and analysis views; the store keeps more. */
export const VISIBLE_GAMES = 30;

interface GameHistoryItemProps {
  game: GameRecord;
  language: Language;
  /** Analysis view (#85): adds replay buttons — the whole list, and one per round. */
  onReplay?: (roundIndex: number) => void;
}

/** One recorded list: a summary row that expands into its rounds. */
export default function GameHistoryItem({ game, language, onReplay }: GameHistoryItemProps) {
  const t = translations[language];
  const [expanded, setExpanded] = useState(false);
  const score = game.finalScores[game.localPlayerId] ?? 0;
  const date = new Date(game.finishedAt).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const hasRounds = game.rounds.length > 0;
  // Where "play the whole list" starts; -1 when nothing can be replayed.
  const firstPlayable = game.rounds.findIndex(isReplayable);

  const row = (
    <button
      className="stats-game-row"
      type="button"
      onClick={() => hasRounds && setExpanded((value) => !value)}
      aria-expanded={expanded}
      title={hasRounds ? (expanded ? t.statsHideRounds : t.statsShowRounds) : undefined}
    >
      <span className="stats-date">{date}</span>
      <span className="stats-mode-icon">{game.mode === "solo" ? <BotIcon size={14} /> : <UsersIcon size={14} />}</span>
      <span className="stats-opponent">{game.mode === "solo" ? t.statsSoloOpponent : (game.opponentName ?? "—")}</span>
      <span className={`stats-score ${score >= 0 ? "positive" : "negative"}`}>{signed(score)}</span>
      <span className={`stats-result ${game.won ? "won" : "lost"}`}>{game.won ? "W" : "L"}</span>
    </button>
  );

  return (
    <div className="stats-game-item">
      {onReplay ? (
        <div className="analysis-game-row-wrap">
          {row}
          {/* Play the whole list straight from the collapsed row. While expanded
              the per-round buttons say the same thing more precisely, so this
              one steps aside rather than competing with them. */}
          {!expanded && firstPlayable >= 0 && (
            <button
              className="secondary-button analysis-replay-button analysis-play-game"
              type="button"
              onClick={() => onReplay(firstPlayable)}
              title={t.replayWholeGame}
              aria-label={t.replay}
            >
              <PlayIcon size={12} />
            </button>
          )}
        </div>
      ) : (
        row
      )}
      {expanded && hasRounds && (
        <div className="stats-round-detail">
          {onReplay && <p className="muted analysis-rounds-hint">{t.analysisRoundsHint}</p>}
          {game.rounds.map((round, index) => (
            <RoundRow
              key={round.roundNumber}
              round={round}
              game={game}
              language={language}
              onReplay={onReplay && (() => onReplay(index))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundRow({
  round,
  game,
  language,
  onReplay,
}: {
  round: RoundRecord;
  game: GameRecord;
  language: Language;
  onReplay?: () => void;
}) {
  const t = translations[language];
  const contract = round.contract;
  const declarer = contract ? game.players.find((player) => player.id === contract.declarerId) : undefined;
  const change = round.result.scoreChanges[game.localPlayerId] ?? 0;
  const label = contract ? declarationLabel(language, contract) : "—";
  const extras = [round.result.isSchwarz ? t.schwarz : round.result.isSchneider ? t.schneider : null]
    .filter(Boolean)
    .join(" · ");
  // Old records (or a round abandoned mid-play) may carry no trick log.
  const replayable = isReplayable(round);

  return (
    <div className={onReplay ? "stats-round-row analysis-round-row" : "stats-round-row"}>
      <span className="stats-round-num">
        {t.round} {round.roundNumber}
      </span>
      <span className="stats-round-contract">
        {label}
        {declarer ? ` · ${declarer.name}` : ""}
        {extras ? ` · ${extras}` : ""}
      </span>
      <span className={`stats-score ${change >= 0 ? "positive" : "negative"}`}>{signed(change)}</span>
      {onReplay && (
        <button
          className="secondary-button analysis-replay-button"
          type="button"
          onClick={onReplay}
          disabled={!replayable}
          title={replayable ? t.replay : t.replayNoData}
          aria-label={t.replay}
        >
          <PlayIcon size={12} />
        </button>
      )}
    </div>
  );
}
