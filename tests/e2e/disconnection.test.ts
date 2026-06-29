import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, getFreePort, TestServer } from "./helpers/serverRunner";
import { ClientSimulator } from "./helpers/clientSimulator";
import { GameType, Suit } from "../../src/types";
import { getLegalCards } from "../../src/utils/gameLogic";

describe("E2E - Disconnection & Reconnection (Tier 3)", () => {
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
  async function setupBiddingGame(): Promise<{ players: ClientSimulator[]; code: string }> {
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
    return { players, code };
  }

  it("D1: Bidding + Disconnection (AI Takeover) - active player disconnects during bidding, AI takes over and passes", async () => {
    const { players } = await setupBiddingGame();
    const state = players[0].gameState!;
    const activeIdx = state.activePlayerIdx;
    
    // Disconnect the active player
    const activeClient = players[activeIdx];
    activeClient.disconnect();

    // The remaining players should receive a GAME_STATE_UPDATED.
    // The disconnected player's seat should be taken over by AI (either isHuman becomes false or isConnected becomes false)
    // and the server should automatically make a bid (e.g. pass) on their behalf, progressing the active player.
    const remainingPlayers = players.filter((_, idx) => idx !== activeIdx);
    
    // Wait for the state update
    const updatePromises = remainingPlayers.map((p) => p.waitForMessage("GAME_STATE_UPDATED"));
    await Promise.all(updatePromises);

    const updatedState = remainingPlayers[0].gameState!;
    
    // The disconnected player should now be marked as AI or disconnected
    const disconnectedSeat = updatedState.players.find((p) => p.name === activeClient.playerName);
    expect(disconnectedSeat).toBeDefined();
    // Either isHuman is false, or isConnected is false and AI took over
    expect(disconnectedSeat!.isHuman === false || (disconnectedSeat as any).isConnected === false).toBe(true);

    // The active player should have advanced
    expect(updatedState.activePlayerIdx).not.toBe(activeIdx);

    remainingPlayers.forEach((p) => p.disconnect());
  });

  it("D2: Bidding + Reconnection - player disconnects during bidding, reconnects, and recovers their hand", async () => {
    const { players, code } = await setupBiddingGame();
    const state = players[0].gameState!;
    
    // Choose a player who is NOT active to disconnect (e.g., active + 1)
    const activeIdx = state.activePlayerIdx;
    const disconnectIdx = (activeIdx + 1) % 4;
    const clientToDisconnect = players[disconnectIdx];
    const originalHandIds = clientToDisconnect.hand.map((c) => c.id);

    clientToDisconnect.disconnect();

    // Wait for remaining players to receive update
    const remainingPlayers = players.filter((_, idx) => idx !== disconnectIdx);
    await Promise.all(remainingPlayers.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // Reconnect the player
    const reconnectedClient = new ClientSimulator(clientToDisconnect.playerName);
    await reconnectedClient.connect(port);
    reconnectedClient.joinLobby(code);

    // The reconnected player should receive the game state and recover their original hand
    const reconnectMsg = await reconnectedClient.waitForMessage("GAME_STATE_UPDATED");
    expect(reconnectMsg.gameState).toBeDefined();
    
    const reconnectedSeat = reconnectMsg.gameState.players.find(
      (p: any) => p.name === reconnectedClient.playerName
    );
    expect(reconnectedSeat).toBeDefined();
    expect(reconnectedSeat.isHuman).toBe(true);
    
    const newHandIds = reconnectedClient.hand.map((c) => c.id);
    expect(newHandIds).toHaveLength(8);
    expect(newHandIds).toEqual(expect.arrayContaining(originalHandIds));

    players.forEach((p) => p.disconnect());
    reconnectedClient.disconnect();
  });

  it("D3: Play + Disconnection (AI Takeover) - player disconnects during gameplay, AI plays a card on their behalf", async () => {
    const { players } = await setupBiddingGame();
    
    // Progress through bidding phase to enter PLAYING phase
    let state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;
    
    // Player 1 declares Sauspiel calling BELLS (or whatever suit they can call)
    const bidder = players[activeIdx];
    let calledSuit: Suit | null = null;
    for (const s of [Suit.ACORNS, Suit.LEAVES, Suit.BELLS]) {
      if (bidder.hand.some((c) => c.suit === s) && !bidder.hand.some((c) => c.suit === s && c.value === "A")) {
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

    // Enter PLAYING phase
    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    state = players[0].gameState!;
    activeIdx = state.activePlayerIdx;
    const clientToDisconnect = players[activeIdx];

    // Disconnect the active player whose turn it is to play a card
    clientToDisconnect.disconnect();

    // The server should detect disconnection, substitute an AI, and have that AI play a card.
    // The remaining players should receive a GAME_STATE_UPDATED where:
    // 1. The disconnected player played a card (currentTrick has 1 card).
    // 2. The turn progressed (activePlayerIdx advanced).
    const remainingPlayers = players.filter((_, idx) => idx !== activeIdx);
    await Promise.all(remainingPlayers.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    const newState = remainingPlayers[0].gameState!;
    expect(newState.currentTrick).toBeDefined();
    expect(newState.currentTrick!.playedCards).toHaveLength(1);
    expect(newState.currentTrick!.playedCards[0].playerId).toBe(clientToDisconnect.playerId);
    expect(newState.activePlayerIdx).toBe((activeIdx + 1) % 4);

    players.forEach((p) => p.disconnect());
  });

  it("D4: Play + Reconnection - player disconnects during play, reconnects, and resumes play", async () => {
    const { players } = await setupBiddingGame();
    
    // Progress through bidding phase to enter PLAYING phase
    let state = players[0].gameState!;
    let activeIdx = state.activePlayerIdx;
    
    // Player 1 declares Sauspiel
    const bidder = players[activeIdx];
    let calledSuit: Suit | null = null;
    for (const s of [Suit.ACORNS, Suit.LEAVES, Suit.BELLS]) {
      if (bidder.hand.some((c) => c.suit === s) && !bidder.hand.some((c) => c.suit === s && c.value === "A")) {
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

    await Promise.all(players.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // We choose a player who is NOT currently active to disconnect
    state = players[0].gameState!;
    activeIdx = state.activePlayerIdx;
    const disconnectIdx = (activeIdx + 1) % 4;
    const clientToDisconnect = players[disconnectIdx];
    const originalHandIds = clientToDisconnect.hand.map((c) => c.id);

    clientToDisconnect.disconnect();

    // Wait for remaining players to receive update
    const remainingPlayers = players.filter((_, idx) => idx !== disconnectIdx);
    await Promise.all(remainingPlayers.map((p) => p.waitForMessage("GAME_STATE_UPDATED")));

    // Reconnect the player
    const reconnectedClient = new ClientSimulator(clientToDisconnect.playerName);
    await reconnectedClient.connect(port);
    reconnectedClient.joinLobby(players[0].lobbyCode);

    // The reconnected player should receive the game state and recover their hand
    const reconnectMsg = await reconnectedClient.waitForMessage("GAME_STATE_UPDATED");
    expect(reconnectedClient.hand.map((c) => c.id)).toEqual(expect.arrayContaining(originalHandIds));

    players.forEach((p) => p.disconnect());
    reconnectedClient.disconnect();
  });
});
