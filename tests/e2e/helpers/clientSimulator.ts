import WebSocket from "ws";
import { GameState, Card, Suit, GameType } from "../../../src/types";

interface MessageWaiter {
  type: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

export class ClientSimulator {
  private ws!: WebSocket;
  public playerId: string = "";
  public playerName: string;
  public lobbyCode: string = "";
  public gameState: GameState | null = null;
  public hand: Card[] = [];

  private messageQueue: any[] = [];
  private waiters: MessageWaiter[] = [];

  constructor(playerName: string) {
    this.playerName = playerName;
  }

  /**
   * Connect to the server on the specified port
   */
  public connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${port}`);

      this.ws.on("open", () => {
        resolve();
      });

      this.ws.on("error", (err) => {
        reject(err);
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (e) {
          console.error(`[Client ${this.playerName}] Failed to parse message:`, data.toString(), e);
        }
      });
    });
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Process incoming WebSocket messages and update local state
   */
  private handleMessage(message: any) {
    if (message.yourPlayerId) {
      this.playerId = message.yourPlayerId;
    }
    if (message.type === "LOBBY_UPDATED") {
      this.lobbyCode = message.code;
      const me = message.players.find((p: any) => p.name === this.playerName);
      if (me) {
        this.playerId = me.id;
      }
    } else if (message.type === "GAME_START") {
      if (message.gameState) {
        this.gameState = message.gameState;
      } else if (message.gameStates) {
        // If server sends all game states keyed by player ID, extract ours
        if (this.playerId && message.gameStates[this.playerId]) {
          this.gameState = message.gameStates[this.playerId];
        } else {
          // Fallback: find the state where our player exists
          for (const pid of Object.keys(message.gameStates)) {
            const gs = message.gameStates[pid];
            const me = gs.players.find((p: any) => p.name === this.playerName);
            if (me) {
              this.playerId = me.id;
              this.gameState = gs;
              break;
            }
          }
        }
      }
    } else if (message.type === "GAME_STATE_UPDATED") {
      this.gameState = message.gameState;
    }

    // Sync hand if gameState was updated
    if (this.gameState) {
      const me = this.gameState.players.find((p) => p.id === this.playerId || p.name === this.playerName);
      if (me) {
        if (!this.playerId) {
          this.playerId = me.id;
        }
        this.hand = me.cards || [];
      }
    }

    // Check if there is a pending waiter for this message type
    const waiterIndex = this.waiters.findIndex((w) => w.type === message.type || w.type === "");
    if (waiterIndex !== -1) {
      const waiter = this.waiters[waiterIndex];
      this.waiters.splice(waiterIndex, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else {
      // Otherwise, queue it for future waitForMessage calls
      this.messageQueue.push(message);
    }
  }

  /**
   * Send a JSON message to the server
   */
  public send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error(`Cannot send message. WebSocket is not open for player ${this.playerName}`);
    }
  }

  /**
   * Promise-based helper to wait for a message of a specific type.
   * Checks the queue of already received messages first.
   */
  public waitForMessage(type: string, timeoutMs: number = 5000): Promise<any> {
    const qIndex = this.messageQueue.findIndex((m) => m.type === type || type === "");
    if (qIndex !== -1) {
      const msg = this.messageQueue[qIndex];
      this.messageQueue.splice(qIndex, 1);
      return Promise.resolve(msg);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const wIndex = this.waiters.findIndex((w) => w.resolve === resolve);
        if (wIndex !== -1) {
          this.waiters.splice(wIndex, 1);
        }
        reject(new Error(`Timeout waiting for message of type "${type}" for player "${this.playerName}"`));
      }, timeoutMs);

      this.waiters.push({ type, resolve, reject, timer });
    });
  }

  // --- Action Helpers ---

  public createLobby(maxHumans: number) {
    this.send({ type: "CREATE_LOBBY", playerName: this.playerName, maxHumans });
  }

  public joinLobby(code: string) {
    this.send({ type: "JOIN_LOBBY", playerName: this.playerName, code });
  }

  public declareBid(bid: { type: GameType; calledSuit?: Suit } | null) {
    this.send({ type: "DECLARE_BID", bid });
  }

  public playCard(cardId: string) {
    this.send({ type: "PLAY_CARD", cardId });
  }
}
