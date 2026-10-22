import { useEffect, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { GameRecord, gameHistoryStore } from "../persistence";
import GameHistoryItem, { VISIBLE_GAMES } from "./GameHistoryItem";
import ReplayScreen from "./ReplayScreen";
import { HistoryIcon } from "./icons";

interface AnalysisScreenProps {
  language: Language;
  /** Lets App drop its chrome while a replay is on screen (#85). */
  onReplayActiveChange?: (active: boolean) => void;
}

interface Selection {
  game: GameRecord;
  /** Index into `game.rounds`; the replay continues into later rounds itself. */
  roundIndex: number;
}

/** Analysis view (#85): a row per recorded list, expanding into its rounds. */
export default function AnalysisScreen({ language, onReplayActiveChange }: AnalysisScreenProps) {
  const t = translations[language];
  const [games, setGames] = useState<GameRecord[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);

  // History can't change while this screen is mounted; one read is enough.
  useEffect(() => {
    let active = true;
    gameHistoryStore.loadGames().then((value) => active && setGames(value));
    return () => {
      active = false;
    };
  }, []);

  // The replay runs chrome-free; hand the chrome back on unmount too.
  useEffect(() => {
    onReplayActiveChange?.(selection !== null);
  }, [onReplayActiveChange, selection]);
  useEffect(() => () => onReplayActiveChange?.(false), [onReplayActiveChange]);

  if (selection) {
    return (
      <ReplayScreen
        game={selection.game}
        startRoundIndex={selection.roundIndex}
        language={language}
        onBack={() => setSelection(null)}
      />
    );
  }

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
              <GameHistoryItem
                key={game.id}
                game={game}
                language={language}
                onReplay={(roundIndex) => setSelection({ game, roundIndex })}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
