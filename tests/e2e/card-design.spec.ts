import { test, expect } from "./helpers/test";
import { bootHome, de, handCards } from "./helpers/fixtures";
import * as path from "path";
import * as fs from "fs";

test.describe("card design settings and screenshots", () => {
  // iPhone 13 landscape viewport is 844x390
  test.use({ viewport: { width: 844, height: 390 } });

  test("generate screenshots and verify designs", async ({ page }) => {
    // Log console and page errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message, err.stack));

    // Artifacts directory path
    const artifactDir = "C:/Users/emanu/.gemini/antigravity/brain/bfbc57ec-80b3-4cb4-b496-0342cab6a48c";
    
    // Ensure local screenshot directories exist
    const localScreenshotDir = path.resolve("./docs/pr-screenshots/card-design");
    if (!fs.existsSync(localScreenshotDir)) {
      fs.mkdirSync(localScreenshotDir, { recursive: true });
    }

    // Ensure artifact directory exists
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // 1. Settings - Bavarian Design
    await bootHome(page);
    await page.getByTitle(de.settings).click();
    await expect(page.getByRole("heading", { name: de.settingsCardDesign })).toBeVisible();

    // Ensure it is on Bavarian
    await page.getByRole("button", { name: de.settingsCardDesignBavarian }).click();
    
    // Take Settings Bavarian screenshot
    const settingsBavarianPath = path.join(localScreenshotDir, "1-settings-bavarian.png");
    await page.screenshot({ path: settingsBavarianPath });
    fs.copyFileSync(settingsBavarianPath, path.join(artifactDir, "1-settings-bavarian.png"));

    // 2. Settings - Minimal Design
    await page.getByRole("button", { name: de.settingsCardDesignMinimal }).click();
    const settingsMinimalPath = path.join(localScreenshotDir, "2-settings-minimal.png");
    await page.screenshot({ path: settingsMinimalPath });
    fs.copyFileSync(settingsMinimalPath, path.join(artifactDir, "2-settings-minimal.png"));

    // 3. Game - Minimal Design
    // Go to home and start a Solo game (settings are minimal now)
    await page.getByTitle(de.home).click();
    await page.getByRole("tab", { name: de.soloGame }).click();
    await page.getByRole("button", { name: de.startGame }).click();
    await expect(page.locator(".game-screen")).toBeVisible();
    await expect(handCards(page)).toHaveCount(8);

    const gameMinimalPath = path.join(localScreenshotDir, "4-game-minimal.png");
    await page.screenshot({ path: gameMinimalPath });
    fs.copyFileSync(gameMinimalPath, path.join(artifactDir, "4-game-minimal.png"));

    // Quit game to change settings
    await page.getByTitle(de.quit).click();
    
    // Switch settings back to Bavarian
    await page.getByTitle(de.settings).click();
    await page.getByRole("button", { name: de.settingsCardDesignBavarian }).click();
    
    // Go to home and start solo game with Bavarian design
    await page.getByTitle(de.home).click();
    await page.getByRole("tab", { name: de.soloGame }).click();
    await page.getByRole("button", { name: de.startGame }).click();
    await expect(page.locator(".game-screen")).toBeVisible();
    await expect(handCards(page)).toHaveCount(8);

    const gameBavarianPath = path.join(localScreenshotDir, "3-game-bavarian.png");
    await page.screenshot({ path: gameBavarianPath });
    fs.copyFileSync(gameBavarianPath, path.join(artifactDir, "3-game-bavarian.png"));

    // 4. Round Overview UI screenshot
    // Use dev skip round button to end the round and show round overview
    await page.getByRole("button", { name: de.devSkipRound }).click();
    await expect(page.locator(".round-over-overlay")).toBeVisible();
    
    const roundOverviewPath = path.join(localScreenshotDir, "5-round-overview.png");
    await page.screenshot({ path: roundOverviewPath });
    fs.copyFileSync(roundOverviewPath, path.join(artifactDir, "5-round-overview.png"));
  });
});
