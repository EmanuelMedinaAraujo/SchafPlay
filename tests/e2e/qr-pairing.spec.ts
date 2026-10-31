import { Page } from "@playwright/test";
import { encodeQR } from "../../src/lib/qr";
import { bootHome, de, readInvite } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

/** Replace the camera with a canvas stream showing `text` as a QR code. */
async function showQrToCamera(page: Page, text: string): Promise<void> {
  await page.addInitScript((matrix) => {
    const scale = 10;
    const quiet = 4;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = (matrix.length + quiet * 2) * scale;
    const context = canvas.getContext("2d")!;
    const draw = () => {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000";
      matrix.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) context.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
        }),
      );
    };
    // A canvas stream only yields frames while something keeps drawing.
    window.setInterval(draw, 100);
    draw();
    navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(10);
  }, encodeQR(text));
}

/**
 * QR pairing (#7): the host's invite QR opens from the copy-paste flow and
 * closing it leaves that flow in place; a scanned code feeds the paste flow.
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

  test("a scanned invite goes through the on-demand decoder into the join flow", async ({ page }) => {
    await showQrToCamera(page, "not-a-real-invite");
    await bootHome(page, { mode: "join" });

    await page.getByRole("button", { name: de.scanInviteQr }).click();

    const flow = page.locator(".pairing-flow");
    await expect(flow.getByPlaceholder(de.pasteInviteHint)).toHaveValue("not-a-real-invite");
    await expect(flow.locator(".error-text")).toHaveText(de.invalidCode);
    await expect(page.locator(".qr-scanner-overlay")).toHaveCount(0);
  });
});
