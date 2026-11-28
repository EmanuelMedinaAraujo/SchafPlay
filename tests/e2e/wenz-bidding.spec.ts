import { expect, test } from "@playwright/test";
import { GameEngine } from "../../src/engine/GameEngine";
import { cardFromId } from "../../src/game/deck";
import { getLegalCards } from "../../src/game/rules";
import { GameType, Player, PlayerActionType, Suit } from "../../src/game/types";
import { getAIBid, getAIWillBid } from "../../src/players/aiHeuristics";

const wenz = { type: GameType.WENZ };
const wenzTout = { type: GameType.WENZ, isTout: true };
const sauspiel = { type: GameType.SAUSPIEL, calledSuit: Suit.LEAVES };
const solo = { type: GameType.SOLO_ACORNS };
const fourUnters = ["ACORNS-U", "LEAVES-U", "HEARTS-U", "BELLS-U"];
const earlierWill = [{ playerId: "p1", wantsToPlay: true }];

function seat(...ids: string[]): Player {
  return {
    id: "p2",
    name: "AI",
    isHuman: false,
    cards: ids.map((id) => cardFromId(id)!),
    pointsCollected: 0,
    seatIndex: 1,
  };
}

test("four Unters and an Ace guarantee a Wenz from either lead position", () => {
  const player = seat(...fourUnters, "ACORNS-A", "LEAVES-7", "LEAVES-8", "BELLS-7");
  for (const leads of [true, false]) {
    expect(getAIWillBid(player, [], leads)).toBe(true);
    expect(getAIWillBid(player, earlierWill, leads)).toBe(true);
    expect(getAIBid(player, null, true, leads)).toEqual(wenz);
    expect(getAIBid(player, sauspiel, false, leads)).toEqual(wenz);
  }
});

test("a guaranteed Wenz takes priority over an available Sauspiel", () => {
  const player = seat(...fourUnters, "ACORNS-A", "LEAVES-7", "HEARTS-7", "BELLS-7");
  expect(getAIBid(player)).toEqual(wenz);
});

test("a missing high card blocks lower cards in that plain suit", () => {
  const player = seat(...fourUnters, "ACORNS-10", "ACORNS-K", "ACORNS-8", "ACORNS-7");
  expect(getAIWillBid(player, [], true)).toBe(false);
  expect(getAIBid(player, null, true, true)).toBeNull();
  expect(getAIBid(player, sauspiel, false, true)).toEqual(wenz);
});

test("top trumps can draw opposing trumps before cashing plain winners", () => {
  const player = seat(
    "ACORNS-U", "LEAVES-U", "ACORNS-A", "ACORNS-10", "ACORNS-K", "ACORNS-7", "LEAVES-7", "BELLS-7",
  );
  expect(getAIWillBid(player, [], true)).toBe(true);
  expect(getAIBid(player, null, true, true)).toEqual(wenz);
  expect(getAIWillBid(player, [])).toBe(false);
  expect(getAIBid(player)).toBeNull();

  const weakerTrumps = seat(
    "HEARTS-U", "BELLS-U", "ACORNS-A", "ACORNS-10", "LEAVES-A", "LEAVES-10", "LEAVES-7", "BELLS-7",
  );
  expect(getAIBid(weakerTrumps, null, true, true)).toBeNull();
});

test("all four Aces cover every suit in two-trump Wenz hands", () => {
  const aces = ["ACORNS-A", "LEAVES-A", "HEARTS-A", "BELLS-A"];
  const topTwo = seat("ACORNS-U", "LEAVES-U", ...aces, "ACORNS-10", "ACORNS-7");
  expect(getAIBid(topTwo)).toEqual(wenz);
  expect(getAIBid(seat("ACORNS-U", "LEAVES-U", ...aces, "ACORNS-9", "ACORNS-7"))).toBeNull();

  const splitRanks = seat("ACORNS-U", "BELLS-U", ...aces, "ACORNS-9", "ACORNS-7");
  expect(getAIBid(splitRanks, null, true, true)).toEqual(wenz);
  expect(getAIBid(splitRanks)).toBeNull();
});

test("three Unters account for one trick lost to the opposing trump", () => {
  const twoPlainMasters = ["ACORNS-A", "ACORNS-10", "ACORNS-7", "LEAVES-7", "BELLS-7"];
  const withTop = seat("ACORNS-U", "LEAVES-U", "HEARTS-U", ...twoPlainMasters);
  expect(getAIBid(withTop, null, true, true)).toEqual(wenz);
  expect(getAIBid(withTop)).toBeNull();

  const withoutTop = seat("LEAVES-U", "HEARTS-U", "BELLS-U", ...twoPlainMasters);
  expect(getAIBid(withoutTop, null, true, true)).toBeNull();
  const threePlainMasters = seat(
    "LEAVES-U", "HEARTS-U", "BELLS-U", "ACORNS-A", "ACORNS-10", "ACORNS-K", "LEAVES-7", "BELLS-7",
  );
  expect(getAIBid(threePlainMasters)).toEqual(wenz);
});

test("only a guaranteed sweep raises Wenz to Tout, and stronger bids still stand", () => {
  const sixTricks = seat(...fourUnters, "ACORNS-A", "LEAVES-A", "LEAVES-7", "BELLS-7");
  expect(getAIBid(sixTricks)).toEqual(wenz);
  expect(getAIBid(sixTricks, wenz)).toBeNull();
  expect(getAIBid(sixTricks, solo)).toBeNull();

  const sweep = seat(...fourUnters, "ACORNS-A", "ACORNS-10", "ACORNS-K", "ACORNS-O");
  expect(getAIBid(sweep)).toEqual(wenz);
  expect(getAIBid(sweep, wenz)).toEqual(wenzTout);
  expect(getAIBid(sweep, solo)).toEqual(wenzTout);
  expect(getAIBid(sweep, wenzTout)).toBeNull();
  expect(getAIBid(sweep, { ...solo, isTout: true })).toBeNull();
});

test("the engine's opening AI bids Wenz and cashes its five winners", () => {
  const { cards } = seat(
    "ACORNS-U", "LEAVES-U", "ACORNS-A", "ACORNS-10", "ACORNS-K", "ACORNS-7", "LEAVES-7", "BELLS-7",
  );
  const engine = new GameEngine("Host", 1, {
    aiDelayMs: 0,
    trickHoldMs: 0,
    enableRamsch: true,
    shuffleFn: (deck) => {
      const rest = deck.filter((card) => !cards.some(({ id }) => id === card.id));
      return [...rest.slice(0, 8), ...cards, ...rest.slice(8)];
    },
  });
  try {
    engine.dealCards();
    expect(engine.getState().biddingState?.willBids[0]).toEqual({ playerId: "p2", wantsToPlay: true });
    for (const id of ["p3", "p1"]) {
      engine.processAction({ type: PlayerActionType.BID_WILL, playerId: id, data: { wantsToPlay: false } });
    }
    expect(engine.getState().currentContract).toEqual({ ...wenz, declarerId: "p2" });

    for (let turn = 0; turn < 16; turn += 1) {
      const state = engine.getState();
      if (state.status === "ROUND_OVER") break;
      const player = state.players[state.activePlayerIdx];
      const [card] = getLegalCards(player.cards, state.currentTrick, state.currentContract, state.tricks);
      engine.processAction({ type: PlayerActionType.PLAY_CARD, playerId: player.id, data: { cardId: card.id } });
    }

    const { tricks } = engine.getState();
    expect(tricks).toHaveLength(8);
    expect(tricks.slice(0, 5).map((trick) => trick.winnerId)).toEqual(Array(5).fill("p2"));
    expect(tricks.slice(0, 5).map((trick) => trick.playedCards[0].card.id)).toEqual([
      "ACORNS-U", "LEAVES-U", "ACORNS-A", "ACORNS-10", "ACORNS-K",
    ]);
  } finally {
    engine.destroy();
  }
});
