import { useMemo, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { GameRecord, StatsMode, loadGames, loadStats } from "../lib/stats";
import { BotIcon, ChartColumnIcon, UsersIcon } from "./icons";

interface StatsScreenProps {
  language: Language;
}

type Filter = "all" | StatsMode;

/** Newest games shown in the list; the store keeps more for later analysis. */
const VISIBLE_GAMES = 30;

export default function StatsScreen({ language }: StatsScreenProps) {
  const t = translations[language];
  const [filter, setFilter] = useState<Filter>("all");

  // Statistics only change when a list finishes, which is impossible while
  // this screen is mounted — reading once on mount is enough.
  const totals = useMemo(() => loadStats(), []);
  const games = useMemo(() => loadGames(), []);

  const played = filter === "all" ? totals.played : filter === "solo" ? totals.soloPlayed : totals.mpPlayed;
  const won = filter === "all" ? totals.won : filter === "solo" ? totals.soloWon : totals.mpWon;
  const lost = Math.max(0, played - won);
  const winRate = played > 0 ? `${Math.round((won / played) * 100)}%` : "—";

  const visible = games.filter((game) => filter === "all" || game.mode === filter).slice(0, VISIBLE_GAMES);
  const locale = language === "de" ? "de-DE" : "en-GB";

  return (
    <main className="home-screen stats-screen">
      <div className="stats-header">
        <h2>
          <ChartColumnIcon size={18} />
          {t.stats}
        </h2>
        <div className="mode-switch" role="tablist">
          {(["all", "multiplayer", "solo"] as Filter[]).map((option) => (
            <button
              key={option}
              className={filter === option ? "active" : ""}
              onClick={() => setFilter(option)}
              role="tab"
              aria-selected={filter === option}
              type="button"
            >
              {option === "multiplayer" && <UsersIcon />}
              {option === "solo" && <BotIcon />}
              {option === "all" ? t.statsAll : option === "multiplayer" ? t.statsMultiplayer : t.soloGame}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile">
          <small>{t.statsPlayed}</small>
          <strong>{played}</strong>
        </div>
        <div className="stat-tile won">
          <small>{t.statsWon}</small>
          <strong>{won}</strong>
        </div>
        <div className="stat-tile lost">
          <small>{t.statsLost}</small>
          <strong>{lost}</strong>
        </div>
        <div className="stat-tile">
          <small>{t.statsWinRate}</small>
          <strong>{winRate}</strong>
        </div>
      </div>

      <section className="panel stats-games-panel">
        <h2>{t.statsRecent}</h2>
        {visible.length === 0 ? (
          <p className="muted">{t.statsEmpty}</p>
        ) : (
          <div className="stats-game-list">
            {visible.map((game) => (
              <GameRow key={game.id} game={game} locale={locale} soloLabel={t.statsSoloOpponent} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function GameRow({ game, locale, soloLabel }: { game: GameRecord; locale: string; soloLabel: string }) {
  const score = game.finalScores[game.localPlayerId] ?? 0;
  const date = new Date(game.finishedAt).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });

  return (
    <div className="stats-game-row">
      <span className="stats-date">{date}</span>
      <span className="stats-mode-icon">{game.mode === "solo" ? <BotIcon size={14} /> : <UsersIcon size={14} />}</span>
      <span className="stats-opponent">{game.mode === "solo" ? soloLabel : (game.opponentName ?? "—")}</span>
      <span className={`stats-score ${score >= 0 ? "positive" : "negative"}`}>
        {score > 0 ? `+${score}` : score}
      </span>
      <span className={`stats-result ${game.won ? "won" : "lost"}`}>{game.won ? "W" : "L"}</span>
    </div>
  );
}
