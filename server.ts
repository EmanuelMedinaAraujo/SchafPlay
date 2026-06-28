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

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Vite integration for development vs. production static delivery
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
