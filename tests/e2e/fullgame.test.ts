import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, getFreePort, TestServer } from "./helpers/serverRunner";
import { ClientSimulator } from "./helpers/clientSimulator";
import { GameType, Suit } from "../../src/types";
import { getLegalCards } from "../../src/utils/gameLogic";

describe("E2E - Full Game Playthrough (Tier 4)", () => {
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

  it("FG1: should play a complete 8-trick game to completion and verify scoring", async () => {
    const players = [
      new ClientSimulator("Alice"),
      new ClientSimulator("Bob"),
      new ClientSimulator("Charlie"),
      new ClientSimulator("Dave"),
    ];

    await Promise.all(players.map((p) => p.connect(port)));

    // 1. Create and join lobby
    players[0].createLobby(4);
    const lobbyMsg = await players[0].waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    for (let i = 1; i < 4; i++) {
      players[i].joinLobby(code);
    }

    // 2. Wait for GAME_START
    await Promise.all(players.map((p) => p.waitForMessage("GAME_START")));

    // 3. Bidding Phase: Active player declares Wenz (always legal, no called-suit restrictions)
    let state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;
    const bidder = players[activeIdx];

    bidder.declareBid({ type: GameType.WENZ });

    // The other 3 players pass
    for (let i = 1; i < 4; i++) {
      await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
      activeIdx = players[0].gameState!.activePlayerIdx;
      players[activeIdx].declareBid(null);
    }

    // Wait for the gameplay phase transition
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
    state = players[0].gameState!;
    expect(state.status).toBe("PLAYING");

    // 4. Play 8 Tricks (32 cards total)
    for (let trickNum = 1; trickNum <= 8; trickNum++) {
      // Play 4 cards in the trick
      for (let cardNum = 1; cardNum <= 4; cardNum++) {
        state = players[0].gameState!;
        activeIdx = state.activePlayerIdx;
        const activeClient = players[activeIdx];

        // Retrieve the client's current hand from their simulator state
        const clientHand = activeClient.hand;
        
        // Use the pure game logic to find legal cards to play
        const legalCards = getLegalCards(clientHand, state.currentTrick, state.currentContract);
        expect(legalCards.length).toBeGreaterThan(0);
        
        // Play the first legal card
        const cardToPlay = legalCards[0];
        activeClient.playCard(cardToPlay.id);

        // Wait for the state update on all clients
        await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));
      }

      // After 4 cards are played, the trick is resolved.
      // If we are not at the end of the game, the server resolves the trick,
      // and state.currentTrick will be null (ready for the next trick).
      state = players[0].gameState!;
      if (trickNum < 8) {
        expect(state.currentTrick).toBeNull();
        expect(state.tricks).toHaveLength(trickNum);
      }
    }

    // 5. Verify Game Over / Round Over
    // Wait for the final ROUND_OVER / GAME_OVER state update if not already received
    state = players[0].gameState!;
    expect(state.status).toBe("ROUND_OVER");

    // Verify that the sum of points collected by all players is exactly 120
    const totalPoints = state.players.reduce((sum, p) => sum + p.pointsCollected, 0);
    expect(totalPoints).toBe(120);

    players.forEach((p) => p.disconnect());
  }, 30000); // Increase timeout for the full playthrough test
});
