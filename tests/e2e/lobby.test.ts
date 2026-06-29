import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, getFreePort, TestServer } from "./helpers/serverRunner";
import { ClientSimulator } from "./helpers/clientSimulator";

describe("E2E - Lobby Management (Tier 1 & Tier 2)", () => {
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

  // --- TIER 1: Feature Coverage ---

  it("L1: should allow a player to create a lobby", async () => {
    const client = new ClientSimulator("Alice");
    await client.connect(port);

    client.createLobby(4);
    const msg = await client.waitForMessage("LOBBY_UPDATED");

    expect(msg.code).toBeDefined();
    expect(msg.code.length).toBe(6);
    expect(msg.maxHumans).toBe(4);
    expect(msg.players).toHaveLength(1);
    expect(msg.players[0].name).toBe("Alice");

    client.disconnect();
  });

  it("L2: should allow other players to join an existing lobby", async () => {
    const host = new ClientSimulator("Alice");
    const peer = new ClientSimulator("Bob");

    await host.connect(port);
    await peer.connect(port);

    host.createLobby(4);
    const lobbyMsg = await host.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    peer.joinLobby(code);

    // Both should receive LOBBY_UPDATED
    const hostUpdate = await host.waitForMessage("LOBBY_UPDATED");
    const peerUpdate = await peer.waitForMessage("LOBBY_UPDATED");

    expect(hostUpdate.players).toHaveLength(2);
    expect(peerUpdate.players).toHaveLength(2);
    expect(hostUpdate.players.map((p: any) => p.name)).toContain("Bob");

    host.disconnect();
    peer.disconnect();
  });

  it("L3: should start the game when the lobby is full (4 players)", async () => {
    const p1 = new ClientSimulator("Alice");
    const p2 = new ClientSimulator("Bob");
    const p3 = new ClientSimulator("Charlie");
    const p4 = new ClientSimulator("Dave");

    await Promise.all([p1.connect(port), p2.connect(port), p3.connect(port), p4.connect(port)]);

    p1.createLobby(4);
    const lobbyMsg = await p1.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    p2.joinLobby(code);
    await Promise.all([p1.waitForMessage("LOBBY_UPDATED"), p2.waitForMessage("LOBBY_UPDATED")]);

    p3.joinLobby(code);
    await Promise.all([
      p1.waitForMessage("LOBBY_UPDATED"),
      p2.waitForMessage("LOBBY_UPDATED"),
      p3.waitForMessage("LOBBY_UPDATED"),
    ]);

    p4.joinLobby(code);

    // Once the 4th player joins, it should trigger GAME_START
    const startPromises = [
      p1.waitForMessage("GAME_START"),
      p2.waitForMessage("GAME_START"),
      p3.waitForMessage("GAME_START"),
      p4.waitForMessage("GAME_START"),
    ];

    const startMsgs = await Promise.all(startPromises);
    for (const msg of startMsgs) {
      expect(msg.type).toBe("GAME_START");
    }

    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
    p4.disconnect();
  });

  it("L4: should allow a player to leave a lobby", async () => {
    const host = new ClientSimulator("Alice");
    const peer = new ClientSimulator("Bob");

    await host.connect(port);
    await peer.connect(port);

    host.createLobby(4);
    const lobbyMsg = await host.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    peer.joinLobby(code);
    await host.waitForMessage("LOBBY_UPDATED");

    // Bob leaves
    peer.send({ type: "LEAVE_LOBBY" });

    // Host should receive LOBBY_UPDATED showing only 1 player remaining
    const update = await host.waitForMessage("LOBBY_UPDATED");
    expect(update.players).toHaveLength(1);
    expect(update.players[0].name).toBe("Alice");

    host.disconnect();
    peer.disconnect();
  });

  it("L5: should start a 2-player lobby game with 2 AI players when 2 humans join", async () => {
    const p1 = new ClientSimulator("Alice");
    const p2 = new ClientSimulator("Bob");

    await p1.connect(port);
    await p2.connect(port);

    p1.createLobby(2);
    const lobbyMsg = await p1.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    p2.joinLobby(code);

    // Game should start immediately since maxHumans is 2
    const [start1, start2] = await Promise.all([
      p1.waitForMessage("GAME_START"),
      p2.waitForMessage("GAME_START"),
    ]);

    expect(start1.type).toBe("GAME_START");
    expect(start2.type).toBe("GAME_START");

    // The game state should have 4 players (2 humans, 2 AI)
    const state = start1.gameState || start1.gameStates?.[p1.playerId];
    expect(state.players).toHaveLength(4);
    const humans = state.players.filter((p: any) => p.isHuman);
    const ais = state.players.filter((p: any) => !p.isHuman);
    expect(humans).toHaveLength(2);
    expect(ais).toHaveLength(2);

    p1.disconnect();
    p2.disconnect();
  });

  // --- TIER 2: Boundary & Corner Cases ---

  it("L-B1: should return ERROR when joining with a non-existent code", async () => {
    const client = new ClientSimulator("Alice");
    await client.connect(port);

    client.joinLobby("NOSUCH");
    const errorMsg = await client.waitForMessage("ERROR");

    expect(errorMsg.message).toBeDefined();
    expect(errorMsg.message.toLowerCase()).toContain("not found");

    client.disconnect();
  });

  it("L-B2: should return ERROR when trying to join a full lobby", async () => {
    const p1 = new ClientSimulator("Alice");
    const p2 = new ClientSimulator("Bob");
    const p3 = new ClientSimulator("Charlie");

    await Promise.all([p1.connect(port), p2.connect(port), p3.connect(port)]);

    p1.createLobby(2);
    const lobbyMsg = await p1.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    p2.joinLobby(code);
    // Game starts because it is full (maxHumans = 2)
    await Promise.all([p1.waitForMessage("GAME_START"), p2.waitForMessage("GAME_START")]);

    // Charlie tries to join
    p3.joinLobby(code);
    const errorMsg = await p3.waitForMessage("ERROR");

    expect(errorMsg.message).toBeDefined();
    expect(errorMsg.message.toLowerCase()).toContain("full");

    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
  });

  it("L-B3: should handle invalid maxHumans parameter by defaulting or returning error", async () => {
    const client = new ClientSimulator("Alice");
    await client.connect(port);

    // Attempting to create lobby with 5 players (invalid)
    client.createLobby(5);
    
    // The server should either return an ERROR, or clamp it to a valid size (e.g. 4)
    const msg = await client.waitForMessage(""); // Wait for any message
    if (msg.type === "ERROR") {
      expect(msg.message).toBeDefined();
    } else {
      expect(msg.type).toBe("LOBBY_UPDATED");
      expect(msg.maxHumans).toBeLessThanOrEqual(4);
      expect(msg.maxHumans).toBeGreaterThanOrEqual(2);
    }

    client.disconnect();
  });

  it("L-B4: should reject empty player names", async () => {
    const client = new ClientSimulator("");
    await client.connect(port);

    client.createLobby(4);
    const errorMsg = await client.waitForMessage("ERROR");
    expect(errorMsg.message).toBeDefined();

    client.disconnect();
  });

  it("L-B5: should reject joining a game that has already started", async () => {
    const p1 = new ClientSimulator("Alice");
    const p2 = new ClientSimulator("Bob");
    const p3 = new ClientSimulator("Charlie");

    await Promise.all([p1.connect(port), p2.connect(port), p3.connect(port)]);

    p1.createLobby(2);
    const lobbyMsg = await p1.waitForMessage("LOBBY_UPDATED");
    const code = lobbyMsg.code;

    p2.joinLobby(code);
    await Promise.all([p1.waitForMessage("GAME_START"), p2.waitForMessage("GAME_START")]);

    // Charlie tries to join after start
    p3.joinLobby(code);
    const errorMsg = await p3.waitForMessage("ERROR");
    expect(errorMsg.message).toBeDefined();

    p1.disconnect();
    p2.disconnect();
    p3.disconnect();
  });
});
