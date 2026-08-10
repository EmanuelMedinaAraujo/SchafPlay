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
 * Reloads onto the new version without a manual restart (#76). `main.tsx`
 * reloads on `controllerchange`, but that event is unreliable in standalone
 * PWAs (notably iOS), so this also watches the worker's own `activated` state.
 */
function reloadOnActivation(worker: ServiceWorker): void {
  if (typeof window === "undefined") return;
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  if (worker.state === "activated") {
    reload();
    return;
  }
  worker.addEventListener("statechange", () => {
    if (worker.state === "activated") reload();
  });
  // Last-resort fallback if neither `statechange` nor `controllerchange` fires.
  window.setTimeout(reload, 3000);
}

/** Manual version check (#61). The only code path that calls `registration.update()`. */
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
  reloadOnActivation(waiting);
  return "updating";
}
