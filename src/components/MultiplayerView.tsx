/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Users, Wifi, Copy, Check, Radio, HelpCircle, Phone, ArrowRight, ShieldCheck, Laptop, Cpu, User } from "lucide-react";
import { Player, Difficulty } from "../types";
import { translations, Language } from "../lib/i18n";

interface MultiplayerViewProps {
  language: Language;
  playerName: string;
  onStartPassAndPlay: (players: { name: string; isHuman: boolean; difficulty?: Difficulty }[]) => void;
  onJoinPeerGame: (peerId: string) => void;
  onHostPeerGame: () => void;
}

export default function MultiplayerView({
  language,
  playerName,
  onStartPassAndPlay,
  onJoinPeerGame,
  onHostPeerGame,
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

  // Hotspot P2P states
  const [isCopied, setIsCopied] = useState(false);
  const [peerIdInput, setPeerIdInput] = useState("");
  const [selfPeerId, setSelfPeerId] = useState("");
  const [localLobbies, setLocalLobbies] = useState([
    { id: "lobby-1", host: "Xaver (Hotspot)", players: 2, strength: "High", ping: "4ms", channel: "Wi-Fi Hotspot" },
    { id: "lobby-2", host: "Resi (Tavern Bluetooth)", players: 3, strength: "Medium", ping: "12ms", channel: "Bluetooth 5.2" },
    { id: "lobby-3", host: "Alois (Bells Table)", players: 1, strength: "High", ping: "8ms", channel: "Local Wi-Fi" },
  ]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Generate a random mock serverless Peer ID for self-contained direct WebRTC
    const randId = "SK-" + Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase();
    setSelfPeerId(randId);
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(selfPeerId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 2500);
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

  const [showHotspotHelp, setShowHotspotHelp] = useState(false);

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
            {t.localHotspot}
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

      {/* 2. Hotspot P2P Screen */}
      {activeTab === "hotspot-p2p" && (
        <div className="space-y-4">
          {/* Compact header with Hotspot P2P help trigger */}
          <div className="flex items-center justify-between bg-[#0d0d10] border border-neutral-800 px-4 py-2 rounded-xl text-left">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-1.5">
                <Wifi className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-black text-neutral-50 uppercase tracking-wider">{t.localHotspot}</h3>
                <p className="text-[9px] text-neutral-400">{language === "de" ? "Geräte direkt koppeln" : "Connect devices directly"}</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowHotspotHelp(true)}
              className="p-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white cursor-pointer transition-all flex items-center gap-1"
              title="Help"
            >
              <HelpCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-wider px-0.5">{language === "de" ? "Anleitung" : "Info"}</span>
            </button>
          </div>

          {/* Elegant Hotspot P2P Explanatory Pop-up Modal */}
          {showHotspotHelp && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-[#0f1015] border border-neutral-800 max-w-sm w-full rounded-2xl p-5 shadow-2xl text-left space-y-4">
                <div className="flex items-center gap-2.5 border-b border-neutral-850 pb-2.5">
                  <div className="bg-emerald-500/10 p-1.5 rounded-lg">
                    <Wifi className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{t.zeroServerTitle}</h3>
                </div>

                <div className="space-y-2.5 text-xs text-neutral-300 leading-relaxed">
                  <p className="font-extrabold text-neutral-200 text-[11px]">{t.zeroServerSubtitle}</p>
                  <p className="text-[11px]">{t.zeroServerDesc}</p>
                  <div className="p-2.5 bg-neutral-950 border border-neutral-850 rounded-xl space-y-1">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">{language === "de" ? "Vorgehensweise:" : "Steps:"}</span>
                    <ol className="list-decimal pl-4 space-y-0.5 text-[10px] text-neutral-400">
                      <li>{language === "de" ? "Erstelle einen Hotspot oder sei im selben WLAN" : "Open a Wi-Fi hotspot or connect to same Wi-Fi"}</li>
                      <li>{language === "de" ? "Kopiere deinen Geräte-Code und teile ihn" : "Copy your Device Code and share with friends"}</li>
                      <li>{language === "de" ? "Oder scanne den Tisch und trete direkt bei" : "Or scan the list and join an active table"}</li>
                    </ol>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setShowHotspotHelp(false)}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white font-black text-[10px] uppercase tracking-wider py-2 px-4 rounded-xl cursor-pointer transition-all"
                  >
                    {language === "de" ? "Verstanden" : "Schließen"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {/* Direct P2P Device Coupling (Serverless WebRTC) */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-neutral-50 uppercase tracking-wider flex items-center gap-1.5">
                  <Laptop className="h-3.5 w-3.5 text-violet-500" />
                  {language === "de" ? "Geräte-Kopplung" : "Direct Peer coupling"}
                </h4>
                <p className="text-[10px] text-neutral-400">
                  {language === "de" ? "Kopple deine Geräte direkt per Code" : "Pair devices directly via WebRTC code"}
                </p>
              </div>

              {/* Self Code */}
              <div className="bg-[#07080b] border border-neutral-850 rounded-xl p-2.5 flex items-center justify-between mt-1">
                <div className="space-y-0.5">
                  <span className="text-[8px] uppercase font-black text-neutral-500 tracking-wider">
                    {language === "de" ? "Dein Code" : "Your Code"}
                  </span>
                  <span className="text-xs font-mono font-bold text-neutral-200 block">{selfPeerId}</span>
                </div>
                <button
                  onClick={handleCopyId}
                  className="rounded-lg p-1.5 hover:bg-neutral-800 text-neutral-400 transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Join Code */}
              <div className="space-y-1 mt-1">
                <label className="text-[9px] font-black uppercase text-neutral-400 block">
                  {language === "de" ? "Geräte-Code eingeben" : "Enter Device Code"}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={peerIdInput}
                    onChange={(e) => setPeerIdInput(e.target.value.toUpperCase())}
                    placeholder="SK-A1B2C3"
                    className="flex-1 rounded-xl border border-neutral-800 bg-[#07080b] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-neutral-100"
                  />
                  <button
                    onClick={() => onJoinPeerGame(peerIdInput)}
                    disabled={!peerIdInput}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-550 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-[10px] font-black uppercase px-3 transition-colors cursor-pointer"
                  >
                    {t.connect}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-[9px] text-neutral-500 mt-1">
                <span className="flex items-center gap-0.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  100% Serverless
                </span>
                <span>{language === "de" ? "Direktverbindung" : "Direct link"}</span>
              </div>
            </div>

            {/* Simulated Tavern Hotspot Discoverer */}
            <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] p-4 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-neutral-50 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-emerald-400" />
                    {t.scanLocalTavern}
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    {language === "de" ? "Finde Spieltische in der Nähe" : "Discover active tables nearby"}
                  </p>
                </div>
                <button
                  onClick={startScan}
                  disabled={isScanning}
                  className="rounded-full bg-neutral-800 text-neutral-300 hover:bg-neutral-700 px-2.5 py-1 text-[9px] font-black uppercase transition-all cursor-pointer"
                >
                  {isScanning ? t.scanning : language === "de" ? "Scannen" : "Scan"}
                </button>
              </div>

              {/* Lobby scan list */}
              <div className="space-y-1.5 flex-1 max-h-[120px] overflow-y-auto pr-1">
                {isScanning ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-1.5">
                    <Radio className="h-6 w-6 text-emerald-400 animate-ping" />
                    <span className="text-[10px] text-neutral-500">{t.scanning}</span>
                  </div>
                ) : (
                  localLobbies.map((lobby) => (
                    <div
                      key={lobby.id}
                      className="border border-neutral-850 rounded-xl p-2 hover:border-emerald-500/40 hover:bg-emerald-950/5 flex items-center justify-between text-[11px] transition-all"
                    >
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-neutral-200">{lobby.host}</span>
                        <div className="flex gap-1.5 text-[9px] text-neutral-500">
                          <span>{lobby.channel}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          alert(`Joining table hosted by ${lobby.host}. This initiates a serverless peer-to-peer lobby!`);
                          onJoinPeerGame(lobby.id);
                        }}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-550 text-white text-[9px] font-black uppercase px-2 py-1 transition-colors cursor-pointer"
                      >
                        {language === "de" ? "Beitritt" : "Join"} ({lobby.players}/4)
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Host locally button */}
              <div className="pt-1">
                <button
                  onClick={onHostPeerGame}
                  className="w-full rounded-xl border border-neutral-850 hover:border-emerald-500 hover:text-emerald-400 py-2 text-[9px] font-black uppercase text-neutral-300 transition-all text-center block cursor-pointer"
                >
                  {language === "de" ? "Lokalen Tisch erstellen" : "Host Local Table"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
