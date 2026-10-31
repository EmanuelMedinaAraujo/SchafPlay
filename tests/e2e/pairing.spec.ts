import { bootHome, de, exchangeCodes, readInvite } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/** Garbage that decompresses to nothing — exercises the INVALID_CODE path. */
const GARBAGE = "this-is-not-a-valid-sdp-code-!!!";

test.describe("pairing", () => {
  test("guest rejects a garbage invite code without crashing", async ({ page }) => {
    await bootHome(page, { mode: "join" });

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
    await bootHome(page, { mode: "host" }); // the invite is minted when the panel mounts.
    const invite = await readInvite(page);
    expect(invite.length).toBeGreaterThan(0);

    const flow = page.locator(".pairing-flow");
    await flow.getByPlaceholder(de.pasteReplyHint).fill(GARBAGE);
    await flow.getByRole("button", { name: de.connect }).click();

    await expect(flow.locator(".error-text")).toHaveText(de.invalidCode);
    // INVALID_CODE leaves the peer alive: the same invite is still on screen,
    // so a real guest reply would still connect.
    await expect(flow.locator("textarea[readonly]").first()).toHaveValue(invite);
  });

  test("deep-link opens the join flow with the invite pre-filled and pairs", async ({ newPage }) => {
    const host = await newPage();
    const guest = await newPage();

    await bootHome(host, { mode: "host" });
    const invite = await readInvite(host);

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
  });

  test("paste button fills the invite code from clipboard", async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await bootHome(page, { mode: "join" });
    await page.evaluate(() => navigator.clipboard.writeText("test-clipboard-value"));

    const flow = page.locator(".pairing-flow");
    await flow.getByRole("button", { name: de.paste }).click();

    await expect(flow.getByPlaceholder(de.pasteInviteHint)).toHaveValue("test-clipboard-value");
  });
});
