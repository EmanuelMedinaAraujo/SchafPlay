import { useEffect, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { GameRecord, RoundRecord, gameHistoryStore } from "../persistence";
import GameHistoryList, { VISIBLE_GAMES } from "./GameHistoryList";
import { HistoryIcon } from "./icons";

interface AnalysisScreenProps {
  language: Language;
  /** Opens the dedicated ReplayScreen for one recorded round (routed by App). */
  onReplay: (game: GameRecord, round: RoundRecord) => void;
}

/**
 * Analysis view (#85, part of #16): the recorded games row by row — date,
 * mode, opponent and result — expanding into their rounds, each of which can
 * be replayed trick by trick.
 *
 * The list itself is the shared `GameHistoryList` the stats screen uses, so
 * both read identically; only the per-round replay button is new here.
 */
export default function AnalysisScreen({ language, onReplay }: AnalysisScreenProps) {
  const t = translations[language];
  const [games, setGames] = useState<GameRecord[]>([]);

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
          <GameHistoryList games={visible} language={language} onReplay={onReplay} />
        )}
      </section>
    </main>
  );
}
