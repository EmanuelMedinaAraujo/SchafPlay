import { translations } from "../../src/lib/i18n";
import { bootHome, de, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";
import { quitFinishedList, skipRounds } from "./helpers/ui";

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

    // The scoring effect is engine-internal; only persistence is observable here.
    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(page.getByRole("button", { name: de.settingsLaufendeOff })).toHaveAttribute("aria-pressed", "true");
  });

  test("default and presets share one selection that survives reload (#104)", async ({ page }) => {
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await expect(page.getByRole("heading", { name: de.settingsAvatar })).toBeVisible();

    const picker = page.getByRole("radiogroup", { name: de.avatarChoose });
    const selected = picker.getByRole("radio", { checked: true });
    const defaultPicture = picker.getByRole("radio", { name: de.avatarDefault });
    const zenzi = picker.getByRole("radio", { name: "Zenzi" });
    await expect(selected).toHaveCount(1);
    await expect(defaultPicture).toBeChecked();

    await zenzi.check();
    await expect(zenzi).toBeChecked();
    await expect(defaultPicture).not.toBeChecked();
    await expect(picker.locator(".avatar-option-check")).toHaveCount(1);

    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(zenzi).toBeChecked();
    await zenzi.focus();
    await page.keyboard.press("ArrowRight");
    await expect(picker.getByRole("radio", { name: "Wastl" })).toBeChecked();
    await defaultPicture.check();
    await expect(defaultPicture).toBeChecked();
    await expect(selected).toHaveCount(1);
  });

  test("upload stays selectable until deleted (#104)", async ({ page }) => {
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    const picker = page.getByRole("radiogroup", { name: de.avatarChoose });
    const defaultPicture = picker.getByRole("radio", { name: de.avatarDefault });
    const custom = picker.getByRole("radio", { name: de.avatarCustom });
    const upload = page.getByRole("button", { name: de.avatarUpload });
    const remove = page.getByRole("button", { name: de.avatarDelete });

    const [fileChooser] = await Promise.all([page.waitForEvent("filechooser"), upload.click()]);
    await fileChooser.setFiles("public/icon-192.png");
    await expect(custom).toBeChecked();
    await expect(picker.getByRole("button", { name: de.avatarUpload })).toHaveCount(0);
    await expect(upload.locator("svg")).toBeVisible();

    await defaultPicture.check();
    await expect(custom).not.toBeChecked();
    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(defaultPicture).toBeChecked();
    await custom.check();
    await expect(custom).toBeChecked();
    await remove.click();
    await expect(defaultPicture).toBeChecked();
    await expect(custom).toHaveCount(0);
    await expect(remove).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("schafplay.avatar"))).toBe("");

    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(defaultPicture).toBeChecked();
    await expect(custom).toHaveCount(0);
    await expect(upload).toBeVisible();
  });

  test("legacy upload is retained through switching and can be deleted without changing the preset (#104)", async ({ page }) => {
    await bootHome(page);
    await page.evaluate(() => {
      localStorage.setItem("schafplay.avatar", document.createElement("canvas").toDataURL());
    });
    await page.reload();
    await page.getByTitle(de.settings).click();
    const picker = page.getByRole("radiogroup", { name: de.avatarChoose });
    const custom = picker.getByRole("radio", { name: de.avatarCustom });
    const preset = picker.getByRole("radio", { name: "Wastl" });
    await expect(custom).toBeChecked();
    await preset.check();

    await page.reload();
    await page.getByTitle(de.settings).click();
    await expect(preset).toBeChecked();
    await expect(custom).toBeVisible();
    await page.getByRole("button", { name: de.avatarDelete }).click();
    await expect(custom).toHaveCount(0);
    await expect(preset).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem("schafplay.avatar"))).toBe("preset:wastl");
  });

  test("stale picker actions respect uploads and deletions from another tab (#104)", async ({ page }) => {
    // Keep this picker stale even after the other tab has finished writing.
    await page.addInitScript(() => window.addEventListener("storage", (event) => event.stopImmediatePropagation()));
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    const custom = page.getByRole("radio", { name: de.avatarCustom });
    await expect(custom).toBeChecked();
    const original = await page.locator(".avatar-option.selected img").getAttribute("src");

    const otherTab = await page.context().newPage();
    await bootHome(otherTab);
    await otherTab.getByTitle(de.settings).click();
    await otherTab.locator('input[type="file"]').setInputFiles("public/avatars/resi.jpg");
    const otherPicker = otherTab.getByRole("radiogroup", { name: de.avatarChoose });
    const replacement = otherPicker.locator(".avatar-option.selected img");
    await expect(replacement).not.toHaveAttribute("src", original!);
    await expect(replacement).toHaveAttribute("src", /^data:image\/jpeg/);
    const replacementSrc = await replacement.getAttribute("src");

    await page.getByRole("button", { name: de.avatarDelete }).click();
    await expect(custom).toBeChecked();
    await expect(page.locator(".avatar-option.selected img")).toHaveAttribute("src", replacementSrc!);
    await otherTab.getByRole("button", { name: de.avatarDelete }).click();

    await page.getByRole("radio", { name: "Zenzi" }).check();
    await expect(custom).toHaveCount(0);
    await otherTab.reload();
    await otherTab.getByTitle(de.settings).click();
    await expect(otherTab.getByRole("radio", { name: "Zenzi" })).toBeChecked();
    await expect(otherTab.getByRole("radio", { name: de.avatarCustom })).toHaveCount(0);
  });

  test("the custom picture stays available for the session if storage rejects writes (#104)", async ({ page }) => {
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "schafplay.avatar") throw new DOMException("Storage full", "QuotaExceededError");
        setItem.call(this, key, value);
      };
    });
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    const custom = page.getByRole("radio", { name: de.avatarCustom });
    await expect(custom).toBeChecked();
    await page.getByRole("radio", { name: "Zenzi" }).check();
    await expect(custom).toBeVisible();
    await custom.check();
    await expect(custom).toBeChecked();
  });

  test("the home screen always opens on solo (#94)", async ({ page }) => {
    await bootHome(page);

    // Solo is selected on open, and nothing has minted an invite — no
    // signaling runs before the player asks for multiplayer.
    await expect(page.getByRole("tab", { name: de.soloGame })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".pairing-flow textarea[readonly]")).toHaveCount(0);

    // Using host does not stick: the next open is solo again (the mode is no
    // longer a persisted preference).
    await page.getByRole("tab", { name: de.hostGame }).click();
    await expect(page.getByRole("tab", { name: de.hostGame })).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(page.getByRole("tab", { name: de.soloGame })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: de.hostGame })).toHaveAttribute("aria-selected", "false");
  });

  test("player name is enforced in-game and persists on the home screen", async ({ page }) => {
    await startSolo(page, { name: "Vroni" });
    await expect(page.locator(".player-hand-name")).toHaveText("Vroni");

    // Quit back to the home screen and reload — the name survives both.
    await page.getByTitle(de.quit).click();
    await expect(page.locator(".home-screen")).toBeVisible();
    await page.reload();
    await expect(page.locator("#player-name")).toHaveValue("Vroni");
  });

  test("export games downloads file or shows error if empty", async ({ page }) => {
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await expect(page.getByRole("heading", { name: de.settingsExport })).toBeVisible();

    const exportBtn = page.locator(".settings-export-btn");
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Nothing recorded yet.
    await expect(page.locator(".error-message")).toContainText(de.exportNoGames);

    // With a recorded list the same button downloads it.
    await startSolo(page, { seed: 5, rounds: 4, name: "Wastl" });
    await skipRounds(page, 4);
    await quitFinishedList(page);
    await page.getByTitle(de.settings).click();

    const downloadPromise = page.waitForEvent("download");
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^schafplay-history-\d{4}-\d{2}-\d{2}\.txt$/);
  });
});

