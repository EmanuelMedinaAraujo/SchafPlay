/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState } from "../types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isHuman: boolean;
  isConnected: boolean;
}

export interface LobbyState {
  code: string;
  hostId: string;
  maxHumans: number;
  players: LobbyPlayer[];
}

export interface ClientState {
  status: ConnectionStatus;
  error: string | null;
  playerId: string | null;
  lobby: LobbyState | null;
  gameState: GameState | null;
}

type Listener = (state: ClientState) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private playerName: string | null = null;
  private state: ClientState = {
    status: "disconnected",
    error: null,
    playerId: null,
    lobby: null,
    gameState: null,
  };
  private listeners = new Set<Listener>();
  private reconnectTimeout: any = null;
  private reconnectDelay = 1000;
  private shouldReconnect = false;

  constructor() {}

  private setState(newState: Partial<ClientState>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  public getState(): ClientState {
    return this.state;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public connect(url: string) {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      if (this.url === url) return;
      this.disconnect();
    }

    this.url = url;
    this.shouldReconnect = true;
    this.setState({ status: "connecting", error: null });

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
        this.setState({ status: "connected", error: null });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.setState({ status: "disconnected" });
        if (this.shouldReconnect) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        this.setState({ error: "WebSocket connection error" });
      };
    } catch (err: any) {
      this.setState({ status: "disconnected", error: err.message || "Failed to connect" });
      if (this.shouldReconnect) {
        this.attemptReconnect();
      }
    }
  }

  private attemptReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (this.shouldReconnect && this.url) {
        this.connect(this.url);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
      }
    }, this.reconnectDelay);
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.playerName = null;
    this.setState({
      status: "disconnected",
      error: null,
      playerId: null,
      lobby: null,
      gameState: null,
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case "LOBBY_UPDATED": {
        const lobby: LobbyState = {
          code: message.code,
          hostId: message.hostId,
          maxHumans: message.maxHumans,
          players: message.players,
        };
        let playerId = message.yourPlayerId || this.state.playerId;
        if (!playerId && this.playerName) {
          const me = lobby.players.find(p => p.name === this.playerName);
          if (me) {
            playerId = me.id;
          }
        }
        this.setState({ lobby, playerId, gameState: null });
        break;
      }
      case "GAME_START":
      case "GAME_STATE_UPDATED": {
        const gameState = message.gameState;
        let playerId = message.yourPlayerId || this.state.playerId;

        if (!playerId && this.playerName && gameState) {
          const me = gameState.players.find((p: any) => p.name === this.playerName);
          if (me) {
            playerId = me.id;
          }
        }

        this.setState({ gameState, playerId });
        break;
      }
      case "ERROR": {
        this.setState({ error: message.message });
        break;
      }
    }
  }

  public send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not open. Message not sent:", message);
    }
  }

  public createLobby(playerName: string, maxHumans: number) {
    this.playerName = playerName;
    this.send({ type: "CREATE_LOBBY", playerName, maxHumans });
  }

  public joinLobby(playerName: string, code: string) {
    this.playerName = playerName;
    this.send({ type: "JOIN_LOBBY", playerName, code });
  }

  public leaveLobby() {
    this.send({ type: "LEAVE_LOBBY" });
    this.disconnect();
  }

  public declareBid(bid: any) {
    this.send({ type: "DECLARE_BID", bid });
  }

  public playCard(cardId: string) {
    this.send({ type: "PLAY_CARD", cardId });
  }
}

export const wsClient = new WebSocketClient();
