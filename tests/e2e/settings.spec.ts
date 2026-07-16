import { translations } from "../../src/lib/i18n";
import { bootHome, de, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

const en = translations.en;

test.describe("settings", () => {
  test("language setting is enforced and persists across reload", async ({ page }) => {
    await bootHome(page);

    // Default language is German.
    await page.getByTitle(de.settings).click();
    await expect(page.getByRole("heading", { name: de.settingsLanguage })).toBeVisible();

    // Switch to English — headings flip immediately (no reload needed).
    await page.getByRole("tab", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: en.settingsLanguage })).toBeVisible();
    await expect(page.getByTitle(en.settings)).toBeVisible();

    // Persists across a full reload (schafplay.language in localStorage).
    await page.reload();
    await expect(page.getByTitle(en.settings)).toBeVisible();
    await page.getByTitle(en.settings).click();
    await expect(page.getByRole("heading", { name: en.settingsLanguage })).toBeVisible();

    // Switch back to German and confirm that persists too.
    await page.getByRole("tab", { name: "Deutsch" }).click();
    await expect(page.getByRole("heading", { name: de.settingsLanguage })).toBeVisible();
    await page.reload();
    await expect(page.getByTitle(de.settings)).toBeVisible();
  });

  test("laufende house rule selection persists across reload", async ({ page }) => {
    await bootHome(page);
    await page.getByTitle(de.settings).click();

    const offButton = page.getByRole("button", { name: de.settingsLaufendeOff });
    const countButton = page.getByRole("button", { name: de.settingsLaufendeCount });
    await expect(countButton).toHaveAttribute("aria-pressed", "true");
    await expect(offButton).toHaveAttribute("aria-pressed", "false");

    await offButton.click();
    await expect(offButton).toHaveAttribute("aria-pressed", "true");
    await expect(countButton).toHaveAttribute("aria-pressed", "false");

    // Its scoring effect is engine-internal (disableLaufende reaches
    // calculateRoundResult) — out of scope for E2E. Here we only assert the
    // selection is persisted, which is what a page reload can observe.
    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(page.getByRole("button", { name: de.settingsLaufendeOff })).toHaveAttribute("aria-pressed", "true");
  });

  test("list length selection controls the round count in a solo game", async ({ page }) => {
    await startSolo(page, { rounds: 4 });
    await expect(page.locator(".game-toolbar")).toContainText("1/4");
  });

  test("last-used game mode is preselected after reload (#44)", async ({ page }) => {
    await bootHome(page);

    // Default mode is host.
    await expect(page.getByRole("tab", { name: de.hostGame })).toHaveAttribute("aria-selected", "true");

    // Switch to join and reload — the join tab comes back selected.
    await page.getByRole("tab", { name: de.joinGame }).click();
    await expect(page.getByRole("tab", { name: de.joinGame })).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(page.getByRole("tab", { name: de.joinGame })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: de.hostGame })).toHaveAttribute("aria-selected", "false");

    // Solo persists too.
    await page.getByRole("tab", { name: de.soloGame }).click();
    await page.reload();
    await expect(page.getByRole("tab", { name: de.soloGame })).toHaveAttribute("aria-selected", "true");
  });

  test("player name is enforced in-game and persists on the home screen", async ({ page }) => {
    await bootHome(page, { name: "Vroni" });
    await expect(page.locator("#player-name")).toHaveValue("Vroni");

    await page.getByRole("tab", { name: de.soloGame }).click();
    await page.getByRole("button", { name: de.startGame }).click();
    await expect(page.locator(".game-screen")).toBeVisible();
    await expect(page.locator(".player-hand-name")).toHaveText("Vroni");

    // Quit back to the home screen and reload — the name survives both.
    await page.getByTitle(de.quit).click();
    await expect(page.locator(".home-screen")).toBeVisible();
    await page.reload();
    await expect(page.locator("#player-name")).toHaveValue("Vroni");
  });
});
