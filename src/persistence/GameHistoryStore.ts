import { BidDeclaration, Contract, RoundResult, WillBid } from "../game/types";

/**
 * Local game statistics, persisted per device.
 *
 * Stability rules (binding — see CLAUDE.md):
 * - Never remove or repurpose a stored field without bumping the database
 *   version and adding an upgrade step (see persistence/idb.ts).
 * - Loading must never throw and never delete user data.
 * - `totals` are the authoritative lifetime counters, never pruned.
 * - `games` are pruned to MAX_GAMES (newest first). All games keep their
 *   full per-round `rounds` detail.
 * - All reads/writes of stored stats go through this module's store.
 */

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
  /** Cumulative list scores after this round. */
  scoresAfter: Record<string, number>;
  bids?: WillBid[];
  declarations?: BidDeclaration[];
}

export interface GameRecord {
  id: string;
  /** ISO timestamp of when the list finished. */
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
  /** Full per-round data: the dealt hand, contract, tricks in play order, and scoring result. */
  rounds: RoundRecord[];
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

/**
 * The persistence boundary for game history. IndexedDB-backed today
 * (IdbGameHistoryStore); the interface keeps recorders, screens and future
 * consumers (analysis view #16, achievements #9) independent of the backend.
 */
export interface GameHistoryStore {
  /** Append a finished game. Fire-and-forget: must never throw into the game. */
  recordGame(record: Omit<GameRecord, "id" | "finishedAt">): void;
  /** Lifetime counters; zeros when nothing is stored or storage is unavailable. */
  loadTotals(): Promise<StatsTotals>;
  /** All stored games, newest first; empty when storage is unavailable. */
  loadGames(): Promise<GameRecord[]>;
}

export function emptyTotals(): StatsTotals {
  return { played: 0, won: 0, soloPlayed: 0, soloWon: 0, mpPlayed: 0, mpWon: 0 };
}
