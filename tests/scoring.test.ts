import { describe, expect, it } from "vitest";
import { calculateRoundResult, countLaufende, createDeck } from "../src/utils/gameLogic";
import { Card, Contract, GameType, Player, SeatId, Suit, Trick } from "../src/types";

const DECK = createDeck();

function card(id: string): Card {
  const found = DECK.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown card id: ${id}`);
  return found;
}

function cards(...ids: string[]): Card[] {
  return ids.map(card);
}

function makePlayers(points: Record<SeatId, number>): Player[] {
  return (Object.keys(points) as SeatId[]).map((id, index) => ({
    id,
    name: id,
    isHuman: id === "p1" || id === "p3",
    cards: [],
    pointsCollected: points[id],
    seatIndex: index,
  }));
}

/** 8 tricks with the given winner ids. */
function makeTricks(winners: string[]): Trick[] {
  return winners.map((winnerId, index) => ({
    id: index + 1,
    leaderId: winnerId,
    playedCards: [],
    winnerId,
  }));
}

// Holding only the 3rd Ober breaks the run at "ohne 2" — below the minimum,
// so no Laufende are scored. (A hand missing all top trumps would be "ohne 8"!)
const NO_LAUFENDE_HANDS: Record<string, Card[]> = {
  p1: cards("HEARTS-O"),
  p2: cards("LEAVES-7"),
  p3: cards("HEARTS-7"),
  p4: cards("BELLS-7"),
};

const mixedWinners = ["p1", "p2", "p3", "p4", "p1", "p2", "p3", "p4"];

describe("tournament scoring — Rufspiel", () => {
  const contract: Contract = { type: GameType.SAUSPIEL, calledSuit: Suit.ACORNS, declarerId: "p1", partnerId: "p2" };

  it("base win at 61 points: +1 per winner, -1 per loser", () => {
    const players = makePlayers({ p1: 31, p2: 30, p3: 30, p4: 29 });
    const result = calculateRoundResult(players, contract, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.declarerWon).toBe(true);
    expect(result.isSchneider).toBe(false);
    expect(result.scoreChanges).toEqual({ p1: 1, p2: 1, p3: -1, p4: -1 });
  });

  it("loss at exactly 60 points", () => {
    const players = makePlayers({ p1: 30, p2: 30, p3: 30, p4: 30 });
    const result = calculateRoundResult(players, contract, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.declarerWon).toBe(false);
    expect(result.scoreChanges).toEqual({ p1: -1, p2: -1, p3: 1, p4: 1 });
  });

  it("Schneider boundaries: defenders at 30 escape, declarers at 30 do not", () => {
    // Declarers win 90:30 — defenders exactly 30 = out of Schneider.
    let players = makePlayers({ p1: 45, p2: 45, p3: 15, p4: 15 });
    let result = calculateRoundResult(players, contract, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.isSchneider).toBe(false);

    // Declarers win 91:29 — defenders are Schneider.
    players = makePlayers({ p1: 46, p2: 45, p3: 15, p4: 14 });
    result = calculateRoundResult(players, contract, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.isSchneider).toBe(true);
    expect(result.scoreChanges).toEqual({ p1: 2, p2: 2, p3: -2, p4: -2 });

    // Declarers lose with exactly 30 — they are Schneider (need 31).
    players = makePlayers({ p1: 15, p2: 15, p3: 45, p4: 45 });
    result = calculateRoundResult(players, contract, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.isSchneider).toBe(true);
    expect(result.scoreChanges).toEqual({ p1: -2, p2: -2, p3: 2, p4: 2 });
  });

  it("Schwarz requires taking every trick, not just every point", () => {
    const players = makePlayers({ p1: 60, p2: 60, p3: 0, p4: 0 });
    // Defenders took one (pointless) trick — not schwarz, but schneider.
    let result = calculateRoundResult(players, contract, makeTricks(["p1", "p2", "p1", "p3", "p1", "p2", "p1", "p2"]), NO_LAUFENDE_HANDS);
    expect(result.isSchwarz).toBe(false);
    expect(result.scoreChanges.p1).toBe(2);

    result = calculateRoundResult(players, contract, makeTricks(["p1", "p2", "p1", "p2", "p1", "p2", "p1", "p2"]), NO_LAUFENDE_HANDS);
    expect(result.isSchwarz).toBe(true);
    expect(result.scoreChanges).toEqual({ p1: 3, p2: 3, p3: -3, p4: -3 });
  });

  it("adds 1 per Laufendem for each player", () => {
    const hands = {
      ...NO_LAUFENDE_HANDS,
      p1: cards("ACORNS-O", "LEAVES-O"),
      p2: cards("HEARTS-O"), // team holds top 3 Obers => mit 3
    };
    const players = makePlayers({ p1: 40, p2: 40, p3: 20, p4: 20 });
    const result = calculateRoundResult(players, contract, makeTricks(mixedWinners), hands);
    expect(result.laufende).toBe(3);
    // base 1 + 3 laufende = 4 per player
    expect(result.scoreChanges).toEqual({ p1: 4, p2: 4, p3: -4, p4: -4 });
  });
});

describe("tournament scoring — Solo & Wenz", () => {
  const solo: Contract = { type: GameType.SOLO_HEARTS, declarerId: "p1" };

  it("base win: soloist +6, each defender -2 (zero-sum)", () => {
    const players = makePlayers({ p1: 61, p2: 20, p3: 20, p4: 19 });
    const result = calculateRoundResult(players, solo, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.scoreChanges).toEqual({ p1: 6, p2: -2, p3: -2, p4: -2 });
  });

  it("Schneider win: soloist +9, defenders -3", () => {
    const players = makePlayers({ p1: 91, p2: 10, p3: 10, p4: 9 });
    const result = calculateRoundResult(players, solo, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.scoreChanges).toEqual({ p1: 9, p2: -3, p3: -3, p4: -3 });
  });

  it("Schwarz win: soloist +12, defenders -4", () => {
    const players = makePlayers({ p1: 120, p2: 0, p3: 0, p4: 0 });
    const result = calculateRoundResult(players, solo, makeTricks(Array(8).fill("p1")), NO_LAUFENDE_HANDS);
    expect(result.scoreChanges).toEqual({ p1: 12, p2: -4, p3: -4, p4: -4 });
  });

  it("lost solo: soloist pays 3x", () => {
    const players = makePlayers({ p1: 60, p2: 20, p3: 20, p4: 20 });
    const result = calculateRoundResult(players, solo, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
    expect(result.scoreChanges).toEqual({ p1: -6, p2: 2, p3: 2, p4: 2 });
  });

  it("Tout won (all tricks): +18/-6; Tout lost: -18/+6", () => {
    const tout: Contract = { ...solo, isTout: true };
    let players = makePlayers({ p1: 120, p2: 0, p3: 0, p4: 0 });
    let result = calculateRoundResult(players, tout, makeTricks(Array(8).fill("p1")), NO_LAUFENDE_HANDS);
    expect(result.scoreChanges).toEqual({ p1: 18, p2: -6, p3: -6, p4: -6 });

    // One defender trick loses the Tout even with 120-ish dominance.
    players = makePlayers({ p1: 110, p2: 10, p3: 0, p4: 0 });
    result = calculateRoundResult(players, tout, makeTricks(["p2", ...Array(7).fill("p1")]), NO_LAUFENDE_HANDS);
    expect(result.declarerWon).toBe(false);
    expect(result.scoreChanges).toEqual({ p1: -18, p2: 6, p3: 6, p4: 6 });
  });

  it("Wenz counts Laufende from 2: soloist gets 3 per Laufendem", () => {
    const wenz: Contract = { type: GameType.WENZ, declarerId: "p1" };
    const hands = { ...NO_LAUFENDE_HANDS, p1: cards("ACORNS-U", "LEAVES-U") };
    const players = makePlayers({ p1: 61, p2: 20, p3: 20, p4: 19 });
    const result = calculateRoundResult(players, wenz, makeTricks(mixedWinners), hands);
    expect(result.laufende).toBe(2);
    // (base 2 + 2 laufende) = 4 per defender, soloist 12
    expect(result.scoreChanges).toEqual({ p1: 12, p2: -4, p3: -4, p4: -4 });
  });

  it("Sie: soloist dealt all 8 top trumps scores 24/8", () => {
    const hands = {
      ...NO_LAUFENDE_HANDS,
      p1: cards("ACORNS-O", "LEAVES-O", "HEARTS-O", "BELLS-O", "ACORNS-U", "LEAVES-U", "HEARTS-U", "BELLS-U"),
    };
    const players = makePlayers({ p1: 120, p2: 0, p3: 0, p4: 0 });
    const result = calculateRoundResult(players, { ...solo, isTout: true }, makeTricks(Array(8).fill("p1")), hands);
    expect(result.scoreChanges).toEqual({ p1: 24, p2: -8, p3: -8, p4: -8 });
  });

  it("every result is zero-sum", () => {
    const players = makePlayers({ p1: 61, p2: 20, p3: 20, p4: 19 });
    for (const contract of [
      solo,
      { ...solo, isTout: true },
      { type: GameType.WENZ, declarerId: "p1" } as Contract,
      { type: GameType.SAUSPIEL, calledSuit: Suit.BELLS, declarerId: "p1", partnerId: "p3" } as Contract,
    ]) {
      const result = calculateRoundResult(players, contract, makeTricks(mixedWinners), NO_LAUFENDE_HANDS);
      const sum = Object.values(result.scoreChanges).reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    }
  });
});

describe("countLaufende", () => {
  it("counts 'mit' runs from the Eichel-Ober down", () => {
    expect(countLaufende(cards("ACORNS-O", "LEAVES-O", "HEARTS-O"), GameType.SOLO_HEARTS)).toBe(3);
    expect(countLaufende(cards("ACORNS-O", "LEAVES-O", "HEARTS-O", "BELLS-O", "ACORNS-U"), GameType.SOLO_HEARTS)).toBe(5);
  });

  it("counts 'ohne' runs when the top trump is missing", () => {
    // Missing top 3 Obers, holding the 4th => ohne 3.
    expect(countLaufende(cards("BELLS-O", "ACORNS-U"), GameType.SAUSPIEL)).toBe(3);
  });

  it("returns 0 below the minimum (3, Wenz 2)", () => {
    expect(countLaufende(cards("ACORNS-O", "LEAVES-O"), GameType.SAUSPIEL)).toBe(0);
    expect(countLaufende(cards("ACORNS-U"), GameType.WENZ)).toBe(0);
    expect(countLaufende(cards("ACORNS-U", "LEAVES-U"), GameType.WENZ)).toBe(2);
  });

  it("caps at 8 (Wenz: 4)", () => {
    const allTop = cards("ACORNS-O", "LEAVES-O", "HEARTS-O", "BELLS-O", "ACORNS-U", "LEAVES-U", "HEARTS-U", "BELLS-U", "HEARTS-A");
    expect(countLaufende(allTop, GameType.SOLO_HEARTS)).toBe(8);
    expect(countLaufende(cards("ACORNS-U", "LEAVES-U", "HEARTS-U", "BELLS-U"), GameType.WENZ)).toBe(4);
  });
});
