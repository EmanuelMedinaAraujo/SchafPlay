/** Service-worker / PWA update helpers shared by main.tsx and the settings UI. */

export type UpdateResult =
  | "updating" // a new version was found and told to activate; the caller should wait for the controllerchange-driven reload (see main.tsx)
  | "uptodate" // already on the newest version
  | "unsupported"; // no service worker active (dev, or not yet installed)

/**
 * Resolves once `worker` has left the "installing" state — i.e. it either
 * finished installing (now sitting in registration.waiting, since
 * public/sw.js no longer calls skipWaiting() on its own, #61) or failed
 * ("redundant"). Returns false on failure.
 */
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
 * Manually check for a new app version. This is the *only* code path in the
 * app that ever calls `registration.update()` (#61) — there is no automatic
 * background check. If a new version is found, it's told to activate
 * (postMessage SKIP_WAITING to the waiting worker); public/sw.js's
 * 'message' handler then calls self.skipWaiting(), which triggers
 * clients.claim() and a 'controllerchange' event that main.tsx listens for
 * to reload the page and pick up the new version.
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

  // public/sw.js parks a newly-installed worker in registration.waiting
  // instead of activating itself; tell it to go ahead now that the user has
  // explicitly asked for the update.
  const waiting = registration.waiting;
  if (!waiting) return "uptodate";

  waiting.postMessage({ type: "SKIP_WAITING" });
  return "updating";
}
