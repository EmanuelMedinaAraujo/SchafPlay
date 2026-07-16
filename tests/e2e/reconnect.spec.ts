import { Page } from "@playwright/test";
import { de, exchangeCodes, handCards, pairHostGuest } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/** The local hand's card ids, order-independent (the host never auto-plays). */
async function handCardIds(page: Page): Promise<string[]> {
  const ids = await handCards(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-card-id") ?? ""),
  );
  return ids.sort();
}

/** The "round X/Y" text from the in-game toolbar. */
function roundLabel(page: Page): Promise<string> {
  return page.locator(".game-toolbar").getByText(new RegExp(`${de.round}\\s+\\d+/\\d+`)).innerText();
}

test.describe("reconnect", () => {
  test("mid-game disconnect pauses the host and re-pairing resumes intact", async ({ browser }) => {
    const { host, guest, guestContext } = await pairHostGuest(browser, { seed: 3, rounds: 8 });

    // Both sides are at the table in the bidding phase.
    await expect(host.locator(".bidding-panel")).toContainText(de.willPhaseTitle);
    await expect(guest.locator(".bidding-panel")).toContainText(de.willPhaseTitle);

    // Snapshot the host's authoritative view just before the drop. The engine
    // is host-driven and the host is a human that never auto-acts, so the hand
    // and round are stable until we tear the link down.
    const handBefore = await handCardIds(host);
    const roundBefore = await roundLabel(host);
    expect(handBefore).toHaveLength(8);

    // Closing the guest CONTEXT (not just the page) tears down the
    // RTCPeerConnection so the host detects the drop promptly; if it ever falls
    // back to the 15s heartbeat timeout the overlay still appears within 20s.
    await guestContext.close();

    const overlay = host.locator(".reconnect-overlay");
    await expect(overlay).toBeVisible({ timeout: 20_000 });
    await expect(overlay.locator("h2")).toHaveText(de.paused);

    // While paused the overlay is modal: it is a fixed full-viewport layer over
    // the board, so a hit-test at the first hand card lands on the overlay, not
    // the card. The hand buttons are disabled too.
    const firstCard = handCards(host).first();
    await expect(firstCard).toBeDisabled();
    const box = await firstCard.boundingBox();
    expect(box).not.toBeNull();
    const hitInsideOverlay = await host.evaluate((point) => {
      const el = document.elementFromPoint(point.x, point.y);
      return !!el?.closest(".reconnect-overlay");
    }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
    expect(hitInsideOverlay).toBe(true);

    // Bring a fresh guest in and re-pair through the overlay's PairingPanel.
    const newGuestContext = await browser.newContext();
    const newGuest = await newGuestContext.newPage();
    try {
      await newGuest.goto("/");
      await newGuest.getByRole("tab", { name: de.joinGame }).click();
      await exchangeCodes(host, newGuest);

      // The engine survived the pause: overlay clears and the host shows the
      // exact same hand and round it had before the drop.
      await expect(overlay).toBeHidden({ timeout: 20_000 });
      await expect(host.locator(".game-screen")).toBeVisible();
      expect(await handCardIds(host)).toEqual(handBefore);
      expect(await roundLabel(host)).toBe(roundBefore);

      // The new guest lands at the table on the same round.
      await expect(newGuest.locator(".game-screen")).toBeVisible({ timeout: 20_000 });
      await expect(async () => {
        expect(await roundLabel(newGuest)).toBe(roundBefore);
      }).toPass({ timeout: 20_000 });
    } finally {
      await newGuestContext.close();
    }
  });
});
