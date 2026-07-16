import { Page } from "@playwright/test";
import { expect } from "./test";
import { de, handCard } from "./fixtures";
import { gameLabel } from "../../../src/lib/i18n";
import { HumanBid } from "./simulate";

/** Click a specific hand card through its real pointer handlers (PlayerHand
 * plays on pointerup, not the keyboard-only onClick path). */
export async function clickHandCard(page: Page, cardId: string): Promise<void> {
  const card = handCard(page, cardId);
  await expect(card).toBeVisible();
  await card.click();
}

/** Wait until the local hand is unlocked (this seat's turn to play). */
export async function waitMyTurn(page: Page): Promise<void> {
  await expect(page.locator(".player-hand-container.my-turn")).toBeVisible();
}

/** Play one card once it is this seat's turn, then wait for it to leave the hand. */
export async function playCardInTurn(page: Page, cardId: string): Promise<void> {
  await waitMyTurn(page);
  await clickHandCard(page, cardId);
  await expect(handCard(page, cardId)).toHaveCount(0);
}

/**
 * Replay a seat's recorded bidding decisions through the BiddingPanel. Each
 * click auto-waits for the control to appear, so the AI seats' turns (fast
 * pacing) resolve in between without an explicit sleep.
 */
export async function performBids(page: Page, bids: HumanBid[]): Promise<void> {
  for (const bid of bids) {
    if (bid.kind === "will") {
      await page.getByRole("button", { name: bid.will ? de.willPlay : de.pass, exact: true }).click();
    } else if (!bid.declaration) {
      await page.getByRole("button", { name: de.retreat, exact: true }).click();
    } else {
      const label = gameLabel("de", bid.declaration.type, bid.declaration.calledSuit, bid.declaration.isTout);
      await page.getByRole("button", { name: label, exact: true }).click();
    }
  }
}
