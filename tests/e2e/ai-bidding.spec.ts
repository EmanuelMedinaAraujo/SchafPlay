import { GameType, CardValue } from "../../src/game/types";
import { isTrump } from "../../src/game/rules";
import { de, startSolo } from "./helpers/fixtures";
import { findSeed } from "./helpers/simulate";
import { performBids } from "./helpers/ui";
import { expect, test } from "./helpers/test";

test.describe("AI bidding behavior", () => {
  test("AI does not bid Sauspiel if another player already bid wantsToPlay", async ({ page }) => {
    // Find a seed where:
    // - p1 (declarer) declares Sauspiel.
    // - p2 (AI) has a good Sauspiel hand, but not Wenz/Solo.
    // Under new rules, p2 will pass in WILL phase, so p1 becomes the sole bidder.
    const { seed, trace } = findSeed(
      (tr) => {
        const r = tr[0];
        if (!r.contract || r.contract.type !== GameType.SAUSPIEL || r.contract.declarerId !== "p1") return false;

        const handP2 = r.hands.p2;
        const untersP2 = handP2.filter((card) => card.value === CardValue.UNTER);
        const obersP2 = handP2.filter((card) => card.value === CardValue.OBER);
        const acesP2 = handP2.filter((card) => card.value === CardValue.ACE);
        const trumpsInNormalP2 = handP2.filter((card) => isTrump(card, GameType.SAUSPIEL));

        const goodSauspielHandP2 = (trumpsInNormalP2.length >= 4 && obersP2.length >= 1) || trumpsInNormalP2.length >= 5;
        if (!goodSauspielHandP2) return false;

        const wenzWorthyP2 = (untersP2.length >= 3 && acesP2.length >= 1) || (untersP2.length >= 2 && acesP2.length >= 2);
        const soloWorthyP2 = obersP2.length >= 3 && trumpsInNormalP2.length >= 7;
        if (wenzWorthyP2 || soloWorthyP2) return false;

        return true;
      },
      { limit: 400, totalRounds: 8 }
    );

    const round = trace[0];

    await startSolo(page, { seed, name: "Toni", rounds: 8 });

    // Toni (p1) bids "I will play"
    await page.getByRole("button", { name: de.willPlay, exact: true }).click();

    // Since Toni is the only one who bid "will", they enter declare phase.
    // Toni declares Sauspiel in the callable suit.
    const bid = round.bids.find((b) => b.seat === "p1" && b.kind === "declare")!;
    await performBids(page, [bid]);

    // Game should proceed to PLAYING immediately
    await expect(page.locator(".game-screen")).toBeVisible();
    await expect(page.locator(".trick-area")).toBeVisible();
  });
});
