import { Contract, RoundResult } from "../types";

/**
 * Local game statistics, persisted per device under one localStorage key.
 *
 * Stability rules (binding — see CLAUDE.md):
 * - Never remove or repurpose a stored field without bumping STATS_VERSION
 *   and adding a MIGRATIONS entry.
 * - Loading must never throw and never delete user data: unparseable or
 *   newer-versioned payloads are copied to the backup key before starting
 *   fresh.
 * - `totals` are the authoritative lifetime counters; `games` entries (and
 *   their `rounds` detail) may be pruned under quota pressure, totals never.
 * - All reads/writes of the storage key go through this module.
 */

const STORE_KEY = "schafplay.stats";
const BACKUP_KEY = "schafplay.stats.backup";
const STATS_VERSION = 1;

/** At most this many game records are kept (newest first). */
const MAX_GAMES = 200;
/** Only the newest records keep their full per-round detail. */
const MAX_DETAILED = 50;

export type StatsMode = "solo" | "multiplayer";
/** Compact card reference: `"${Suit}-${CardValue}"`, e.g. "ACORNS-A". */
export type CardId = string;

export interface TrickRecord {
  leaderId: string;
  winnerId?: string;
  /** Cards in play order. */
  plays: { playerId: string; card: CardId }[];
}

export interface RoundRecord {
  roundNumber: number;
  /** The local player's 8 dealt cards (the final deal, after any redeal). */
  initialHand: CardId[];
  contract: Contract | null;
  tricks: TrickRecord[];
  result: RoundResult;
  /** Cumulative match scores after this round. */
  scoresAfter: Record<string, number>;
}

export interface GameRecord {
  id: string;
  /** ISO timestamp of when the match finished. */
  finishedAt: string;
  mode: StatsMode;
  role: "host" | "guest" | "solo";
  localPlayerId: "p1" | "p3";
  localPlayerName: string;
  /** The other human's name; null in solo games. */
  opponentName: string | null;
  players: { id: string; name: string; isHuman: boolean }[];
  totalRounds: number;
  finalScores: Record<string, number>;
  /** A shared top score counts as a win. */
  won: boolean;
  /** Rich per-round data for future analysis; prunable under quota pressure. */
  rounds?: RoundRecord[];
}

/** Lifetime counters — incremented at record time, never pruned. */
export interface StatsTotals {
  played: number;
  won: number;
  soloPlayed: number;
  soloWon: number;
  mpPlayed: number;
  mpWon: number;
}

export interface StatsStore {
  version: number;
  totals: StatsTotals;
  /** Newest first. */
  games: GameRecord[];
}

/**
 * Sequential upgrades: MIGRATIONS[n] converts a version-n store to n+1.
 * Empty while STATS_VERSION is 1 — add an entry whenever the version bumps.
 */
const MIGRATIONS: Record<number, (old: unknown) => unknown> = {};

function emptyTotals(): StatsTotals {
  return { played: 0, won: 0, soloPlayed: 0, soloWon: 0, mpPlayed: 0, mpWon: 0 };
}

function emptyStore(): StatsStore {
  return { version: STATS_VERSION, totals: emptyTotals(), games: [] };
}

/** Preserve data we can't read (corrupt or from a newer app version). */
function backupRaw(raw: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    // Best effort only.
  }
}

function normalizeTotals(raw: unknown): StatsTotals {
  const t = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    played: Number(t.played) || 0,
    won: Number(t.won) || 0,
    soloPlayed: Number(t.soloPlayed) || 0,
    soloWon: Number(t.soloWon) || 0,
    mpPlayed: Number(t.mpPlayed) || 0,
    mpWon: Number(t.mpWon) || 0,
  };
}

function loadStore(): StatsStore {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch {
    return emptyStore();
  }
  if (!raw) return emptyStore();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupRaw(raw);
    return emptyStore();
  }
  if (!parsed || typeof parsed !== "object" || typeof (parsed as { version?: unknown }).version !== "number") {
    backupRaw(raw);
    return emptyStore();
  }

  let store = parsed as { version: number } & Record<string, unknown>;
  if (store.version > STATS_VERSION) {
    // App was downgraded: keep the newer payload safe, read what we understand.
    backupRaw(raw);
  } else {
    for (let v = store.version; v < STATS_VERSION; v++) {
      const migrate = MIGRATIONS[v];
      if (migrate) store = migrate(store) as typeof store;
    }
  }

  return {
    version: STATS_VERSION,
    totals: normalizeTotals(store.totals),
    games: Array.isArray(store.games) ? (store.games as GameRecord[]) : [],
  };
}

function stripRounds(game: GameRecord): GameRecord {
  const { rounds: _rounds, ...rest } = game;
  return rest;
}

function saveStore(store: StatsStore): void {
  let games = store.games
    .slice(0, MAX_GAMES)
    .map((game, index) => (index < MAX_DETAILED ? game : stripRounds(game)));

  // On quota errors, shed round detail oldest-first, then whole records.
  for (;;) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...store, games }));
      return;
    } catch {
      let oldestDetailed = -1;
      for (let i = games.length - 1; i >= 0; i--) {
        if (games[i].rounds) {
          oldestDetailed = i;
          break;
        }
      }
      if (oldestDetailed >= 0) {
        games = games.slice();
        games[oldestDetailed] = stripRounds(games[oldestDetailed]);
      } else if (games.length > 0) {
        games = games.slice(0, -1);
      } else {
        // Storage entirely unavailable (e.g. private mode) — give up silently.
        return;
      }
    }
  }
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // Fall through.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Append a finished game. Must never throw into the app. */
export function recordGame(record: Omit<GameRecord, "id" | "finishedAt">): void {
  try {
    const store = loadStore();
    const game: GameRecord = { ...record, id: newId(), finishedAt: new Date().toISOString() };
    store.games.unshift(game);
    store.totals.played += 1;
    if (game.won) store.totals.won += 1;
    if (game.mode === "solo") {
      store.totals.soloPlayed += 1;
      if (game.won) store.totals.soloWon += 1;
    } else {
      store.totals.mpPlayed += 1;
      if (game.won) store.totals.mpWon += 1;
    }
    saveStore(store);
  } catch {
    // A stats failure must never break a game that just finished.
  }
}

export function loadStats(): StatsTotals {
  try {
    return loadStore().totals;
  } catch {
    return emptyTotals();
  }
}

/** All stored games, newest first. */
export function loadGames(): GameRecord[] {
  try {
    return loadStore().games;
  } catch {
    return [];
  }
}
