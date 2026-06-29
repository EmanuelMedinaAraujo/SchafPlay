/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Trophy,
  Brain,
  Wifi,
  History,
  BookOpen,
  User,
  Sun,
  Moon,
  Info,
  Settings,
  Flame,
  Award,
  ArrowLeft,
  Play,
} from "lucide-react";
import { GameType, Contract, Card, Trick, Difficulty, SchafkopfStats, AIAnalysis, DealSpeed } from "./types";
import SchafkopfBoard from "./components/SchafkopfBoard";
import RulesModal from "./components/RulesModal";
import StatsView from "./components/StatsView";
import AnalysisView from "./components/AnalysisView";
import MultiplayerView from "./components/MultiplayerView";
import SettingsView from "./components/SettingsView";
import { translations, Language } from "./lib/i18n";
import { wsClient } from "./utils/websocketClient";

const STATS_KEY = "schafkopf_pwa_stats";
const NAME_KEY = "schafkopf_pwa_username";
const LANG_KEY = "schafkopf_pwa_lang";

const defaultStats: SchafkopfStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  gamesAsDeclarer: 0,
  gamesAsPartner: 0,
  gamesAsDefender: 0,
  winsAsDeclarer: 0,
  winsAsPartner: 0,
  winsAsDefender: 0,
  totalPoints: 0,
  contractTypeCounts: {
    [GameType.SAUSPIEL]: 0,
    [GameType.WENZ]: 0,
    [GameType.SOLO_HEARTS]: 0,
    [GameType.SOLO_ACORNS]: 0,
    [GameType.SOLO_LEAVES]: 0,
    [GameType.SOLO_BELLS]: 0,
    [GameType.RAMSCH]: 0,
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "play" | "multiplayer" | "analysis" | "stats" | "settings">("home");
  const [language, setLanguage] = useState<Language>("de");
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isGameFocusMode, setIsGameFocusMode] = useState<boolean>(true);
  
  // User settings
  const [playerName, setPlayerName] = useState<string>("Bazi");
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [dealSpeed, setDealSpeed] = useState<DealSpeed>(DealSpeed.MEDIUM);
  const [showPointsDuringGame, setShowPointsDuringGame] = useState<boolean>(true);
  const [gamesPerList, setGamesPerList] = useState<number>(12);
  
  // Stats
  const [stats, setStats] = useState<SchafkopfStats>(defaultStats);

  // Active multiplayer state
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [multiplayerPlayers, setMultiplayerPlayers] = useState<{ name: string; isHuman: boolean; difficulty?: Difficulty }[]>([]);

  // WebSocket Lobby States
  const [wsStatus, setWsStatus] = useState<any>("disconnected");
  const [wsLobby, setWsLobby] = useState<any>(null);
  const [onlineGameState, setOnlineGameState] = useState<any>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const [isOnlineGame, setIsOnlineGame] = useState<boolean>(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = wsClient.subscribe((state) => {
      setWsStatus(state.status);
      setWsLobby(state.lobby);
      setOnlineGameState(state.gameState);
      setWsError(state.error);
      setMyPlayerId(state.playerId);

      if (state.gameState) {
        setIsOnlineGame(true);
        setIsMultiplayer(true);
        setActiveTab("play");
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeTab === "multiplayer") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}`;
      wsClient.connect(wsUrl);
    }
  }, [activeTab]);

  // Current analysis targets
  const [lastGameHand, setLastGameHand] = useState<Card[]>([]);
  const [lastGameTricks, setLastGameTricks] = useState<Trick[]>([]);
  const [lastGameContract, setLastGameContract] = useState<Contract | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AIAnalysis | null>(null);

  // Load state on mount
  useEffect(() => {
    // Force dark class on document element
    document.documentElement.classList.add("dark");

    // 1. Load Name
    const savedName = localStorage.getItem(NAME_KEY);
    if (savedName) setPlayerName(savedName);

    // 2. Load Stats
    const savedStats = localStorage.getItem(STATS_KEY);
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error("Failed to parse statistics", e);
      }
    }

    // 3. Load Language
    const savedLang = localStorage.getItem(LANG_KEY);
    if (savedLang === "en" || savedLang === "de") {
      setLanguage(savedLang as Language);
    }

    // 4. Load Difficulty
    const savedDiff = localStorage.getItem("schafkopf_pwa_diff");
    if (savedDiff === "EASY" || savedDiff === "MEDIUM" || savedDiff === "HARD") {
      setDifficulty(savedDiff as Difficulty);
    }

    // 5. Load Deal Speed
    const savedSpeed = localStorage.getItem("schafkopf_pwa_speed");
    if (savedSpeed === "SLOW" || savedSpeed === "MEDIUM" || savedSpeed === "FAST") {
      setDealSpeed(savedSpeed as DealSpeed);
    }

    // 6. Load Show Points setting
    const savedShowPoints = localStorage.getItem("schafkopf_pwa_show_points");
    if (savedShowPoints !== null) {
      setShowPointsDuringGame(savedShowPoints === "true");
    }

    // 7. Load Games per List setting
    const savedGamesPerList = localStorage.getItem("schafkopf_pwa_games_per_list");
    if (savedGamesPerList) {
      setGamesPerList(parseInt(savedGamesPerList) || 12);
    }
  }, []);

  const handleChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem(NAME_KEY, name.trim() || "Bazi");
  };

  const handleDifficultyChange = (diff: Difficulty) => {
    setDifficulty(diff);
    localStorage.setItem("schafkopf_pwa_diff", diff);
  };

  const handleDealSpeedChange = (speed: DealSpeed) => {
    setDealSpeed(speed);
    localStorage.setItem("schafkopf_pwa_speed", speed);
  };

  const handleShowPointsDuringGameChange = (show: boolean) => {
    setShowPointsDuringGame(show);
    localStorage.setItem("schafkopf_pwa_show_points", show ? "true" : "false");
  };

  const handleGamesPerListChange = (num: number) => {
    setGamesPerList(num);
    localStorage.setItem("schafkopf_pwa_games_per_list", num.toString());
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value.trim() || "Bazi";
    setPlayerName(newName);
    localStorage.setItem(NAME_KEY, newName);
  };

  const handleResetStats = () => {
    setStats(defaultStats);
    localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
  };

  // Callback when a card game ends to update stats and cache the log for Gemini
  const handleGameFinished = (
    winnerIds: string[],
    finalPoints: { [playerId: string]: number },
    contract: Contract,
    startingHand: Card[],
    tricksPlayed: Trick[]
  ) => {
    // Cache the game data for local analysis
    setLastGameHand(startingHand);
    setLastGameTricks(tricksPlayed);
    setLastGameContract(contract);
    setCurrentAnalysis(null); // Clear old analysis

    // Reconstruct full game info for persistent extraction log
    const playersList = isMultiplayer && multiplayerPlayers.length > 0
      ? multiplayerPlayers.map((p, idx) => ({
          id: `p${idx + 1}`,
          name: p.name,
          isHuman: p.isHuman,
          difficulty: p.difficulty
        }))
      : [
          { id: "p1", name: playerName, isHuman: true },
          { id: "p2", name: "Hans (AI)", isHuman: false, difficulty },
          { id: "p3", name: "Sepp (AI)", isHuman: false, difficulty },
          { id: "p4", name: "Moni (AI)", isHuman: false, difficulty }
        ];

    const gameToSave = {
      id: `game_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date().toISOString(),
      players: playersList,
      contract: {
        type: contract.type,
        declarerId: contract.declarerId,
        calledSuit: contract.calledSuit,
        partnerId: contract.partnerId,
      },
      winnerIds,
      finalPoints,
      tricks: tricksPlayed.map(t => ({
        id: t.id,
        leaderId: t.leaderId,
        winnerId: t.winnerId,
        playedCards: t.playedCards.map(pc => ({
          playerId: pc.playerId,
          card: {
            suit: pc.card.suit,
            value: pc.card.value,
            points: pc.card.points,
          },
          durationMs: pc.durationMs || 0,
        })),
      })),
    };

    // Save to LocalStorage fallback
    try {
      const existingSaved = localStorage.getItem("schafkopf_pwa_game_history");
      const historyList = existingSaved ? JSON.parse(existingSaved) : [];
      historyList.push(gameToSave);
      localStorage.setItem("schafkopf_pwa_game_history", JSON.stringify(historyList));
    } catch (e) {
      console.error("Failed to save game history to localStorage", e);
    }

    // Save to server filesystem for easy posterior extraction
    fetch("/api/save-game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gameToSave),
    })
      .then(res => res.json())
      .then(data => {
        console.log("Successfully logged game to server filesystem", data);
      })
      .catch(err => {
        console.error("Failed to send game log to server", err);
      });

    // Calculate role of user
    let userRole: "DECLARER" | "PARTNER" | "DEFENDER" = "DEFENDER";
    if (contract.declarerId === "p1") {
      userRole = "DECLARER";
    } else if (contract.partnerId === "p1") {
      userRole = "PARTNER";
    }

    const userPoints = finalPoints["p1"] || 0;
    const userWon = winnerIds.includes("p1");

    // Update stats
    setStats(prev => {
      const next: SchafkopfStats = {
        ...prev,
        gamesPlayed: prev.gamesPlayed + 1,
        gamesWon: prev.gamesWon + (userWon ? 1 : 0),
        totalPoints: prev.totalPoints + userPoints,
        gamesAsDeclarer: prev.gamesAsDeclarer + (userRole === "DECLARER" ? 1 : 0),
        gamesAsPartner: prev.gamesAsPartner + (userRole === "PARTNER" ? 1 : 0),
        gamesAsDefender: prev.gamesAsDefender + (userRole === "DEFENDER" ? 1 : 0),
        winsAsDeclarer: prev.winsAsDeclarer + (userRole === "DECLARER" && userWon ? 1 : 0),
        winsAsPartner: prev.winsAsPartner + (userRole === "PARTNER" && userWon ? 1 : 0),
        winsAsDefender: prev.winsAsDefender + (userRole === "DEFENDER" && userWon ? 1 : 0),
        contractTypeCounts: {
          ...prev.contractTypeCounts,
          [contract.type]: (prev.contractTypeCounts[contract.type] || 0) + 1,
        },
      };

      localStorage.setItem(STATS_KEY, JSON.stringify(next));
      return next;
    });

    // Auto navigate to the analysis page so player gets coached!
    setActiveTab("analysis");
  };

  // Start Multiplayer P&P mode
  const handleStartPassAndPlay = (players: { name: string; isHuman: boolean; difficulty?: Difficulty }[]) => {
    setMultiplayerPlayers(players);
    setIsMultiplayer(true);
    setActiveTab("play");
  };

  // Immersive Play View: completely isolated, zero scroll, absolute focus on cards
  if (activeTab === "play") {
    return (
      <div className="fixed inset-0 w-screen h-[100dvh] bg-[#050806] text-slate-100 overflow-hidden select-none z-50 flex flex-col justify-between">
      <SchafkopfBoard
        playerName={playerName}
        difficulty={difficulty}
        dealSpeed={dealSpeed}
        language={language}
        isMultiplayer={isMultiplayer}
        multiplayerPlayers={isMultiplayer ? multiplayerPlayers : undefined}
        onGameFinished={handleGameFinished}
        onShowRules={() => setIsRulesOpen(true)}
        isGameFocusMode={true}
        setIsGameFocusMode={() => {}}
        onBackToMenu={() => {
          if (isOnlineGame) {
            wsClient.leaveLobby();
            setIsOnlineGame(false);
            setOnlineGameState(null);
          }
          setActiveTab("home");
        }}
        showPointsDuringGame={showPointsDuringGame}
        gamesPerList={gamesPerList}
        isOnline={isOnlineGame}
        onlineGameState={onlineGameState}
        playerId={myPlayerId || undefined}
        onSendPlayerAction={(action) => wsClient.send(action)}
      />
        <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} language={language} />
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-200 bg-[#050806] text-slate-200 flex flex-col justify-between font-sans dark">
      
      {/* Universal Top Header Banner (Hidden during Play View) with Integrated Tabs */}
      <header className="sticky top-0 z-40 bg-[#0c0d10]/95 backdrop-blur-md border-b border-neutral-850 shadow-sm py-1.5">
        <div className="w-full max-w-5xl mx-auto px-4 flex items-center justify-center">
          {/* Integrated Navigation Tabs only - Title removed to save space */}
          <div className="flex bg-[#050608]/90 border border-neutral-800/80 p-0.5 rounded-xl w-full max-w-md shadow-md">
            <button
              onClick={() => setActiveTab("home")}
              className={`relative flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all z-10 ${
                activeTab === "home" || activeTab === "multiplayer"
                  ? "text-white font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {(activeTab === "home" || activeTab === "multiplayer") && (
                <motion.div
                  layoutId="headerTabIndicator"
                  className="absolute inset-0 bg-emerald-600 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Play className="h-3 w-3" />
              <span>{language === "de" ? "Spielen" : "Play"}</span>
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`relative flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all z-10 ${
                activeTab === "analysis"
                  ? "text-white font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {activeTab === "analysis" && (
                <motion.div
                  layoutId="headerTabIndicator"
                  className="absolute inset-0 bg-emerald-600 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Brain className="h-3 w-3" />
              <span>{translations[language].aiCoaching}</span>
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`relative flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all z-10 ${
                activeTab === "stats"
                  ? "text-white font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {activeTab === "stats" && (
                <motion.div
                  layoutId="headerTabIndicator"
                  className="absolute inset-0 bg-emerald-600 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Trophy className="h-3 w-3" />
              <span>{language === "de" ? "Erfolge" : "Stats"}</span>
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`relative flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all z-10 ${
                activeTab === "settings"
                  ? "text-white font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {activeTab === "settings" && (
                <motion.div
                  layoutId="headerTabIndicator"
                  className="absolute inset-0 bg-emerald-600 rounded-lg -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Settings className="h-3 w-3" />
              <span>{language === "de" ? "Optionen" : "Settings"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Primary Layout Center Stage - Strictly Mobile-First Width */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 space-y-5">

        {/* VIEW 1: BEAUTIFUL HOME MENU DASHBOARD */}
        {activeTab === "home" && (
          <div className="animate-fade-in w-full space-y-5">

            {/* Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {/* Single Player Card */}
              <div className="rounded-3xl border border-neutral-850 bg-[#0d0d10] p-5 flex flex-col justify-between text-left space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                      <Play className="h-4 w-4 fill-current" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                      {language === "de" ? "Einzelspieler-Modus" : "Singleplayer Game"}
                    </h3>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {language === "de" 
                      ? "Tritt offline gegen 3 schlaue KI-Gegner an. Konfiguriere Spielstärke und Geschwindigkeit in Optionen."
                      : "Challenge 3 smart computer opponents offline. Custom strategy level and deal speed can be configured in Options."}
                  </p>
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      {difficulty === Difficulty.EASY ? (language === "de" ? "G'sell" : "Beginner") : difficulty === Difficulty.MEDIUM ? (language === "de" ? "Meister" : "Master") : (language === "de" ? "Großmeister" : "Expert")}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      {dealSpeed === DealSpeed.SLOW ? (language === "de" ? "Langsam" : "Slow") : dealSpeed === DealSpeed.MEDIUM ? (language === "de" ? "Mittel" : "Medium") : (language === "de" ? "Schnell" : "Fast")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsMultiplayer(false);
                    setActiveTab("play");
                  }}
                  className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-550 text-white py-3.5 font-black text-xs tracking-wider uppercase transition-all shadow-lg hover:shadow-emerald-950/40 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {language === "de" ? "Spiel starten" : "Start Game"}
                </button>
              </div>

              {/* Multiplayer Card */}
              <div className="rounded-3xl border border-neutral-850 bg-[#0d0d10] p-5 flex flex-col justify-between text-left space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                      <Wifi className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                      {language === "de" ? "Mehrspieler-Modus" : "Multiplayer Game"}
                    </h3>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {language === "de"
                      ? "Lokal nacheinander auf einem Gerät spielen (Pass & Play) oder serverlos im Biergarten über Hotspot verbinden."
                      : "Couch co-op with local friends on a single device (Pass & Play) or setup a zero-server hotspot network."}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("multiplayer")}
                  className="w-full rounded-2xl bg-[#16181f] hover:bg-[#1f222d] border border-neutral-800 text-neutral-200 py-3.5 font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wifi className="h-4 w-4" />
                  {language === "de" ? "Lobby konfigurieren" : "Configure Lobby"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MULTIPLAYER VIEW PAGE */}
        {activeTab === "multiplayer" && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-white dark:bg-[#0d0d10] border border-slate-200 dark:border-slate-850 rounded-2xl p-4 shadow-md">
              <MultiplayerView
                language={language}
                playerName={playerName}
                onStartPassAndPlay={handleStartPassAndPlay}
                lobby={wsLobby}
                connectionStatus={wsStatus}
                errorMessage={wsError}
                onHostLobby={(maxHumans) => wsClient.createLobby(playerName, maxHumans)}
                onJoinLobby={(code) => wsClient.joinLobby(playerName, code)}
                onLeaveLobby={() => wsClient.leaveLobby()}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: AI COACHING ANALYSIS VIEW PAGE */}
        {activeTab === "analysis" && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-[#0d0d10] border border-neutral-850 rounded-2xl p-4 shadow-md">
              <AnalysisView
                playerName={playerName}
                language={language}
                playerHand={lastGameHand}
                tricks={lastGameTricks}
                contract={lastGameContract}
                savedAnalysis={currentAnalysis}
                onAnalyzeComplete={(res) => setCurrentAnalysis(res)}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: STATS VIEW PAGE */}
        {activeTab === "stats" && (
          <div className="space-y-3 animate-fade-in">
            <StatsView
              language={language}
              stats={stats}
              onResetStats={handleResetStats}
            />
          </div>
        )}

        {/* VIEW 5: SETTINGS VIEW PAGE */}
        {activeTab === "settings" && (
          <div className="animate-fade-in w-full space-y-6">
          <SettingsView
            language={language}
            onChangeLanguage={handleChangeLanguage}
            playerName={playerName}
            onChangePlayerName={handlePlayerNameChange}
            dealSpeed={dealSpeed}
            onChangeDealSpeed={handleDealSpeedChange}
            difficulty={difficulty}
            onChangeDifficulty={handleDifficultyChange}
            showPointsDuringGame={showPointsDuringGame}
            onChangeShowPointsDuringGame={handleShowPointsDuringGameChange}
            gamesPerList={gamesPerList}
            onChangeGamesPerList={handleGamesPerListChange}
          />

            {/* Info / About Card under info section */}
            <div className="max-w-xl mx-auto rounded-3xl border border-neutral-850 bg-[#0d0d10] p-6 shadow-2xl space-y-4 text-center">
              <div className="flex items-center justify-center gap-3">
                <span className="font-black text-xs bg-emerald-600 text-white px-2 py-1 rounded-lg shadow-md tracking-tight">
                  SF
                </span>
                <div className="text-left">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                    {translations[language].appTitle}
                  </h3>
                  <span className="text-[10px] text-neutral-500 font-bold">
                    Version: {translations[language].appVersion}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 font-semibold leading-relaxed">
                {language === "de"
                  ? "Schafkopf Coach ist eine moderne Progressive Web App, die vollständig offline auf deinem Gerät funktioniert und KI-gestütztes Coaching für Schafkopf-Spiele bietet."
                  : "Schafkopf Coach is a modern Progressive Web App that works completely offline on your device, providing AI-powered coaching for Schafkopf games."}
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Rules Guide slides modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} language={language} />
    </div>
  );
}
