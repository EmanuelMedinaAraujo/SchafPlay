import { bootHome, de, readInvite } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/**
 * QR pairing (#7): the host's invite QR opens from the copy-paste flow and
 * closing it leaves that flow in place. Scanning needs a camera, so it is out
 * of scope here.
 */
test.describe("qr pairing", () => {
  test("host shows an invite QR with the copy-paste flow intact", async ({ page }) => {
    await bootHome(page, { seed: 7, mode: "host" });

    // The invite code (and its QR) appear once ICE gathering completes.
    expect(await readInvite(page, 20_000)).not.toBe("");

    // The QR code starts hidden and is only displayed inside the popup.
    const qr = page.locator(".qr-code");
    await expect(qr).toHaveCount(0);

    await page.getByRole("button", { name: de.showQr }).click();
    await expect(qr).toBeVisible();

    await page.getByRole("button", { name: de.cancel }).click();
    await expect(qr).toHaveCount(0);
    await expect(page.locator(".pairing-flow textarea[readonly]")).toBeVisible();
  });
});
