/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Users, Wifi, Copy, Check, Radio, HelpCircle, Phone, ArrowRight, ShieldCheck, Laptop, Cpu, User } from "lucide-react";
import { Difficulty } from "../types";
import { translations, Language } from "../lib/i18n";
import { ConnectionStatus, LobbyState } from "../utils/websocketClient";

interface MultiplayerViewProps {
  language: Language;
  playerName: string;
  onStartPassAndPlay: (players: { name: string; isHuman: boolean; difficulty?: Difficulty }[]) => void;
  
  // WebSocket Lobby Props
  lobby: LobbyState | null;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  onHostLobby: (maxHumans: number) => void;
  onJoinLobby: (code: string) => void;
  onLeaveLobby: () => void;
}

export default function MultiplayerView({
  language,
  playerName,
  onStartPassAndPlay,
  lobby,
  connectionStatus,
  errorMessage,
  onHostLobby,
  onJoinLobby,
  onLeaveLobby,
}: MultiplayerViewProps) {
  const [activeTab, setActiveTab] = useState<"pass-play" | "hotspot-p2p">("pass-play");
  
  // Pass & Play players configuration state
  const [players, setPlayers] = useState<{ name: string; isHuman: boolean; difficulty: Difficulty }[]>([]);

  useEffect(() => {
    setPlayers([
      { name: playerName || "Bazi", isHuman: true, difficulty: Difficulty.MEDIUM },
      { name: language === "de" ? "Hans" : "Jack", isHuman: false, difficulty: Difficulty.MEDIUM },
      { name: language === "de" ? "Sepp" : "Charlie", isHuman: false, difficulty: Difficulty.MEDIUM },
      { name: language === "de" ? "Moni" : "Rose", isHuman: false, difficulty: Difficulty.MEDIUM },
    ]);
  }, [playerName, language]);

  // Online Lobby states
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [maxHumansInput, setMaxHumansInput] = useState<number>(4);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyCode = () => {
    if (lobby) {
      navigator.clipboard.writeText(lobby.code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleNameChange = (idx: number, val: string) => {
    const updated = [...players];
    updated[idx] = { ...updated[idx], name: val };
    setPlayers(updated);
  };

  const handleIsHumanChange = (idx: number, isHuman: boolean) => {
    const updated = [...players];
    updated[idx] = { ...updated[idx], isHuman };
    setPlayers(updated);
  };

  const handleDifficultyChange = (idx: number, difficulty: Difficulty) => {
    const updated = [...players];
    updated[idx] = { ...updated[idx], difficulty };
    setPlayers(updated);
  };

  const t = translations[language];

  return (
    <div className="w-full space-y-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-neutral-850 relative">
        <button
          onClick={() => setActiveTab("pass-play")}
          className={`relative flex-1 py-3.5 text-xs font-black uppercase tracking-wider text-center cursor-pointer transition-all z-10 ${
            activeTab === "pass-play"
              ? "text-emerald-400 font-bold"
              : "text-neutral-400 hover:text-neutral-300"
          }`}
        >
          {activeTab === "pass-play" && (
            <motion.div
              layoutId="multiplayerTabIndicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <div className="flex items-center justify-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            {t.offlinePassPlay}
          </div>
        </button>
        <button
          onClick={() => setActiveTab("hotspot-p2p")}
          className={`relative flex-1 py-3.5 text-xs font-black uppercase tracking-wider text-center cursor-pointer transition-all z-10 ${
            activeTab === "hotspot-p2p"
              ? "text-emerald-400 font-bold"
              : "text-neutral-400 hover:text-neutral-300"
          }`}
        >
          {activeTab === "hotspot-p2p" && (
            <motion.div
              layoutId="multiplayerTabIndicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <div className="flex items-center justify-center gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            {language === "de" ? "Online Mehrspieler" : "Online Multiplayer"}
          </div>
        </button>
      </div>

      {/* 1. Pass & Play Screen */}
      {activeTab === "pass-play" && (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d0d10] p-4 shadow-sm space-y-4">
          <div className="space-y-1 text-left">
            <h3 className="text-sm font-black text-neutral-50 uppercase tracking-wider">{t.passPlayTitle}</h3>
            <p className="text-[10px] text-neutral-400 leading-normal">
              {language === "de" 
                ? "Spiele mit Freunden an einem Tisch auf einem einzigen Gerät. Gib das Gerät weiter, wenn du am Zug bist." 
                : "Play with friends on a single device. Simply pass the device when it's your turn."}
            </p>
          </div>

          <div className="space-y-3 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">{t.enterPlayerNames}</span>
            
            {/* Displaying two players per row using a grid layout */}
            <div className="grid grid-cols-2 gap-3">
              {players.map((p, idx) => (
                <div 
                  key={idx} 
                  className="bg-[#121318] border border-neutral-800/80 p-2.5 rounded-xl flex flex-col justify-between gap-2.5"
                >
                  {/* Row 1: Position and human vs AI buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[9px] text-neutral-500 font-black uppercase tracking-wider block">
                      {t.positionLabel.replace("{num}", (idx + 1).toString())} {idx === 0 ? `(${t.dealerLabel})` : ""}
                    </label>
                    
                    <div className="flex bg-[#07080b] p-0.5 rounded-lg border border-neutral-800 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleIsHumanChange(idx, true)}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all cursor-pointer flex items-center gap-0.5 ${
                          p.isHuman 
                            ? "bg-emerald-600 text-white shadow-sm" 
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <User className="h-2.5 w-2.5" />
                        {language === "de" ? "Mensch" : "Human"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIsHumanChange(idx, false)}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all cursor-pointer flex items-center gap-0.5 ${
                          !p.isHuman 
                            ? "bg-emerald-600 text-white shadow-sm" 
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        <Cpu className="h-2.5 w-2.5" />
                        {language === "de" ? "KI" : "AI"}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Name Input */}
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => handleNameChange(idx, e.target.value)}
                    className="w-full rounded-lg border border-neutral-850 bg-[#07080b] px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    placeholder={`Player ${idx + 1}`}
                  />

                  {/* Row 3: AI Difficulty (Only shown if player is AI) */}
                  {!p.isHuman && (
                    <div className="flex items-center justify-between gap-2 border-t border-neutral-850/40 pt-1.5 mt-0.5">
                      <span className="text-[8px] text-neutral-500 font-black uppercase tracking-wider block">
                        {t.strength}
                      </span>
                      <div className="flex bg-[#07080b] p-0.5 rounded-lg border border-neutral-800">
                        {Object.values(Difficulty).map(diff => {
                          const activeLabel = diff === Difficulty.EASY 
                            ? (language === "de" ? "G'sell" : "Easy") 
                            : diff === Difficulty.MEDIUM 
                              ? (language === "de" ? "Meist" : "Med") 
                              : (language === "de" ? "Groß" : "Hard");
                          
                          return (
                            <button
                              key={diff}
                              type="button"
                              onClick={() => handleDifficultyChange(idx, diff)}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all cursor-pointer ${
                                p.difficulty === diff 
                                  ? "bg-[#1d2d25] text-emerald-400 border border-emerald-900/30" 
                                  : "text-neutral-400 hover:text-neutral-200"
                              }`}
                            >
                              {activeLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => onStartPassAndPlay(players)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-550 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 transition-all inline-flex items-center gap-1 cursor-pointer shadow-md"
            >
              {t.startPassPlayGame}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Online Lobby Screen */}
      {activeTab === "hotspot-p2p" && (
        <div className="space-y-4">
          {/* Connection Status Banner */}
          <div className="flex items-center justify-between bg-[#0d0d10] border border-neutral-850 px-4 py-3 rounded-xl text-left">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                connectionStatus === "connected" 
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" 
                  : connectionStatus === "connecting" 
                    ? "bg-amber-500 animate-pulse" 
                    : "bg-neutral-600"
              }`} />
              <span className="text-xs font-black uppercase tracking-wider text-neutral-300">
                {connectionStatus === "connected" 
                  ? (language === "de" ? "Verbunden" : "Connected")
                  : connectionStatus === "connecting" 
                    ? (language === "de" ? "Verbinde..." : "Connecting...") 
                    : (language === "de" ? "Getrennt" : "Disconnected")}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400">
              {language === "de" ? "Online-Spieltisch" : "Online Playroom"}
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-950/40 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl text-xs font-semibold text-left">
              {errorMessage}
            </div>
          )}

          {lobby === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {/* Host Lobby Form */}
              <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] p-4 shadow-sm space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-neutral-50 uppercase tracking-wider flex items-center gap-1.5">
                    <Laptop className="h-3.5 w-3.5 text-emerald-500" />
                    {language === "de" ? "Tisch erstellen" : "Host Table"}
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    {language === "de" ? "Erstelle einen neuen Online-Tisch" : "Open a new online table"}
                  </p>
                </div>

                <div className="space-y-1.5 mt-2">
                  <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">
                    {language === "de" ? "Menschliche Spieler" : "Human Players"}
                  </label>
                  <select
                    value={maxHumansInput}
                    onChange={(e) => setMaxHumansInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-neutral-800 bg-[#07080b] px-2.5 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={2}>2 {language === "de" ? "Menschen" : "Humans"} + 2 AI</option>
                    <option value={3}>3 {language === "de" ? "Menschen" : "Humans"} + 1 AI</option>
                    <option value={4}>4 {language === "de" ? "Menschen" : "Humans"} + 0 AI</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onHostLobby(maxHumansInput)}
                    disabled={connectionStatus !== "connected"}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-550 disabled:bg-neutral-800 disabled:text-neutral-500 text-white py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {language === "de" ? "Tisch eröffnen" : "Host Table"}
                  </button>
                </div>
              </div>

              {/* Join Lobby Form */}
              <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] p-4 shadow-sm flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-neutral-50 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-emerald-400" />
                    {language === "de" ? "Tisch beitreten" : "Join Table"}
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    {language === "de" ? "Tritt einem Tisch über den Code bei" : "Join an existing table via code"}
                  </p>
                </div>

                <div className="space-y-1.5 mt-2">
                  <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">
                    {language === "de" ? "Tisch-Code" : "Table Code"}
                  </label>
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="E.G. A1B2C3"
                    maxLength={6}
                    className="w-full rounded-xl border border-neutral-800 bg-[#07080b] px-2.5 py-2 text-xs font-mono text-center tracking-widest text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onJoinLobby(joinCodeInput)}
                    disabled={connectionStatus !== "connected" || joinCodeInput.length !== 6}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-550 disabled:bg-neutral-800 disabled:text-neutral-500 text-white py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {language === "de" ? "Beitreten" : "Join Table"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Waiting Room */
            <div className="bg-[#0d0d10] border border-neutral-850 rounded-2xl p-4 space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                <div>
                  <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider">
                    {language === "de" ? "Tisch-Code" : "Table Code"}
                  </span>
                  <span className="text-xl font-black text-white font-mono tracking-widest block">{lobby.code}</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-850 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold text-neutral-300 cursor-pointer"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? (language === "de" ? "Kopiert!" : "Copied!") : (language === "de" ? "Kopieren" : "Copy")}
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">
                  {language === "de" ? "Spieler" : "Players"} ({lobby.players.length}/4)
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const humanSeatIndex = idx;
                    const isHumanSeat = humanSeatIndex < lobby.maxHumans;
                    const player = isHumanSeat ? lobby.players[humanSeatIndex] : null;

                    if (isHumanSeat) {
                      if (player) {
                        return (
                          <div key={idx} className="flex items-center justify-between bg-[#121318] border border-neutral-800/85 rounded-xl p-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${player.isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-pulse"}`} />
                              <span className="text-xs font-bold text-neutral-200">
                                {player.name} {player.isHost && <span className="text-[9px] text-amber-400 font-black uppercase ml-1">(Host)</span>}
                                {!player.isConnected && <span className="text-[9px] text-red-500 font-black uppercase ml-1">(Offline)</span>}
                              </span>
                            </div>
                            <span className="text-[9px] font-black uppercase text-neutral-500">
                              {language === "de" ? "Platz" : "Seat"} {idx + 1}
                            </span>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="flex items-center justify-between bg-[#121318]/40 border border-dashed border-neutral-800 rounded-xl p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700 animate-pulse" />
                              <span className="text-xs font-bold text-neutral-500 italic">
                                {language === "de" ? "Warte auf Spieler..." : "Waiting for player..."}
                              </span>
                            </div>
                            <span className="text-[9px] font-black uppercase text-neutral-600">
                              {language === "de" ? "Platz" : "Seat"} {idx + 1}
                            </span>
                          </div>
                        );
                      }
                    } else {
                      return (
                        <div key={idx} className="flex items-center justify-between bg-[#121318]/60 border border-neutral-850 rounded-xl p-3 opacity-80">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span className="text-xs font-bold text-neutral-400">
                              {language === "de" ? "KI-Spieler (Automatisch)" : "AI Player (Automated)"}
                            </span>
                          </div>
                          <span className="text-[9px] font-black uppercase text-neutral-500">
                            {language === "de" ? "KI-Platz" : "AI Seat"}
                          </span>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onLeaveLobby}
                  className="w-full rounded-xl border border-neutral-850 hover:border-red-500 hover:text-red-400 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center block"
                >
                  {language === "de" ? "Tisch verlassen" : "Leave Table"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
