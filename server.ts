/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import {
  createDeck,
  shuffleDeck,
  isTrump,
  getPlaySuit,
  getLegalCards,
  determineTrickWinner,
  countPoints,
  getAIBid,
  getAICardPlay,
} from "./src/utils/gameLogic";
import { GameType, Suit, CardValue, Card, GameState, Difficulty } from "./src/types";

dotenv.config();

// --- WebSocket Types & State --- //
interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  isHost: boolean;
  isHuman: boolean;
  isConnected: boolean;
}

interface Lobby {
  code: string;
  hostId: string;
  maxHumans: number;
  players: Player[];
  createdAt: Date;
  gameStarted?: boolean;
  gameState?: GameState | null;
  passedPlayerIds?: string[];
}

const lobbies = new Map<string, Lobby>();
const socketToPlayer = new Map<WebSocket, { lobbyCode: string; playerId: string }>();
const aliveSockets = new WeakMap<WebSocket, boolean>();

function generateLobbyCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (lobbies.has(code));
  return code;
}

function broadcastToLobby(lobby: Lobby, message: any) {
  const payload = JSON.stringify(message);
  for (const player of lobby.players) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}

function getCleanLobbyDetails(lobby: Lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    maxHumans: lobby.maxHumans,
    players: lobby.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isHuman: p.isHuman,
      isConnected: p.isConnected
    }))
  };
}

function redactGameState(gameState: GameState, targetPlayerId: string): GameState {
  return {
    ...gameState,
    players: gameState.players.map((p) => {
      if (p.id === targetPlayerId) {
        return p;
      } else {
        return {
          ...p,
          cards: [],
        };
      }
    }),
  };
}

function broadcastGameState(lobby: Lobby, isStart: boolean = false) {
  if (!lobby.gameState) return;

  const gameStatesMap: { [playerId: string]: GameState } = {};
  for (const player of lobby.players) {
    gameStatesMap[player.id] = redactGameState(lobby.gameState, player.id);
  }

  for (const player of lobby.players) {
    if (player.ws.readyState === WebSocket.OPEN) {
      const redactedState = gameStatesMap[player.id];
      player.ws.send(
        JSON.stringify({
          type: isStart ? "GAME_START" : "GAME_STATE_UPDATED",
          gameState: redactedState,
          gameStates: gameStatesMap,
        })
      );
    }
  }
}

function startGame(lobby: Lobby) {
  const playersData: any[] = lobby.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHuman: true,
    cards: [] as Card[],
    pointsCollected: 0,
  }));

  const aiNames = ["Hans (AI)", "Sepp (AI)", "Moni (AI)"];
  let aiIdx = 0;
  while (playersData.length < 4) {
    const aiId = `ai_${Math.random().toString(36).substr(2, 9)}`;
    playersData.push({
      id: aiId,
      name: aiNames[aiIdx++],
      isHuman: false,
      cards: [] as Card[],
      pointsCollected: 0,
    });
  }

  const deck = shuffleDeck(createDeck());
  for (let i = 0; i < 4; i++) {
    playersData[i].cards = deck.slice(i * 8, (i + 1) * 8).sort((a, b) => {
      const aT = isTrump(a, GameType.SAUSPIEL);
      const bT = isTrump(b, GameType.SAUSPIEL);
      if (aT && !bT) return -1;
      if (!aT && bT) return 1;
      return a.suit === b.suit ? b.points - a.points : a.suit.localeCompare(b.suit);
    });
  }

  const gameState: GameState = {
    status: "BIDDING",
    players: playersData,
    dealerIdx: 0,
    activePlayerIdx: 1, // Forehand
    currentContract: null,
    tricks: [],
    currentTrick: null,
    history: [],
    bids: [],
    logs: ["Welcome to Bavarian Schafkopf! Cards dealt, bidding begins."],
  };

  lobby.gameState = gameState;
  lobby.gameStarted = true;

  broadcastGameState(lobby, true);
  const steps = progressGame(lobby);
  if (steps > 0) {
    broadcastGameState(lobby);
  }
}

function progressGame(lobby: Lobby): number {
  const gameState = lobby.gameState;
  if (!gameState) return 0;

  let steps = 0;
  while (steps < 50) {
    const activePlayer = gameState.players[gameState.activePlayerIdx];
    if (!activePlayer) break;
    
    if (activePlayer.isHuman) {
      break;
    }

    if (gameState.status === "BIDDING") {
      const bid = getAIBid(activePlayer, gameState.bids);
      processBid(lobby, activePlayer.id, bid);
      steps++;
    } else if (gameState.status === "PLAYING") {
      const card = getAICardPlay(activePlayer, gameState.currentTrick, gameState.currentContract, Difficulty.MEDIUM);
      processPlayCard(lobby, activePlayer.id, card.id);
      steps++;
    } else {
      break;
    }

    if ((gameState.status as any) === "ROUND_OVER") {
      break;
    }
  }

  return steps;
}

function processBid(lobby: Lobby, playerId: string, bid: any) {
  const gameState = lobby.gameState;
  if (!gameState) return;

  if (!lobby.passedPlayerIds) {
    lobby.passedPlayerIds = [];
  }

  gameState.bids.push({ playerId, choice: bid });
  
  if (!bid) {
    if (!lobby.passedPlayerIds.includes(playerId)) {
      lobby.passedPlayerIds.push(playerId);
    }
  }

  const player = gameState.players.find(p => p.id === playerId);
  let bidLabel = "";
  if (bid) {
    if (bid.type === GameType.SAUSPIEL && bid.calledSuit) {
      bidLabel = `Sauspiel (ruft ${bid.calledSuit}-As)`;
    } else if (bid.type === GameType.WENZ) {
      let label = "Wenz";
      if (bid.wenzSuit) {
        label = `${bid.wenzSuit} Wenz`;
      }
      if (bid.isTout) {
        label += " Tout";
      }
      bidLabel = label;
    } else {
      bidLabel = bid.type;
    }
  } else {
    bidLabel = "Weiter (gepasst)";
  }
  gameState.logs.push(`${player?.name}: ${bidLabel}`);

  gameState.activePlayerIdx = (gameState.activePlayerIdx + 1) % 4;

  if (gameState.bids.length >= 4 && lobby.passedPlayerIds.length >= 3) {
    let bestBid: any = null;
    for (const b of gameState.bids) {
      if (!b.choice) continue;
      if (!bestBid) {
        bestBid = b;
        continue;
      }

      const getBidPriority = (choice: any) => {
        if (choice.isTout) return 3;
        if (choice.type.startsWith("SOLO") || choice.type === GameType.WENZ) return 2;
        if (choice.type === GameType.SAUSPIEL) return 1;
        return 0;
      };

      const currentPriority = getBidPriority(bestBid.choice);
      const nextPriority = getBidPriority(b.choice);

      if (nextPriority > currentPriority) {
        bestBid = b;
      }
    }

    if (bestBid) {
      const finalContract: any = {
        type: bestBid.choice.type,
        declarerId: bestBid.playerId,
        calledSuit: bestBid.choice.calledSuit,
        isTout: bestBid.choice.isTout,
        wenzSuit: bestBid.choice.wenzSuit,
      };

      if (finalContract.type === GameType.SAUSPIEL && finalContract.calledSuit) {
        const partner = gameState.players.find(p =>
          p.cards.some(c => c.suit === finalContract.calledSuit && c.value === CardValue.ACE)
        );
        if (partner) {
          finalContract.partnerId = partner.id;
        }
      }

      const contractor = gameState.players.find(p => p.id === finalContract.declarerId);
      gameState.status = "PLAYING";
      gameState.currentContract = finalContract;
      gameState.activePlayerIdx = (gameState.dealerIdx + 1) % 4;
      gameState.currentTrick = {
        id: 1,
        leaderId: gameState.players[gameState.activePlayerIdx].id,
        playedCards: [],
      };
      gameState.logs.push(`${contractor?.name} spielt ein ${finalContract.type}!`);
    } else {
      gameState.status = "PLAYING";
      gameState.currentContract = {
        type: GameType.RAMSCH,
        declarerId: "all",
      };
      gameState.activePlayerIdx = (gameState.dealerIdx + 1) % 4;
      gameState.currentTrick = {
        id: 1,
        leaderId: gameState.players[gameState.activePlayerIdx].id,
        playedCards: [],
      };
      gameState.logs.push("Alle weiter! Ramsch-Modus aktiv!");
    }
  }
}

function processPlayCard(lobby: Lobby, playerId: string, cardId: string) {
  const gameState = lobby.gameState;
  if (!gameState) return;

  const activePlayer = gameState.players.find(p => p.id === playerId);
  if (!activePlayer) return;

  const card = activePlayer.cards.find(c => c.id === cardId)!;

  activePlayer.cards = activePlayer.cards.filter(c => c.id !== cardId);

  const playedCard = {
    playerId,
    card,
    durationMs: 0,
  };

  if (!gameState.currentTrick) {
    gameState.currentTrick = {
      id: gameState.tricks.length + 1,
      leaderId: playerId,
      playedCards: [],
    };
  }

  gameState.currentTrick.playedCards.push(playedCard);
  gameState.logs.push(`${activePlayer.name}: ${card.value} ${card.suit}`);

  if (gameState.currentTrick.playedCards.length === 4) {
    const winnerId = determineTrickWinner(gameState.currentTrick.playedCards, gameState.currentContract?.type || GameType.PASSED);
    gameState.currentTrick.winnerId = winnerId;

    const trickPoints = countPoints(gameState.currentTrick.playedCards.map(pc => pc.card));
    const winnerPlayer = gameState.players.find(p => p.id === winnerId);
    if (winnerPlayer) {
      winnerPlayer.pointsCollected += trickPoints;
    }

    const completedTrick = { ...gameState.currentTrick };
    gameState.tricks.push(completedTrick);

    const nextTrickNum = completedTrick.id + 1;

    gameState.currentTrick = null;

    if (nextTrickNum > 8) {
      gameState.status = "ROUND_OVER";
      gameState.logs.push("Spiel beendet! Punkte werden gezählt.");
    } else {
      const winnerIdx = gameState.players.findIndex(p => p.id === winnerId);
      gameState.activePlayerIdx = winnerIdx;
      gameState.logs.push(`${winnerPlayer?.name} sticht!`);
    }
  } else {
    gameState.activePlayerIdx = (gameState.activePlayerIdx + 1) % 4;
  }
}

function handlePlayerLeave(ws: WebSocket) {
  const session = socketToPlayer.get(ws);
  if (session) {
    const { lobbyCode, playerId } = session;
    socketToPlayer.delete(ws);

    const lobby = lobbies.get(lobbyCode);
    if (lobby) {
      if (lobby.gameStarted) {
        const player = lobby.players.find(p => p.id === playerId);
        if (player) {
          player.isConnected = false;
          if (lobby.gameState) {
            const gamePlayer = lobby.gameState.players.find((p: any) => p.id === playerId);
            if (gamePlayer) {
              gamePlayer.isHuman = false;
            }
          }
          console.log(`Player ${player.name} (${playerId}) disconnected from started game in lobby ${lobbyCode}. AI took over.`);
          
          if (lobby.players.every(p => !p.isConnected)) {
            lobbies.delete(lobbyCode);
            console.log(`Lobby ${lobbyCode} deleted (all players disconnected)`);
          } else {
            if (lobby.gameState && lobby.gameState.players[lobby.gameState.activePlayerIdx]?.id === playerId) {
              progressGame(lobby);
            }
            broadcastGameState(lobby);
          }
        }
        return;
      }

      const playerIndex = lobby.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const removedPlayer = lobby.players.splice(playerIndex, 1)[0];
        console.log(`Player ${removedPlayer.name} (${playerId}) left lobby ${lobbyCode}`);
      }

      if (lobby.players.length === 0) {
        lobbies.delete(lobbyCode);
        console.log(`Lobby ${lobbyCode} deleted (no players left)`);
      } else if (lobby.hostId === playerId) {
        broadcastToLobby(lobby, {
          type: "ERROR",
          message: "Host has disconnected. Lobby disbanded."
        });
        for (const player of lobby.players) {
          player.ws.close();
          socketToPlayer.delete(player.ws);
        }
        lobbies.delete(lobbyCode);
        console.log(`Lobby ${lobbyCode} disbanded because host left`);
      } else {
        const cleanDetails = getCleanLobbyDetails(lobby);
        broadcastToLobby(lobby, {
          type: "LOBBY_UPDATED",
          ...cleanDetails,
          lobby: cleanDetails
        });
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: "5mb" }));

  // API: Analyze the Schafkopf game using Gemini
  app.post("/api/analyze-game", async (req, res) => {
    try {
      const { playerHand, tricks, contract, playerName } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.",
        });
      }

      // Initialize Gemini Client
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `
        You are an elite Bavarian Schafkopf master coach. Analyze the following game log for player "${playerName}" and provide actionable, educational tactical feedback to help them improve.
        
        Contract: ${JSON.stringify(contract)}
        Original Hand: ${JSON.stringify(playerHand)}
        Tricks Played: ${JSON.stringify(tricks)}

        Examine each of the tricks step-by-step. Under Schafkopf rules and strategy, evaluate if the player's card choice was optimal or if they should have played differently (e.g., led a different card, saved a trump, or "schmieren" (greased) their partner's trick).
        
        You must return your response strictly matching the requested JSON schema.
        Keep trick explanations concise, helpful, and friendly. Use standard German Schafkopf terminology (such as "Schmieren", "Sauspiel", "Unter", "Ober", "Farbzwang") with brief explanations of the terms so the player can learn.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              trickAnalysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    trickNumber: {
                      type: Type.INTEGER,
                      description: "The sequence number of the trick (1-8).",
                    },
                    userAction: {
                      type: Type.STRING,
                      description: "A summary of what card the user played.",
                    },
                    aiRecommendation: {
                      type: Type.STRING,
                      description: "What card or play strategy would be recommended.",
                    },
                    isOptimal: {
                      type: Type.BOOLEAN,
                      description: "True if the user made the optimal choice, false otherwise.",
                    },
                    reasoning: {
                      type: Type.STRING,
                      description: "Explanation of why this was good, or why another play was better.",
                    },
                  },
                  required: ["trickNumber", "userAction", "aiRecommendation", "isOptimal", "reasoning"],
                },
              },
              overallFeedback: {
                type: Type.STRING,
                description: "An overall summary of the player's game, strategic strengths, and what they should focus on next time.",
              },
              rating: {
                type: Type.STRING,
                description: "Must be exactly one of: Excellent, Good, Average, Needs Improvement.",
              },
            },
            required: ["trickAnalysis", "overallFeedback", "rating"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response received from Gemini.");
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Gemini Schafkopf analysis error:", error);
      res.status(500).json({
        error: error.message || "Failed to analyze game with Gemini AI.",
      });
    }
  });

  // API: Save a completed Schafkopf game to a JSON log file
  app.post("/api/save-game", async (req, res) => {
    try {
      const gameData = req.body;
      if (!gameData || typeof gameData !== "object") {
        return res.status(400).json({ error: "Invalid game data" });
      }

      // Add server-side timestamp and unique ID if not present
      const gameLog = {
        id: gameData.id || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...gameData,
      };

      const filePath = path.join(process.cwd(), "saved_games.json");
      let savedGames = [];

      try {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          savedGames = JSON.parse(fileContent);
          if (!Array.isArray(savedGames)) {
            savedGames = [];
          }
        }
      } catch (readError) {
        console.error("Error reading saved_games.json, starting fresh:", readError);
        savedGames = [];
      }

      savedGames.push(gameLog);

      fs.writeFileSync(filePath, JSON.stringify(savedGames, null, 2), "utf-8");
      console.log(`Successfully saved game ${gameLog.id} to saved_games.json`);

      res.json({ success: true, id: gameLog.id });
    } catch (error: any) {
      console.error("Failed to save game to server:", error);
      res.status(500).json({ error: error.message || "Failed to save game to server" });
    }
  });

  // --- WebSocket Server Logic --- //
  const heartbeatInterval = Number(process.env.HEARTBEAT_INTERVAL) || 30000;
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (aliveSockets.get(ws) === false) {
        console.log("Terminating inactive WebSocket connection.");
        return ws.terminate();
      }
      aliveSockets.set(ws, false);
      ws.ping();
    });
  }, heartbeatInterval);

  wss.on("close", () => {
    clearInterval(interval);
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("New WebSocket connection established.");
    aliveSockets.set(ws, true);

    ws.on("pong", () => {
      aliveSockets.set(ws, true);
    });

    ws.on("message", (messageData) => {
      try {
        const data = JSON.parse(messageData.toString());
        const { type, payload } = data;

        switch (type) {
          case "CREATE_LOBBY": {
            const playerName = data.playerName || payload?.playerName;
            const maxHumans = data.maxHumans || payload?.maxHumans || data.maxPlayers || payload?.maxPlayers;

            if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
              ws.send(JSON.stringify({ type: "ERROR", message: "Invalid player name." }));
              break;
            }
            const maxHumansNum = Number(maxHumans);
            if (![2, 3, 4].includes(maxHumansNum)) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Max players must be 2, 3, or 4." }));
              break;
            }

            if (socketToPlayer.has(ws)) {
              handlePlayerLeave(ws);
            }

            const lobbyCode = generateLobbyCode();
            const playerId = `p_${Math.random().toString(36).substr(2, 9)}`;
            const hostPlayer: Player = {
              id: playerId,
              name: playerName.trim(),
              ws,
              isHost: true,
              isHuman: true,
              isConnected: true
            };

            const newLobby: Lobby = {
              code: lobbyCode,
              hostId: playerId,
              maxHumans: maxHumansNum,
              players: [hostPlayer],
              createdAt: new Date()
            };

            lobbies.set(lobbyCode, newLobby);
            socketToPlayer.set(ws, { lobbyCode, playerId });

            const cleanDetails = getCleanLobbyDetails(newLobby);
            ws.send(JSON.stringify({
              type: "LOBBY_UPDATED",
              ...cleanDetails,
              lobby: cleanDetails
            }));
            console.log(`Lobby ${lobbyCode} created by ${playerName} (${playerId})`);
            break;
          }

          case "JOIN_LOBBY": {
            const lobbyCode = data.code || data.lobbyCode || payload?.code || payload?.lobbyCode;
            const playerName = data.playerName || payload?.playerName;

            if (!lobbyCode || typeof lobbyCode !== "string" || lobbyCode.trim() === "") {
              ws.send(JSON.stringify({ type: "ERROR", message: "Lobby code is required." }));
              break;
            }
            if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
              ws.send(JSON.stringify({ type: "ERROR", message: "Player name is required." }));
              break;
            }

            const code = lobbyCode.trim().toUpperCase();
            const lobby = lobbies.get(code);
            if (!lobby) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Lobby not found." }));
              break;
            }

            if (lobby.gameStarted) {
              const existingPlayer = lobby.players.find(p => p.name === playerName.trim() && !p.isConnected);
              if (existingPlayer) {
                existingPlayer.ws = ws;
                existingPlayer.isConnected = true;
                if (lobby.gameState) {
                  const gamePlayer = lobby.gameState.players.find((p: any) => p.id === existingPlayer.id);
                  if (gamePlayer) {
                    gamePlayer.isHuman = true;
                  }
                }
                socketToPlayer.set(ws, { lobbyCode: code, playerId: existingPlayer.id });
                console.log(`Player ${playerName} reconnected to lobby ${code}`);
                broadcastGameState(lobby);
                break;
              } else {
                ws.send(JSON.stringify({ type: "ERROR", message: "Lobby is full. Game has already started." }));
                break;
              }
            }

            if (lobby.players.length >= lobby.maxHumans) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Lobby is full." }));
              break;
            }

            if (socketToPlayer.has(ws)) {
              handlePlayerLeave(ws);
            }

            const playerId = `p_${Math.random().toString(36).substr(2, 9)}`;
            const newPlayer: Player = {
              id: playerId,
              name: playerName.trim(),
              ws,
              isHost: false,
              isHuman: true,
              isConnected: true
            };

            lobby.players.push(newPlayer);
            socketToPlayer.set(ws, { lobbyCode: code, playerId });

            const cleanDetails = getCleanLobbyDetails(lobby);
            broadcastToLobby(lobby, {
              type: "LOBBY_UPDATED",
              ...cleanDetails,
              lobby: cleanDetails
            });
            console.log(`Player ${playerName} (${playerId}) joined lobby ${code}`);

            if (lobby.players.length === lobby.maxHumans) {
              startGame(lobby);
            }
            break;
          }

          case "LEAVE_LOBBY": {
            handlePlayerLeave(ws);
            break;
          }

          case "DECLARE_BID": {
            const session = socketToPlayer.get(ws);
            if (!session) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Not in a lobby." }));
              break;
            }
            const { lobbyCode, playerId } = session;
            const lobby = lobbies.get(lobbyCode);
            if (!lobby || !lobby.gameState || lobby.gameState.status !== "BIDDING") {
              ws.send(JSON.stringify({ type: "ERROR", message: "Game is not in bidding state." }));
              break;
            }
            const gameState = lobby.gameState;
            const activePlayer = gameState.players[gameState.activePlayerIdx];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Not your turn." }));
              break;
            }

            const bid = data.bid !== undefined ? data.bid : payload?.bid;
            if (bid) {
              const validTypes = [
                GameType.SAUSPIEL,
                GameType.WENZ,
                GameType.SOLO_HEARTS,
                GameType.SOLO_ACORNS,
                GameType.SOLO_LEAVES,
                GameType.SOLO_BELLS,
              ];
              if (!validTypes.includes(bid.type)) {
                ws.send(JSON.stringify({ type: "ERROR", message: "Invalid bid type." }));
                break;
              }

              if (bid.type === GameType.SAUSPIEL) {
                const calledSuit = bid.calledSuit;
                if (!calledSuit || ![Suit.ACORNS, Suit.LEAVES, Suit.BELLS].includes(calledSuit)) {
                  ws.send(JSON.stringify({ type: "ERROR", message: "Invalid Sauspiel called suit. Must be Acorns, Leaves, or Bells." }));
                  break;
                }

                const hand = activePlayer.cards;
                const hasCalledAce = hand.some((c: any) => c.suit === calledSuit && c.value === CardValue.ACE);

                if (hasCalledAce) {
                  ws.send(JSON.stringify({ type: "ERROR", message: "You cannot call a suit of which you hold the Ace." }));
                  break;
                }
              }
            }

            processBid(lobby, playerId, bid);
            progressGame(lobby);
            broadcastGameState(lobby);
            break;
          }

          case "PLAY_CARD": {
            const session = socketToPlayer.get(ws);
            if (!session) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Not in a lobby." }));
              break;
            }
            const { lobbyCode, playerId } = session;
            const lobby = lobbies.get(lobbyCode);
            if (!lobby || !lobby.gameState) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Game not started." }));
              break;
            }
            const gameState = lobby.gameState;
            
            if (gameState.status !== "PLAYING") {
              ws.send(JSON.stringify({ type: "ERROR", message: "Game is not in playing phase." }));
              break;
            }

            const activePlayer = gameState.players[gameState.activePlayerIdx];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Not your turn." }));
              break;
            }

            const cardId = data.cardId || payload?.cardId;
            if (!cardId) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Card ID is required." }));
              break;
            }

            const playerHand = activePlayer.cards;
            const card = playerHand.find((c: any) => c.id === cardId);
            if (!card) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Card not in hand." }));
              break;
            }

            const legalCards = getLegalCards(playerHand, gameState.currentTrick!, gameState.currentContract);
            const isLegal = legalCards.some((c: any) => c.id === cardId);
            if (!isLegal) {
              ws.send(JSON.stringify({ type: "ERROR", message: "Card play is illegal. You must follow suit/trump." }));
              break;
            }

            processPlayCard(lobby, playerId, cardId);
            progressGame(lobby);
            broadcastGameState(lobby);
            break;
          }

          default:
            ws.send(JSON.stringify({ type: "ERROR", message: `Unknown message type: ${type}` }));
        }
      } catch (err) {
        console.error("Failed to parse or handle WebSocket message:", err);
        ws.send(JSON.stringify({ type: "ERROR", message: "Invalid message format." }));
      }
    });

    ws.on("close", () => {
      handlePlayerLeave(ws);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    });
  });

  // Vite integration for development vs. production static delivery
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
