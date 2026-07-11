import { test as base } from "@playwright/test";

/**
 * Shared `test` for the whole suite. Extends the base test with a renderer
 * keepalive: in headless/CI environments Chromium delivers tasks to pages
 * lazily when nothing external touches them, which stalls WebRTC handshakes
 * and the engine's setTimeout-driven AI pacing until the next protocol call
 * happens to wake the renderer. A cheap 250ms evaluate on every open page
 * keeps the event loops pumping; it is a no-op wake, so it cannot mask real
 * timing bugs — it only stops the environment from freezing the app between
 * Playwright polls.
 */
export const test = base.extend<{ _keepAlive: void }>({
  _keepAlive: [
    async ({ browser }, use) => {
      const timer = setInterval(() => {
        for (const context of browser.contexts()) {
          for (const page of context.pages()) {
            page.evaluate("0").catch(() => undefined);
          }
        }
      }, 250);
      await use(undefined);
      clearInterval(timer);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
