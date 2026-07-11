import { GameType } from "../../src/game/types";
import { de, handCard, pairHostGuest, startSolo } from "./helpers/fixtures";
import { calledAcePlayIndex, findSeed, simulateMultiplayer } from "./helpers/simulate";
import { clickHandCard, performBids, waitMyTurn } from "./helpers/ui";
import { expect, test } from "./helpers/test";

// Seat class for the partner, from each viewer's own bottom-seat perspective
// (GameBoard.seatAt: offset 1 = left, 2 = top, 3 = right).
const SOLO_SEAT: Record<string, string> = { p2: ".seat-left", p3: ".seat-top", p4: ".seat-right" };
const GUEST_SEAT: Record<string, string> = { p4: ".seat-left", p1: ".seat-top", p2: ".seat-right" };

test.describe("Sauspiel partner reveal", () => {
  test("solo: partner badge stays hidden until the called Ace drops", async ({ page }) => {
    const { seed, trace } = findSeed(
      (tr) => {
        const r = tr[0];
        if (!r.contract || r.contract.type !== GameType.SAUSPIEL) return false;
        if (r.contract.declarerId !== "p1" || !r.contract.partnerId || r.contract.partnerId === "p1") return false;
        const aceIdx = calledAcePlayIndex(r);
        const firstP1 = r.plays.findIndex((p) => p.playerId === "p1");
        return aceIdx >= 5 && firstP1 >= 0 && firstP1 < aceIdx;
      },
      { limit: 400, totalRounds: 8 },
    );

    const round = trace[0];
    const aceIdx = calledAcePlayIndex(round);
    const partnerSeat = SOLO_SEAT[round.contract!.partnerId!];
    const p1BeforeAce = round.plays
      .map((p, i) => ({ ...p, i }))
      .filter((p) => p.playerId === "p1" && p.i < aceIdx)
      .map((p) => p.cardId);

    await startSolo(page, { seed, name: "Toni", rounds: 8 });
    await performBids(page, round.bids);

    const anyPartner = page.locator(".role-badge.partner");
    await expect(anyPartner).toHaveCount(0);

    for (let i = 0; i < p1BeforeAce.length; i += 1) {
      await waitMyTurn(page);
      // Right before the last pre-Ace play the Ace is still down.
      if (i === p1BeforeAce.length - 1) await expect(anyPartner).toHaveCount(0);
      await clickHandCard(page, p1BeforeAce[i]);
      await expect(handCard(page, p1BeforeAce[i])).toHaveCount(0);
    }

    // The AI partner now plays the called Ace; the badge appears on its seat only.
    await expect(page.locator(`${partnerSeat} .role-badge.partner`)).toBeVisible();
    await expect(anyPartner).toHaveCount(1);
  });

  test("multiplayer: the guest sees the partner only after the Ace crosses the wire", async ({ browser }) => {
    // A Sauspiel where the guest (p3) is a defender and the called Ace sits with
    // an AI seat (p2/p4) — the real redaction boundary in src/engine/redaction.ts.
    const { seed, trace } = findSeed(
      (tr) => {
        const r = tr[0];
        if (!r.contract || r.contract.type !== GameType.SAUSPIEL) return false;
        const { declarerId, partnerId } = r.contract;
        if (declarerId === "p3" || partnerId === "p3") return false;
        if (partnerId !== "p2" && partnerId !== "p4") return false;
        return calledAcePlayIndex(r) >= 5;
      },
      { start: 700, limit: 120, totalRounds: 8, simulate: simulateMultiplayer },
    );

    const round = trace[0];
    const partnerSeat = GUEST_SEAT[round.contract!.partnerId!];
    const p1Cards = round.turns.filter((t) => t.seat === "p1").map((t) => t.chosenId);
    const p3Cards = round.turns.filter((t) => t.seat === "p3").map((t) => t.chosenId);

    const { host, guest } = await pairHostGuest(browser, { seed, rounds: 8, hostName: "Anna", guestName: "Vroni" });

    // Bidding decisions were recorded chronologically across both human seats
    // (round 1 forehand is p1, so the host bids first) — replay them in that
    // order, each on its own page.
    for (const bid of round.bids) {
      await performBids(bid.seat === "p1" ? host : guest, [bid]);
    }

    const guestPartner = guest.locator(".role-badge.partner");
    await expect(guestPartner).toHaveCount(0);

    // Drive both defenders/declarer along the trace until the wire delivers the
    // un-redacted partner to the guest (the Ace is played by an AI seat).
    for (let guard = 0; guard < 160; guard += 1) {
      if ((await guest.locator(`${partnerSeat} .role-badge.partner`).count()) > 0) break;
      if (p1Cards.length && (await host.locator(".player-hand-container.my-turn").count())) {
        const id = p1Cards.shift()!;
        await clickHandCard(host, id);
        await expect(handCard(host, id)).toHaveCount(0);
        continue;
      }
      if (p3Cards.length && (await guest.locator(".player-hand-container.my-turn").count())) {
        const id = p3Cards.shift()!;
        await clickHandCard(guest, id);
        await expect(handCard(guest, id)).toHaveCount(0);
        continue;
      }
      // An AI seat is acting or a finished trick is collecting (120ms hold).
      await guest.waitForTimeout(60);
    }

    await expect(guest.locator(`${partnerSeat} .role-badge.partner`)).toBeVisible();
    await expect(guestPartner).toHaveCount(1);
  });
});
