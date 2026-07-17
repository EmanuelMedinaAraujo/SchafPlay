/** Service-worker / PWA update helpers shared by main.tsx and the settings UI. */

export type UpdateResult =
  | "updating" // new version activated; page will reload via controllerchange
  | "uptodate" // already on the newest version
  | "unsupported"; // no service worker active (dev / not installed)

/** Resolves once `worker` leaves the "installing" state. Returns false on failure. */
function waitUntilInstalled(worker: ServiceWorker): Promise<boolean> {
  if (worker.state !== "installing") return Promise.resolve(worker.state !== "redundant");
  return new Promise((resolve) => {
    const onStateChange = () => {
      if (worker.state === "installing") return;
      worker.removeEventListener("statechange", onStateChange);
      resolve(worker.state !== "redundant");
    };
    worker.addEventListener("statechange", onStateChange);
  });
}

/**
 * Manually check for a new app version (#61). This is the only code path
 * that calls `registration.update()`. If a new worker is found, posts
 * SKIP_WAITING to activate it (triggers controllerchange → page reload).
 */
export async function checkForUpdate(): Promise<UpdateResult> {
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

  const candidate = registration.installing || registration.waiting;
  if (!updateFound && !candidate) return "uptodate";
  if (!candidate) return "uptodate";

  const installed = await waitUntilInstalled(candidate);
  if (!installed) return "uptodate";

  // Tell the waiting worker to activate now.
  const waiting = registration.waiting;
  if (!waiting) return "uptodate";

  waiting.postMessage({ type: "SKIP_WAITING" });
  return "updating";
}
