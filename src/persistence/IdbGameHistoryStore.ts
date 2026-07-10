import {
  emptyTotals,
  GameHistoryStore,
  GameRecord,
  StatsTotals,
} from "./GameHistoryStore";
import { openDB, promisifyRequest, txDone } from "./idb";

const DB_NAME = "schafplay";
/** Bump + add an onupgradeneeded branch whenever the stored schema changes. */
const DB_VERSION = 1;
const GAMES_STORE = "games";
const TOTALS_STORE = "totals";
/** Single fixed key for the one lifetime-totals record. */
const TOTALS_KEY = "totals";
/** At most this many game records are kept (newest first). All retain full round detail. */
const MAX_GAMES = 2000;

function upgrade(db: IDBDatabase, _oldVersion: number): void {
  if (!db.objectStoreNames.contains(GAMES_STORE)) {
    const games = db.createObjectStore(GAMES_STORE, { keyPath: "id" });
    // Indexes for the analysis view (#16): by date, by mode, by participant.
    games.createIndex("finishedAt", "finishedAt");
    games.createIndex("mode", "mode");
    games.createIndex("players", "players", { multiEntry: true });
  }
  if (!db.objectStoreNames.contains(TOTALS_STORE)) {
    db.createObjectStore(TOTALS_STORE);
  }
}

interface StoredTotals extends StatsTotals {
  key: string;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // Fall through.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * IndexedDB-backed game history. Every method degrades silently when storage
 * is unavailable (private mode, quota, blocked upgrade): recordGame no-ops
 * and reads resolve to empty defaults — a stats failure must never break a
 * game that just finished.
 */
export class IdbGameHistoryStore implements GameHistoryStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, upgrade).catch((error) => {
        // Reset so a later call can retry a transient failure.
        this.dbPromise = null;
        throw error;
      });
    }
    return this.dbPromise;
  }

  recordGame(record: Omit<GameRecord, "id" | "finishedAt">): void {
    // Fire-and-forget; all errors swallowed.
    void this.append(record).catch(() => undefined);
  }

  private async append(record: Omit<GameRecord, "id" | "finishedAt">): Promise<void> {
    const db = await this.db();
    const game: GameRecord = { ...record, id: newId(), finishedAt: new Date().toISOString() };

    const tx = db.transaction([GAMES_STORE, TOTALS_STORE], "readwrite");
    const games = tx.objectStore(GAMES_STORE);
    const totalsStore = tx.objectStore(TOTALS_STORE);

    games.add(game);

    const existing = (await promisifyRequest(totalsStore.get(TOTALS_KEY) as IDBRequest<StoredTotals | undefined>)) ?? {
      key: TOTALS_KEY,
      ...emptyTotals(),
    };
    existing.played += 1;
    if (game.won) existing.won += 1;
    if (game.mode === "solo") {
      existing.soloPlayed += 1;
      if (game.won) existing.soloWon += 1;
    } else {
      existing.mpPlayed += 1;
      if (game.won) existing.mpWon += 1;
    }
    totalsStore.put(existing, TOTALS_KEY);

    // Prune oldest games beyond the cap (totals stay authoritative and untouched).
    const count = await promisifyRequest(games.count());
    if (count > MAX_GAMES) {
      let toDelete = count - MAX_GAMES;
      const cursorReq = games.index("finishedAt").openCursor(null, "next"); // oldest first
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor || toDelete <= 0) {
            resolve();
            return;
          }
          cursor.delete();
          toDelete -= 1;
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error ?? new Error("prune failed"));
      });
    }

    await txDone(tx);
  }

  async loadTotals(): Promise<StatsTotals> {
    try {
      const db = await this.db();
      const tx = db.transaction(TOTALS_STORE, "readonly");
      const stored = await promisifyRequest(
        tx.objectStore(TOTALS_STORE).get(TOTALS_KEY) as IDBRequest<StoredTotals | undefined>,
      );
      if (!stored) return emptyTotals();
      const { key: _key, ...totals } = stored;
      return totals;
    } catch {
      return emptyTotals();
    }
  }

  async loadGames(): Promise<GameRecord[]> {
    try {
      const db = await this.db();
      const tx = db.transaction(GAMES_STORE, "readonly");
      const all = await promisifyRequest(tx.objectStore(GAMES_STORE).getAll() as IDBRequest<GameRecord[]>);
      // Newest first.
      return all.sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : a.finishedAt > b.finishedAt ? -1 : 0));
    } catch {
      return [];
    }
  }
}
