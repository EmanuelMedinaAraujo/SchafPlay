import { test as base } from "@playwright/test";

/**
 * Shared `test` with a renderer keepalive: headless Chromium delivers page
 * tasks lazily when nothing external touches them, stalling WebRTC handshakes
 * and the engine's setTimeout pacing. A 250ms no-op evaluate keeps the event
 * loops pumping without masking real timing bugs.
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
