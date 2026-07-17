import { bootHome, de } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";
import { GameType } from "../../src/game/types";
import { gameLabel } from "../../src/lib/i18n";

/**
 * Ramsch house rule (#11). With the setting on, a will-phase where every seat
 * passes plays the deal out as a Ramsch instead of redealing. Seed 79 is a
 * deterministic all-pass deal: every seat's AI will-bid heuristic declines, so
 * once the human seat passes too the round tips into a Ramsch.
 *
 * The default-off behavior (all-pass → redeal) is covered implicitly by the
 * rest of the suite, which runs with the setting at its default.
 */
test.describe("ramsch", () => {
  test("all-pass plays and scores a Ramsch when the house rule is on", async ({ page }) => {
    // Turn the Ramsch house rule on (it defaults off) via settings.
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await page.getByRole("button", { name: de.settingsRamschPlay }).click();
    await expect(page.getByRole("button", { name: de.settingsRamschPlay })).toHaveAttribute("aria-pressed", "true");

    // Boot the seeded all-pass solo deal. The setting persists in localStorage
    // across this navigation, so the fresh engine picks it up.
    await bootHome(page, { seed: 79, name: "Wastl" });
    await page.getByRole("tab", { name: de.soloGame }).click();
    await page.getByRole("button", { name: de.startGame }).click();
    await expect(page.locator(".game-screen")).toBeVisible();

    // Human seat passes in the will phase (the three AI seats pass on their
    // own); that completes the all-pass.
    await page.getByRole("button", { name: de.pass, exact: true }).click();

    // With the rule on, the all-pass becomes a Ramsch rather than a redeal:
    // the contract chip names the Ramsch instead of the deal being thrown in.
    await expect(page.locator(".contract-chip")).toHaveText(gameLabel("de", GameType.RAMSCH), { timeout: 15_000 });

    // Play the Ramsch out; the summary headline names the loser who pays all
    // (or a Durchmarsch winner who takes all) — never a declarer/defender line.
    await page.locator(".dev-round-btn").click();
    await expect(page.locator(".round-over-overlay h2")).toContainText(de.roundOver);
    await expect(page.locator(".round-headline")).toHaveText(
      new RegExp(`${de.ramschLoses}|${de.ramschDurchmarsch}`),
    );
  });
});
