import { useEffect, useMemo, useState } from "react";
import { GameType, Language } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import { GameRecord, RoundRecord, StatsMode, StatsTotals, gameHistoryStore } from "../persistence";
import { BotIcon, ChartColumnIcon, UsersIcon } from "./icons";

const EMPTY_TOTALS: StatsTotals = { played: 0, won: 0, soloPlayed: 0, soloWon: 0, mpPlayed: 0, mpWon: 0 };

interface StatsScreenProps {
  language: Language;
}

type Filter = "all" | StatsMode;

/** Newest games shown in the list; the store keeps more for later analysis. */
const VISIBLE_GAMES = 30;
/** Newest lists plotted in the trend chart (oldest → newest, left → right). */
const TREND_GAMES = 20;

/** Contract families shown in the per-contract table, in bidding-priority order. */
type ContractFamily = "SAUSPIEL" | "WENZ" | "SOLO" | "TOUT";
const CONTRACT_FAMILIES: ContractFamily[] = ["SAUSPIEL", "WENZ", "SOLO", "TOUT"];

interface ContractStats {
  played: number;
  won: number;
  /** Sum of the declarer side's card points (Augen), for the average. */
  points: number;
}

function contractFamily(round: RoundRecord): ContractFamily | null {
  const contract = round.contract;
  if (!contract) return null;
  if (contract.isTout) return "TOUT";
  if (contract.type === GameType.SAUSPIEL) return "SAUSPIEL";
  if (contract.type === GameType.WENZ) return "WENZ";
  return "SOLO";
}

/** "+N" / "N" — the same signed-score formatting used across the app. */
function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

export default function StatsScreen({ language }: StatsScreenProps) {
  const t = translations[language];
  const [filter, setFilter] = useState<Filter>("all");
  const [totals, setTotals] = useState<StatsTotals>(EMPTY_TOTALS);
  const [games, setGames] = useState<GameRecord[]>([]);

  // Statistics only change when a list finishes, which is impossible while
  // this screen is mounted — reading once on mount is enough. Reads are async
  // (IndexedDB), so populate into state; both resolve in a few ms.
  useEffect(() => {
    let active = true;
    gameHistoryStore.loadTotals().then((value) => active && setTotals(value));
    gameHistoryStore.loadGames().then((value) => active && setGames(value));
    return () => {
      active = false;
    };
  }, []);

  const played = filter === "all" ? totals.played : filter === "solo" ? totals.soloPlayed : totals.mpPlayed;
  const won = filter === "all" ? totals.won : filter === "solo" ? totals.soloWon : totals.mpWon;
  const lost = Math.max(0, played - won);
  const winRate = played > 0 ? `${Math.round((won / played) * 100)}%` : "—";

  // All stored games under the current filter (newest first) — the basis for
  // every derived figure below; the visible list is capped separately.
  const filtered = useMemo(() => games.filter((game) => filter === "all" || game.mode === filter), [games, filter]);
  const visible = filtered.slice(0, VISIBLE_GAMES);
  const locale = language === "de" ? "de-DE" : "en-GB";

  const roundsPlayed = useMemo(() => filtered.reduce((sum, game) => sum + game.rounds.length, 0), [filtered]);
  const pointsBalance = useMemo(
    () => filtered.reduce((sum, game) => sum + (game.finalScores[game.localPlayerId] ?? 0), 0),
    [filtered],
  );

  // Rounds where the local player was the declarer, grouped by contract family.
  const contractStats = useMemo(() => {
    const stats: Record<ContractFamily, ContractStats> = {
      SAUSPIEL: { played: 0, won: 0, points: 0 },
      WENZ: { played: 0, won: 0, points: 0 },
      SOLO: { played: 0, won: 0, points: 0 },
      TOUT: { played: 0, won: 0, points: 0 },
    };
    for (const game of filtered) {
      for (const round of game.rounds) {
        if (round.contract?.declarerId !== game.localPlayerId) continue;
        const family = contractFamily(round);
        if (!family) continue;
        stats[family].played += 1;
        if (round.result.declarerWon) stats[family].won += 1;
        stats[family].points += round.result.declarerPoints;
      }
    }
    return stats;
  }, [filtered]);

  const anyDeclared = CONTRACT_FAMILIES.some((family) => contractStats[family].played > 0);

  // Final list score of the local player, oldest → newest, for the trend.
  const trendValues = useMemo(
    () =>
      filtered
        .slice(0, TREND_GAMES)
        .map((game) => game.finalScores[game.localPlayerId] ?? 0)
        .reverse(),
    [filtered],
  );

  const familyLabel = (family: ContractFamily): string =>
    family === "SAUSPIEL"
      ? t.gameTypes[GameType.SAUSPIEL]
      : family === "WENZ"
        ? t.gameTypes[GameType.WENZ]
        : family === "SOLO"
          ? t.statsFamilySolo
          : t.tout;

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
        <div className="stat-tile">
          <small>{t.rounds}</small>
          <strong>{roundsPlayed}</strong>
        </div>
        <div className={`stat-tile ${pointsBalance > 0 ? "won" : pointsBalance < 0 ? "lost" : ""}`}>
          <small>{t.statsPointsBalance}</small>
          <strong>{signed(pointsBalance)}</strong>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="stats-analysis">
          <section className="panel stats-trend-panel">
            <h2>{t.statsTrend}</h2>
            <p className="muted stats-panel-hint">{t.statsTrendHint}</p>
            {trendValues.length >= 2 ? (
              <TrendChart values={trendValues} ariaLabel={t.statsTrendHint} />
            ) : (
              <p className="muted">{t.statsTrendEmpty}</p>
            )}
          </section>

          <section className="panel stats-contracts-panel">
            <h2>{t.statsContracts}</h2>
            <p className="muted stats-panel-hint">{t.statsContractsHint}</p>
            {anyDeclared ? (
              <table className="stats-contract-table">
                <thead>
                  <tr>
                    <th>{t.statsContractType}</th>
                    <th>{t.statsPlayed}</th>
                    <th>{t.statsWon}</th>
                    <th>{t.statsWinRate}</th>
                    <th>{t.statsContractAvgPoints}</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRACT_FAMILIES.map((family) => {
                    const stats = contractStats[family];
                    return (
                      <tr key={family} className={stats.played === 0 ? "empty" : ""}>
                        <td>{familyLabel(family)}</td>
                        <td>{stats.played}</td>
                        <td>{stats.won}</td>
                        <td>{stats.played > 0 ? `${Math.round((stats.won / stats.played) * 100)}%` : "—"}</td>
                        <td>{stats.played > 0 ? Math.round(stats.points / stats.played) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="muted">{t.statsEmpty}</p>
            )}
          </section>
        </div>
      )}

      <section className="panel stats-games-panel">
        <h2>{t.statsRecent}</h2>
        {visible.length === 0 ? (
          <p className="muted">{t.statsEmpty}</p>
        ) : (
          <div className="stats-game-list">
            {visible.map((game) => (
              <GameItem key={game.id} game={game} language={language} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/**
 * Hand-rolled SVG column chart: the local player's final score per list,
 * oldest → newest. Positive bars grow up from the zero line in green,
 * negative bars grow down in red — the same polarity colors used everywhere
 * else in the app. No chart library (offline-first, react-only).
 */
function TrendChart({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const W = 600;
  const H = 130;
  const PAD_X = 34; // room for the min/max/zero labels on the left
  const PAD_Y = 10;

  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const y = (value: number) => PAD_Y + ((max - value) / span) * (H - 2 * PAD_Y);
  const zeroY = y(0);

  const plotW = W - PAD_X - 4;
  const step = plotW / values.length;
  const barW = Math.max(3, Math.min(26, step - 3));

  return (
    <svg
      className="stats-trend-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* min/max gridlines + zero baseline, recessive */}
      {max > 0 && (
        <>
          <line className="grid" x1={PAD_X} y1={y(max)} x2={W - 4} y2={y(max)} />
          <text className="axis" x={PAD_X - 6} y={y(max) + 3.5}>
            {signed(max)}
          </text>
        </>
      )}
      {min < 0 && (
        <>
          <line className="grid" x1={PAD_X} y1={y(min)} x2={W - 4} y2={y(min)} />
          <text className="axis" x={PAD_X - 6} y={y(min) + 3.5}>
            {signed(min)}
          </text>
        </>
      )}
      <line className="zero" x1={PAD_X} y1={zeroY} x2={W - 4} y2={zeroY} />
      <text className="axis" x={PAD_X - 6} y={zeroY + 3.5}>
        0
      </text>

      {values.map((value, i) => {
        const x = PAD_X + i * step + (step - barW) / 2;
        const top = value >= 0 ? y(value) : zeroY;
        const height = Math.max(1.5, Math.abs(y(value) - zeroY));
        return (
          <rect
            key={i}
            className={value >= 0 ? "bar pos" : "bar neg"}
            x={x}
            y={top}
            width={barW}
            height={height}
            rx={2}
          >
            <title>{signed(value)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function GameItem({ game, language, locale }: { game: GameRecord; language: Language; locale: string }) {
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
            <RoundRow key={round.roundNumber} round={round} game={game} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundRow({ round, game, language }: { round: RoundRecord; game: GameRecord; language: Language }) {
  const t = translations[language];
  const contract = round.contract;
  const declarer = contract ? game.players.find((player) => player.id === contract.declarerId) : undefined;
  const change = round.result.scoreChanges[game.localPlayerId] ?? 0;
  const label = contract ? gameLabel(language, contract.type, contract.calledSuit, contract.isTout) : "—";
  const extras = [round.result.isSchwarz ? t.schwarz : round.result.isSchneider ? t.schneider : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="stats-round-row">
      <span className="stats-round-num">
        {t.round} {round.roundNumber}
      </span>
      <span className="stats-round-contract">
        {label}
        {declarer ? ` · ${declarer.name}` : ""}
        {extras ? ` · ${extras}` : ""}
      </span>
      <span className={`stats-score ${change >= 0 ? "positive" : "negative"}`}>{signed(change)}</span>
    </div>
  );
}
