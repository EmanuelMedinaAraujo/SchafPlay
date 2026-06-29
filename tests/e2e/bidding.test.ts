import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, getFreePort, TestServer } from "./helpers/serverRunner";
import { ClientSimulator } from "./helpers/clientSimulator";
import { GameType, Suit } from "../../src/types";

describe("E2E - Bidding Phase (Tier 1 & Tier 2)", () => {
  let server: TestServer;
  let port: number;

  beforeAll(async () => {
    port = await getFreePort();
    server = await startTestServer(port);
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  // Helper to set up a 4-player game in BIDDING phase
  async function setupBiddingGame(): Promise<ClientSimulator[]> {
    const players = [
      new ClientSimulator("Alice"),
      new ClientSimulator("Bob"),
      new ClientSimulator("Charlie"),
      new ClientSimulator("Dave"),
    ];

    await Promise.all(players.map((p) => p.connect(port)));

    players[0].createLobby(4);
    const lobbyMsg = await players[0].waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    for (let i = 1; i < 4; i++) {
      players[i].joinLobby(code);
    }

    await Promise.all(players.map((p) => p.waitForMessage("GAME_START")));
    return players;
  }

  // --- TIER 1: Feature Coverage ---

  it("B1: should transition to BIDDING and deal 8 cards to each player", async () => {
    const players = await setupBiddingGame();

    for (const p of players) {
      expect(p.gameState).toBeDefined();
      expect(p.gameState!.status).toBe("BIDDING");
      expect(p.hand).toHaveLength(8);
    }

    players.forEach((p) => p.disconnect());
  });

  it("B2: should allow players to pass in clockwise order", async () => {
    const players = await setupBiddingGame();
    const firstState = players[0].gameState!;
    let activeIdx = firstState.activePlayerIdx;

    // Have all players pass in order
    for (let i = 0; i < 4; i++) {
      const activePlayer = players[activeIdx];
      activePlayer.declareBid(null); // Pass

      // Wait for game state update on all clients
      await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

      const updatedState = players[0].gameState!;
      if (i < 3) {
        // Next player should be active
        activeIdx = (activeIdx + 1) % 4;
        expect(updatedState.activePlayerIdx).toBe(activeIdx);
      }
    }

    // If all pass, game should either go to RAMSCH, REDEAL or PASSED
    const finalState = players[0].gameState!;
    expect(["PLAYING", "DEALING", "BIDDING", "ROUND_OVER"]).toContain(finalState.status);

    players.forEach((p) => p.disconnect());
  });

  it("B3: should establish a SAUSPIEL contract when a player bids and others pass", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;

    // Player 1 (active) declares Sauspiel calling BELLS (or whatever suit they can call)
    // To make sure it is valid, let's find a suit in their hand that they don't have the Ace of,
    // or just declare Sauspiel calling BELLS (as E2E clients, we assume the server accepts it or we can inspect hand)
    const bidder = players[activeIdx];
    
    // Find a callable suit in bidder's hand
    // Sauspiel called suit must be ACORNS, LEAVES, or BELLS.
    // Must have a card of that suit but NOT the Ace of that suit.
    let calledSuit = Suit.BELLS;
    const hand = bidder.hand;
    const suitsToCheck = [Suit.ACORNS, Suit.LEAVES, Suit.BELLS];
    for (const s of suitsToCheck) {
      const hasSuit = hand.some((c) => c.suit === s);
      const hasAce = hand.some((c) => c.suit === s && c.value === "A");
      if (hasSuit && !hasAce) {
        calledSuit = s;
        break;
      }
    }

    bidder.declareBid({ type: GameType.SAUSPIEL, calledSuit });

    // The other 3 players pass in turn
    for (let i = 1; i < 4; i++) {
      await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
      activeIdx = players[0].gameState!.activePlayerIdx;
      players[activeIdx].declareBid(null);
    }

    // After all have declared, the game should transition to PLAYING with the contract set
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    const finalState = players[0].gameState!;
    expect(finalState.status).toBe("PLAYING");
    expect(finalState.currentContract).toBeDefined();
    expect(finalState.currentContract!.type).toBe(GameType.SAUSPIEL);
    expect(finalState.currentContract!.declarerId).toBe(bidder.playerId);
    expect(finalState.currentContract!.calledSuit).toBe(calledSuit);

    players.forEach((p) => p.disconnect());
  });

  it("B4: should establish a SOLO contract immediately if no one overbids", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;

    // Active player bids SOLO_HEARTS
    const bidder = players[activeIdx];
    bidder.declareBid({ type: GameType.SOLO_HEARTS });

    // Others pass
    for (let i = 1; i < 4; i++) {
      await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
      activeIdx = players[0].gameState!.activePlayerIdx;
      players[activeIdx].declareBid(null);
    }

    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    const finalState = players[0].gameState!;
    expect(finalState.status).toBe("PLAYING");
    expect(finalState.currentContract!.type).toBe(GameType.SOLO_HEARTS);
    expect(finalState.currentContract!.declarerId).toBe(bidder.playerId);

    players.forEach((p) => p.disconnect());
  });

  it("B5: should resolve bidding priority (Solo beats Sauspiel)", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    const active1 = state.activePlayerIdx;
    const active2 = (active1 + 1) % 4;

    // Player 1 bids Sauspiel
    players[active1].declareBid({ type: GameType.SAUSPIEL, calledSuit: Suit.BELLS });
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // Player 2 overbids with SOLO_HEARTS
    players[active2].declareBid({ type: GameType.SOLO_HEARTS });
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // Player 3 and 4 pass
    let active3 = (active2 + 1) % 4;
    players[active3].declareBid(null);
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    let active4 = (active3 + 1) % 4;
    players[active4].declareBid(null);
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // Player 1 gets a chance to match/raise or pass. Player 1 passes.
    players[active1].declareBid(null);
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // Solo should win
    const finalState = players[0].gameState!;
    expect(finalState.status).toBe("PLAYING");
    expect(finalState.currentContract!.type).toBe(GameType.SOLO_HEARTS);
    expect(finalState.currentContract!.declarerId).toBe(players[active2].playerId);

    players.forEach((p) => p.disconnect());
  });

  // --- TIER 2: Boundary & Corner Cases ---

  it("B-B1: should reject bidding out of turn with an ERROR", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;
    const inactiveIdx = (activeIdx + 1) % 4;

    // Inactive player tries to bid
    players[inactiveIdx].declareBid({ type: GameType.SAUSPIEL, calledSuit: Suit.BELLS });
    const errorMsg = await players[inactiveIdx].waitForMessage("ERROR");

    expect(errorMsg.message).toBeDefined();
    expect(errorMsg.message.toLowerCase()).toContain("turn");

    players.forEach((p) => p.disconnect());
  });

  it("B-B2: should reject bidding when not in BIDDING state", async () => {
    const p1 = new ClientSimulator("Alice");
    await p1.connect(port);

    p1.createLobby(4);
    await p1.waitForMessage("LOBBY_UPDATED");

    // In LOBBY state, try to bid
    p1.declareBid({ type: GameType.SOLO_HEARTS });
    const errorMsg = await p1.waitForMessage("ERROR");

    expect(errorMsg.message).toBeDefined();
    expect(errorMsg.message.toLowerCase()).toContain("state");

    p1.disconnect();
  });

  it("B-B3: should reject invalid Sauspiel called suit (e.g. HEARTS)", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;

    // HEARTS is the trump suit, cannot be called for Sauspiel
    players[activeIdx].declareBid({ type: GameType.SAUSPIEL, calledSuit: Suit.HEARTS });
    const errorMsg = await players[activeIdx].waitForMessage("ERROR");

    expect(errorMsg.message).toBeDefined();

    players.forEach((p) => p.disconnect());
  });

  it("B-B4: should reject calling a suit of which the player holds the Ace", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;
    const bidder = players[activeIdx];

    // Find a suit of which the player holds the Ace
    const aceCard = bidder.hand.find((c) => c.value === "A" && c.suit !== Suit.HEARTS);
    if (aceCard) {
      bidder.declareBid({ type: GameType.SAUSPIEL, calledSuit: aceCard.suit });
      const errorMsg = await bidder.waitForMessage("ERROR");
      expect(errorMsg.message).toBeDefined();
    }

    players.forEach((p) => p.disconnect());
  });

  it("B-B5: should reject invalid bid payload structure", async () => {
    const players = await setupBiddingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;

    // Send an invalid bid type
    players[activeIdx].send({ type: "DECLARE_BID", bid: { type: "SUPER_SOLO" } });
    const errorMsg = await players[activeIdx].waitForMessage("ERROR");
    expect(errorMsg.message).toBeDefined();

    players.forEach((p) => p.disconnect());
  });
});
