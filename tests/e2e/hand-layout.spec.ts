import { Page } from "@playwright/test";
import { handCards, startSolo } from "./helpers/fixtures";
import { expect, test } from "./helpers/test";

interface Box {
  left: number;
  right: number;
}

/** Horizontal extents of the own-seat column, the fanned hand and every card. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right };
    };
    const cards = [...document.querySelectorAll(".player-hand-cards .playing-card")];
    return {
      me: box(document.querySelector(".player-hand-me")),
      right: box(document.querySelector(".player-hand-col-right")),
      first: box(cards[0]),
      last: box(cards[cards.length - 1]),
      widths: cards.map((card) => {
        const face = card.querySelector(".card-face")!.getBoundingClientRect().width;
        return { button: card.getBoundingClientRect().width, face };
      }),
    };
  });
}

// Landscape phones: iPhone SE, 12/13/14, 15/16 and Pro Max sizes.
for (const viewport of [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 932, height: 430 },
]) {
  test(`the hand never covers the own seat or the last-trick column at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await startSolo(page, { seed: 42, name: "Toni", rounds: 4 });
    await expect(handCards(page)).toHaveCount(8);

    const m = await measure(page);
    // Each card button is exactly as wide as the face it shows, so the
    // negative margins overlap the cards instead of leaving gaps.
    for (const { button, face } of m.widths) expect(Math.abs(button - face)).toBeLessThan(1);
    // The fanned hand stays between the profile column and the right column.
    expect(m.first!.left).toBeGreaterThanOrEqual(m.me!.right);
    expect(m.last!.right).toBeLessThanOrEqual(m.right!.left);
  });
}
