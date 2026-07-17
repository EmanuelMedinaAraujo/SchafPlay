import { bootHome, de } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/**
 * QR pairing (issue #7, Option C). Verifies the host's invite QR renders
 * alongside the existing copy-paste flow, and that hiding it never removes the
 * textarea fallback. Camera scanning is feature-detected (BarcodeDetector +
 * getUserMedia) and unavailable in headless CI, so it is out of scope here;
 * the encoder's decode-correctness is verified out of band (see the PR).
 */
test.describe("qr pairing", () => {
  test("host shows an invite QR with the copy-paste flow intact", async ({ page }) => {
    await bootHome(page, { seed: 7 });
    await page.getByRole("tab", { name: de.hostGame }).click();

    // The invite code (and its QR) appear once ICE gathering completes.
    const inviteArea = page.locator(".pairing-flow textarea[readonly]").first();
    await expect(inviteArea).toBeVisible({ timeout: 20_000 });
    await expect(inviteArea).not.toHaveValue("");

    // The QR code starts hidden and is only displayed inside the popup.
    const qr = page.locator(".qr-code");
    await expect(qr).toHaveCount(0);

    // Open the QR popup
    await page.getByRole("button", { name: de.showQr }).click();
    await expect(qr).toBeVisible();

    // Close the QR popup
    await page.getByRole("button", { name: de.cancel }).click();
    await expect(qr).toHaveCount(0);
  });
});
