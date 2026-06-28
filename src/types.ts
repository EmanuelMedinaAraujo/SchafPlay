/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Suit {
  ACORNS = "ACORNS", // Eichel (🌰)
  LEAVES = "LEAVES", // Gras/Grün (🍃)
  HEARTS = "HEARTS", // Herz (❤️)
  BELLS = "BELLS",   // Schellen (🔔)
}

export enum CardValue {
  SEVEN = "7",
  EIGHT = "8",
  NINE = "9",
  UNTER = "U", // Jack (Unter)
  OBER = "O",  // Queen (Ober)
  KING = "K",
  TEN = "10",
  ACE = "A",   // Sau
}

export interface Card {
  id: string;
  suit: Suit;
  value: CardValue;
  points: number;
  image?: string; // Optional custom visual representation
}

export enum GameType {
  SAUSPIEL = "SAUSPIEL", // Normal partnership game calling an Ace
  WENZ = "WENZ",         // Only Unters are trumps
  SOLO_ACORNS = "SOLO_ACORNS",
  SOLO_LEAVES = "SOLO_LEAVES",
  SOLO_HEARTS = "SOLO_HEARTS",
  SOLO_BELLS = "SOLO_BELLS",
  RAMSCH = "RAMSCH",     // Everyone for themselves, avoid points (optional round when all pass)
  PASSED = "PASSED",     // No game declared
}

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export interface Player {
  id: string; // "p1" (user), "p2" (AI left), "p3" (AI top), "p4" (AI right) or multi-peer IDs
  name: string;
  isHuman: boolean;
  cards: Card[];
  pointsCollected: number;
  difficulty?: Difficulty;
}

export interface Contract {
  type: GameType;
  declarerId: string; // The player who declared/called the game
  calledSuit?: Suit;  // For Sauspiel, the suit of the Ace being called (must be ACORNS, LEAVES, or BELLS)
  partnerId?: string; // Revealed during gameplay or at start if known (multiplayer)
  isTout?: boolean;
  isContra?: boolean;
  wenzSuit?: Suit;
}

export interface PlayedCard {
  playerId: string;
  card: Card;
  durationMs?: number; // Time taken in milliseconds to play this card
}

export interface Trick {
  id: number;
  leaderId: string; // Player who led the trick
  playedCards: PlayedCard[]; // Cards played in turn order
  winnerId?: string;
}

export interface GameState {
  status: "LOBBY" | "DEALING" | "BIDDING" | "PLAYING" | "ROUND_OVER" | "GAME_OVER";
  players: Player[];
  dealerIdx: number; // Index of the dealer
  activePlayerIdx: number; // Whose turn is it
  currentContract: Contract | null;
  tricks: Trick[];
  currentTrick: Trick | null;
  history: {
    contract: Contract;
    scores: { [playerId: string]: number };
    winnerIds: string[];
    points: { [playerId: string]: number };
  }[];
  bids: { playerId: string; choice: { type: GameType; calledSuit?: Suit } | null }[];
  logs: string[]; // Play-by-play actions
}

export interface SchafkopfStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesAsDeclarer: number;
  gamesAsPartner: number;
  gamesAsDefender: number;
  winsAsDeclarer: number;
  winsAsPartner: number;
  winsAsDefender: number;
  totalPoints: number;
  contractTypeCounts: { [key in GameType]?: number };
}

export interface AIAnalysis {
  trickAnalysis: {
    trickNumber: number;
    userAction: string;
    aiRecommendation: string;
    isOptimal: boolean;
    reasoning: string;
  }[];
  overallFeedback: string;
  rating: "Excellent" | "Good" | "Average" | "Needs Improvement";
}

export enum DealSpeed {
  SLOW = "SLOW",
  MEDIUM = "MEDIUM",
  FAST = "FAST",
}

