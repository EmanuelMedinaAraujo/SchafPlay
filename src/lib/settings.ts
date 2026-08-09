import { useCallback, useState } from "react";
import { Language } from "../types";

/** The three ways to start a session from the home screen. */
export type GameMode = "host" | "join" | "solo";

/** List lengths offered on the home screen / settings, in rounds. */
export const ROUND_OPTIONS = [4, 8, 12] as const;

/**
 * Every persisted local-device preference (#44). Small scalars only, in
 * synchronous storage so the right value is on screen at first paint.
 */
export interface Settings {
  language: Language;
  playerName: string;
  /** Own profile picture (#14); see `lib/avatars.ts`. Synced to the other human. */
  avatar: string;
  totalRounds: number;
  disableLaufende: boolean;
  /** House rule #11. The HOST's setting governs a game. */
  enableRamsch: boolean;
  /** House rule #57. The HOST's setting governs a game. */
  enableStoss: boolean;
  /** The mode tab last used on the home screen, preselected next open. */
  lastMode: GameMode;
}

export const DEFAULT_SETTINGS: Settings = {
  language: "de",
  playerName: "Bazi",
  avatar: "",
  totalRounds: 8,
  disableLaufende: false,
  enableRamsch: false,
  enableStoss: true,
  lastMode: "host",
};

/**
 * The persistence seam. `load` is total — it always returns a full `Settings`,
 * defaulting any missing or unparseable field. `save` degrades silently when
 * storage is unavailable.
 */
export interface SettingsStore {
  load(): Settings;
  save<K extends keyof Settings>(key: K, value: Settings[K]): void;
}

/**
 * Per-field `localStorage` key plus tolerant parse/serialize. Add a new
 * preference here, never hand-rolled in a component (#37). Keys match the
 * historical `schafplay.*` names so stored preferences keep working.
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
  avatar: {
    key: "schafplay.avatar",
    parse: identity,
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
  enableStoss: {
    key: "schafplay.enableStoss",
    // Defaults to enabled; only an explicit "false" turns it off.
    parse: (raw) => raw !== "false",
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

/** Seeds state synchronously from the store (no flash) and writes through. */
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
