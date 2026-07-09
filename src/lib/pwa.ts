/** Service-worker / PWA update helpers shared by main.tsx and the settings UI. */

/** Timestamp of the last online update check; used to throttle to once a day. */
export const UPDATE_CHECK_KEY = "schafplay.lastUpdateCheck";

export type UpdateResult =
  | "updating" // a new version is installing; the caller should reload shortly
  | "uptodate" // already on the newest version
  | "unsupported"; // no service worker active (dev, or not yet installed)

/**
 * Manually check for a new app version, bypassing the once-a-day throttle
 * (#28). Records the check time so the automatic check stays quiet for the
 * next 24h. Returns whether an update is being installed so the caller can
 * reload to pick it up.
 */
export async function checkForUpdate(): Promise<UpdateResult> {
  try {
    localStorage.setItem(UPDATE_CHECK_KEY, String(Date.now()));
  } catch {
    // Storage disabled — the check still runs, it just won't be recorded.
  }

  if (!("serviceWorker" in navigator)) return "unsupported";
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "unsupported";

  let updateFound = false;
  const onUpdateFound = () => {
    updateFound = true;
  };
  registration.addEventListener("updatefound", onUpdateFound);
  try {
    await registration.update();
  } finally {
    registration.removeEventListener("updatefound", onUpdateFound);
  }

  // The worker uses skipWaiting()/clients.claim(), so a newly discovered
  // version installs and takes over on its own — the caller just reloads.
  if (updateFound || registration.installing || registration.waiting) return "updating";
  return "uptodate";
}
