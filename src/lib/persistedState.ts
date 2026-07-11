import { Dispatch, SetStateAction, useEffect, useState } from "react";

/**
 * Persists a piece of local device state to localStorage under `key`,
 * restoring it on mount. Centralizes the read-parse-fallback / write-effect
 * pattern (#37) so every device setting persists the same way instead of
 * each one hand-rolling its own localStorage read + useEffect — which is
 * how `totalRounds` previously ended up not persisted at all.
 *
 * `parse` must tolerate missing/invalid stored values (e.g. from an older
 * app version) and fall back to `defaultValue` — it is only ever called with
 * whatever raw string is already in storage, which this hook does not
 * control. Storage failures (private mode, quota) degrade silently, same as
 * the persistence-layer contract in `src/persistence/`.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T,
  serialize: (value: T) => string = (value) => String(value),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? defaultValue : parse(raw);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value));
    } catch {
      // Storage unavailable — the setting just won't survive a reload.
    }
  }, [key, value]);

  return [value, setValue];
}
