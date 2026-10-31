import { useEffect, useState } from "react";
import { GameRecord } from "./GameHistoryStore";
import { gameHistoryStore } from "./store";

/** Stored games, newest first. History can't change while a screen is mounted, so one read is enough. */
export function useStoredGames(): GameRecord[] {
  const [games, setGames] = useState<GameRecord[]>([]);
  useEffect(() => {
    let active = true;
    gameHistoryStore.loadGames().then((value) => active && setGames(value));
    return () => {
      active = false;
    };
  }, []);
  return games;
}
