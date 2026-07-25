import { useState } from "react";
import { Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord } from "../persistence";
import { BotIcon, PlayIcon, UsersIcon } from "./icons";

/**
 * The recorded-games list, shared by the statistics screen and the analysis
 * screen (#85). Both show the same rows — date, mode, opponent, score, result,
 * expanding into the game's rounds — and the two must not drift, so the markup
 * lives here once. The analysis screen is the only caller that passes
 * `onReplay`, which adds the per-round replay button.
 */

/** Newest games shown in a list; the store keeps more for later analysis. */
export const VISIBLE_GAMES = 30;

/** "+N" / "N" — the signed-score formatting used across the app. */
export function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

interface GameHistoryListProps {
  games: GameRecord[];
  language: Language;
  /** When given, each round row gets a replay button (analysis screen only). */
  onReplay?: (game: GameRecord, round: RoundRecord) => void;
}

export default function GameHistoryList({ games, language, onReplay }: GameHistoryListProps) {
  const locale = language === "de" ? "de-DE" : "en-GB";
  return (
    <div className="stats-game-list">
      {games.map((game) => (
        <GameItem key={game.id} game={game} language={language} locale={locale} onReplay={onReplay} />
      ))}
    </div>
  );
}

function GameItem({
  game,
  language,
  locale,
  onReplay,
}: {
  game: GameRecord;
  language: Language;
  locale: string;
  onReplay?: (game: GameRecord, round: RoundRecord) => void;
}) {
  const t = translations[language];
  const [expanded, setExpanded] = useState(false);
  const score = game.finalScores[game.localPlayerId] ?? 0;
  const date = new Date(game.finishedAt).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
  const hasRounds = game.rounds.length > 0;

  return (
    <div className="stats-game-item">
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
      {expanded && hasRounds && (
        <div className="stats-round-detail">
          {game.rounds.map((round) => (
            <RoundRow
              key={round.roundNumber}
              round={round}
              game={game}
              language={language}
              onReplay={onReplay && (() => onReplay(game, round))}
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
  const label = contract ? gameLabel(language, contract.type, contract.calledSuit, contract.isTout) : "—";
  const extras = [round.result.isSchwarz ? t.schwarz : round.result.isSchneider ? t.schneider : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`stats-round-row ${onReplay ? "analysis-round-row" : ""}`}>
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
          className="text-button analysis-replay-btn"
          type="button"
          onClick={onReplay}
          disabled={round.tricks.length === 0}
          title={round.tricks.length === 0 ? t.replayNoTricks : t.replay}
        >
          <PlayIcon size={13} />
          {t.replay}
        </button>
      )}
    </div>
  );
}
