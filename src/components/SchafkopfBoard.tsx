/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Award, Trophy, HelpCircle, ArrowRight, Play, Eye, EyeOff, ArrowLeft, Menu, RefreshCw, X, AlertTriangle } from "lucide-react";
import { Card, CardValue, Suit, GameType, Contract, Trick, Player, PlayedCard, Difficulty, GameState, DealSpeed } from "../types";
import {
  createDeck,
  shuffleDeck,
  isTrump,
  getPlaySuit,
  getLegalCards,
  determineTrickWinner,
  countPoints,
  getSuitEmoji,
  getCardLabel,
  getAIBid,
  getAICardPlay,
  getCardRank,
} from "../utils/gameLogic";
import { translations, Language, getCardSuitTranslated, getCardValueTranslated } from "../lib/i18n";

interface SchafkopfBoardProps {
  playerName: string;
  difficulty: Difficulty;
  dealSpeed?: DealSpeed;
  language: Language;
  isMultiplayer: boolean;
  multiplayerPlayers?: { name: string; isHuman: boolean; difficulty?: Difficulty }[];
  onGameFinished: (
    winnerIds: string[],
    finalPoints: { [playerId: string]: number },
    contract: Contract,
    startingHand: Card[],
    tricksPlayed: Trick[]
  ) => void;
  onShowRules: () => void;
  isGameFocusMode?: boolean;
  setIsGameFocusMode?: (val: boolean) => void;
  onBackToMenu?: () => void;
  showPointsDuringGame?: boolean;
  gamesPerList?: number;
}

export default function SchafkopfBoard({
  playerName,
  difficulty,
  dealSpeed = DealSpeed.MEDIUM,
  language,
  isMultiplayer,
  multiplayerPlayers,
  onGameFinished,
  onShowRules,
  isGameFocusMode = false,
  setIsGameFocusMode,
  onBackToMenu,
  showPointsDuringGame = true,
  gamesPerList = 12,
}: SchafkopfBoardProps) {
  const [gameState, setGameState] = useState<GameState>({
    status: "LOBBY",
    players: [],
    dealerIdx: 0,
    activePlayerIdx: 0,
    currentContract: null,
    tricks: [],
    currentTrick: null,
    history: [],
    bids: [],
    logs: ["Welcome to Bavarian Schafkopf!"],
  });

  const [startingHand, setStartingHand] = useState<Card[]>([]);
  const [tricksPlayed, setTricksPlayed] = useState<Trick[]>([]);

  const [biddingIndex, setBiddingIndex] = useState<number>(0);
  const [trickWinnerId, setTrickWinnerId] = useState<string | null>(null);
  const [isCollecting, setIsCollecting] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [confirmRestart, setConfirmRestart] = useState<boolean>(false);
  const [showLastTrickModal, setShowLastTrickModal] = useState<boolean>(false);

  // Pass & Play hand concealment state to prevent screen cheating
  const [isHandRevealed, setIsHandRevealed] = useState<boolean>(false);

  const turnStartTimeRef = React.useRef<number>(Date.now());

  // Reset/start selection timer whenever activePlayerIdx changes, playing begins, or trick is collected/revealed
  useEffect(() => {
    if (gameState.status === "PLAYING" && !isCollecting && isHandRevealed) {
      turnStartTimeRef.current = Date.now();
    }
  }, [gameState.activePlayerIdx, gameState.status, isCollecting, isHandRevealed]);

  // Invalid card selection tracking state
  const [hasClickedInvalid, setHasClickedInvalid] = useState<boolean>(false);

  // List play mechanics state
  const [listStandings, setListStandings] = useState<{ [playerId: string]: number }>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0
  });
  const [gamesPlayedInList, setGamesPlayedInList] = useState<number>(0);
  const [lastRoundScoreChange, setLastRoundScoreChange] = useState<{ [playerId: string]: number }>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0
  });

  // Mid-game adjustable settings and bidding sub-stage state
  const [localDifficulty, setLocalDifficulty] = useState<Difficulty>(difficulty);
  const [localDealSpeed, setLocalDealSpeed] = useState<DealSpeed>(dealSpeed || DealSpeed.MEDIUM);
  const [biddingStage, setBiddingStage] = useState<"category" | "sauspiel" | "solo" | "wenz_options" | "wenz_color">("category");
  const [wenzIsTout, setWenzIsTout] = useState<boolean>(false);

  useEffect(() => {
    setLocalDifficulty(difficulty);
  }, [difficulty]);

  useEffect(() => {
    setLocalDealSpeed(dealSpeed || DealSpeed.MEDIUM);
  }, [dealSpeed]);

  // Translate terms
  const t = translations[language];

  // Initializing or starting a new game
  const initGame = () => {
    processedRoundOver.current = false;
    const deck = shuffleDeck(createDeck());
    const players: Player[] = [];
    
    if (isMultiplayer && multiplayerPlayers) {
      // Use the custom seat configs configured in MultiplayerView
      players.push({ id: "p1", name: multiplayerPlayers[0]?.name || playerName, isHuman: multiplayerPlayers[0]?.isHuman, cards: [], pointsCollected: 0, difficulty: multiplayerPlayers[0]?.difficulty || localDifficulty });
      players.push({ id: "p2", name: multiplayerPlayers[1]?.name || "Hans", isHuman: multiplayerPlayers[1]?.isHuman, cards: [], pointsCollected: 0, difficulty: multiplayerPlayers[1]?.difficulty || localDifficulty });
      players.push({ id: "p3", name: multiplayerPlayers[2]?.name || "Sepp", isHuman: multiplayerPlayers[2]?.isHuman, cards: [], pointsCollected: 0, difficulty: multiplayerPlayers[2]?.difficulty || localDifficulty });
      players.push({ id: "p4", name: multiplayerPlayers[3]?.name || "Moni", isHuman: multiplayerPlayers[3]?.isHuman, cards: [], pointsCollected: 0, difficulty: multiplayerPlayers[3]?.difficulty || localDifficulty });
    } else {
      players.push({ id: "p1", name: playerName || "You", isHuman: true, cards: [], pointsCollected: 0 });
      players.push({ id: "p2", name: "Hans (AI)", isHuman: false, cards: [], pointsCollected: 0, difficulty: localDifficulty });
      players.push({ id: "p3", name: "Sepp (AI)", isHuman: false, cards: [], pointsCollected: 0, difficulty: localDifficulty });
      players.push({ id: "p4", name: "Moni (AI)", isHuman: false, cards: [], pointsCollected: 0, difficulty: localDifficulty });
    }

    // Deal 8 cards to each player
    for (let i = 0; i < 4; i++) {
      players[i].cards = deck.slice(i * 8, (i + 1) * 8).sort((a, b) => {
        const aT = isTrump(a, GameType.SAUSPIEL);
        const bT = isTrump(b, GameType.SAUSPIEL);
        if (aT && !bT) return -1;
        if (!aT && bT) return 1;
        return a.suit === b.suit ? b.points - a.points : a.suit.localeCompare(b.suit);
      });
    }

    // Keep track of user's original starting hand for analysis
    setStartingHand([...players[0].cards]);
    setTricksPlayed([]);

    const nextDealerIdx = (gameState.dealerIdx + 1) % 4;

    setGameState({
      status: "BIDDING",
      players,
      dealerIdx: nextDealerIdx,
      activePlayerIdx: (nextDealerIdx + 1) % 4, // Forehand starts bidding
      currentContract: null,
      tricks: [],
      currentTrick: null,
      history: gameState.history,
      bids: [],
      logs: [language === "de" ? "Karten wurden gegeben. Das Ansagen beginnt!" : "Cards dealt. Let the bidding begin!"],
    });

    setBiddingIndex(0);
    setBiddingStage("category");
    setWenzIsTout(false);
    setTrickWinnerId(null);
    setIsCollecting(false);
    setIsHandRevealed(!isMultiplayer); // Auto-reveal for single player
    setHasClickedInvalid(false);
  };

  useEffect(() => {
    if (gameState.status === "LOBBY") {
      initGame();
    }
  }, [gameState.status]);

  // Handle auto turn handover on player index shifts
  useEffect(() => {
    if (gameState.status === "PLAYING" || gameState.status === "BIDDING") {
      const nextPlayer = gameState.players[gameState.activePlayerIdx];
      if (isMultiplayer && nextPlayer?.isHuman) {
        setIsHandRevealed(false); // Hide until they tap "Reveal"
      } else {
        setIsHandRevealed(true); // AI or Single-player is always auto-revealed
      }
      setBiddingStage("category"); // Always reset bidding sub-stage when active player changes
      setWenzIsTout(false);
    }
  }, [gameState.activePlayerIdx, gameState.status, isMultiplayer]);

  // Dynamic delays based on dealSpeed setting
  const getDelayFactor = () => {
    switch (localDealSpeed) {
      case DealSpeed.SLOW:
        return 1.8; // 80% slower
      case DealSpeed.FAST:
        return 0; // directly / instantaneous play
      case DealSpeed.MEDIUM:
      default:
        return 1.0;
    }
  };

  const delayFactor = getDelayFactor();

  // AI Bidding simulation
  useEffect(() => {
    if (gameState.status !== "BIDDING") return;
    
    const activePlayer = gameState.players[gameState.activePlayerIdx];
    if (activePlayer && !activePlayer.isHuman) {
      const timer = setTimeout(() => {
        const bid = getAIBid(activePlayer, gameState.bids);
        handleBidSelection(activePlayer.id, bid);
      }, Math.round(1000 * delayFactor));
      return () => clearTimeout(timer);
    }
  }, [gameState.status, gameState.activePlayerIdx, delayFactor]);

  // AI Play simulation
  useEffect(() => {
    if (gameState.status !== "PLAYING" || isCollecting) return;

    const activePlayer = gameState.players[gameState.activePlayerIdx];
    if (activePlayer && !activePlayer.isHuman) {
      const timer = setTimeout(() => {
        const cardToPlay = getAICardPlay(activePlayer, gameState.currentTrick, gameState.currentContract, activePlayer.difficulty || localDifficulty);
        playCard(activePlayer.id, cardToPlay);
      }, Math.round(1200 * delayFactor));
      return () => clearTimeout(timer);
    }
  }, [gameState.status, gameState.activePlayerIdx, isCollecting, delayFactor]);

  // Automatically collect tricks after delay
  useEffect(() => {
    if (!isCollecting) return;

    const timer = setTimeout(() => {
      collectTrick();
    }, Math.round(2000 * delayFactor));

    return () => clearTimeout(timer);
  }, [isCollecting, delayFactor]);

  // Ref to guarantee list score calculations only run once per round-over
  const processedRoundOver = React.useRef<boolean>(false);

  useEffect(() => {
    if (gameState.status !== "ROUND_OVER") return;
    if (processedRoundOver.current) return;
    if (!gameState.currentContract) return;

    processedRoundOver.current = true;

    const contract = gameState.currentContract;
    const scoresChange: { [playerId: string]: number } = { p1: 0, p2: 0, p3: 0, p4: 0 };
    const multiplier = contract.isContra ? 2 : 1;

    if (contract.type === GameType.RAMSCH) {
      // Ramsch: highest points collected is the loser, pays 10 to others
      const playersSorted = [...gameState.players].sort((a, b) => b.pointsCollected - a.pointsCollected);
      const loserId = playersSorted[0].id;

      gameState.players.forEach(p => {
        if (p.id === loserId) {
          scoresChange[p.id] = -30;
        } else {
          scoresChange[p.id] = 10;
        }
      });
    } else if (contract.type === GameType.SAUSPIEL && contract.partnerId) {
      // Sauspiel: Partnership
      const declarerTeam = [contract.declarerId, contract.partnerId];
      const declarerPoints = gameState.players
        .filter(p => declarerTeam.includes(p.id))
        .reduce((sum, p) => sum + p.pointsCollected, 0);

      const defendersTricksCount = gameState.tricks.filter(t => !declarerTeam.includes(t.winnerId || "")).length;
      const declarerTeamWon = contract.isTout ? (defendersTricksCount === 0) : (declarerPoints >= 61);

      // Schneider/Schwarz modifiers
      let baseTariff = 10;
      if (contract.isTout) {
        baseTariff = 60; // Tout base tariff
      } else if (declarerTeamWon) {
        const defendersPoints = 120 - declarerPoints;
        if (defendersPoints < 30) baseTariff = 20; // Schneider
        if (defendersPoints === 0) baseTariff = 30; // Schwarz
      } else {
        if (declarerPoints < 31) baseTariff = 20; // Schneider
        if (declarerPoints === 0) baseTariff = 30; // Schwarz
      }

      const gameValue = baseTariff * multiplier;

      gameState.players.forEach(p => {
        if (declarerTeam.includes(p.id)) {
          scoresChange[p.id] = declarerTeamWon ? gameValue : -gameValue;
        } else {
          scoresChange[p.id] = declarerTeamWon ? -gameValue : gameValue;
        }
      });
    } else {
      // Solo or Wenz: Declarer against 3 defenders
      const declarerId = contract.declarerId;
      const declarerPlayer = gameState.players.find(p => p.id === declarerId);
      const declarerPoints = declarerPlayer?.pointsCollected || 0;

      const defendersTricksCount = gameState.tricks.filter(t => t.winnerId !== declarerId).length;
      const declarerWon = contract.isTout ? (defendersTricksCount === 0) : (declarerPoints >= 61);

      let baseTariff = 30;
      if (contract.isTout) {
        baseTariff = 120; // Tout base tariff
      } else if (declarerWon) {
        const defendersPoints = 120 - declarerPoints;
        if (defendersPoints < 30) baseTariff = 45; // Schneider
        if (defendersPoints === 0) baseTariff = 60; // Schwarz
      } else {
        if (declarerPoints < 31) baseTariff = 45; // Schneider
        if (declarerPoints === 0) baseTariff = 60; // Schwarz
      }

      const gameValue = baseTariff * multiplier;

      gameState.players.forEach(p => {
        if (p.id === declarerId) {
          scoresChange[p.id] = declarerWon ? gameValue * 3 : -gameValue * 3;
        } else {
          scoresChange[p.id] = declarerWon ? -gameValue : gameValue;
        }
      });
    }

    setListStandings(prev => {
      const next = { ...prev };
      Object.keys(scoresChange).forEach(id => {
        next[id] = (next[id] || 0) + scoresChange[id];
      });
      return next;
    });

    setLastRoundScoreChange(scoresChange);
    setGamesPlayedInList(prev => prev + 1);

  }, [gameState.status, gameState.currentContract, gameState.players]);

  // Handle bidding decisions
  const handleBidSelection = (playerId: string, bid: { type: GameType; calledSuit?: Suit; isTout?: boolean; wenzSuit?: Suit } | null) => {
    const activePlayer = gameState.players.find(p => p.id === playerId)!;
    
    let bidLabel = "";
    if (bid) {
      if (bid.type === GameType.SAUSPIEL && bid.calledSuit) {
        bidLabel = language === "de" 
          ? `Sauspiel (ruft ${getCardSuitTranslated(bid.calledSuit, language)}-As)` 
          : `Sauspiel (calling ${getCardSuitTranslated(bid.calledSuit, language)} Ace)`;
      } else if (bid.type === GameType.WENZ) {
        let label = "Wenz";
        if (bid.wenzSuit) {
          const suitName = bid.wenzSuit === Suit.ACORNS ? (language === "de" ? "Eichel" : "Acorns")
            : bid.wenzSuit === Suit.LEAVES ? (language === "de" ? "Gras" : "Leaves")
            : bid.wenzSuit === Suit.HEARTS ? (language === "de" ? "Herz" : "Hearts")
            : (language === "de" ? "Schellen" : "Bells");
          label = `${suitName} Wenz`;
        }
        if (bid.isTout) {
          label += " Tout";
        }
        bidLabel = label;
      } else {
        bidLabel = bid.type;
      }
    } else {
      bidLabel = language === "de" ? "Weiter (gepasst)" : "Passed";
    }

    const newBids = [...gameState.bids, { playerId, choice: bid }];
    const nextPlayerIdx = (gameState.activePlayerIdx + 1) % 4;
    const nextLogs = [...gameState.logs, `${activePlayer.name}: ${bidLabel}`];

    // Check if everyone has bid
    if (newBids.length === 4) {
      let bestBid: { playerId: string; choice: { type: GameType; calledSuit?: Suit; isTout?: boolean; wenzSuit?: Suit } } | null = null;
      
      for (const b of newBids) {
        if (!b.choice) continue;
        if (!bestBid) {
          bestBid = b as any;
          continue;
        }

        const currentBestType = bestBid.choice.type;
        const nextType = b.choice.type;

        const getBidPriority = (choice: { type: GameType; isTout?: boolean }) => {
          if (choice.isTout) return 3;
          if (choice.type.startsWith("SOLO") || choice.type === GameType.WENZ) return 2;
          if (choice.type === GameType.SAUSPIEL) return 1;
          return 0;
        };

        const currentPriority = getBidPriority(bestBid.choice);
        const nextPriority = getBidPriority(b.choice);

        if (nextPriority > currentPriority) {
          bestBid = b as any;
        }
      }

      if (bestBid) {
        const finalContract: Contract = {
          type: bestBid.choice.type,
          declarerId: bestBid.playerId,
          calledSuit: bestBid.choice.calledSuit,
          isTout: bestBid.choice.isTout,
          wenzSuit: bestBid.choice.wenzSuit,
        };

        // If Sauspiel, find partner holding the called Ace
        if (finalContract.type === GameType.SAUSPIEL && finalContract.calledSuit) {
          const partner = gameState.players.find(p => 
            p.cards.some(c => c.suit === finalContract.calledSuit && c.value === CardValue.ACE)
          );
          if (partner) {
            finalContract.partnerId = partner.id;
          }
        }

        const contractor = gameState.players.find(p => p.id === finalContract.declarerId)!;
        
        let contractTypeLabel = "";
        if (finalContract.type === GameType.SAUSPIEL) {
          contractTypeLabel = language === "de" 
            ? `Sauspiel mit gerufenem ${getCardSuitTranslated(finalContract.calledSuit!, language)}-As`
            : `Sauspiel with called ${getCardSuitTranslated(finalContract.calledSuit!, language)} Ace`;
        } else if (finalContract.type === GameType.WENZ) {
          let label = "Wenz";
          if (finalContract.wenzSuit) {
            const suitName = finalContract.wenzSuit === Suit.ACORNS ? (language === "de" ? "Eichel" : "Acorns")
              : finalContract.wenzSuit === Suit.LEAVES ? (language === "de" ? "Gras" : "Leaves")
              : finalContract.wenzSuit === Suit.HEARTS ? (language === "de" ? "Herz" : "Hearts")
              : (language === "de" ? "Schellen" : "Bells");
            label = `${suitName} Wenz`;
          }
          if (finalContract.isTout) {
            label += " Tout";
          }
          contractTypeLabel = label;
        } else {
          contractTypeLabel = finalContract.type;
        }

        setGameState(prev => ({
          ...prev,
          status: "PLAYING",
          currentContract: finalContract,
          activePlayerIdx: (prev.dealerIdx + 1) % 4, // Forehand leads first trick
          currentTrick: { id: 1, leaderId: prev.players[(prev.dealerIdx + 1) % 4].id, playedCards: [] },
          bids: newBids,
          logs: [...nextLogs, `${contractor.name} ${language === "de" ? "spielt ein" : "plays"} ${contractTypeLabel}!`],
        }));
      } else {
        // Everyone passed! Trigger Ramsch
        const ramschContract: Contract = {
          type: GameType.RAMSCH,
          declarerId: "all",
        };

        setGameState(prev => ({
          ...prev,
          status: "PLAYING",
          currentContract: ramschContract,
          activePlayerIdx: (prev.dealerIdx + 1) % 4,
          currentTrick: { id: 1, leaderId: prev.players[(prev.dealerIdx + 1) % 4].id, playedCards: [] },
          bids: newBids,
          logs: [...nextLogs, language === "de" ? "Alle weiter! Ramsch-Modus aktiv!" : "Everyone passed! Ramsch Mode Activated!"],
        }));
      }
    } else {
      setGameState(prev => ({
        ...prev,
        activePlayerIdx: nextPlayerIdx,
        bids: newBids,
        logs: nextLogs,
      }));
    }
  };

  // Human player options for Sauspiel calling suits
  const getCallableSuits = (cards: Card[]): Suit[] => {
    const callable: Suit[] = [];
    const suits = [Suit.ACORNS, Suit.LEAVES, Suit.BELLS]; // Hearts is trump
    for (const s of suits) {
      // Obers and Unters are trumps, they do not count as suit cards for calling
      const hasCards = cards.some(c => c.suit === s && c.value !== CardValue.OBER && c.value !== CardValue.UNTER);
      const hasAce = cards.some(c => c.suit === s && c.value === CardValue.ACE);
      if (hasCards && !hasAce) {
        callable.push(s);
      }
    }
    return callable;
  };

  const playCard = (playerId: string, card: Card) => {
    const activePlayer = gameState.players.find(p => p.id === playerId)!;

    // Remove card from hand
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === playerId) {
        return { ...p, cards: p.cards.filter(c => c.id !== card.id) };
      }
      return p;
    });

    // Record the player decision time
    const duration = Date.now() - turnStartTimeRef.current;

    const currentPlayed = gameState.currentTrick 
      ? [...gameState.currentTrick.playedCards, { playerId, card, durationMs: duration }] 
      : [{ playerId, card, durationMs: duration }];

    const trickId = gameState.currentTrick ? gameState.currentTrick.id : 1;
    const leaderId = gameState.currentTrick ? gameState.currentTrick.leaderId : playerId;

    const nextTrickState: Trick = {
      id: trickId,
      leaderId,
      playedCards: currentPlayed,
    };

    const cardLabel = `${getCardValueTranslated(card.value, language)} ${getCardSuitTranslated(card.suit, language)}`;
    const nextLogs = [...gameState.logs, `${activePlayer.name}: ${cardLabel}`];

    // If trick is full (4 cards played)
    if (currentPlayed.length === 4) {
      const winnerId = determineTrickWinner(currentPlayed, gameState.currentContract?.type || GameType.PASSED);
      nextTrickState.winnerId = winnerId;
      setTrickWinnerId(winnerId);
      setIsCollecting(true);

      const winnerPlayer = updatedPlayers.find(p => p.id === winnerId)!;

      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        currentTrick: nextTrickState,
        logs: [...nextLogs, `${winnerPlayer.name} ${language === "de" ? "sticht!" : "wins the trick!"}`],
      }));
    } else {
      // Advance turn order
      const nextActiveIdx = (gameState.activePlayerIdx + 1) % 4;
      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        currentTrick: nextTrickState,
        activePlayerIdx: nextActiveIdx,
        logs: nextLogs,
      }));
    }
  };

  const collectTrick = () => {
    if (!gameState.currentTrick || !trickWinnerId) return;

    const trickPoints = countPoints(gameState.currentTrick.playedCards.map(p => p.card));
    
    // Add points to trick winner
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === trickWinnerId) {
        return { ...p, pointsCollected: p.pointsCollected + trickPoints };
      }
      return p;
    });

    const completedTrick = { ...gameState.currentTrick };
    const allTricks = [...gameState.tricks, completedTrick];
    setTricksPlayed(allTricks);

    const nextTrickNum = completedTrick.id + 1;

    if (nextTrickNum > 8) {
      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        tricks: allTricks,
        currentTrick: null,
        status: "ROUND_OVER",
        logs: [...prev.logs, language === "de" ? "Spiel beendet! Punkte werden gezählt." : "Round completed! Let's tally the cards."],
      }));
    } else {
      const winnerIdx = updatedPlayers.findIndex(p => p.id === trickWinnerId);
      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        tricks: allTricks,
        currentTrick: { id: nextTrickNum, leaderId: trickWinnerId, playedCards: [] },
        activePlayerIdx: winnerIdx,
        logs: [...prev.logs, language === "de" ? `${updatedPlayers[winnerIdx].name} spielt an.` : `Next trick led by ${updatedPlayers[winnerIdx].name}.`],
      }));
    }

    setTrickWinnerId(null);
    setIsCollecting(false);
    setHasClickedInvalid(false);
  };

  // Compute final score results
  const getRoundSummary = () => {
    if (!gameState.currentContract) return { winners: [], scoreStr: "", userWon: false, details: "" };
    
    const contract = gameState.currentContract;
    const p1 = gameState.players.find(p => p.id === "p1")!; // User
    const declarer = gameState.players.find(p => p.id === contract.declarerId);

    if (contract.type === GameType.RAMSCH) {
      const sortedByPoints = [...gameState.players].sort((a, b) => a.pointsCollected - b.pointsCollected);
      const winner = sortedByPoints[0];
      const loser = sortedByPoints[3];
      const userWon = p1.id === winner.id;
      return {
        winners: [winner.id],
        scoreStr: language === "de" 
          ? `${winner.name} gewinnt Ramsch mit nur ${winner.pointsCollected} Augen!` 
          : `${winner.name} wins Ramsch with only ${winner.pointsCollected} points!`,
        userWon,
        details: language === "de"
          ? `${loser.name} hat mit ${loser.pointsCollected} Augen die meisten Punkte geholt!`
          : `${loser.name} took the loss with ${loser.pointsCollected} points!`,
      };
    }

    // Sauspiel: Partnership
    if (contract.type === GameType.SAUSPIEL && contract.partnerId) {
      const declarerTeam = [contract.declarerId, contract.partnerId];
      const defenderTeam = gameState.players.filter(p => !declarerTeam.includes(p.id)).map(p => p.id);
      
      const declarerPoints = gameState.players
        .filter(p => declarerTeam.includes(p.id))
        .reduce((sum, p) => sum + p.pointsCollected, 0);

      const defendersPoints = 120 - declarerPoints;

      const declarerTeamNames = gameState.players.filter(p => declarerTeam.includes(p.id)).map(p => p.name).join(" & ");
      const defenderTeamNames = gameState.players.filter(p => defenderTeam.includes(p.id)).map(p => p.name).join(" & ");

      const declarerTeamWon = declarerPoints >= 61;
      const winningTeamIds = declarerTeamWon ? declarerTeam : defenderTeam;
      const userWon = winningTeamIds.includes("p1");

      return {
        winners: winningTeamIds,
        scoreStr: declarerTeamWon 
          ? (language === "de" ? `Spieler haben gewonnen! (${declarerPoints} zu ${defendersPoints} Augen)` : `Declarers won! (${declarerPoints} to ${defendersPoints} pts)`)
          : (language === "de" ? `Nichtspieler haben gewonnen! (${defendersPoints} zu ${declarerPoints} Augen)` : `Defenders won! (${defendersPoints} to ${declarerPoints} pts)`),
        userWon,
        details: declarerTeamWon 
          ? (language === "de" ? `${declarerTeamNames} haben die Sau erfolgreich heimgebracht.` : `${declarerTeamNames} successfully collected the target points.`)
          : (language === "de" ? `${defenderTeamNames} haben das Spiel erfolgreich abgewehrt.` : `${defenderTeamNames} blocked the callers successfully.`),
      };
    }

    // Solo or Wenz
    const isDeclarerWon = (declarer?.pointsCollected || 0) >= 61;
    const defenders = gameState.players.filter(p => p.id !== contract.declarerId);
    
    const winningTeamIds = isDeclarerWon ? [contract.declarerId] : defenders.map(p => p.id);
    const userWon = winningTeamIds.includes("p1");

    return {
      winners: winningTeamIds,
      scoreStr: isDeclarerWon 
        ? (language === "de" ? `${declarer?.name} gewinnt Solo mit ${declarer?.pointsCollected} Augen!` : `${declarer?.name} won Solo with ${declarer?.pointsCollected} points!`)
        : (language === "de" ? `Gegenspieler haben das Solo besiegt! Soloist hatte ${declarer?.pointsCollected} Augen.` : `Defenders defeated the Solo! Declarer got ${declarer?.pointsCollected} points.`),
      userWon,
      details: isDeclarerWon 
        ? (language === "de" ? "Der Solo-Meister hat den Tisch beherrscht!" : "The solo master claimed the table.")
        : (language === "de" ? "Die Verteidigungsallianz war zu stark." : "The defending alliance was too strong to break."),
    };
  };

  const handleProcedToAnalysis = () => {
    onGameFinished(
      getRoundSummary().winners,
      gameState.players.reduce((acc, p) => ({ ...acc, [p.id]: p.pointsCollected }), {}),
      gameState.currentContract!,
      startingHand,
      tricksPlayed
    );
  };

  const activePlayer = gameState.players[gameState.activePlayerIdx];
  
  // Who is the active human player whose cards we should show
  const currentActingHumanPlayer = isMultiplayer 
    ? (activePlayer?.isHuman ? activePlayer : null)
    : gameState.players[0]; // Player 1 (user) in single player

  const callableSuits = currentActingHumanPlayer ? getCallableSuits(currentActingHumanPlayer.cards) : [];

  // Calculate legal cards for active player
  const legalUserCards = (gameState.status === "PLAYING" && currentActingHumanPlayer)
    ? getLegalCards(currentActingHumanPlayer.cards, gameState.currentTrick!, gameState.currentContract)
    : [];

  const renderCardFace = (card: Card, options: { isPlayed?: boolean; isLegal?: boolean; isActiveTurn?: boolean } = {}) => {
    const { isPlayed = false, isLegal = true, isActiveTurn = false } = options;
    const isCardTrump = gameState.currentContract 
      ? isTrump(card, gameState.currentContract.type) 
      : isTrump(card, GameType.SAUSPIEL);

    let suitBg = "from-[#111216] to-[#0d0d10]";
    let suitBorder = "border-neutral-800";
    let suitColor = "text-white";
    let suitLabelColor = "text-slate-300";

    switch (card.suit) {
      case Suit.HEARTS:
        suitColor = "text-red-500 animate-pulse-subtle";
        suitBg = "from-[#21090a] via-[#0d0d10] to-[#050508]";
        suitBorder = isCardTrump ? "border-amber-500/50" : "border-red-950/55";
        suitLabelColor = "text-red-500";
        break;
      case Suit.LEAVES:
        suitColor = "text-emerald-500";
        suitBg = "from-[#082111] via-[#0d0d10] to-[#050508]";
        suitBorder = isCardTrump ? "border-amber-500/50" : "border-emerald-950/55";
        suitLabelColor = "text-emerald-500";
        break;
      case Suit.BELLS:
        suitColor = "text-amber-500";
        suitBg = "from-[#211b08] via-[#0d0d10] to-[#050508]";
        suitBorder = isCardTrump ? "border-amber-500/50" : "border-amber-950/55";
        suitLabelColor = "text-amber-500";
        break;
      case Suit.ACORNS:
        suitColor = "text-orange-400";
        suitBg = "from-[#211408] via-[#0d0d10] to-[#050508]";
        suitBorder = isCardTrump ? "border-amber-500/50" : "border-orange-950/55";
        suitLabelColor = "text-orange-400";
        break;
    }

    const cardIcon = getSuitEmoji(card.suit);
    const isAcorn = card.suit === Suit.ACORNS;

    // MAKE CARDS MUCH MORE COMPACT FOR NO-SCROLL LAYOUT (HALF CARDS)
    const cardSizeClasses = isPlayed 
      ? "w-10 h-14 sm:w-14 sm:h-20 p-1" 
      : "w-12 h-16 sm:w-16 sm:h-22 p-1 sm:p-2"; // 20% smaller than previous for mobile fit

    const opacityClass = !isPlayed && !isLegal && isActiveTurn ? "opacity-30 filter grayscale" : "";
    const hoverClasses = !isPlayed && (isLegal || gameState.status === "BIDDING")
      ? "hover:border-emerald-500 duration-200"
      : "";

    const trumpRingClass = isCardTrump && !isPlayed
      ? "ring-1 ring-amber-500/40 shadow-amber-950/35"
      : "";

    return (
      <div
        className={`relative rounded-xl border bg-gradient-to-br ${suitBg} ${suitBorder} ${trumpRingClass} ${cardSizeClasses} ${opacityClass} ${hoverClasses} flex flex-col justify-between shadow-lg select-none overflow-hidden`}
      >
        {/* Top corner value */}
        <div className="flex justify-between items-start leading-none">
          <span className={`text-[10px] sm:text-[12px] font-black tracking-tight ${suitLabelColor}`}>
            {card.value}
          </span>
        </div>

        {/* Center icon */}
        <div className="relative flex flex-col items-center justify-center my-auto leading-none overflow-hidden">
          <span className={`text-sm sm:text-lg filter drop-shadow-sm ${suitColor} ${isAcorn ? "rotate-180 inline-block" : ""}`}>
            {cardIcon}
          </span>
        </div>

        {/* Bottom corner value flipped */}
        <div className="flex justify-between items-end rotate-180 leading-none">
          <span className={`text-[10px] sm:text-[12px] font-black tracking-tight ${suitLabelColor}`}>
            {card.value}
          </span>
        </div>
      </div>
    );
  };

  const isPartnerRevealed = () => {
    if (!gameState.currentContract || gameState.currentContract.type !== GameType.SAUSPIEL) return false;
    const contract = gameState.currentContract;
    
    // Check if called Ace has been played in previous tricks
    const aceInPrevTricks = gameState.tricks.some(t =>
      t.playedCards.some(pc =>
        pc.card.suit === contract.calledSuit && pc.card.value === CardValue.ACE
      )
    );
    
    // Check if called Ace has been played in current trick
    const aceInCurrentTrick = gameState.currentTrick?.playedCards.some(pc =>
      pc.card.suit === contract.calledSuit && pc.card.value === CardValue.ACE
    ) || false;
    
    return aceInPrevTricks || aceInCurrentTrick;
  };

  const renderPlayerRoleBadge = (player: Player) => {
    if (!gameState.currentContract) return null;
    const contract = gameState.currentContract;

    const getSuitIcon = (suit?: Suit) => {
      switch (suit) {
        case Suit.ACORNS: return <span className="inline-block rotate-180">🌰</span>;
        case Suit.LEAVES: return "🍃";
        case Suit.HEARTS: return "❤️";
        case Suit.BELLS: return "🔔";
        default: return "";
      }
    };

    if (contract.type === GameType.SAUSPIEL) {
      if (player.id === contract.declarerId) {
        return (
          <span className="text-[7.5px] font-black uppercase px-1 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded tracking-wider scale-90 flex items-center gap-1">
            {language === "de" ? "Ansager" : "Caller"} {getSuitIcon(contract.calledSuit)}
          </span>
        );
      }
      if (player.id === contract.partnerId) {
        // Only show if it is the user themselves (since they know their cards) or if revealed
        const isMe = isMultiplayer ? (activePlayer?.id === player.id) : (player.id === "p1");
        if (isMe || isPartnerRevealed()) {
          return (
            <span className="text-[7.5px] font-black uppercase px-1 py-0.2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded tracking-wider scale-90 flex items-center gap-1">
              {language === "de" ? "Gerufen" : "Called"} {getSuitIcon(contract.calledSuit)}
            </span>
          );
        }
      }
    } else if (contract.type === GameType.RAMSCH) {
      return (
        <span className="text-[7.5px] font-black uppercase px-1 py-0.2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded tracking-wider scale-90">
          Ramsch
        </span>
      );
    } else if (contract.type !== GameType.PASSED) {
      if (player.id === contract.declarerId) {
        let suitIcon = "";
        if (contract.type.startsWith("SOLO_")) {
          const suit = contract.type.replace("SOLO_", "") as Suit;
          suitIcon = getSuitIcon(suit);
        } else if (contract.type === GameType.WENZ && contract.wenzSuit) {
          suitIcon = getSuitIcon(contract.wenzSuit);
        }
        
        const label = contract.type === GameType.WENZ ? "Wenz" : "Solo";
        const isToutLabel = contract.isTout ? " (Tout)" : "";
        return (
          <span className="text-[7.5px] font-black uppercase px-1 py-0.2 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded tracking-wider scale-90 flex items-center gap-1">
            {label}{isToutLabel} {suitIcon}
          </span>
        );
      }
    }
    return null;
  };

  return (
    <div className="w-full h-full max-h-screen flex flex-col justify-between p-2 sm:p-4 select-none overflow-hidden text-left relative">
      
      {/* Full Screen Menu Modal Backdrop & Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            key="menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
            onClick={() => {
              setIsMenuOpen(false);
              setConfirmRestart(false);
            }}
          >
            {/* Side Menu Panel Drawer */}
            <motion.div
              key="menu-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
              className="w-64 h-full bg-[#0d0d10] border-l border-neutral-850 p-5 flex flex-col justify-between shadow-2xl"
              onClick={(e) => e.stopPropagation()} // Prevent close on click inside
            >
              {/* Top section */}
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                    {language === "de" ? "Spiel-Optionen" : "Game Settings"}
                  </span>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setConfirmRestart(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2 text-left">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onShowRules();
                    }}
                    className="w-full text-left py-2.5 px-3 rounded-xl text-xs font-bold text-slate-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-all border border-neutral-850/50 bg-neutral-950/30"
                  >
                    <HelpCircle className="h-4 w-4 text-emerald-400" />
                    {t.rules}
                  </button>

                  {/* Mid-game Settings selectors inside the options menu */}
                  <div className="space-y-3.5 border-t border-neutral-850/50 pt-4 mt-2 text-left">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
                        {language === "de" ? "Spielstärke (KI)" : "Difficulty (AI)"}
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-850">
                        <button
                          onClick={() => setLocalDifficulty(Difficulty.EASY)}
                          className={`py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            localDifficulty === Difficulty.EASY
                              ? "bg-violet-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {language === "de" ? "G'sell" : "Easy"}
                        </button>
                        <button
                          onClick={() => setLocalDifficulty(Difficulty.MEDIUM)}
                          className={`py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            localDifficulty === Difficulty.MEDIUM
                              ? "bg-violet-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {language === "de" ? "Meister" : "Med"}
                        </button>
                        <button
                          onClick={() => setLocalDifficulty(Difficulty.HARD)}
                          className={`py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            localDifficulty === Difficulty.HARD
                              ? "bg-violet-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {language === "de" ? "Expert" : "Hard"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
                        {language === "de" ? "Geschwindigkeit" : "Deal Speed"}
                      </label>
                      <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-850">
                        <button
                          onClick={() => setLocalDealSpeed(DealSpeed.SLOW)}
                          className={`py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            localDealSpeed === DealSpeed.SLOW
                              ? "bg-amber-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {language === "de" ? "Lang" : "Slow"}
                        </button>
                        <button
                          onClick={() => setLocalDealSpeed(DealSpeed.MEDIUM)}
                          className={`py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            localDealSpeed === DealSpeed.MEDIUM
                              ? "bg-amber-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {language === "de" ? "Mit" : "Med"}
                        </button>
                        <button
                          onClick={() => setLocalDealSpeed(DealSpeed.FAST)}
                          className={`py-1 rounded text-[9px] font-black uppercase transition-all cursor-pointer ${
                            localDealSpeed === DealSpeed.FAST
                              ? "bg-amber-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          {language === "de" ? "Schnell" : "Fast"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom inline confirmation button for safe iframe-compatible restart! */}
                  {!confirmRestart ? (
                    <button
                      onClick={() => setConfirmRestart(true)}
                      className="w-full text-left py-2.5 px-3 rounded-xl text-xs font-bold text-slate-200 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-all border border-neutral-850/50 bg-neutral-950/30"
                    >
                      <RefreshCw className="h-4 w-4 text-amber-400" />
                      {language === "de" ? "Runde Neustarten" : "Restart Round"}
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/10 border border-amber-500/20 text-center space-y-2">
                      <p className="text-[10px] font-bold text-amber-400 leading-tight">
                        {language === "de" ? "Bist du sicher? Fortschritt dieser Runde geht verloren!" : "Are you sure? Current round progress will be lost!"}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setConfirmRestart(false);
                            setIsMenuOpen(false);
                            initGame();
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-[10px] font-black text-slate-950 cursor-pointer transition-all shadow-sm"
                        >
                          {language === "de" ? "Ja, Neustart" : "Yes, Restart"}
                        </button>
                        <button
                          onClick={() => setConfirmRestart(false)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] cursor-pointer transition-all"
                        >
                          {language === "de" ? "Nein" : "No"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom section (Back to Menu) */}
              {onBackToMenu && (
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setConfirmRestart(false);
                    onBackToMenu();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-black text-rose-400 hover:bg-rose-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all border border-rose-950/10 bg-rose-950/5 mt-auto"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {language === "de" ? "Spiel beenden" : "Quit Game"}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D-Like Bavarian Card Table Grid - Flexible Height */}
      <div className="relative h-[55dvh] sm:h-[60dvh] min-h-0 w-full rounded-2xl bg-gradient-to-b from-[#101b15] to-[#040806] border border-emerald-950 p-2 sm:p-4 flex flex-col justify-between overflow-hidden shadow-2xl flex-1">
        
        {/* Ambient table grain overlay */}
        <div className="absolute inset-0 bg-radial from-transparent to-[#020403]/90 pointer-events-none" />

        {/* Tiny Floating Menu controls on the table (replaces the bulky top bar) */}
        <div className="absolute top-2 right-2 z-40 flex gap-1.5">
          {/* Last Trick / Last Thrown Cards Button */}
          {gameState.tricks.length > 0 && (
            <button
              onClick={() => setShowLastTrickModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-amber-400 hover:text-amber-300 transition-all hover:bg-neutral-900 cursor-pointer shadow-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
              title={language === "de" ? "Letzter Stich" : "Last Trick"}
            >
              <Eye className="h-3.5 w-3.5 text-amber-400" />
              {language === "de" ? "Letzter Stich" : "Last Trick"}
            </button>
          )}

          <button
            onClick={() => {
              setConfirmRestart(false);
              setIsMenuOpen(prev => !prev);
            }}
            className="p-2 rounded-xl bg-neutral-950/80 border border-neutral-800 text-slate-300 hover:text-white transition-all hover:bg-neutral-900 cursor-pointer shadow-md"
            title="Menu Options"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>


        {/* Trick Collector floating notification - moves smoothly to the winning seat */}
        {isCollecting && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-35 animate-pulse bg-amber-500 text-slate-950 font-black text-[10px] px-4 py-2 rounded-full shadow-2xl flex items-center gap-1.5 border border-amber-400/30 whitespace-nowrap">
            <span>
              {language === "de" 
                ? `Stich geht an ${gameState.players.find(p => p.id === trickWinnerId)?.name || "Gewinner"}` 
                : `Trick goes to ${gameState.players.find(p => p.id === trickWinnerId)?.name || "Winner"}`}
            </span>
          </div>
        )}

        {/* Seats Grid */}
        <div className="relative flex-1 grid grid-cols-3 grid-rows-3 gap-1 w-full h-full z-10 pt-1 sm:pt-2">
          
          {/* North Seat (Opponent AI 2) */}
          <div className="col-start-2 row-start-1 flex flex-col items-center text-center justify-self-center">
            {gameState.players[2] && (
              <div className="space-y-1">
                <div className={`px-2.5 py-1 rounded-xl border text-center transition-all ${
                  gameState.activePlayerIdx === 2
                    ? "bg-emerald-950/40 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] text-white"
                    : "bg-[#0d0d10]/65 border-neutral-850/60 text-neutral-300"
                }`}>
                  <div className="text-[9px] font-extrabold flex items-center justify-center gap-1">
                    {gameState.activePlayerIdx === 2 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
                    <span>{gameState.players[2].name}</span>
                    {renderPlayerRoleBadge(gameState.players[2])}
                  </div>
                  {showPointsDuringGame && (
                    <div className="text-[8px] text-neutral-400 font-bold mt-0.5">
                      {gameState.players[2].pointsCollected} {language === "de" ? "Augen" : "Pts"}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 justify-center">
                  {gameState.players[2].cards.map((_, idx) => (
                    <div key={idx} className="w-1.5 h-2.5 bg-gradient-to-br from-red-800 to-red-950 rounded-xs border border-red-950 shadow" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* West Seat (Opponent AI 1) */}
          <div className="col-start-1 row-start-2 flex items-center justify-self-start text-left gap-1 pl-1">
            {gameState.players[1] && (
              <div className="space-y-1">
                <div className={`px-2.5 py-1 rounded-xl border text-left transition-all ${
                  gameState.activePlayerIdx === 1
                    ? "bg-emerald-950/40 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] text-white"
                    : "bg-[#0d0d10]/65 border-neutral-850/60 text-neutral-300"
                }`}>
                  <div className="text-[9px] font-extrabold flex items-center gap-1">
                    {gameState.activePlayerIdx === 1 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
                    <span>{gameState.players[1].name}</span>
                    {renderPlayerRoleBadge(gameState.players[1])}
                  </div>
                  {showPointsDuringGame && (
                    <div className="text-[8px] text-neutral-400 font-bold mt-0.5">
                      {gameState.players[1].pointsCollected} {language === "de" ? "Augen" : "Pts"}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 mt-0.5 justify-start">
                  {gameState.players[1].cards.map((_, idx) => (
                    <div key={idx} className="w-1.5 h-2.5 bg-gradient-to-br from-red-800 to-red-950 rounded-xs border border-red-950 shadow" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trick Arena in the center */}
          <div className="col-start-2 row-start-2 flex items-center justify-center relative">
            <AnimatePresence>
              {gameState.currentTrick && gameState.currentTrick.playedCards.map((played) => {
                let rx = 0;
                let ry = 0;
                let rot = 0;
                if (played.playerId === "p1") { ry = 35; rot = 0; } // South
                if (played.playerId === "p2") { rx = -45; rot = -15; } // West
                if (played.playerId === "p3") { ry = -35; rot = 5; } // North
                if (played.playerId === "p4") { rx = 45; rot = 15; } // East

                const isWinner = trickWinnerId === played.playerId;

                // Dynamic flight path exit animation coordinates to fly directly towards winner's seat!
                let exitTarget = { scale: 0.1, opacity: 0, x: 0, y: 0, rotate: rot };
                if (trickWinnerId === "p1") exitTarget = { scale: 0.1, opacity: 0, x: 0, y: 150, rotate: rot }; // South seat
                if (trickWinnerId === "p2") exitTarget = { scale: 0.1, opacity: 0, x: -150, y: 0, rotate: rot }; // West seat
                if (trickWinnerId === "p3") exitTarget = { scale: 0.1, opacity: 0, x: 0, y: -150, rotate: rot }; // North seat
                if (trickWinnerId === "p4") exitTarget = { scale: 0.1, opacity: 0, x: 150, y: 0, rotate: rot }; // East seat

                return (
                  <motion.div
                    key={played.card.id}
                    initial={{ scale: 0.6, opacity: 0, x: 0, y: 0, rotate: 0 }}
                    animate={{ scale: 1, opacity: 1, x: rx, y: ry, rotate: rot }}
                    exit={exitTarget}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={`absolute rounded-xl shadow-2xl z-20 ${
                      isWinner ? "ring-2 ring-amber-500 shadow-amber-500/30 scale-105" : ""
                    }`}
                  >
                    {renderCardFace(played.card, { isPlayed: true })}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* East Seat (Opponent AI 3) */}
          <div className="col-start-3 row-start-2 flex items-center justify-self-end text-right gap-1 pr-1">
            {gameState.players[3] && (
              <div className="space-y-1">
                <div className={`px-2.5 py-1 rounded-xl border text-right transition-all ${
                  gameState.activePlayerIdx === 3
                    ? "bg-emerald-950/40 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] text-white"
                    : "bg-[#0d0d10]/65 border-neutral-850/60 text-neutral-300"
                }`}>
                  <div className="text-[9px] font-extrabold flex items-center justify-end gap-1">
                    {gameState.activePlayerIdx === 3 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />}
                    <span>{gameState.players[3].name}</span>
                    {renderPlayerRoleBadge(gameState.players[3])}
                  </div>
                  {showPointsDuringGame && (
                    <div className="text-[8px] text-neutral-400 font-bold mt-0.5">
                      {gameState.players[3].pointsCollected} {language === "de" ? "Augen" : "Pts"}
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5 justify-end mt-0.5">
                  {gameState.players[3].cards.map((_, idx) => (
                    <div key={idx} className="w-1.5 h-2.5 bg-gradient-to-br from-red-800 to-red-950 rounded-xs border border-red-950 shadow" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* South Seat (Omitted from table to make space for the fanned cards) */}
          <div className="col-start-2 row-start-3" />

        </div>

        {/* ELEGANT MODAL POPUP FOR DECLARATION/BIDDING (Centered on the table!) */}
        <AnimatePresence>
          {gameState.status === "BIDDING" && activePlayer?.isHuman && isHandRevealed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-35 bg-[#121318]/95 backdrop-blur-md border border-emerald-900/50 p-4 rounded-2xl shadow-2xl text-center space-y-3.5 max-w-sm mx-auto"
            >
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest block">{activePlayer.name}</span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {biddingStage === "category" && (language === "de" ? "Ansage wählen:" : "Select Game Category:")}
                  {biddingStage === "sauspiel" && (language === "de" ? "Rufspiel-As wählen:" : "Choose Partner Ace:")}
                  {biddingStage === "solo" && (language === "de" ? "Solo-Farbe wählen:" : "Choose Solo Trump Suit:")}
                  {biddingStage === "wenz_options" && (language === "de" ? "Wenz-Optionen wählen:" : "Choose Wenz Option:")}
                  {biddingStage === "wenz_color" && (language === "de" ? "Wenz-Farbe wählen:" : "Choose Wenz Suit:")}
                </h3>
              </div>

              {biddingStage === "category" && (
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Pass option */}
                  <button
                    onClick={() => handleBidSelection(activePlayer.id, null)}
                    className="col-span-2 rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 text-xs font-black text-slate-300 hover:bg-neutral-900 cursor-pointer transition-all"
                  >
                    {language === "de" ? "Passen / Weiter" : "Pass (Weiter)"}
                  </button>

                  {/* Sauspiel option button (advances stage) */}
                  <button
                    onClick={() => setBiddingStage("sauspiel")}
                    className="rounded-xl border border-emerald-900/40 bg-emerald-950/80 hover:bg-emerald-900/40 py-2.5 text-xs font-black text-emerald-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    <span>{language === "de" ? "Rufspiel" : "Call Ace"}</span>
                  </button>

                  {/* Solo option button (advances stage) */}
                  <button
                    onClick={() => setBiddingStage("solo")}
                    className="rounded-xl border border-rose-900/40 bg-rose-950/80 hover:bg-rose-900/40 py-2.5 text-xs font-black text-rose-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    <span>Solo</span>
                  </button>

                  {/* Wenz option */}
                  <button
                    onClick={() => {
                      setWenzIsTout(false);
                      setBiddingStage("wenz_options");
                    }}
                    className="col-span-2 rounded-xl border border-amber-900/40 bg-amber-950/80 hover:bg-amber-900/40 py-2.5 text-xs font-black text-amber-400 cursor-pointer transition-all"
                  >
                    Wenz
                  </button>
                </div>
              )}

              {biddingStage === "sauspiel" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[Suit.ACORNS, Suit.LEAVES, Suit.BELLS].map((suit) => {
                      const isValid = callableSuits.includes(suit);
                      
                      const getLocalSuitName = (s: Suit) => {
                        switch (s) {
                          case Suit.ACORNS: return language === "de" ? "Eichel" : "Acorns";
                          case Suit.LEAVES: return language === "de" ? "Gras" : "Leaves";
                          case Suit.BELLS: return language === "de" ? "Schellen" : "Bells";
                          default: return "";
                        }
                      };

                      return (
                        <button
                          key={suit}
                          disabled={!isValid}
                          onClick={() => {
                            if (isValid) {
                              handleBidSelection(activePlayer.id, { type: GameType.SAUSPIEL, calledSuit: suit });
                            }
                          }}
                          className={`rounded-xl border py-2.5 text-xs font-black transition-all flex items-center justify-center gap-1 ${
                            isValid
                              ? "border-emerald-900/40 bg-emerald-950/80 hover:bg-emerald-900/40 text-emerald-400 cursor-pointer"
                              : "border-neutral-800 bg-neutral-950 text-neutral-600 opacity-45 cursor-not-allowed"
                          }`}
                        >
                          <span>{language === "de" ? "Rufspiel" : "Call"} {getLocalSuitName(suit)} As</span> {suit === Suit.ACORNS ? <span className="inline-block rotate-180">🌰</span> : getSuitEmoji(suit)}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setBiddingStage("category")}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 py-2 text-[10px] font-black uppercase text-neutral-400 cursor-pointer transition-all"
                  >
                    {language === "de" ? "Zurück" : "Back"}
                  </button>
                </div>
              )}

              {biddingStage === "solo" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Heart Solo */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.SOLO_HEARTS })}
                      className="rounded-xl border border-red-900/40 bg-red-950/80 hover:bg-red-900/40 py-2.5 text-xs font-black text-red-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Herz" : "Hearts"}</span> ❤️
                    </button>

                    {/* Acorn Solo */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.SOLO_ACORNS })}
                      className="rounded-xl border border-amber-900/40 bg-amber-950/80 hover:bg-amber-900/40 py-2.5 text-xs font-black text-amber-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Eichel" : "Acorns"}</span> <span className="inline-block rotate-180">🌰</span>
                    </button>

                    {/* Grass Solo */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.SOLO_LEAVES })}
                      className="rounded-xl border border-emerald-900/40 bg-emerald-950/80 hover:bg-emerald-900/40 py-2.5 text-xs font-black text-emerald-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Gras" : "Leaves"}</span> 🍃
                    </button>

                    {/* Bells Solo */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.SOLO_BELLS })}
                      className="rounded-xl border border-yellow-900/40 bg-yellow-950/80 hover:bg-yellow-900/40 py-2.5 text-xs font-black text-yellow-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Schellen" : "Bells"}</span> 🔔
                    </button>
                  </div>

                  <button
                    onClick={() => setBiddingStage("category")}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 py-2 text-[10px] font-black uppercase text-neutral-400 cursor-pointer transition-all"
                  >
                    {language === "de" ? "Zurück" : "Back"}
                  </button>
                </div>
              )}

              {biddingStage === "wenz_options" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Colorless Wenz button */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.WENZ, isTout: wenzIsTout })}
                      className="rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 py-2.5 text-xs font-black text-slate-300 cursor-pointer transition-all flex flex-col items-center justify-center"
                    >
                      <span>{language === "de" ? "Farblos" : "Colorless"}</span>
                      <span className="text-[9px] font-semibold text-neutral-500">{language === "de" ? "(Normaler Wenz)" : "(Standard Wenz)"}</span>
                    </button>

                    {/* Color Wenz button */}
                    <button
                      onClick={() => setBiddingStage("wenz_color")}
                      className="rounded-xl border border-amber-900/40 bg-amber-950/80 hover:bg-amber-900/40 py-2.5 text-xs font-black text-amber-400 cursor-pointer transition-all flex flex-col items-center justify-center"
                    >
                      <span>{language === "de" ? "Farbe wählen" : "Choose Color"}</span>
                      <span className="text-[9px] font-semibold text-amber-500/70">{language === "de" ? "(Farb-Wenz)" : "(Suit Wenz)"}</span>
                    </button>

                    {/* Tout Toggle Button */}
                    <button
                      onClick={() => setWenzIsTout(prev => !prev)}
                      className={`col-span-2 rounded-xl border py-2.5 text-xs font-black transition-all flex items-center justify-center gap-2 ${
                        wenzIsTout 
                          ? "border-rose-900 bg-rose-950/70 text-rose-400 font-extrabold shadow-[0_0_12px_rgba(244,63,94,0.2)] animate-pulse" 
                          : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-400"
                      }`}
                    >
                      🏆 <span>{language === "de" ? "Spiele TOUT (alle Stiche)" : "Play TOUT (all tricks)"}</span>
                      {wenzIsTout && <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 bg-rose-950/40 px-1 rounded">ON</span>}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setWenzIsTout(false);
                      setBiddingStage("category");
                    }}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 py-2 text-[10px] font-black uppercase text-neutral-400 cursor-pointer transition-all"
                  >
                    {language === "de" ? "Zurück" : "Back"}
                  </button>
                </div>
              )}

              {biddingStage === "wenz_color" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {/* Acorns Wenz */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.WENZ, wenzSuit: Suit.ACORNS, isTout: wenzIsTout })}
                      className="rounded-xl border border-amber-900/40 bg-amber-950/80 hover:bg-amber-900/40 py-2.5 text-xs font-black text-amber-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Eichel" : "Acorns"}</span> <span className="inline-block rotate-180">🌰</span>
                    </button>

                    {/* Leaves Wenz */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.WENZ, wenzSuit: Suit.LEAVES, isTout: wenzIsTout })}
                      className="rounded-xl border border-emerald-900/40 bg-emerald-950/80 hover:bg-emerald-900/40 py-2.5 text-xs font-black text-emerald-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Gras" : "Leaves"}</span> 🍃
                    </button>

                    {/* Hearts Wenz */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.WENZ, wenzSuit: Suit.HEARTS, isTout: wenzIsTout })}
                      className="rounded-xl border border-red-900/40 bg-red-950/80 hover:bg-red-900/40 py-2.5 text-xs font-black text-red-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Herz" : "Hearts"}</span> ❤️
                    </button>

                    {/* Bells Wenz */}
                    <button
                      onClick={() => handleBidSelection(activePlayer.id, { type: GameType.WENZ, wenzSuit: Suit.BELLS, isTout: wenzIsTout })}
                      className="rounded-xl border border-yellow-900/40 bg-yellow-950/80 hover:bg-yellow-900/40 py-2.5 text-xs font-black text-yellow-400 cursor-pointer transition-all flex items-center justify-center gap-1"
                    >
                      <span>{language === "de" ? "Schellen" : "Bells"}</span> 🔔
                    </button>
                  </div>

                  <button
                    onClick={() => setBiddingStage("wenz_options")}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 py-2 text-[10px] font-black uppercase text-neutral-400 cursor-pointer transition-all"
                  >
                    {language === "de" ? "Zurück" : "Back"}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Round Tally Overlay (Fitted inside central area) */}
      <AnimatePresence>
        {gameState.status === "ROUND_OVER" && (() => {
          const limit = gamesPerList || 12;
          const isListCompleted = gamesPlayedInList >= limit;

          // Find the list champion and standings sorted
          const sortedListStandings = [...gameState.players].map(p => ({
            id: p.id,
            name: p.name,
            total: listStandings[p.id] || 0
          })).sort((a, b) => b.total - a.total);

          const listWinnerName = sortedListStandings[0]?.name;
          const listWinnerScore = sortedListStandings[0]?.total;

          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-neutral-800 bg-[#0d0d10] p-4 shadow-2xl text-center space-y-3 z-30 max-w-sm mx-auto"
            >
              {isListCompleted ? (
                <div className="space-y-1.5 text-center">
                  <Trophy className="h-9 w-9 text-amber-400 mx-auto animate-bounce" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {language === "de" ? "Liste beendet!" : "List Completed!"}
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    {language === "de"
                      ? `${limit} von ${limit} Spielen absolviert.`
                      : `${limit} of ${limit} games played.`}
                  </p>
                  <p className="text-xs font-black text-amber-400 uppercase tracking-wide">
                    👑 {listWinnerName} ({listWinnerScore >= 0 ? "+" : ""}{listWinnerScore} {language === "de" ? "Punkte" : "pts"})
                  </p>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <Trophy className="h-7 w-7 text-amber-500 mx-auto" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    {language === "de" ? `Spiel ${gamesPlayedInList} von ${limit}` : `Game ${gamesPlayedInList} of ${limit}`}
                  </h3>
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-wide leading-tight mt-1">
                    {getRoundSummary().scoreStr}
                  </p>
                  <p className="text-[9px] text-slate-400 max-w-xs mx-auto leading-normal">
                    {getRoundSummary().details}
                  </p>
                </div>
              )}

              {/* Standing List showing changes & cumulative totals */}
              <div className="bg-[#07080b] rounded-xl p-2.5 border border-neutral-850 max-w-xs mx-auto space-y-1.5 text-left">
                <span className="text-[8px] font-black uppercase text-neutral-500 tracking-wider block border-b border-neutral-850/50 pb-1">
                  {isListCompleted
                    ? (language === "de" ? "Endstand der Liste" : "Final List Standings")
                    : (language === "de" ? "Aktueller Listenstand" : "Current List Standings")}
                </span>
                <div className="grid grid-cols-1 gap-1 text-[10px] font-bold">
                  {(isListCompleted ? sortedListStandings : gameState.players).map(p => {
                    const totalScore = listStandings[p.id] || 0;
                    const changeScore = lastRoundScoreChange[p.id] || 0;
                    return (
                      <div key={p.id} className="flex justify-between items-center py-0.5">
                        <span className="text-slate-400">{p.name}:</span>
                        <div className="flex items-center gap-2">
                          {!isListCompleted && (
                            <span className={`text-[8.5px] font-extrabold ${changeScore > 0 ? "text-emerald-500" : changeScore < 0 ? "text-rose-500" : "text-neutral-500"}`}>
                              {changeScore > 0 ? "+" : ""}{changeScore}
                            </span>
                          )}
                          <span className={`font-black ${totalScore > 0 ? "text-emerald-400" : totalScore < 0 ? "text-rose-400" : "text-neutral-300"}`}>
                            {totalScore >= 0 ? "+" : ""}{totalScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 justify-center max-w-xs mx-auto pt-1">
                {isListCompleted ? (
                  <button
                    onClick={() => {
                      setListStandings({ p1: 0, p2: 0, p3: 0, p4: 0 });
                      setGamesPlayedInList(0);
                      initGame();
                    }}
                    className="flex-1 rounded-xl border border-amber-950/30 bg-amber-950/80 text-amber-400 py-2.5 text-[9px] font-black uppercase tracking-wider hover:bg-amber-900 transition-all cursor-pointer"
                  >
                    {language === "de" ? "Neue Liste" : "New List"}
                  </button>
                ) : (
                  <button
                    onClick={initGame}
                    className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 py-2.5 text-[9px] font-black uppercase text-slate-300 hover:bg-neutral-900 transition-all cursor-pointer"
                  >
                    {language === "de" ? "Nächstes Spiel" : "Play Next"}
                  </button>
                )}

                <button
                  onClick={handleProcedToAnalysis}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-550 text-white font-black text-[9px] py-2.5 uppercase tracking-wider transition-all flex items-center justify-center gap-0.5 cursor-pointer shadow-lg"
                >
                  {language === "de" ? "Spielanalyse" : "Get Coaching"}
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Human Player Hand Controls */}
      {(gameState.status === "PLAYING" || gameState.status === "BIDDING") && (
        <div className="space-y-1 flex-shrink-0">
          
          {/* HAND CONCEALMENT SHIELD (For zero-server Pass & Play card safety) */}
          <AnimatePresence mode="wait">
            {!isHandRevealed ? (
              <motion.div
                key="handover"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="rounded-2xl border border-amber-950/30 bg-[#121318]/95 p-3.5 flex flex-col items-center justify-center space-y-2.5 shadow-xl max-w-md mx-auto"
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-amber-500/10 p-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-left leading-none">
                    <span className="text-[8px] font-black uppercase text-amber-500 block">{language === "de" ? "Sichtschutz aktiv" : "Pass & Play Hand Concealment"}</span>
                    <h4 className="text-xs font-black text-white mt-0.5">
                      {language === "de" ? `Gerät an ${activePlayer?.name} übergeben!` : `Pass device to ${activePlayer?.name}!`}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setIsHandRevealed(true)}
                  className="w-full sm:w-auto px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {language === "de" ? `Ich bin ${activePlayer?.name} (Karten zeigen)` : `I am ${activePlayer?.name} (Show cards)`}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="realhand"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1.5"
              >
                           {/* Overlapping Card Fan - Rendered as elegant "Half Cards" fanned to avoid scrolling */}
                <div className={`relative flex flex-col items-center justify-center gap-1.5 py-2 px-4 rounded-2xl border transition-all duration-300 shadow-inner overflow-visible min-h-[90px] ${
                  gameState.status === "PLAYING" && (isMultiplayer ? activePlayer?.isHuman : gameState.activePlayerIdx === 0)
                    ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] bg-emerald-950/10 animate-pulse"
                    : "border-neutral-850 bg-[#0d0d10]/40"
                }`}>
                  {/* Left Side: Player Info/Points Badge & Contra Call Button */}
                  {currentActingHumanPlayer && (
                    <div className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-start gap-1.5 select-none max-w-[120px] sm:max-w-[160px]">
                      {/* Name & Points Badge */}
                      <div className="flex items-center gap-1.5 bg-[#0d0d10]/90 border border-neutral-800 px-2 py-1 rounded-xl shadow backdrop-blur-xs text-[9px] font-black leading-none uppercase tracking-wider text-left">
                        <span className="text-white truncate max-w-[50px] sm:max-w-[80px]">{currentActingHumanPlayer.name}</span>
                        {renderPlayerRoleBadge(currentActingHumanPlayer)}
                        {showPointsDuringGame && (
                          <span className="text-emerald-400 font-extrabold border-l border-neutral-800/80 pl-1.5">
                            {currentActingHumanPlayer.pointsCollected} {language === "de" ? "Augen" : "Pts"}
                          </span>
                        )}
                      </div>

                      {/* Contra Button */}
                      {(() => {
                        const userHasPlayed = gameState.tricks.some(t => t.playedCards.some(pc => pc.playerId === "p1")) ||
                          (gameState.currentTrick?.playedCards.some(pc => pc.playerId === "p1") ?? false);

                        const canDeclareContra = 
                          gameState.status === "PLAYING" &&
                          gameState.currentContract &&
                          gameState.currentContract.type !== GameType.RAMSCH &&
                          gameState.currentContract.declarerId !== "p1" &&
                          gameState.currentContract.partnerId !== "p1" &&
                          !userHasPlayed &&
                          !gameState.currentContract.isContra;

                        if (!canDeclareContra) return null;

                        return (
                          <button
                            onClick={() => {
                              setGameState(prev => {
                                  if (!prev.currentContract) return prev;
                                  return {
                                    ...prev,
                                    currentContract: {
                                      ...prev.currentContract,
                                      isContra: true
                                    },
                                    logs: [...prev.logs, language === "de" ? "Du gibst KONTRA! (Doppelte Punkte)" : "You call CONTRA! (Double Points)"]
                                  };
                                });
                            }}
                            className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] uppercase tracking-wider cursor-pointer shadow border border-rose-500/30 flex items-center gap-1 leading-none shrink-0"
                          >
                            📢 {language === "de" ? "Kontra" : "Contra"}
                          </button>
                        );
                      })()}
                    </div>
                  )}

                  <div className="flex justify-center -space-x-4 sm:-space-x-5 py-1 w-full items-center overflow-visible pr-4 pl-32 sm:pl-40">
                    {currentActingHumanPlayer && (() => {
                      const activeGameType = gameState?.currentContract?.type || GameType.SAUSPIEL;
                      const activeWenzSuit = gameState?.currentContract?.wenzSuit;
                      const sortedHandCards = [...currentActingHumanPlayer.cards].sort((a, b) => {
                        const aTrump = isTrump(a, activeGameType, activeWenzSuit);
                        const bTrump = isTrump(b, activeGameType, activeWenzSuit);
                        
                        // 1. Trump vs Non-Trump: Trump to the left (highest rank)
                        if (aTrump && !bTrump) return -1;
                        if (!aTrump && bTrump) return 1;
                        
                        // 2. Both Trump: sort highest to lowest using getCardRank
                        if (aTrump && bTrump) {
                          return getCardRank(b, activeGameType, activeWenzSuit) - getCardRank(a, activeGameType, activeWenzSuit);
                        }
                        
                        // 3. Both Non-Trump: sort by color/suit first, then by rank highest to lowest
                        // Suit order for non-trumps: Acorns (🌰) > Leaves (🍃) > Hearts (❤️) > Bells (🔔)
                        const suitOrder = { [Suit.ACORNS]: 0, [Suit.LEAVES]: 1, [Suit.HEARTS]: 2, [Suit.BELLS]: 3 };
                        if (a.suit !== b.suit) {
                          return suitOrder[a.suit] - suitOrder[b.suit];
                        }
                        
                        return getCardRank(b, activeGameType, activeWenzSuit) - getCardRank(a, activeGameType, activeWenzSuit);
                      });

                      const totalCards = sortedHandCards.length;
                      return sortedHandCards.map((card, index) => {
                        const isActiveTurn = gameState.status === "PLAYING" && (isMultiplayer ? activePlayer?.isHuman && activePlayer?.id === currentActingHumanPlayer?.id : gameState.activePlayerIdx === 0);
                        const isLegal = gameState.status === "BIDDING" || (gameState.status === "PLAYING" && legalUserCards.some(lc => lc.id === card.id));
                        
                        // Always enabled by default, disabled only if an invalid card was clicked
                        const isVisuallyDisabled = gameState.status === "PLAYING" && isActiveTurn && hasClickedInvalid && !isLegal;
                        const canDragOrClick = gameState.status === "PLAYING" && isActiveTurn;

                        // Calculate natural fan rotation & vertical offsets
                        const midIndex = (totalCards - 1) / 2;
                        const rotateVal = totalCards > 1 ? (index - midIndex) * 3 : 0; // slight curve -9deg to +9deg
                        const yOffset = totalCards > 1 ? Math.abs(index - midIndex) * 1.5 : 0; // slight curved height offset

                        const handlePlayAttempt = () => {
                          if (isLegal) {
                            playCard(currentActingHumanPlayer.id, card);
                            if (isMultiplayer) {
                              setIsHandRevealed(false);
                            }
                          } else {
                            setHasClickedInvalid(true);
                            setGameState(prev => ({
                              ...prev,
                              logs: [...prev.logs, language === "de" 
                                ? `Ungültige Karte! Du musst die Farbe bedienen.` 
                                : `Invalid card! You must follow suit or play trump.`]
                            }));
                          }
                        };

                        return (
                          <motion.div
                            key={card.id}
                            drag={canDragOrClick ? true : false}
                            dragConstraints={{ top: -350, bottom: 80, left: -150, right: 150 }}
                            dragElastic={0.65}
                            dragSnapToOrigin={true}
                            onDragEnd={(event, info) => {
                              // If dragged far enough upward or flicked with sufficient upward speed, play/attempt the card
                              if (canDragOrClick && (info.offset.y < -95 || (info.offset.y < -50 && info.velocity.y < -200))) {
                                handlePlayAttempt();
                              }
                            }}
                            onClick={() => {
                              if (canDragOrClick) {
                                handlePlayAttempt();
                              }
                            }}
                            style={{
                              rotate: rotateVal,
                              y: yOffset,
                            }}
                            className={`focus:outline-none rounded-xl relative select-none origin-bottom transition-shadow duration-200 ${
                              isVisuallyDisabled
                                ? "cursor-not-allowed opacity-30 scale-95" 
                                : "cursor-grab active:cursor-grabbing hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                            }`}
                            whileHover={canDragOrClick && !isVisuallyDisabled ? { y: -25, scale: 1.14, rotate: 0, zIndex: 100 } : {}}
                            whileDrag={{ scale: 1.25, zIndex: 100, rotate: rotateVal - 3, filter: "brightness(1.15)" }}
                            whileTap={canDragOrClick && !isVisuallyDisabled ? { scale: 0.96 } : {}}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          >
                            {renderCardFace(card, { isLegal: !isVisuallyDisabled, isActiveTurn: canDragOrClick && !isVisuallyDisabled })}
                          </motion.div>
                        );
                      });
                    })()}
                  </div>

                  {currentActingHumanPlayer && currentActingHumanPlayer.cards.length === 0 && (
                    <div className="py-2 text-[10px] text-neutral-500 italic">
                      {language === "de" ? "Keine Karten übrig." : "No cards remaining. Wait for round summary."}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}

      {/* Last Trick Modal overlay */}
      <AnimatePresence>
        {showLastTrickModal && gameState.tricks.length > 0 && (() => {
          const lastTrick = gameState.tricks[gameState.tricks.length - 1];
          const winnerName = gameState.players.find(p => p.id === lastTrick.winnerId)?.name || lastTrick.winnerId;
          return (
            <motion.div
              key="last-trick-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setShowLastTrickModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-sm bg-[#0d0d10] border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4 text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    {language === "de" 
                      ? `Stich-Gewinner: ${winnerName}` 
                      : `Trick Winner: ${winnerName}`}
                  </span>
                  <button
                    onClick={() => setShowLastTrickModal(false)}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center py-2 justify-items-center">
                  {lastTrick.playedCards.map((played) => {
                    const player = gameState.players.find(p => p.id === played.playerId);
                    const isWinner = lastTrick.winnerId === played.playerId;
                    return (
                      <div key={played.card.id} className="space-y-1.5 flex flex-col items-center">
                        <span className={`text-[8px] font-bold truncate max-w-[65px] ${isWinner ? "text-amber-400 font-black" : "text-neutral-400"}`}>
                          {player?.name || played.playerId}
                        </span>
                        <div className={`relative rounded-xl transition-all ${isWinner ? "ring-2 ring-amber-400 shadow-lg shadow-amber-400/15 scale-105" : "opacity-80"}`}>
                          {renderCardFace(played.card, { isPlayed: false })}
                          {isWinner && (
                            <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full leading-none font-black shadow-md z-30">
                              ★
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowLastTrickModal(false)}
                  className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  {language === "de" ? "Schließen" : "Close"}
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
