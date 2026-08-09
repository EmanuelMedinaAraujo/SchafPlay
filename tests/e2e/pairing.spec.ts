import { Page } from "@playwright/test";
import { bootHome, de, exchangeCodes } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/** Garbage that decompresses to nothing — exercises the INVALID_CODE path. */
const GARBAGE = "this-is-not-a-valid-sdp-code-!!!";

/** Read a host page's freshly minted invite code once its textarea appears. */
async function hostInvite(host: Page): Promise<string> {
  const inviteArea = host.locator(".pairing-flow textarea[readonly]").first();
  // Invite generation gathers ICE candidates (up to ~1.5s by design).
  await expect(inviteArea).toBeVisible({ timeout: 15_000 });
  return inviteArea.inputValue();
}

test.describe("pairing", () => {
  test("guest rejects a garbage invite code without crashing", async ({ page }) => {
    await bootHome(page);
    await page.getByRole("tab", { name: de.joinGame }).click();

    const flow = page.locator(".pairing-flow");
    await flow.getByPlaceholder(de.pasteInviteHint).fill(GARBAGE);
    await flow.getByRole("button", { name: de.generateReply }).click();

    await expect(flow.locator(".error-text")).toHaveText(de.invalidCode);
    // No reply was produced and the paste field is still there and usable —
    // the app recovered rather than crashing.
    await expect(flow.locator("textarea[readonly]")).toHaveCount(0);
    await expect(page.locator(".home-screen")).toBeVisible();
    await flow.getByPlaceholder(de.pasteInviteHint).fill("retry");
    await expect(flow.getByRole("button", { name: de.generateReply })).toBeEnabled();
  });

  test("host rejects a garbage reply code and keeps the invite live", async ({ page }) => {
    await bootHome(page); // defaults to host mode; the invite is minted on mount.
    const invite = await hostInvite(page);
    expect(invite.length).toBeGreaterThan(0);

    const flow = page.locator(".pairing-flow");
    await flow.getByPlaceholder(de.pasteReplyHint).fill(GARBAGE);
    await flow.getByRole("button", { name: de.connect }).click();

    await expect(flow.locator(".error-text")).toHaveText(de.invalidCode);
    // INVALID_CODE leaves the peer alive: the same invite is still on screen,
    // so a real guest reply would still connect.
    await expect(flow.locator("textarea[readonly]").first()).toHaveValue(invite);
  });

  test("deep-link opens the join flow with the invite pre-filled and pairs", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      await bootHome(host);
      const invite = await hostInvite(host);

      // Opening the deep link routes the guest straight into the join flow with
      // the invite already loaded into the paste field.
      await guest.goto(`/#invite=${encodeURIComponent(invite)}`);
      const guestFlow = guest.locator(".pairing-flow");
      await expect(guest.getByRole("tab", { name: de.joinGame })).toHaveAttribute("aria-selected", "true");
      await expect(guestFlow.getByPlaceholder(de.pasteInviteHint)).toHaveValue(invite);

      // The panel also auto-submits on mount, but StrictMode's dev
      // double-invoke tears the auto-created peer down, so that path fails in
      // the dev build. Drive the exchange explicitly instead.
      await exchangeCodes(host, guest);

      await expect(host.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
      await expect(guest.locator(".game-screen")).toBeVisible({ timeout: 15_000 });
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test("paste button fills the invite code from clipboard", async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await bootHome(page);
    await page.evaluate(() => navigator.clipboard.writeText("test-clipboard-value"));
    await page.getByRole("tab", { name: de.joinGame }).click();

    const flow = page.locator(".pairing-flow");
    await flow.getByRole("button", { name: de.paste }).click();

    await expect(flow.getByPlaceholder(de.pasteInviteHint)).toHaveValue("test-clipboard-value");
  });

  // Name propagation is asserted by smoke.spec.ts, not duplicated here.
});
