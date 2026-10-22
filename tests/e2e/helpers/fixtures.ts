import { Locator, Page, expect } from "@playwright/test";
import { translations } from "../../../src/lib/i18n";
import { GameMode } from "../../../src/lib/settings";

/** The suite drives the app in its default language. */
export const de = translations.de;

const modeTab: Record<GameMode, "soloGame" | "hostGame" | "joinGame"> = {
  solo: "soloGame",
  host: "hostGame",
  join: "joinGame",
};

export interface BootOptions {
  /** Activates the DEV determinism hook (`src/lib/e2e.ts`): seeded deal + fast AI pacing. */
  seed?: number;
  name?: string;
  rounds?: 4 | 8 | 12;
  /** Mode tab to select; the app opens on solo (#94), so host/join tests must ask for theirs. */
  mode?: GameMode;
}

/** Load the home screen and apply the pre-game options a player would set there. */
export async function bootHome(page: Page, options: BootOptions = {}): Promise<void> {
  // `E2E_SLOW=1` stretches the in-game pacing through the URL overrides
  // `lib/e2e.ts` exposes — timing only, so the deal and the outcome are the
  // same. It buys a slow machine time to see a card before the trick is
  // collected; CI has the headroom and runs at full speed.
  const pacing = process.env.E2E_SLOW ? "&e2e-ai=200&e2e-hold=1200" : "";
  await page.goto(options.seed === undefined ? "/" : `/?e2e-seed=${options.seed}${pacing}`);
  if (options.name !== undefined) {
    await page.locator("#player-name").fill(options.name);
  }
  // Before the round count: the list-length row only exists in host and solo.
  if (options.mode !== undefined) {
    await page.getByRole("tab", { name: de[modeTab[options.mode]] }).click();
  }
  if (options.rounds !== undefined) {
    await page.locator(".list-length-row").getByRole("button", { name: String(options.rounds), exact: true }).click();
  }
}

/** Boot straight into a solo game; resolves once the table is on screen. */
export async function startSolo(page: Page, options: BootOptions = {}): Promise<void> {
  await bootHome(page, { ...options, mode: "solo" });
  await page.getByRole("button", { name: de.startGame }).click();
  await expect(page.locator(".game-screen")).toBeVisible();
}

/** A host page's freshly minted invite code, once its textarea appears. */
export async function readInvite(host: Page, timeout = 15_000): Promise<string> {
  const inviteArea = host.locator(".pairing-flow textarea[readonly]").first();
  // Invite code generation gathers ICE candidates (up to ~1.5s by design).
  await expect(inviteArea).toBeVisible({ timeout });
  return inviteArea.inputValue();
}

/**
 * One host↔guest code exchange through whatever PairingPanel is on each page —
 * the home screen and the reconnect overlay render the same flow, so this
 * drives initial pairing and re-pairing alike.
 */
export async function exchangeCodes(host: Page, guest: Page): Promise<void> {
  const guestFlow = guest.locator(".pairing-flow");
  const invite = await readInvite(host);

  await guestFlow.getByPlaceholder(de.pasteInviteHint).fill(invite);
  await guestFlow.getByRole("button", { name: de.generateReply }).click();
  const replyArea = guestFlow.locator("textarea[readonly]").first();
  await expect(replyArea).toBeVisible({ timeout: 15_000 });
  const reply = await replyArea.inputValue();

  await host.getByPlaceholder(de.pasteReplyHint).fill(reply);
  await host.getByRole("button", { name: de.connect }).click();
}

export interface PairedGame {
  host: Page;
  guest: Page;
}

export interface PairOptions {
  seed?: number;
  rounds?: 4 | 8 | 12;
  hostName?: string;
  guestName?: string;
}

/**
 * Pair two pages from separate browser contexts over real WebRTC (loopback
 * host candidates) and wait until both sit at the table. Tests normally reach
 * this through the `pair` fixture, which also owns the contexts; call it
 * directly to patch a page (`addInitScript`) before it boots.
 */
export async function pairPages(host: Page, guest: Page, options: PairOptions = {}): Promise<void> {
  await bootHome(host, { seed: options.seed, name: options.hostName, rounds: options.rounds, mode: "host" });
  await bootHome(guest, { name: options.guestName, mode: "join" });

  await exchangeCodes(host, guest);
  await expect(host.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
  await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
}

/** The local player's hand cards, in on-screen (sorted) order. */
export function handCards(page: Page): Locator {
  return page.locator(".player-hand-cards .playing-card");
}

/** One specific card button in the local player's hand. */
export function handCard(page: Page, cardId: string): Locator {
  return page.locator(`.player-hand-cards .playing-card[data-card-id="${cardId}"]`);
}
