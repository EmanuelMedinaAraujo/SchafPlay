import { createDeck } from "../../src/game/deck";
import { seededShuffle } from "../../src/lib/seededShuffle";
import { de, handCards, pairHostGuest, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

test.describe("smoke", () => {
  test("solo game boots with a deterministic seeded deal", async ({ page }) => {
    const seed = 1;
    await startSolo(page, { seed, name: "Toni" });

    // The UI hand must be exactly the seat-p1 slice of the seeded deal —
    // this pins the contract between src/lib/seededShuffle.ts in the app
    // and the same module imported by the Node-side test helpers.
    const expected = seededShuffle(seed)(createDeck())
      .slice(0, 8)
      .map((card) => card.id)
      .sort();
    await expect(handCards(page)).toHaveCount(8);
    const shown = await handCards(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));
    expect(shown.slice().sort()).toEqual(expected);

    // Round 1 of the default 8 and the bidding panel are up.
    await expect(page.locator(".game-toolbar")).toContainText("1/8");
    await expect(page.locator(".bidding-panel")).toContainText(de.willPhaseTitle);
  });

  test("host and guest pair over WebRTC and land at the same table", async ({ browser }) => {
    const { host, guest } = await pairHostGuest(browser, { seed: 2, hostName: "Anna", guestName: "Vroni" });

    // Host is seat p1, guest seat p3 — each sees the other across the table.
    await expect(host.locator(".seat-top")).toContainText("Vroni");
    await expect(guest.locator(".seat-top")).toContainText("Anna");
    await expect(host.locator(".player-hand-name")).toHaveText("Anna");
    await expect(guest.locator(".player-hand-name")).toHaveText("Vroni");
  });
});
