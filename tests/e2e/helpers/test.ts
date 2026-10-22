import { BrowserContext, Page, test as base } from "@playwright/test";
import { PairedGame, PairOptions, pairPages } from "./fixtures";

interface Fixtures {
  _keepAlive: void;
  /** A page in its own fresh browser context (a separate device), closed at teardown. */
  newPage: () => Promise<Page>;
  /** Host and guest on two fresh contexts, paired and seated; closed at teardown. */
  pair: (options?: PairOptions) => Promise<PairedGame>;
}

/**
 * Shared `test`. Its renderer keepalive exists because headless Chromium
 * delivers page tasks lazily when nothing external touches them, stalling
 * WebRTC handshakes and the engine's setTimeout pacing. A 250ms no-op evaluate
 * keeps the event loops pumping without masking real timing bugs.
 */
export const test = base.extend<Fixtures>({
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
  newPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      return context.newPage();
    });
    // A test may already have closed one on purpose (reconnect drops its guest).
    await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
  },
  pair: async ({ newPage }, use) => {
    await use(async (options = {}) => {
      const game = { host: await newPage(), guest: await newPage() };
      await pairPages(game.host, game.guest, options);
      return game;
    });
  },
});

export { expect } from "@playwright/test";
