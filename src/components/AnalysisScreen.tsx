import { useEffect, useState } from "react";
import { Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord, gameHistoryStore } from "../persistence";
import { BotIcon, HistoryIcon, PlayIcon, UsersIcon } from "./icons";

interface AnalysisScreenProps {
  language: Language;
  /** Opens the dedicated ReplayScreen for one recorded round (routed by App). */
  onReplay: (game: GameRecord, round: RoundRecord) => void;
}

/** Newest games listed; the store keeps more. Same cap as the stats screen. */
const VISIBLE_GAMES = 30;

/** "+N" / "N" — the same signed-score formatting used across the app. */
function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

/**
 * Analysis view (#85, part of #16): the recorded games row by row — date,
 * mode, opponent and result — expanding into their rounds, each of which can
 * be replayed trick by trick.
 *
 * The list is deliberately the same shape as the stats screen's recent-games
 * list, so both read identically; only the per-round replay button is new.
 */
export default function AnalysisScreen({ language, onReplay }: AnalysisScreenProps) {
  const t = translations[language];
  const [games, setGames] = useState<GameRecord[]>([]);
  const locale = language === "de" ? "de-DE" : "en-GB";

  // Stored games only change when a list finishes, which cannot happen while
  // this screen is mounted — one read on mount is enough (IndexedDB is async).
  useEffect(() => {
    let active = true;
    gameHistoryStore.loadGames().then((value) => active && setGames(value));
    return () => {
      active = false;
    };
  }, []);

  const visible = games.slice(0, VISIBLE_GAMES);

  return (
    <main className="home-screen analysis-screen">
      <div className="stats-header">
        <h2>
          <HistoryIcon size={18} />
          {t.analysis}
        </h2>
      </div>

      <section className="panel stats-games-panel">
        <h2>{t.analysisGames}</h2>
        <p className="muted stats-panel-hint">{t.analysisHint}</p>
        {visible.length === 0 ? (
          <p className="muted">{t.statsEmpty}</p>
        ) : (
          <div className="stats-game-list">
            {visible.map((game) => (
              <GameItem key={game.id} game={game} language={language} locale={locale} onReplay={onReplay} />
            ))}
          </div>
        )}
      </section>
    </main>
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
  onReplay: (game: GameRecord, round: RoundRecord) => void;
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
              onReplay={() => onReplay(game, round)}
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
  onReplay: () => void;
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
    <div className="stats-round-row analysis-round-row">
      <span className="stats-round-num">
        {t.round} {round.roundNumber}
      </span>
      <span className="stats-round-contract">
        {label}
        {declarer ? ` · ${declarer.name}` : ""}
        {extras ? ` · ${extras}` : ""}
      </span>
      <span className={`stats-score ${change >= 0 ? "positive" : "negative"}`}>{signed(change)}</span>
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
    </div>
  );
}
