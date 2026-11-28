import { useCallback, useEffect, useRef, useState } from "react";
import { Language } from "../types";

/** The three ways to start a session from the home screen. */
export type GameMode = "host" | "join" | "solo";

/** List lengths offered on the home screen / settings, in rounds. */
export const ROUND_OPTIONS = [4, 8, 12] as const;

interface AvatarPreferences {
  /** Own profile picture (#14); see `lib/avatars.ts`. Synced to the other human. */
  avatar: string;
  /** Locally available upload, including when another avatar is selected. */
  customAvatar: string;
}

export type AvatarChange =
  | { type: "select"; value: string }
  | { type: "selectCustom"; photo: string }
  | { type: "upload"; photo: string }
  | { type: "delete"; photo: string };

/**
 * Every persisted local-device preference (#44). Small scalars only, in
 * synchronous storage so the right value is on screen at first paint.
 */
export interface Settings extends AvatarPreferences {
  language: Language;
  playerName: string;
  totalRounds: number;
  disableLaufende: boolean;
  /** House rule #11. The HOST's setting governs a game. */
  enableRamsch: boolean;
  /** House rule #57. The HOST's setting governs a game. */
  enableStoss: boolean;
}

type SettingKey = Exclude<keyof Settings, keyof AvatarPreferences>;
export type UpdateSetting = <K extends SettingKey>(key: K, value: Settings[K]) => void;

const AVATAR_KEY = "schafplay.avatar";
const DEFAULT_AVATAR: AvatarPreferences = { avatar: "", customAvatar: "" };

const DEFAULT_SETTINGS: Omit<Settings, keyof AvatarPreferences> = {
  language: "de",
  playerName: "Bazi",
  totalRounds: 8,
  disableLaufende: false,
  enableRamsch: false,
  enableStoss: true,
};

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

const CODECS: { [K in SettingKey]: FieldCodec<Settings[K]> } = {
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
  enableStoss: {
    key: "schafplay.enableStoss",
    // Defaults to enabled; only an explicit "false" turns it off.
    parse: (raw) => raw !== "false",
    serialize: String,
  },
};

const KEYS = Object.keys(CODECS) as SettingKey[];

function readAvatarRecord(): string | null {
  try {
    return localStorage.getItem(AVATAR_KEY) ?? "";
  } catch {
    return null;
  }
}

function parseAvatarPreferences(raw: string): AvatarPreferences {
  // Old profiles stored only the active avatar, including uploaded data URLs.
  if (!raw.startsWith("{")) {
    return { avatar: raw, customAvatar: raw.startsWith("data:") ? raw : "" };
  }
  try {
    const { avatar, customAvatar } = JSON.parse(raw);
    if (typeof avatar === "string" && typeof customAvatar === "string" && customAvatar.startsWith("data:")) {
      return { avatar, customAvatar };
    }
  } catch {
    // Unreadable record — use the default.
  }
  return DEFAULT_AVATAR;
}

function saveAvatarPreferences(preferences: AvatarPreferences): boolean {
  const { avatar, customAvatar } = preferences;
  // Store both together when a separate photo needs retaining. Keep the
  // original format when the selected avatar alone represents the profile.
  const raw = customAvatar && customAvatar !== avatar ? JSON.stringify(preferences) : avatar;
  try {
    localStorage.setItem(AVATAR_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

function changeAvatar(preferences: AvatarPreferences, change: AvatarChange): AvatarPreferences {
  switch (change.type) {
    case "select":
      return { ...preferences, avatar: change.value };
    case "selectCustom":
      return change.photo === preferences.customAvatar ? { ...preferences, avatar: preferences.customAvatar } : preferences;
    case "upload":
      return { avatar: change.photo, customAvatar: change.photo };
    case "delete":
      if (change.photo !== preferences.customAvatar) return preferences;
      return {
        avatar: preferences.avatar === preferences.customAvatar ? "" : preferences.avatar,
        customAvatar: "",
      };
  }
}

/** Total: always a full `Settings`, defaulting any missing or unparseable field. */
function loadSettings(): Settings {
  const result = { ...DEFAULT_SETTINGS, ...parseAvatarPreferences(readAvatarRecord() ?? "") };
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

function saveSetting<K extends SettingKey>(key: K, value: Settings[K]): void {
  try {
    localStorage.setItem(CODECS[key].key, CODECS[key].serialize(value));
  } catch {
    // Storage unavailable (private mode, quota) — the change just won't survive.
  }
}

/** Seeds state synchronously from `localStorage` (no flash) and writes through. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const unsavedAvatar = useRef<{ record: string | null; preferences: AvatarPreferences } | null>(null);

  const update = useCallback<UpdateSetting>((key, value) => {
    setSettings((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    saveSetting(key, value);
  }, []);

  useEffect(() => {
    function syncAvatar(event: StorageEvent) {
      if (event.storageArea !== localStorage || (event.key !== AVATAR_KEY && event.key !== null)) return;
      const record = readAvatarRecord();
      if (record === null || record === unsavedAvatar.current?.record) return;
      unsavedAvatar.current = null;
      setSettings((prev) => ({ ...prev, ...parseAvatarPreferences(record) }));
    }
    window.addEventListener("storage", syncAvatar);
    return () => window.removeEventListener("storage", syncAvatar);
  }, []);

  const updateAvatar = useCallback((change: AvatarChange) => {
    // A background tab can receive its storage event after the next click.
    const record = readAvatarRecord();
    const unsaved = unsavedAvatar.current;
    let current = { avatar: settings.avatar, customAvatar: settings.customAvatar };
    if (unsaved && (record === null || record === unsaved.record)) {
      // Keep edits in this session when storage is unavailable or full.
      current = unsaved.preferences;
    } else if (record !== null) {
      current = parseAvatarPreferences(record);
    }
    const next = changeAvatar(current, change);
    unsavedAvatar.current = saveAvatarPreferences(next) ? null : { record, preferences: next };
    setSettings((prev) => ({ ...prev, ...next }));
  }, [settings.avatar, settings.customAvatar]);

  return [settings, update, updateAvatar] as const;
}
