/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { User, Globe, Gauge, Brain, Save } from "lucide-react";
import { Difficulty, DealSpeed } from "../types";
import { Language, translations } from "../lib/i18n";

interface SettingsViewProps {
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  playerName: string;
  onChangePlayerName: (name: string) => void;
  dealSpeed: DealSpeed;
  onChangeDealSpeed: (speed: DealSpeed) => void;
  difficulty: Difficulty;
  onChangeDifficulty: (diff: Difficulty) => void;
  showPointsDuringGame: boolean;
  onChangeShowPointsDuringGame: (show: boolean) => void;
  gamesPerList: number;
  onChangeGamesPerList: (num: number) => void;
}

export default function SettingsView({
  language,
  onChangeLanguage,
  playerName,
  onChangePlayerName,
  dealSpeed,
  onChangeDealSpeed,
  difficulty,
  onChangeDifficulty,
  showPointsDuringGame,
  onChangeShowPointsDuringGame,
  gamesPerList,
  onChangeGamesPerList,
}: SettingsViewProps) {
  const t = translations[language];

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangePlayerName(e.target.value);
  };

  return (
    <div className="w-full space-y-6 text-left max-w-xl mx-auto">
      <div className="rounded-3xl border border-neutral-850 bg-[#0d0d10] p-6 shadow-2xl space-y-6">
        {/* 1. Player Name */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-emerald-400" />
            {t.playerName}
          </label>
          <input
            type="text"
            value={playerName}
            onChange={handleNameInputChange}
            maxLength={14}
            className="w-full rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-extrabold shadow-inner"
            placeholder={language === "de" ? "Spielername eingeben..." : "Enter player name..."}
          />
        </div>

        {/* 1b. Games per List setting */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-[9px]">L</span>
            {language === "de" ? "Spiele pro Liste (Runde)" : "Games per List (Round)"}
          </label>
          <div className="grid grid-cols-7 gap-1.5 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
            {[1, 4, 8, 12, 16, 24, 32].map((num) => {
              const isSelected = gamesPerList === num;
              return (
                <button
                  key={num}
                  onClick={() => onChangeGamesPerList(num)}
                  className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-md font-bold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Opponent Level */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-400" />
            {t.opponentLevel}
          </label>
          <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
            {Object.values(Difficulty).map((diff) => {
              const label =
                diff === Difficulty.EASY
                  ? language === "de"
                    ? "G'sell"
                    : "Beginner"
                  : diff === Difficulty.MEDIUM
                  ? language === "de"
                    ? "Meister"
                    : "Master"
                  : language === "de"
                  ? "Großmeister"
                  : "Expert";
              const isSelected = difficulty === diff;
              return (
                <button
                  key={diff}
                  onClick={() => onChangeDifficulty(diff)}
                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-violet-600 text-white shadow-md"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Card Deal Speed */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-amber-400" />
            {language === "de" ? "Gebe-Geschwindigkeit der Karten" : "Card Dealing Speed"}
          </label>
          <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
            {(["SLOW", "MEDIUM", "FAST"] as DealSpeed[]).map((speed) => {
              const label =
                speed === "SLOW"
                  ? language === "de"
                    ? "Langsam"
                    : "Slow"
                  : speed === "MEDIUM"
                  ? language === "de"
                    ? "Mittel"
                    : "Medium"
                  : language === "de"
                  ? "Schnell"
                  : "Fast";
              const isSelected = dealSpeed === speed;
              return (
                <button
                  key={speed}
                  onClick={() => onChangeDealSpeed(speed)}
                  className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-amber-600 text-slate-950 shadow-md font-black"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Language Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-blue-400" />
            {language === "de" ? "Sprach-Einstellung" : "Language Setting"}
          </label>
          <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
            <button
              onClick={() => onChangeLanguage("de")}
              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                language === "de"
                  ? "bg-emerald-600 text-white shadow-md font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              🇩🇪 Deutsch
            </button>
            <button
              onClick={() => onChangeLanguage("en")}
              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                language === "en"
                  ? "bg-emerald-600 text-white shadow-md font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              🇺🇸 English
            </button>
          </div>
        </div>

        {/* 5. Show points during game */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-[9px]">A</span>
            {language === "de" ? "Augen (Punkte) während des Spiels anzeigen" : "Show Points During Game"}
          </label>
          <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
            <button
              onClick={() => onChangeShowPointsDuringGame(true)}
              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                showPointsDuringGame
                  ? "bg-emerald-600 text-white shadow-md font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {language === "de" ? "Anzeigen" : "Show"}
            </button>
            <button
              onClick={() => onChangeShowPointsDuringGame(false)}
              className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                !showPointsDuringGame
                  ? "bg-rose-950 text-rose-400 shadow-md font-bold border border-rose-900/30"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {language === "de" ? "Verbergen" : "Hide"}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        <div className="rounded-2xl border border-emerald-950/40 bg-emerald-950/10 p-3 flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
            <Save className="h-4 w-4" />
          </div>
          <p className="text-[10px] text-emerald-400 font-extrabold leading-tight">
            {language === "de"
              ? "Einstellungen werden sofort automatisch lokal gespeichert und sind vollständig offline verfügbar!"
              : "Settings are automatically saved locally and are fully functional offline!"}
          </p>
        </div>
      </div>
    </div>
  );
}
