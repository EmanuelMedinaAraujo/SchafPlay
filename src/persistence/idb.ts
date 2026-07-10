/**
 * Minimal promise wrapper over IndexedDB — no external dependency, matching
 * the project's zero-runtime-deps ethos. Just enough for the game-history
 * store: open with an upgrade callback, and promisified request/transaction
 * helpers. Every caller treats a rejected promise as "storage unavailable"
 * and degrades silently, so this layer never needs its own fallback logic.
 */

export function openDB(
  name: string,
  version: number,
  upgrade: (db: IDBDatabase, oldVersion: number) => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = (event) => upgrade(request.result, event.oldVersion);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("openDB failed"));
    request.onblocked = () => reject(new Error("openDB blocked"));
  });
}

/** Resolve when a request completes, reject on its error. */
export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("request failed"));
  });
}

/** Resolve when the whole transaction commits, reject on error/abort. */
export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });
}
