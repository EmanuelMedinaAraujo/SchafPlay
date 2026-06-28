/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Trophy, Award, BarChart3, RotateCcw, Heart, Calendar } from "lucide-react";
import { SchafkopfStats, GameType } from "../types";
import { translations, Language } from "../lib/i18n";

interface StatsViewProps {
  language: Language;
  stats: SchafkopfStats;
  onResetStats: () => void;
}

export default function StatsView({ language, stats, onResetStats }: StatsViewProps) {
  const t = translations[language];
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  
  // Calculate game type contract ratios for custom SVG bar charts
  const contracts = [
    { label: "Sauspiel", value: stats.contractTypeCounts[GameType.SAUSPIEL] || 0, color: "bg-emerald-500" },
    { label: "Wenz", value: stats.contractTypeCounts[GameType.WENZ] || 0, color: "bg-amber-500" },
    { label: "Solo (Hearts)", value: stats.contractTypeCounts[GameType.SOLO_HEARTS] || 0, color: "bg-red-500" },
    { label: { de: "Solo (Andere)", en: "Solo (Other)" }[language], value: 
      (stats.contractTypeCounts[GameType.SOLO_ACORNS] || 0) + 
      (stats.contractTypeCounts[GameType.SOLO_LEAVES] || 0) + 
      (stats.contractTypeCounts[GameType.SOLO_BELLS] || 0), 
      color: "bg-blue-500" 
    },
    { label: "Ramsch", value: stats.contractTypeCounts[GameType.RAMSCH] || 0, color: "bg-neutral-500" },
  ];

  const maxContractVal = Math.max(...contracts.map(c => c.value), 1);

  return (
    <div className="w-full space-y-6 text-left">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Games Played */}
        <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] px-4 py-3.5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-neutral-400 min-w-0">
            <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider truncate">{t.gamesPlayed}</span>
          </div>
          <span className="text-lg font-black tracking-tight text-neutral-100 shrink-0">{stats.gamesPlayed}</span>
        </div>

        {/* Win Rate */}
        <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] px-4 py-3.5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-neutral-400 min-w-0">
            <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider truncate">{t.winRate}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-lg font-black tracking-tight text-neutral-100">{winRate}%</span>
            <span className="text-[9px] text-neutral-500 font-bold">({stats.gamesWon} {t.wins})</span>
          </div>
        </div>

        {/* Total Points */}
        <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] px-4 py-3.5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-neutral-400 min-w-0">
            <Award className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider truncate">{t.avgPoints}</span>
          </div>
          <span className="text-lg font-black tracking-tight text-neutral-100 shrink-0">
            {stats.gamesPlayed > 0 ? Math.round(stats.totalPoints / stats.gamesPlayed) : 0}
          </span>
        </div>

        {/* Role Breakdown */}
        <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] px-4 py-3 shadow-sm flex flex-col justify-center gap-1 col-span-1 sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-neutral-500 border-b border-neutral-850/80 pb-1 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-wider">{t.gamesPlayedAs}</span>
            <BarChart3 className="h-3 w-3 text-violet-500" />
          </div>
          <div className="space-y-0.5 text-[9px] font-extrabold uppercase tracking-wide">
            <div className="flex justify-between leading-none">
              <span className="text-neutral-500">{t.declarer}:</span>
              <span className="text-neutral-300">{stats.gamesAsDeclarer} ({stats.winsAsDeclarer} W)</span>
            </div>
            <div className="flex justify-between leading-none">
              <span className="text-neutral-500">{t.partner}:</span>
              <span className="text-neutral-300">{stats.gamesAsPartner} ({stats.winsAsPartner} W)</span>
            </div>
            <div className="flex justify-between leading-none">
              <span className="text-neutral-500">{t.defender}:</span>
              <span className="text-neutral-300">{stats.gamesAsDefender} ({stats.winsAsDefender} W)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Win Rate Ring Chart */}
        <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] p-6 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 self-start mb-6">{t.performanceIndex}</h3>
          
          <div className="relative flex items-center justify-center">
            {/* SVG Progress Ring */}
            <svg className="w-36 h-36 transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-neutral-800 fill-none"
                strokeWidth="10"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-emerald-550 fill-none transition-all duration-1000 ease-out"
                strokeWidth="10"
                strokeDasharray={402}
                strokeDashoffset={402 - (402 * winRate) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-white">{winRate}%</span>
              <span className="text-[10px] text-neutral-500 font-bold tracking-wider uppercase mt-1">{t.winRate}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 w-full border-t border-neutral-850 pt-4 text-center">
            <div>
              <span className="text-[10px] text-neutral-500 font-bold block">{language === "de" ? "SIEG" : "WINS"}</span>
              <span className="text-base font-black text-emerald-400">{stats.gamesWon}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 font-bold block">{language === "de" ? "NIEDERLAGEN" : "LOSSES"}</span>
              <span className="text-base font-black text-rose-500">{stats.gamesPlayed - stats.gamesWon}</span>
            </div>
          </div>
        </div>

        {/* Contracts Breakdown Bar Chart */}
        <div className="rounded-2xl border border-neutral-850 bg-[#0d0d10] p-6 shadow-sm flex flex-col justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6">{t.recentContracts}</h3>

          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {contracts.map((c, idx) => {
              const pct = Math.round((c.value / maxContractVal) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-neutral-400 font-bold">{c.label}</span>
                    <span className="text-white font-extrabold">{c.value}</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${c.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-center text-[10px] text-neutral-500 font-semibold border-t border-neutral-850 pt-4">
            {language === "de" 
              ? "Übung macht den Meister! Versuche verschiedene Solo-Spiele anzusagen!" 
              : "Practice makes perfect. Try exploring different solo contracts!"}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-950/40 bg-red-950/5 p-5 flex items-center justify-between">
        <div className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">{t.resetStats}</h4>
          <p className="text-[11px] text-neutral-500 font-semibold">
            {language === "de" 
              ? "Lösche alle deine lokalen Spiel- und Punkterekorde unwiderruflich." 
              : "Delete all your local win/loss records and point histories permanently."}
          </p>
        </div>
        <button
          onClick={() => {
            const msg = language === "de" 
              ? "Bist du sicher, dass du deine Statistiken zurücksetzen möchtest? Dies kann nicht rückgängig gemacht werden." 
              : "Are you sure you want to reset your statistics? This cannot be undone.";
            if (confirm(msg)) {
              onResetStats();
              alert(t.statsResetCompleted);
            }
          }}
          className="rounded-xl border border-red-900 hover:bg-red-900 text-red-400 hover:text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
        >
          {language === "de" ? "Zurücksetzen" : "Reset All"}
        </button>
      </div>
    </div>
  );
}
