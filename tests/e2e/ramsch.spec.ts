import { bootHome, de } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";
import { GameType } from "../../src/game/types";
import { gameLabel } from "../../src/lib/i18n";

/**
 * Ramsch house rule (#11). Seed 79 is a deterministic all-pass deal. The
 * default-off behavior (all-pass → redeal) is covered implicitly by the rest
 * of the suite, which runs with the setting at its default.
 */
test.describe("ramsch", () => {
  test("all-pass plays and scores a Ramsch when the house rule is on", async ({ page }) => {
    // Turn the Ramsch house rule on (it defaults off) via settings.
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await page.getByRole("button", { name: de.settingsRamschPlay }).click();
    await expect(page.getByRole("button", { name: de.settingsRamschPlay })).toHaveAttribute("aria-pressed", "true");

    // The setting persists across this navigation, so the fresh engine sees it.
    await bootHome(page, { seed: 79, name: "Wastl" });
    await page.getByRole("tab", { name: de.soloGame }).click();
    await page.getByRole("button", { name: de.startGame }).click();
    await expect(page.locator(".game-screen")).toBeVisible();

    // The three AI seats pass on their own; this completes the all-pass.
    await page.getByRole("button", { name: de.pass, exact: true }).click();

    // The all-pass becomes a Ramsch rather than a redeal.
    await expect(page.locator(".contract-chip")).toHaveText(gameLabel("de", GameType.RAMSCH), { timeout: 15_000 });

    // The summary names the loser (or Durchmarsch winner), never declarer/defender.
    await page.locator(".dev-round-btn").click();
    await expect(page.locator(".round-over-overlay h2")).toContainText(de.roundOver);
    await expect(page.locator(".round-headline")).toHaveText(
      new RegExp(`${de.ramschLoses}|${de.ramschDurchmarsch}`),
    );
  });
});
