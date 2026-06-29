import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startTestServer, getFreePort, TestServer } from "./helpers/serverRunner";
import { ClientSimulator } from "./helpers/clientSimulator";
import WebSocket from "ws";

describe("E2E - Stress & Edge Cases", () => {
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

  // 1. Invalid / Malformed Messages
  describe("Invalid Messages", () => {
    it("should handle malformed JSON gracefully without crashing", async () => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => ws.on("open", resolve));

      const errorPromise = new Promise<any>((resolve) => {
        ws.on("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      ws.send("{invalid-json");

      const reply = await errorPromise;
      expect(reply.type).toBe("ERROR");
      expect(reply.message).toContain("Invalid message format");
      ws.close();
    });

    it("should handle unknown message types gracefully", async () => {
      const ws = new WebSocket(`ws://localhost:${port}`);
      await new Promise<void>((resolve) => ws.on("open", resolve));

      const errorPromise = new Promise<any>((resolve) => {
        ws.on("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      ws.send(JSON.stringify({ type: "UNKNOWN_COMMAND_123" }));

      const reply = await errorPromise;
      expect(reply.type).toBe("ERROR");
      expect(reply.message).toContain("Unknown message type");
      ws.close();
    });

    it("should reject CREATE_LOBBY with invalid maxHumans", async () => {
      const client = new ClientSimulator("Alice");
      await client.connect(port);

      client.send({ type: "CREATE_LOBBY", playerName: "Alice", maxHumans: 10 });
      const reply = await client.waitForMessage("ERROR");
      expect(reply.message).toContain("Max players must be 2, 3, or 4");

      client.disconnect();
    });

    it("should reject JOIN_LOBBY with missing parameters", async () => {
      const client = new ClientSimulator("Alice");
      await client.connect(port);

      // Missing code
      client.send({ type: "JOIN_LOBBY", playerName: "Alice" });
      let reply = await client.waitForMessage("ERROR");
      expect(reply.message).toContain("code is required");

      // Missing playerName
      client.send({ type: "JOIN_LOBBY", code: "ABCDEF" });
      reply = await client.waitForMessage("ERROR");
      expect(reply.message).toContain("name is required");

      client.disconnect();
    });
  });

  // 2. Rapid Connect / Disconnect
  describe("Rapid Connect / Disconnect", () => {
    it("should handle rapid sequential connections and disconnections from a client", async () => {
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        const client = new ClientSimulator(`User_${i}`);
        await client.connect(port);
        client.disconnect();
      }
      // If we reach here without crashing/hanging, it's a pass
      expect(true).toBe(true);
    });

    it("should handle rapid parallel connections and disconnections", async () => {
      const count = 30;
      const clients = Array.from({ length: count }, (_, i) => new ClientSimulator(`Parallel_${i}`));

      // Connect all in parallel
      await Promise.all(clients.map(c => c.connect(port)));

      // Disconnect all in parallel
      clients.forEach(c => c.disconnect());

      expect(true).toBe(true);
    });
  });

  // 3. Concurrent Joins (Race Conditions)
  describe("Concurrent Lobby Joins", () => {
    it("should only allow up to maxHumans players in a lobby under high concurrent join pressure", async () => {
      const host = new ClientSimulator("Host");
      await host.connect(port);
      host.createLobby(3); // Max 3 players (1 host + 2 peers)
      const lobbyMsg = await host.waitForMessage("LOBBY_UPDATED");
      const code = lobbyMsg.code;

      const peerCount = 10;
      const peers = Array.from({ length: peerCount }, (_, i) => new ClientSimulator(`Peer_${i}`));
      await Promise.all(peers.map(p => p.connect(port)));

      // Send all join requests simultaneously
      peers.forEach(p => p.joinLobby(code));

      // Wait a short duration for all messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check how many players are in the lobby via host's latest state
      // We can inspect the lobby players list.
      // Host should have received LOBBY_UPDATED messages.
      // Since it's single-threaded, it will process sequentially and max out at 3 players.
      // Let's count how many successful joins we got.
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < peerCount; i++) {
        const peer = peers[i];
        const queue = (peer as any).messageQueue;
        console.log(`Peer_${i} messageQueue:`, JSON.stringify(queue));
        
        // Count based on the messages in the queue
        const hasLobbyUpdated = queue.some((m: any) => m.type === "LOBBY_UPDATED");
        const hasFullError = queue.some((m: any) => m.type === "ERROR" && m.message.toLowerCase().includes("full"));

        if (hasLobbyUpdated) {
          successCount++;
        } else if (hasFullError) {
          errorCount++;
        }
      }

      console.log(`successCount: ${successCount}, errorCount: ${errorCount}`);

      // Host + successful peers should equal 3
      expect(successCount).toBeLessThanOrEqual(2); // Host is already 1, so at most 2 peers can join
      expect(successCount + errorCount).toBe(peerCount);

      // Clean up
      host.disconnect();
      peers.forEach(p => p.disconnect());
    });
  });

  // 4. Robustness & Heartbeat
  describe("Robustness & Heartbeat", () => {
    it("should remove a client from their previous lobby when they create or join a new lobby", async () => {
      const client1 = new ClientSimulator("Alice");
      const client2 = new ClientSimulator("Bob");

      await client1.connect(port);
      await client2.connect(port);

      // Alice creates Lobby A
      client1.createLobby(3);
      const lobbyAMsg = await client1.waitForMessage("LOBBY_UPDATED");
      const codeA = lobbyAMsg.code || lobbyAMsg.lobby.code;

      // Bob joins Lobby A
      client2.joinLobby(codeA);
      await client2.waitForMessage("LOBBY_UPDATED");

      // Clear Alice's message queue so we only see the new update
      (client1 as any).messageQueue = [];

      // Bob now creates a new lobby (Lobby B)
      client2.createLobby(3);
      const lobbyBMsg = await client2.waitForMessage("LOBBY_UPDATED");
      const codeB = lobbyBMsg.code || lobbyBMsg.lobby.code;
      expect(codeB).not.toBe(codeA);

      // Alice should receive a LOBBY_UPDATED message indicating Bob has left, leaving only Alice in Lobby A.
      const aliceUpdate = await client1.waitForMessage("LOBBY_UPDATED");
      const playersList = aliceUpdate.players || aliceUpdate.lobby.players;
      expect(playersList).toHaveLength(1);
      expect(playersList[0].name).toBe("Alice");

      // Clean up
      client1.disconnect();
      client2.disconnect();
    });

    it("should terminate an unresponsive client via heartbeat", async () => {
      // Start a temporary test server with a very short heartbeat interval (200ms)
      const tempPort = await getFreePort();
      process.env.HEARTBEAT_INTERVAL = "200";
      
      const tempServer = await startTestServer(tempPort);
      
      // Clean up the env var immediately
      delete process.env.HEARTBEAT_INTERVAL;

      try {
        // Create an unresponsive client by overriding its 'pong' handler
        const ws = new WebSocket(`ws://localhost:${tempPort}`);
        
        // Disable automatic pong response
        ws.pong = () => {
          console.log("[Test client] Intercepted and ignored ping (no-op pong)");
        };

        const openPromise = new Promise<void>((resolve) => ws.on("open", resolve));
        await openPromise;

        // The server heartbeat ticks every 200ms.
        // First tick: Sets alive status = false, sends ping.
        // Second tick (after 200ms more): Alive status is still false because no pong was received. Terminated.
        // So we expect the client to be closed by the server within ~600ms.
        const closePromise = new Promise<void>((resolve) => {
          ws.on("close", () => resolve());
        });

        // Wait for the server to terminate the connection
        await expect(closePromise).resolves.toBeUndefined();
      } finally {
        await tempServer.stop();
      }
    });

    it("should NOT terminate a responsive client", async () => {
      // Start a temporary test server with a short heartbeat interval (400ms)
      const tempPort = await getFreePort();
      process.env.HEARTBEAT_INTERVAL = "400";
      
      const tempServer = await startTestServer(tempPort);
      
      delete process.env.HEARTBEAT_INTERVAL;

      try {
        const ws = new WebSocket(`ws://localhost:${tempPort}`);
        
        const openPromise = new Promise<void>((resolve) => ws.on("open", resolve));
        await openPromise;

        // Wait for 1000ms (more than two heartbeat intervals).
        // Since the client is responsive (uses default ws.pong), it should remain connected.
        let wasClosed = false;
        ws.on("close", () => {
          wasClosed = true;
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        expect(wasClosed).toBe(false);
        expect(ws.readyState).toBe(WebSocket.OPEN);

        ws.close();
      } finally {
        await tempServer.stop();
      }
    });
  });
});
