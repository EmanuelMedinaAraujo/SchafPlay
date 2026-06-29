import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, getFreePort, TestServer } from "./helpers/serverRunner";
import { ClientSimulator } from "./helpers/clientSimulator";
import { GameType, Suit, Card } from "../../src/types";
import { getLegalCards, getPlaySuit } from "../../src/utils/gameLogic";

describe("E2E - Gameplay & Security (Tier 1 & Tier 2)", () => {
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

  // Helper to set up a 4-player game in PLAYING phase with a contract
  async function setupPlayingGame(): Promise<{ players: ClientSimulator[]; contractBidder: ClientSimulator }> {
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

    // Bidding phase
    const state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;
    const bidder = players[activeIdx];

    // Find a valid called suit for Sauspiel in bidder's hand
    let calledSuit: Suit | null = null;
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

    if (calledSuit) {
      bidder.declareBid({ type: GameType.SAUSPIEL, calledSuit });
    } else {
      bidder.declareBid({ type: GameType.SOLO_HEARTS });
    }

    for (let i = 1; i < 4; i++) {
      await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
      activeIdx = players[0].gameState!.activePlayerIdx;
      players[activeIdx].declareBid(null);
    }

    // Wait for PLAYING phase transition
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    return { players, contractBidder: bidder };
  }

  // --- TIER 1: Feature Coverage & Security ---

  it("G1: should sanitize game state so players cannot see other players' cards (Security)", async () => {
    const { players } = await setupPlayingGame();

    for (const client of players) {
      const state = client.gameState!;
      expect(state.status).toBe("PLAYING");

      // Verify that for each client, they can see their own cards, but not others
      for (const pState of state.players) {
        if (pState.id === client.playerId) {
          expect(pState.cards).toBeDefined();
          expect(pState.cards.length).toBe(8);
        } else {
          // Other players' cards must be undefined or empty array to prevent cheating
          const otherCards = pState.cards;
          expect(!otherCards || otherCards.length === 0).toBe(true);
        }
      }
    }

    players.forEach((p) => p.disconnect());
  });

  it("G1-Sec: should not leak other players' cards in the raw WebSocket payload", async () => {
    const p1 = new ClientSimulator("Alice");
    const p2 = new ClientSimulator("Bob");
    await Promise.all([p1.connect(port), p2.connect(port)]);

    p1.createLobby(2);
    const lobbyMsg = await p1.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    p2.joinLobby(code);

    const startMsg = await p1.waitForMessage("GAME_START");

    if (startMsg.gameStates) {
      const bobState = startMsg.gameStates[p2.playerId];
      if (bobState) {
        // In Bob's state, Bob's own cards should be visible (8 cards),
        // but other players' cards should be redacted (0 cards).
        for (const p of bobState.players) {
          if (p.id === p2.playerId) {
            expect(p.cards).toHaveLength(8);
          } else {
            expect(p.cards || []).toHaveLength(0);
          }
        }
      }
    }

    p1.disconnect();
    p2.disconnect();
  });

  it("G2: should progress turn when a legal card is played", async () => {
    const { players } = await setupPlayingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;
    const activeClient = players[activeIdx];

    const legalCards = getLegalCards(activeClient.hand, state.currentTrick, state.currentContract);
    const cardToPlay = legalCards[0];

    activeClient.playCard(cardToPlay.id);

    // All clients should receive the updated game state
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    const newState = players[0].gameState!;
    expect(newState.activePlayerIdx).toBe((activeIdx + 1) % 4);
    expect(newState.currentTrick).toBeDefined();
    expect(newState.currentTrick!.playedCards).toHaveLength(1);
    expect(newState.currentTrick!.playedCards[0].card.id).toBe(cardToPlay.id);
    expect(newState.currentTrick!.playedCards[0].playerId).toBe(activeClient.playerId);

    players.forEach((p) => p.disconnect());
  });

  it("G3: should resolve the trick after 4 cards are played", async () => {
    const { players } = await setupPlayingGame();

    for (let i = 0; i < 4; i++) {
      const state = players[0].gameState!;
      const activeIdx = state.activePlayerIdx;
      const activeClient = players[activeIdx];

      const legalCards = getLegalCards(activeClient.hand, state.currentTrick, state.currentContract);
      activeClient.playCard(legalCards[0].id);

      await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
    }

    // After 4th card, the trick should be resolved and cleared
    const stateAfterTrick = players[0].gameState!;
    expect(stateAfterTrick.currentTrick).toBeNull();
    expect(stateAfterTrick.tricks).toHaveLength(1);
    
    // The winner of the trick should be the next active player
    const lastTrick = stateAfterTrick.tricks[0];
    expect(lastTrick.winnerId).toBeDefined();
    expect(stateAfterTrick.activePlayerIdx).toBe(
      stateAfterTrick.players.findIndex((p) => p.id === lastTrick.winnerId)
    );

    players.forEach((p) => p.disconnect());
  });

  // --- TIER 2: Boundary & Corner Cases ---

  it("G-B1: should reject playing out of turn with an ERROR", async () => {
    const { players } = await setupPlayingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;
    const inactiveIdx = (activeIdx + 1) % 4;
    const inactiveClient = players[inactiveIdx];

    const legalCards = getLegalCards(inactiveClient.hand, state.currentTrick, state.currentContract);
    inactiveClient.playCard(legalCards[0].id);

    const errorMsg = await inactiveClient.waitForMessage("ERROR");
    expect(errorMsg.message).toBeDefined();
    expect(errorMsg.message.toLowerCase()).toContain("turn");

    players.forEach((p) => p.disconnect());
  });

  it("G-B2: should reject playing a card not in the player's hand", async () => {
    const { players } = await setupPlayingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;
    const activeClient = players[activeIdx];

    // Create a dummy card that is not in the hand
    const dummyCardId = "HEARTS-7";
    const inHand = activeClient.hand.some((c) => c.id === dummyCardId);
    
    if (!inHand) {
      activeClient.playCard(dummyCardId);
      const errorMsg = await activeClient.waitForMessage("ERROR");
      expect(errorMsg.message).toBeDefined();
      expect(errorMsg.message.toLowerCase()).toContain("hand");
    }

    players.forEach((p) => p.disconnect());
  });

  it("G-B3: should reject playing an illegal card (violating suit/trump following)", async () => {
    const { players } = await setupPlayingGame();

    let state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;
    
    // 1. First player leads their first card
    let p1 = players[activeIdx];
    const leadCard = p1.hand[0];
    p1.playCard(leadCard.id);
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // 2. Find a subsequent player who has both legal and illegal card options,
    // and force them to play an illegal card.
    let tested = false;
    for (let i = 1; i < 4; i++) {
      state = players[0].gameState!;
      activeIdx = state.activePlayerIdx;
      let p = players[activeIdx];

      const legalCards = getLegalCards(p.hand, state.currentTrick!, state.currentContract);
      const illegalCard = p.hand.find((c) => !legalCards.some((lc) => lc.id === c.id));

      if (illegalCard) {
        // Play the illegal card
        p.playCard(illegalCard.id);
        const errorMsg = await p.waitForMessage("ERROR");
        expect(errorMsg.message).toBeDefined();
        expect(errorMsg.message.toLowerCase()).toContain("illegal");
        tested = true;
        break;
      } else {
        // If they have no illegal cards (all cards are legal because they can't follow),
        // they play a legal card to progress the trick so we can check the next player.
        p.playCard(legalCards[0].id);
        await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
      }
    }

    expect(tested).toBe(true);

    players.forEach((p) => p.disconnect());
  });

  it("G-B4: should reject playing a card when game is in ROUND_OVER or LOBBY state", async () => {
    const p1 = new ClientSimulator("Alice");
    await p1.connect(port);

    p1.createLobby(4);
    await p1.waitForMessage("LOBBY_UPDATED");

    // Try to play card in lobby
    p1.playCard("HEARTS-A");
    const errorMsg = await p1.waitForMessage("ERROR");
    expect(errorMsg.message).toBeDefined();

    p1.disconnect();
  });
});
