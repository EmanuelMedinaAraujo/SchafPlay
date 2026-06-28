/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sparkles, Brain, CheckCircle2, XCircle, ChevronRight, RefreshCw, Award, PlayCircle } from "lucide-react";
import { AIAnalysis, Card, Trick, Contract } from "../types";
import { runSubagentsAnalysis } from "../utils/coachingEngine";
import { translations, Language } from "../lib/i18n";

interface AnalysisViewProps {
  playerHand: Card[];
  tricks: Trick[];
  contract: Contract | null;
  playerName: string;
  language: Language;
  onAnalyzeComplete?: (analysis: AIAnalysis) => void;
  savedAnalysis?: AIAnalysis | null;
}

export default function AnalysisView({
  playerHand,
  tricks,
  contract,
  playerName,
  language,
  onAnalyzeComplete,
  savedAnalysis,
}: AnalysisViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(savedAnalysis || null);

  const t = translations[language];

  const handleRequestAnalysis = () => {
    if (tricks.length === 0) {
      const errTxt = language === "de" 
        ? "Es wurden in diesem Spiel noch keine Stiche gespielt. Beende zuerst ein Spiel!" 
        : "No tricks have been played in this game yet. Complete a game first!";
      setError(errTxt);
      return;
    }

    setLoading(true);
    setError(null);

    // Run our subagents-based statistical engine locally!
    setTimeout(() => {
      try {
        const data = runSubagentsAnalysis(playerName, playerHand, tricks, contract);
        setAnalysis(data);
        if (onAnalyzeComplete) {
          onAnalyzeComplete(data);
        }
      } catch (err: any) {
        console.error(err);
        setError(language === "de" ? "Fehler bei der strategischen Spielanalyse." : "An error occurred during game strategy analysis.");
      } finally {
        setLoading(false);
      }
    }, 800); // Small, elegant delay to simulate analytical calculation
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case "Excellent": return "text-emerald-400 bg-emerald-950/30 border-emerald-900/30";
      case "Good": return "text-blue-400 bg-blue-950/30 border-blue-900/30";
      case "Average": return "text-amber-400 bg-amber-950/30 border-amber-900/30";
      default: return "text-red-400 bg-red-950/30 border-red-900/30";
    }
  };

  const getTranslatedRating = (rating: string) => {
    if (language === "en") return rating;
    switch (rating) {
      case "Excellent": return "Hervorragend";
      case "Good": return "Gut";
      case "Average": return "Mittel";
      case "Needs Improvement": return "Verbesserungswürdig";
      default: return rating;
    }
  };

  return (
    <div className="w-full space-y-3 text-left">
      {/* Trigger Analysis Button / Initial State */}
      {!analysis && !loading && (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-4 text-center space-y-2 bg-[#0d0d10]/40">
          <Brain className="h-8 w-8 text-emerald-500 mx-auto animate-pulse" />
          <div className="max-w-md mx-auto space-y-0.5">
            <h3 className="text-xs font-black text-slate-100 uppercase tracking-wider">
              {language === "de" ? "Spiel- & Stichanalyse" : "Game & Trick Analysis"}
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              {language === "de" 
                ? "Detailliertes Feedback von Schafkopf-Subagenten. Lerne schmieren, Trümpfe ziehen oder defensiv spielen!" 
                : "Get feedback from our strategy subagents. Learn when to smear points, draw trumps, or lead!"}
            </p>
          </div>
          <button
            onClick={handleRequestAnalysis}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-550 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2 shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {language === "de" ? "Spiel analysieren" : "Analyze Play"}
          </button>
          {error && <p className="text-[10px] text-red-500 mt-1 font-semibold">{error}</p>}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-2xl border border-neutral-800 bg-[#0d0d10] p-5 text-center space-y-3 shadow-2xl flex flex-col items-center justify-center animate-pulse">
          <div className="relative">
            <Brain className="h-10 w-10 text-emerald-500 animate-bounce" />
            <Sparkles className="h-4 w-4 text-amber-500 absolute -top-1 -right-1 animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              {language === "de" ? "Analyse läuft..." : "Coaching in Progress..."}
            </h3>
            <p className="text-[10px] text-slate-400 max-w-sm leading-normal mx-auto">
              {language === "de" 
                ? "Unsere Strategie-Subagenten analysieren dein Startblatt und bewerten deine Entscheidungen." 
                : "Our strategy subagents are evaluating your starting hand and compilation of tactical advice."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-black uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <RefreshCw className="h-3 w-3 animate-spin" />
            {language === "de" ? "Berechne Stich-Wahrscheinlichkeiten" : "Parsing trick history"}
          </div>
        </div>
      )}

      {/* Analysis Results Display */}
      {analysis && !loading && (
        <div className="space-y-3">
          {/* Dashboard Summary Card */}
          <div className="rounded-2xl bg-[#0d0d10] p-3 shadow-sm space-y-2 border border-neutral-900">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-900 pb-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-1.5">
                  <Award className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-neutral-50 uppercase tracking-wider">{t.coachingAdvice}</h3>
                  <p className="text-[9px] text-neutral-400">
                    {language === "de" ? "Taktische Spielanalyse deiner letzten Runde" : "Tactical debrief of your last round"}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${getRatingColor(analysis.rating)}`}>
                <Sparkles className="h-3 w-3" />
                <span>{getTranslatedRating(analysis.rating)}</span>
              </div>
            </div>

            {/* Overall Feedback */}
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
                {language === "de" ? "Urteil der Subagenten" : "Subagents' Verdict"}
              </span>
              <p className="text-[11px] leading-relaxed text-neutral-300 italic">
                "{analysis.overallFeedback}"
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleRequestAnalysis}
                className="inline-flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 font-black uppercase transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                {language === "de" ? "Erneuern" : "Re-Analyze"}
              </button>
            </div>
          </div>

          {/* Detailed Trick Analysis Cards - in a neat max-height scrollbox */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block px-1">
              {language === "de" ? "Stich-für-Stich Bewertung" : "Trick-by-Trick Evaluation"}
            </span>
            
            <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
              {analysis.trickAnalysis.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-[#09090b] border border-neutral-900/60 p-2.5 flex items-start gap-2.5 text-[11px]"
                >
                  {/* Status icon / Trick Number */}
                  <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                    <div className="flex items-center justify-center h-6 w-6 rounded-md font-black text-[9px] bg-neutral-900 text-neutral-300 border border-neutral-800">
                      T{item.trickNumber}
                    </div>
                    <div>
                      {item.isOptimal ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="p-1.5 rounded bg-neutral-950 border border-neutral-900">
                        <span className="text-neutral-500 block font-black uppercase tracking-wider text-[8px]">
                          {language === "de" ? "GESPIELT" : "PLAYED"}
                        </span>
                        <span className="font-extrabold text-neutral-200">{item.userAction}</span>
                      </div>
                      <div className="p-1.5 rounded bg-neutral-950 border border-neutral-900">
                        <span className="text-neutral-500 block font-black uppercase tracking-wider text-[8px]">
                          {language === "de" ? "OPTIMAL" : "RECOMMENDED"}
                        </span>
                        <span className="font-extrabold text-emerald-400">{item.aiRecommendation}</span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[10px] leading-snug text-neutral-400">
                        {item.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
