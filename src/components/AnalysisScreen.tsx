import { useEffect, useState } from "react";
import { Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord, gameHistoryStore } from "../persistence";
import { isReplayable } from "../analysis/replay";
import ReplayScreen from "./ReplayScreen";
import { BotIcon, HistoryIcon, PlayIcon, UsersIcon } from "./icons";

interface AnalysisScreenProps {
  language: Language;
}

/** Newest games offered for analysis; the store keeps more. */
const VISIBLE_GAMES = 30;

/** "+N" / "N" — the same signed-score formatting used across the app. */
function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

interface Selection {
  game: GameRecord;
  round: RoundRecord;
}

/**
 * Analysis view (#85, first slice of #16): a row per recorded list — date,
 * mode, opponent, result — expanding into its rounds, each with a replay
 * button. Selecting a round hands over to ReplayScreen; nothing here is
 * derived live, it all comes from the stored history.
 */
export default function AnalysisScreen({ language }: AnalysisScreenProps) {
  const t = translations[language];
  const [games, setGames] = useState<GameRecord[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);

  // History only changes when a list finishes, which cannot happen while this
  // screen is mounted — one read on mount is enough (same as StatsScreen).
  useEffect(() => {
    let active = true;
    gameHistoryStore.loadGames().then((value) => active && setGames(value));
    return () => {
      active = false;
    };
  }, []);

  if (selection) {
    return (
      <ReplayScreen
        game={selection.game}
        round={selection.round}
        language={language}
        onBack={() => setSelection(null)}
      />
    );
  }

  const locale = language === "de" ? "de-DE" : "en-GB";
  const visible = games.slice(0, VISIBLE_GAMES);

  return (
    <main className="home-screen stats-screen analysis-screen">
      <div className="stats-header">
        <h2>
          <HistoryIcon size={18} />
          {t.analysis}
        </h2>
      </div>
      <p className="muted stats-panel-hint">{t.analysisIntro}</p>

      <section className="panel stats-games-panel">
        <h2>{t.statsRecent}</h2>
        {visible.length === 0 ? (
          <p className="muted">{t.analysisEmpty}</p>
        ) : (
          <div className="stats-game-list">
            {visible.map((game) => (
              <AnalysisGameItem
                key={game.id}
                game={game}
                language={language}
                locale={locale}
                onReplay={(round) => setSelection({ game, round })}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function AnalysisGameItem({
  game,
  language,
  locale,
  onReplay,
}: {
  game: GameRecord;
  language: Language;
  locale: string;
  onReplay: (round: RoundRecord) => void;
}) {
  const t = translations[language];
  const [expanded, setExpanded] = useState(false);
  const score = game.finalScores[game.localPlayerId] ?? 0;
  const date = new Date(game.finishedAt).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
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
          <p className="muted analysis-rounds-hint">{t.analysisRoundsHint}</p>
          {game.rounds.map((round) => (
            <AnalysisRoundRow
              key={round.roundNumber}
              round={round}
              game={game}
              language={language}
              onReplay={() => onReplay(round)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisRoundRow({
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
  // Old records (or a round abandoned mid-play) may carry no trick log.
  const replayable = isReplayable(round);

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
        className="secondary-button analysis-replay-button"
        type="button"
        onClick={onReplay}
        disabled={!replayable}
        title={replayable ? t.replay : t.replayNoData}
      >
        <PlayIcon size={12} />
        {t.replay}
      </button>
    </div>
  );
}
