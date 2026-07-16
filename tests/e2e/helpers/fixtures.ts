import { Browser, BrowserContext, Locator, Page, expect } from "@playwright/test";
import { translations } from "../../../src/lib/i18n";

/** The suite drives the app in its default language. */
export const de = translations.de;

export interface BootOptions {
  /** Activates the DEV determinism hook (`src/lib/e2e.ts`): seeded deal + fast AI pacing. */
  seed?: number;
  name?: string;
  rounds?: 4 | 8 | 12;
}

/** Load the home screen and apply the pre-game options a player would set there. */
export async function bootHome(page: Page, options: BootOptions = {}): Promise<void> {
  await page.goto(options.seed === undefined ? "/" : `/?e2e-seed=${options.seed}`);
  if (options.name !== undefined) {
    await page.locator("#player-name").fill(options.name);
  }
  if (options.rounds !== undefined) {
    await page.locator(".list-length-row").getByRole("button", { name: String(options.rounds), exact: true }).click();
  }
}

/** Boot straight into a solo game; resolves once the table is on screen. */
export async function startSolo(page: Page, options: BootOptions = {}): Promise<void> {
  await bootHome(page, options);
  await page.getByRole("tab", { name: de.soloGame }).click();
  await page.getByRole("button", { name: de.startGame }).click();
  await expect(page.locator(".game-screen")).toBeVisible();
}

/**
 * Run one host↔guest code exchange through whatever PairingPanel is currently
 * on each page — the home screen's panel and the mid-game reconnect overlay
 * render the same flow, so this drives initial pairing and re-pairing alike.
 * The host page must already show the host panel, the guest page the join
 * panel (paste field visible).
 */
export async function exchangeCodes(host: Page, guest: Page): Promise<void> {
  const hostFlow = host.locator(".pairing-flow");
  const guestFlow = guest.locator(".pairing-flow");

  // Invite code generation gathers ICE candidates (up to ~1.5s by design).
  const inviteArea = hostFlow.locator("textarea[readonly]").first();
  await expect(inviteArea).toBeVisible({ timeout: 15_000 });
  const invite = await inviteArea.inputValue();

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
  hostContext: BrowserContext;
  guestContext: BrowserContext;
}

export interface PairOptions {
  seed?: number;
  rounds?: 4 | 8 | 12;
  hostName?: string;
  guestName?: string;
}

/**
 * Boot two isolated browser contexts, pair them over real WebRTC (loopback
 * host candidates) and wait until both sit at the table. Caller closes the
 * contexts (or lets the test teardown do it).
 */
export async function pairHostGuest(browser: Browser, options: PairOptions = {}): Promise<PairedGame> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await bootHome(host, { seed: options.seed, name: options.hostName, rounds: options.rounds });
  await bootHome(guest, { name: options.guestName });
  await guest.getByRole("tab", { name: de.joinGame }).click();

  await exchangeCodes(host, guest);
  await expect(host.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
  await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
  return { host, guest, hostContext, guestContext };
}

/** The local player's hand cards, in on-screen (sorted) order. */
export function handCards(page: Page): Locator {
  return page.locator(".player-hand-cards .playing-card");
}

/** One specific card button in the local player's hand. */
export function handCard(page: Page, cardId: string): Locator {
  return page.locator(`.player-hand-cards .playing-card[data-card-id="${cardId}"]`);
}

/** Cards lying on the table in the current trick. */
export function trickCards(page: Page): Locator {
  return page.locator(".trick-area .card-face");
}

/**
 * Wait until it is the local player's turn to play a card (hand unlocked),
 * or — if the round ends first — return false once the summary shows.
 */
export async function waitMyTurnOrRoundOver(page: Page): Promise<boolean> {
  const myTurn = page.locator(".player-hand-container.my-turn");
  const roundOver = page.locator(".round-over-overlay");
  await expect(myTurn.or(roundOver).first()).toBeVisible({ timeout: 20_000 });
  return !(await roundOver.isVisible());
}
