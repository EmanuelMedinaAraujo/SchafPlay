/**
 * Sauspiel "Rufsau" play restrictions (#91), each pinned to a seed whose round
 * 1 produces the situation. The partner *reveal* is partner-badge.spec.ts.
 */
import { Page } from "@playwright/test";
import { Card, GameType, Suit } from "../../src/game/types";
import { getPlaySuit } from "../../src/game/rules";
import { handCard, startSolo } from "./helpers/fixtures";
import { defaultPolicy, findSeed, HumanTurn, Policy, RoundTrace, Trace } from "./helpers/simulate";
import { clickHandCard, performBids, playCardInTurn, waitMyTurn } from "./helpers/ui";
import { expect, test } from "./helpers/test";

/**
 * Takes the *last* legal card, not the first: some situations only survive
 * into a later trick when p1 stops dumping its cheapest card every turn.
 */
const lastLegalPolicy: Policy = { ...defaultPolicy, decideCard: (legal) => legal[legal.length - 1] };

/** One p1 turn taken while the called Ace is still bound, with the facts it turns on. */
interface BoundTurn {
  suit: Suit;
  aceId: string;
  /** Index among p1's card plays this round — how many turns to replay first. */
  turnIdx: number;
  turn: HumanTurn;
  /** Hand cards whose *play* suit is the called suit (so never an Ober/Unter). */
  suitIds: string[];
  /** Those minus the Ace: the cards the lock actually covers. */
  lowIds: string[];
  /** Ober/Unter of the called suit — trump, and none of the lock's business. */
  calledTrumpIds: string[];
  /** Play suit led into this turn, or null when p1 leads it. */
  ledPlaySuit: Suit | "TRUMP" | null;
  /** Derived from the hand, never `legalIds`, so predicates locate the
   *  situation rather than restating whatever the rules did. */
  isVoid: boolean;
}

function dealt(round: RoundTrace, cardId: string): Card {
  for (const hand of Object.values(round.hands)) {
    const card = hand.find((candidate) => candidate.id === cardId);
    if (card) return card;
  }
  throw new Error(`card ${cardId} was not dealt this round`);
}

const playSuitOf = (round: RoundTrace, cardId: string) => getPlaySuit(dealt(round, cardId), GameType.SAUSPIEL);

/**
 * Every round-1 turn where p1 sits on the called Ace and the suit has not been
 * led yet — the window in which all of the restrictions apply.
 */
function boundTurns(trace: Trace): BoundTurn[] {
  const round = trace[0];
  if (!round.contract || round.contract.type !== GameType.SAUSPIEL || round.plays.length < 32) return [];
  const suit = round.contract.calledSuit!;
  const aceId = `${suit}-A`;

  let firstCalledLead = Infinity;
  for (let trick = 0; trick * 4 < round.plays.length; trick += 1) {
    if (playSuitOf(round, round.plays[trick * 4].cardId) === suit) {
      firstCalledLead = trick;
      break;
    }
  }

  const bound: BoundTurn[] = [];
  round.turns
    .filter((turn) => turn.seat === "p1")
    .forEach((turn, turnIdx) => {
      if (!turn.handIds.includes(aceId)) return;
      const trickIdx = 8 - turn.handIds.length;
      // Past the trick that first led the suit the Ace is loose again.
      if (trickIdx > firstCalledLead) return;
      const suitIds = turn.handIds.filter((id) => playSuitOf(round, id) === suit);
      const ledPlaySuit = turn.positionInTrick === 0 ? null : playSuitOf(round, round.plays[trickIdx * 4].cardId);
      bound.push({
        suit,
        aceId,
        turnIdx,
        turn,
        suitIds,
        lowIds: suitIds.filter((id) => id !== aceId),
        calledTrumpIds: turn.handIds.filter(
          (id) => dealt(round, id).suit === suit && playSuitOf(round, id) === "TRUMP",
        ),
        ledPlaySuit,
        isVoid: ledPlaySuit !== null && turn.handIds.every((id) => playSuitOf(round, id) !== ledPlaySuit),
      });
    });
  return bound;
}

/** Seed search + the located turn in one step, so predicate and target cannot drift apart. */
function findBoundTurn(
  pick: (turns: BoundTurn[]) => BoundTurn | undefined,
  options: { limit: number; policy?: Policy },
): { seed: number; round: RoundTrace; bound: BoundTurn } {
  const { seed, trace } = findSeed((trace) => Boolean(pick(boundTurns(trace))), {
    limit: options.limit,
    totalRounds: 4,
    policy: options.policy,
  });
  return { seed, round: trace[0], bound: pick(boundTurns(trace))! };
}

/** Boot the seed, replay p1's bids and every p1 turn before the located one. */
async function playUpTo(page: Page, seed: number, round: RoundTrace, bound: BoundTurn): Promise<void> {
  await startSolo(page, { seed, name: "Toni" });
  await performBids(page, round.bids);
  const p1Turns = round.turns.filter((turn) => turn.seat === "p1");
  for (let i = 0; i < bound.turnIdx; i += 1) await playCardInTurn(page, p1Turns[i].chosenId);
  await waitMyTurn(page);
}

/** Assert a card is refused: it grays out, stays in hand and never reaches the table. */
async function expectRefused(page: Page, cardId: string): Promise<void> {
  await clickHandCard(page, cardId);
  await expect(handCard(page, cardId)).toHaveCount(1);
  await expect(handCard(page, cardId)).toHaveClass(/grayed-out/);
  await expect(page.locator(`.trick-area [data-card-id="${cardId}"]`)).toHaveCount(0);
}

/** Assert a card is accepted: it leaves the hand and lands in the trick. */
async function expectPlayed(page: Page, cardId: string): Promise<void> {
  await expect(handCard(page, cardId)).not.toHaveClass(/grayed-out/);
  await clickHandCard(page, cardId);
  await expect(handCard(page, cardId)).toHaveCount(0);
  await expect(page.locator(`.trick-area [data-card-id="${cardId}"]`)).toBeVisible();
}

test.describe("Sauspiel called-Ace restrictions", () => {
  test("leading: the called Ace is allowed, a lower card of its suit is not", async ({ page }) => {
    // The bug from #91: the whole suit was locked, including the Ace.
    const pick = (turns: BoundTurn[]) =>
      turns.find((t) => t.ledPlaySuit === null && t.suitIds.length < 4 && t.lowIds.length > 0);
    const { seed, round, bound } = findBoundTurn(pick, { limit: 400, policy: lastLegalPolicy });

    await playUpTo(page, seed, round, bound);

    // The lock covers the low cards of the called suit …
    await expectRefused(page, bound.lowIds[0]);
    // … but never the Ace itself, which may be led at any time.
    await expectPlayed(page, bound.aceId);
  });

  test("leading: Ober and Unter of the called suit are trump, not locked suit cards", async ({ page }) => {
    // Same window, but the hand also holds an Ober or Unter of the called
    // suit. Those are trump — the called-suit lock must not reach them.
    const pick = (turns: BoundTurn[]) =>
      turns.find((t) => t.ledPlaySuit === null && t.suitIds.length < 4 && t.calledTrumpIds.length > 0);
    const { seed, round, bound } = findBoundTurn(pick, { limit: 400, policy: lastLegalPolicy });

    await playUpTo(page, seed, round, bound);

    await expectPlayed(page, bound.calledTrumpIds[0]);
  });

  test("Davonlaufen: four cards of the called suit unlock leading a low one", async ({ page }) => {
    const pick = (turns: BoundTurn[]) => turns.find((t) => t.ledPlaySuit === null && t.suitIds.length >= 4);
    const { seed, round, bound } = findBoundTurn(pick, { limit: 600 });

    await playUpTo(page, seed, round, bound);

    // Nothing in the hand is refused — the Ace stays leadable and the low
    // cards of the called suit are free too.
    await expect(handCard(page, bound.aceId)).not.toHaveClass(/grayed-out/);
    await expectPlayed(page, bound.lowIds[0]);
  });

  test("the called Ace must be given once its suit is led", async ({ page }) => {
    // Another seat led the called suit while p1 holds the Ace and a lower card
    // of the suit: only the Ace may be played, four-card hands included.
    const pick = (turns: BoundTurn[]) => turns.find((t) => t.ledPlaySuit === t.suit && t.lowIds.length > 0);
    const { seed, round, bound } = findBoundTurn(pick, { limit: 400 });

    await playUpTo(page, seed, round, bound);

    await expectRefused(page, bound.lowIds[0]);
    await expectPlayed(page, bound.aceId);
  });

  test("the called Ace may not be discarded on a foreign suit, a low card of it may", async ({ page }) => {
    // p1 cannot follow the led suit. Everything is discardable except the Ace.
    const pick = (turns: BoundTurn[]) =>
      turns.find((t) => t.ledPlaySuit !== null && t.ledPlaySuit !== t.suit && t.lowIds.length > 0 && t.isVoid);
    const { seed, round, bound } = findBoundTurn(pick, { limit: 600 });

    await playUpTo(page, seed, round, bound);

    await expectRefused(page, bound.aceId);
    await expectPlayed(page, bound.lowIds[0]);
  });
});
