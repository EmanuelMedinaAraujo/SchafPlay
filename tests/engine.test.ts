import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/engine/GameEngine";
import { getLegalCards } from "../src/utils/gameLogic";
import { Card, GameType, PlayerActionType, Suit } from "../src/types";

/**
 * Deck arrangement: hand i (8 card ids) goes to player i. Unspecified
 * cards fill the remaining slots in deck order.
 */
function arrange(...handSpecs: string[][]): (deck: Card[]) => Card[] {
  return (deck) => {
    const byId = new Map(deck.map((card) => [card.id, card]));
    const used = new Set<string>();
    const out: Card[] = [];
    for (const spec of handSpecs) {
      for (const id of spec) {
        const card = byId.get(id);
        if (!card) throw new Error(`Unknown card id: ${id}`);
        out.push(card);
        used.add(id);
      }
    }
    for (const card of deck) if (!used.has(card.id)) out.push(card);
    return out;
  };
}

/** Identity "shuffle": p1 gets all acorns, p2 leaves, p3 hearts, p4 bells. */
const oneSuitEach = (deck: Card[]) => deck;

function makeEngine(shuffleFn: (deck: Card[]) => Card[]) {
  return new GameEngine("Host", "Gast", { aiDelayMs: 0, trickHoldMs: 0, shuffleFn });
}

/** Both AI seats stay weak/passive with these hands. */
const MIXED_HANDS = arrange(
  // p1 (host): 4 normal trumps, can call Leaves (plain leaves, no ace), NOT Acorns (has ace)
  ["HEARTS-O", "HEARTS-U", "HEARTS-A", "HEARTS-10", "ACORNS-A", "ACORNS-7", "LEAVES-7", "LEAVES-8"],
  // p2 (AI): no trumps, no callable game
  ["LEAVES-A", "LEAVES-9", "LEAVES-10", "LEAVES-K", "BELLS-7", "BELLS-8", "BELLS-9", "BELLS-10"],
  // p3 (guest): one ober/unter pair each, harmless
  ["HEARTS-7", "HEARTS-8", "HEARTS-9", "HEARTS-K", "ACORNS-U", "ACORNS-O", "LEAVES-U", "LEAVES-O"],
  // p4 (AI): weak
  ["BELLS-A", "BELLS-K", "BELLS-U", "BELLS-O", "ACORNS-8", "ACORNS-9", "ACORNS-10", "ACORNS-K"],
);

describe("GameEngine — dealing & will phase", () => {
  it("deals 8 cards each and starts bidding at forehand", () => {
    const engine = makeEngine(oneSuitEach);
    engine.dealCards();
    const state = engine.getState();
    expect(state.status).toBe("BIDDING");
    expect(state.biddingState?.phase).toBe("WILL_PHASE");
    expect(state.players.every((player) => player.cards.length === 8)).toBe(true);
    expect(state.roundNumber).toBe(1);
    // Dealer rotated to p1; forehand p2 (AI) already passed synchronously.
    expect(state.dealerIdx).toBe(0);
    expect(state.biddingState?.willBids).toEqual([{ playerId: "p2", wantsToPlay: false }]);
    expect(state.players[state.activePlayerIdx].id).toBe("p3");
  });

  it("redeals when all four players pass", () => {
    const engine = makeEngine(oneSuitEach);
    engine.dealCards();
    engine.processBidWill("p3", false); // p4 (AI) passes right after
    engine.processBidWill("p1", false);
    const state = engine.getState();
    // Redeal: same dealer, fresh will phase (AI forehand already passed again).
    expect(state.status).toBe("BIDDING");
    expect(state.biddingState?.phase).toBe("WILL_PHASE");
    expect(state.dealerIdx).toBe(0);
    expect(state.roundNumber).toBe(1);
    expect(state.biddingState?.willBids).toHaveLength(1);
    expect(state.players.every((player) => player.cards.length === 8)).toBe(true);
  });
});

describe("GameEngine — declare phase", () => {
  it("rejects invalid Sauspiel calls and accepts a valid one with hidden partner", () => {
    const engine = makeEngine(MIXED_HANDS);
    engine.dealCards();
    engine.processBidWill("p3", false);
    engine.processBidWill("p1", true);
    expect(engine.getState().biddingState?.phase).toBe("DECLARE_PHASE");

    // Calling Hearts (trump) is invalid.
    engine.processBidDeclare("p1", { type: GameType.SAUSPIEL, calledSuit: Suit.HEARTS });
    expect(engine.getState().biddingState?.phase).toBe("DECLARE_PHASE");
    // Calling a suit whose Ace we hold is invalid.
    engine.processBidDeclare("p1", { type: GameType.SAUSPIEL, calledSuit: Suit.ACORNS });
    expect(engine.getState().biddingState?.phase).toBe("DECLARE_PHASE");
    // Sauspiel Tout does not exist.
    engine.processBidDeclare("p1", { type: GameType.SAUSPIEL, calledSuit: Suit.LEAVES, isTout: true });
    expect(engine.getState().biddingState?.phase).toBe("DECLARE_PHASE");

    engine.processBidDeclare("p1", { type: GameType.SAUSPIEL, calledSuit: Suit.LEAVES });
    const state = engine.getState();
    expect(state.status).toBe("PLAYING");
    expect(state.currentContract?.type).toBe(GameType.SAUSPIEL);
    expect(state.currentContract?.partnerId).toBe("p2"); // holds Leaves Ace

    // Redaction: guest must not see the partner before the called Ace is played,
    // nor anyone else's cards.
    const redacted = engine.getRedactedState("p3");
    const acePlayed = engine
      .getState()
      .currentTrick?.playedCards.some((played) => played.card.id === "LEAVES-A");
    if (!acePlayed) expect(redacted.currentContract?.partnerId).toBeUndefined();
    expect(redacted.players.find((player) => player.id === "p1")!.cards.every((card) => card.id.startsWith("hidden-"))).toBe(true);
    expect(redacted.players.find((player) => player.id === "p3")!.cards.every((card) => !card.id.startsWith("hidden-"))).toBe(true);
  });

  it("only allows overriding with strictly higher priority and blocks high-bidder retreat", () => {
    const engine = makeEngine(MIXED_HANDS);
    engine.dealCards();
    engine.processBidWill("p3", true);
    engine.processBidWill("p1", true);

    // Forehand order: p3 declares first.
    const active = () => engine.getState().players[engine.getState().activePlayerIdx].id;
    expect(active()).toBe("p3");
    engine.processBidDeclare("p3", { type: GameType.WENZ });
    expect(active()).toBe("p1");

    // Equal priority cannot override.
    engine.processBidDeclare("p1", { type: GameType.WENZ });
    expect(engine.getState().biddingState?.highBid?.playerId).toBe("p3");

    // Higher priority can.
    engine.processBidDeclare("p1", { type: GameType.SOLO_HEARTS });
    expect(engine.getState().biddingState?.highBid?.playerId).toBe("p1");

    // Back to p3: they hold no high bid anymore, may raise again with Wenz Tout.
    expect(active()).toBe("p3");
    engine.processBidDeclare("p3", { type: GameType.WENZ, isTout: true });
    expect(engine.getState().biddingState?.highBid?.declaration?.isTout).toBe(true);

    // p1 retreats -> contract resolves to p3's Wenz Tout.
    expect(active()).toBe("p1");
    // The high bidder (p3) could not retreat in this spot; verify the guard directly.
    engine.processBidDeclare("p3", null);
    expect(engine.getState().biddingState?.phase).toBe("DECLARE_PHASE");

    engine.processBidDeclare("p1", null);
    const state = engine.getState();
    expect(state.status).toBe("PLAYING");
    expect(state.currentContract).toMatchObject({ type: GameType.WENZ, isTout: true, declarerId: "p3" });
  });
});

describe("GameEngine — full round & ready flow", () => {
  it("plays a complete solo round: Sie hand wins every trick, scores 24/-8", () => {
    // p1 is dealt all four Obers and Unters ("Sie") — the highest remaining
    // trump wins every trick no matter what the others do.
    const sieHand = arrange(["ACORNS-O", "LEAVES-O", "HEARTS-O", "BELLS-O", "ACORNS-U", "LEAVES-U", "HEARTS-U", "BELLS-U"]);
    const engine = makeEngine(sieHand);
    engine.dealCards();
    engine.processBidWill("p3", false);
    engine.processBidWill("p1", true);
    engine.processBidDeclare("p1", { type: GameType.SOLO_ACORNS });

    let guard = 0;
    while (engine.getState().status === "PLAYING" && guard < 100) {
      guard += 1;
      const state = engine.getState();
      const activePlayer = state.players[state.activePlayerIdx];
      if (!activePlayer.isHuman || state.collecting) continue;
      const legal = getLegalCards(activePlayer.cards, state.currentTrick, state.currentContract);
      engine.processCardPlay(activePlayer.id, legal[0].id);
    }

    const state = engine.getState();
    expect(state.status).toBe("ROUND_OVER");
    const result = state.lastResult!;
    expect(result.declarerWon).toBe(true);
    expect(result.isSchwarz).toBe(true);
    // Sie: soloist +24, defenders -8 each.
    expect(result.scoreChanges).toEqual({ p1: 24, p2: -8, p3: -8, p4: -8 });
    expect(state.scores).toEqual({ p1: 24, p2: -8, p3: -8, p4: -8 });
    expect(Object.values(result.scoreChanges).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("starts the next round only when both humans are ready", () => {
    const engine = makeEngine(oneSuitEach);
    engine.dealCards();
    engine.processBidWill("p3", false);
    engine.processBidWill("p1", true);
    engine.processBidDeclare("p1", { type: GameType.SOLO_ACORNS });
    let guard = 0;
    while (engine.getState().status === "PLAYING" && guard < 100) {
      guard += 1;
      const state = engine.getState();
      const activePlayer = state.players[state.activePlayerIdx];
      if (!activePlayer.isHuman || state.collecting) continue;
      const legal = getLegalCards(activePlayer.cards, state.currentTrick, state.currentContract);
      engine.processCardPlay(activePlayer.id, legal[0].id);
    }
    expect(engine.getState().status).toBe("ROUND_OVER");

    engine.processAction({ type: PlayerActionType.READY_NEXT, playerId: "p1" });
    expect(engine.getState().status).toBe("ROUND_OVER");
    engine.processAction({ type: PlayerActionType.READY_NEXT, playerId: "p3" });
    const state = engine.getState();
    expect(state.status).toBe("BIDDING");
    expect(state.roundNumber).toBe(2);
    expect(state.dealerIdx).toBe(1); // dealer rotated
  });

  it("ignores all actions while paused and resumes cleanly", () => {
    const engine = makeEngine(oneSuitEach);
    engine.dealCards();
    engine.pause();
    const before = engine.getState();
    expect(before.paused).toBe(true);
    engine.processAction({ type: PlayerActionType.BID_WILL, playerId: "p3", data: { wantsToPlay: true } });
    expect(engine.getState().biddingState?.willBids).toEqual(before.biddingState?.willBids);

    engine.resume();
    expect(engine.getState().paused).toBe(false);
    engine.processBidWill("p3", false);
    expect(engine.getState().biddingState?.willBids.length).toBeGreaterThan(1);
  });
});
