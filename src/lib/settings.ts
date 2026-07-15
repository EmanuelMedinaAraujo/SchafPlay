import { useCallback, useState } from "react";
import { Language } from "../types";

/** The three ways to start a session from the home screen. */
export type GameMode = "host" | "join" | "solo";

/** List lengths offered on the home screen / settings, in rounds. */
export const ROUND_OPTIONS = [4, 8, 12] as const;

/**
 * Every persisted local-device preference, in one shape (#44). These are UI
 * settings only — small scalars that belong in synchronous storage so the
 * right value is available on first paint. The large, structured game history
 * lives behind `GameHistoryStore` (`src/persistence/`) instead.
 */
export interface Settings {
  language: Language;
  playerName: string;
  totalRounds: number;
  disableLaufende: boolean;
  /** House rule (#11): an all-pass starts a Ramsch instead of a redeal. The HOST's setting governs a game. */
  enableRamsch: boolean;
  /** The mode tab last used on the home screen, preselected next open. */
  lastMode: GameMode;
}

export const DEFAULT_SETTINGS: Settings = {
  language: "de",
  playerName: "Bazi",
  totalRounds: 8,
  disableLaufende: false,
  enableRamsch: false,
  lastMode: "host",
};

/**
 * The persistence seam. `useSettings` and the app depend only on this
 * interface, so the backing store can be swapped (localStorage today, an
 * in-memory fake in tests, IndexedDB later) without touching consumers —
 * the same contract `GameHistoryStore` provides for stats.
 *
 * `load` is synchronous and total: it always returns a full `Settings`,
 * substituting the default for any field that is missing or unparseable
 * (e.g. written by an older app version). `save` persists a single field and
 * must degrade silently when storage is unavailable (private mode, quota).
 */
export interface SettingsStore {
  load(): Settings;
  save<K extends keyof Settings>(key: K, value: Settings[K]): void;
}

/**
 * Per-field mapping to a `localStorage` key plus tolerant parse/serialize.
 * Centralizing this here is the point of the refactor: previously each
 * setting hand-rolled its own read + validation + write effect and they
 * drifted (one ended up not persisted at all, #37). Keys match the historical
 * `schafplay.*` names so existing stored preferences keep working.
 */
interface FieldCodec<T> {
  key: string;
  parse(raw: string): T;
  serialize(value: T): string;
}

const identity = (value: string) => value;

const CODECS: { [K in keyof Settings]: FieldCodec<Settings[K]> } = {
  language: {
    key: "schafplay.language",
    parse: (raw) => (raw === "en" ? "en" : "de"),
    serialize: identity,
  },
  playerName: {
    key: "schafplay.name",
    parse: (raw) => raw || DEFAULT_SETTINGS.playerName,
    serialize: identity,
  },
  totalRounds: {
    key: "schafplay.totalRounds",
    parse: (raw) => {
      const n = Number(raw);
      return (ROUND_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_SETTINGS.totalRounds;
    },
    serialize: String,
  },
  disableLaufende: {
    key: "schafplay.disableLaufende",
    parse: (raw) => raw === "true",
    serialize: String,
  },
  enableRamsch: {
    key: "schafplay.enableRamsch",
    parse: (raw) => raw === "true",
    serialize: String,
  },
  lastMode: {
    key: "schafplay.lastMode",
    parse: (raw) => (raw === "join" || raw === "solo" || raw === "host" ? raw : DEFAULT_SETTINGS.lastMode),
    serialize: identity,
  },
};

const KEYS = Object.keys(CODECS) as Array<keyof Settings>;

/** The default `SettingsStore`, backed by `localStorage`. */
export class LocalStorageSettingsStore implements SettingsStore {
  load(): Settings {
    const result = { ...DEFAULT_SETTINGS };
    for (const key of KEYS) {
      try {
        const raw = localStorage.getItem(CODECS[key].key);
        if (raw !== null) {
          // Each codec's parse is typed to its own field; the map ties them
          // together but TS can't track the per-key correlation in this loop.
          (result[key] as Settings[typeof key]) = CODECS[key].parse(raw) as Settings[typeof key];
        }
      } catch {
        // Storage unavailable or a single bad value — keep the default.
      }
    }
    return result;
  }

  save<K extends keyof Settings>(key: K, value: Settings[K]): void {
    try {
      localStorage.setItem(CODECS[key].key, CODECS[key].serialize(value));
    } catch {
      // Storage unavailable (private mode, quota) — the change just won't survive.
    }
  }
}

/** Shared app-wide instance. Swap the argument to `useSettings` in tests. */
export const settingsStore: SettingsStore = new LocalStorageSettingsStore();

/**
 * React bridge over a `SettingsStore`: seeds state synchronously from the
 * store (no flash) and writes through on every change. Returns the current
 * settings and a typed `update(key, value)` setter.
 */
export function useSettings(store: SettingsStore = settingsStore) {
  const [settings, setSettings] = useState<Settings>(() => store.load());

  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
      store.save(key, value);
    },
    [store],
  );

  return [settings, update] as const;
}
