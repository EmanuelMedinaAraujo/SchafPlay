import { GameType, CardValue } from "../../src/game/types";
import { isTrump } from "../../src/game/rules";
import { de, startSolo } from "./helpers/fixtures";
import { simulateSolo } from "./helpers/simulate";
import { performBids } from "./helpers/ui";
import { expect, test } from "./helpers/test";

test.describe("AI bidding behavior", () => {
  test("AI does not bid Sauspiel if another player already bid wantsToPlay", async ({ page }) => {
    const seed = 116;
    const trace = simulateSolo(seed, { totalRounds: 8 });
    const round = trace[0];

    await startSolo(page, { seed, name: "Toni", rounds: 8 });

    // Toni (p1) bids "I will play"
    await page.getByRole("button", { name: de.willPlay, exact: true }).click();

    // Since Toni is the only one who bid "will", they enter declare phase.
    // Toni declares Sauspiel in the callable suit.
    const bid = round.bids.find((b: any) => b.seat === "p1" && b.kind === "declare")!;
    await performBids(page, [bid]);

    // Game should proceed to PLAYING immediately
    await expect(page.locator(".game-screen")).toBeVisible();
    await expect(page.locator(".trick-area")).toBeVisible();
  });
});
