import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket } from "ws";
import { startTestServer, getFreePort } from "./e2e/helpers/serverRunner";

describe("Lobby WebSocket Server", () => {
  let testServer: any;
  let port: number;

  beforeAll(async () => {
    const freePort = await getFreePort();
    testServer = await startTestServer(freePort);
    port = freePort;
  });

  afterAll(async () => {
    if (testServer) {
      await testServer.stop();
    }
  });

  it("should create a lobby and allow players to join and leave", () => {
    return new Promise<void>((resolve, reject) => {
      const client1 = new WebSocket(`ws://127.0.0.1:${port}`);
      let lobbyCode = "";

      client1.on("open", () => {
        client1.send(JSON.stringify({
          type: "CREATE_LOBBY",
          payload: { playerName: "Alice", maxHumans: 3 }
        }));
      });

      client1.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === "LOBBY_UPDATED") {
          if (!lobbyCode) {
            lobbyCode = msg.code || msg.lobby.code;
            expect(lobbyCode).toHaveLength(6);
            expect(msg.maxHumans || msg.lobby.maxHumans).toBe(3);
            expect(msg.players || msg.lobby.players).toHaveLength(1);
            expect((msg.players || msg.lobby.players)[0].name).toBe("Alice");
            expect((msg.players || msg.lobby.players)[0].isHost).toBe(true);

            // Now, client2 joins
            const client2 = new WebSocket(`ws://127.0.0.1:${port}`);
            client2.on("open", () => {
              client2.send(JSON.stringify({
                type: "JOIN_LOBBY",
                payload: { lobbyCode, playerName: "Bob" }
              }));
            });

            client2.on("message", (c2Data) => {
              const c2Msg = JSON.parse(c2Data.toString());
              if (c2Msg.type === "LOBBY_UPDATED") {
                expect(c2Msg.players || c2Msg.lobby.players).toHaveLength(2);
                expect((c2Msg.players || c2Msg.lobby.players)[1].name).toBe("Bob");
                expect((c2Msg.players || c2Msg.lobby.players)[1].isHost).toBe(false);

                // Now client2 leaves (disconnects)
                client2.close();
              }
            });
          } else {
            // This is the second LOBBY_UPDATED on client1 after client2 joined or left
            const playersList = msg.players || msg.lobby.players;
            if (playersList.length === 2) {
              // client2 joined, now wait for client2 to leave and trigger another update
            } else if (playersList.length === 1) {
              // client2 left, lobby is updated
              expect(playersList[0].name).toBe("Alice");
              client1.close();
              resolve();
            }
          }
        } else if (msg.type === "ERROR") {
          reject(new Error(msg.message));
        }
      });

      client1.on("error", (err) => reject(err));
    });
  });

  it("should disband the lobby when the host disconnects", () => {
    return new Promise<void>((resolve, reject) => {
      const client1 = new WebSocket(`ws://127.0.0.1:${port}`);
      let lobbyCode = "";

      client1.on("open", () => {
        client1.send(JSON.stringify({
          type: "CREATE_LOBBY",
          payload: { playerName: "HostAlice", maxHumans: 4 }
        }));
      });

      client1.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "LOBBY_UPDATED" && !lobbyCode) {
          lobbyCode = msg.code || msg.lobby.code;
          
          const client2 = new WebSocket(`ws://127.0.0.1:${port}`);
          client2.on("open", () => {
            client2.send(JSON.stringify({
              type: "JOIN_LOBBY",
              payload: { lobbyCode, playerName: "GuestBob" }
            }));
          });

          client2.on("message", (c2Data) => {
            const c2Msg = JSON.parse(c2Data.toString());
            if (c2Msg.type === "LOBBY_UPDATED") {
              // Both are in the lobby, now close host (client1)
              client1.close();
            } else if (c2Msg.type === "ERROR") {
              expect(c2Msg.message).toContain("Host has disconnected");
              client2.close();
              resolve();
            }
          });
        }
      });
    });
  });
});
