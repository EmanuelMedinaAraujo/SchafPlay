import { BrowserContext, Page } from "@playwright/test";
import { bootHome, de, exchangeCodes } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/**
 * Persistent certificates → 1-message reconnection (issue #71).
 *
 * A pair that has connected once before should reconnect from the host's invite
 * ALONE — no reply code travels back. This exercises the full stack over two
 * real WebRTC channels: persistent certificate reuse (stable DTLS fingerprint),
 * fingerprint pinning in localStorage, and the host priming an offer whose guest
 * ICE credentials are derived from the shared secret so the guest's answer is
 * synthesised locally and its address discovered via peer-reflexive candidates.
 *
 * The two contexts are reloaded (not recreated) between pairings so their
 * IndexedDB certificate and localStorage pin survive — exactly what a returning
 * pair has. Candidate gathering is LAN-only (no ICE servers), and the pair
 * connects over loopback.
 */

async function hostInvite(host: Page): Promise<string> {
  const inviteArea = host.locator(".pairing-flow textarea[readonly]").first();
  await expect(inviteArea).toBeVisible({ timeout: 20_000 });
  const value = await inviteArea.inputValue();
  expect(value.length).toBeGreaterThan(0);
  return value;
}

/** Boot the host into host mode with its invite minted, the guest into join mode. */
async function openPairingScreens(host: Page, guest: Page): Promise<void> {
  await host.getByRole("tab", { name: de.hostGame }).click();
  await guest.getByRole("tab", { name: de.joinGame }).click();
}

test.describe("fast reconnect (issue #71)", () => {
  test("a returning pair connects from the invite alone, no reply code", async ({ browser }) => {
    const hostContext: BrowserContext = await browser.newContext();
    const guestContext: BrowserContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      // --- First pairing: the classic 2-message flow establishes the pins. ---
      await bootHome(host);
      await bootHome(guest);
      await openPairingScreens(host, guest);
      await exchangeCodes(host, guest);
      await expect(host.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
      await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 15_000 });

      // --- Reload both: a fresh app, but the cert + pin persist in storage. ---
      await host.goto("/");
      await guest.goto("/");
      await openPairingScreens(host, guest);

      // --- Second pairing: the guest consumes ONE invite and connects. ---
      const invite = await hostInvite(host);

      const guestFlow = guest.locator(".pairing-flow");
      await guestFlow.getByPlaceholder(de.pasteInviteHint).fill(invite);
      await guestFlow.getByRole("button", { name: de.generateReply }).click();

      // No reply textarea is ever produced — there is nothing to hand back.
      await expect(guestFlow.locator("textarea[readonly]")).toHaveCount(0);

      // Both sit at the table, and the host NEVER pasted a reply code.
      await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 20_000 });
      await expect(host.locator(".game-screen")).toBeVisible({ timeout: 20_000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
