/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { X, BookOpen, Layers, Award, ShieldAlert } from "lucide-react";
import { Language } from "../lib/i18n";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export default function RulesModal({ isOpen, onClose, language }: RulesModalProps) {
  if (!isOpen) return null;

  const isDe = language === "de";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-[#121318] p-4 sm:p-6 shadow-2xl text-slate-100 transition-all text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-emerald-500" />
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isDe ? "Schafkopf Spielregeln & Guide" : "Schafkopf Rules & Guide"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-neutral-800 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          {/* Card Deck Section */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-400">
              <Layers className="h-4 w-4" />
              {isDe ? "1. Das bayerische Blatt (32 Karten)" : "1. The Bavarian Card Deck (32 Cards)"}
            </h3>
            <p>
              {isDe ? (
                <>
                  Schafkopf wird mit 32 Karten aus 4 Farben gespielt: <strong>Eichel <span className="inline-block rotate-180">🌰</span></strong>,{" "}
                  <strong>Gras 🍃</strong>, <strong>Herz ❤️</strong> und{" "}
                  <strong>Schellen 🔔</strong>. Jede Farbe enthält 8 Kartenwerte:
                </>
              ) : (
                <>
                  Schafkopf is played with 32 cards of 4 suits: <strong>Acorns (Eichel <span className="inline-block rotate-180">🌰</span>)</strong>,{" "}
                  <strong>Leaves (Gras 🍃)</strong>, <strong>Hearts (Herz ❤️)</strong>, and{" "}
                  <strong>Bells (Schellen 🔔)</strong>. Each suit contains 8 card values:
                </>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#08080a] p-4 rounded-xl border border-neutral-800">
              <div className="flex flex-col items-center p-2 border border-neutral-800 rounded-lg bg-[#111216]">
                <span className="text-lg font-black text-white">{isDe ? "As / Sau" : "Ace"}</span>
                <span className="text-xs text-slate-400">{isDe ? "11 Augen" : "11 Points"}</span>
              </div>
              <div className="flex flex-col items-center p-2 border border-neutral-800 rounded-lg bg-[#111216]">
                <span className="text-lg font-black text-white">10</span>
                <span className="text-xs text-slate-400">{isDe ? "10 Augen" : "10 Points"}</span>
              </div>
              <div className="flex flex-col items-center p-2 border border-neutral-800 rounded-lg bg-[#111216]">
                <span className="text-lg font-black text-white">{isDe ? "König" : "King"}</span>
                <span className="text-xs text-slate-400">{isDe ? "4 Augen" : "4 Points"}</span>
              </div>
              <div className="flex flex-col items-center p-2 border border-neutral-800 rounded-lg bg-[#111216]">
                <span className="text-lg font-black text-white">Ober</span>
                <span className="text-xs text-slate-400">{isDe ? "3 Augen" : "3 Points"}</span>
              </div>
              <div className="flex flex-col items-center p-2 border border-neutral-800 rounded-lg bg-[#111216] mt-2 sm:mt-0 col-span-2 sm:col-span-1">
                <span className="text-lg font-black text-white">Unter</span>
                <span className="text-xs text-slate-400">{isDe ? "2 Augen" : "2 Points"}</span>
              </div>
              <div className="flex flex-col items-center p-2 border border-neutral-800 rounded-lg bg-[#111216] mt-2 sm:mt-0 col-span-2 sm:col-span-3">
                <span className="text-lg font-black text-white">9, 8, 7</span>
                <span className="text-xs text-slate-400">{isDe ? "0 Augen" : "0 Points"}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isDe ? (
                <>
                  Im gesamten Spiel gibt es <strong>120 Augen</strong>. Um das Spiel zu gewinnen, muss die Spielerseite (der Ansager) mindestens <strong>61 Augen</strong> erzielen. Bei einem 60-60 Split gewinnen die Gegenspieler.
                </>
              ) : (
                <>
                  There is a total of <strong>120 points</strong> in the deck. To win a game, the declarer
                  side must score at least <strong>61 points</strong>. A 60-60 split means the defenders win.
                </>
              )}
            </p>
          </section>

          {/* Trump Hierarchy Section */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-400">
              <Award className="h-4 w-4" />
              {isDe ? "2. Trumpf-Hierarchie" : "2. Trumps Hierarchy"}
            </h3>
            <p>
              {isDe ? "Je nach angesagtem Spiel gelten andere Karten als Trumpf:" : "Depending on the active contract, different cards are defined as trumps:"}
            </p>
            <div className="space-y-3">
              <div className="border-l-2 border-emerald-500 pl-4 py-1">
                <h4 className="font-bold text-white">{isDe ? "Normales Spiel (Sauspiel) & Herz-Solo" : "Normal Game (Sauspiel) & Heart Solo"}</h4>
                <p className="text-xs mt-1">
                  <strong>{isDe ? "Trümpfe (Höchster bis Niedrigster):" : "Trumps (Highest to Lowest):"}</strong>
                </p>
                <p className="text-xs mt-1 text-slate-300 font-semibold tracking-wide">
                  <span className="inline-block rotate-180">🌰</span> Ober &rarr; 🍃 Ober &rarr; ❤️ Ober &rarr; 🔔 Ober &rarr; <span className="inline-block rotate-180">🌰</span> Unter &rarr; 🍃 Unter &rarr; ❤️ Unter &rarr; 🔔 Unter &rarr; ❤️ As &rarr; ❤️ 10 &rarr; ❤️ König &rarr; ❤️ 9 &rarr; ❤️ 8 &rarr; ❤️ 7
                </p>
              </div>

              <div className="border-l-2 border-amber-500 pl-4 py-1">
                <h4 className="font-bold text-white">{isDe ? "Wenz (Nur die Unter sind Trumpf)" : "Wenz (Only Unters are Trump)"}</h4>
                <p className="text-xs mt-1 text-slate-300">
                  <strong>{isDe ? "Trümpfe:" : "Trumps:"}</strong> <span className="inline-block rotate-180">🌰</span> Unter &rarr; 🍃 Unter &rarr; ❤️ Unter &rarr; 🔔 Unter. {isDe ? "Alle anderen Karten (einschließlich der Ober) sind normale Farbkarten." : "All other cards (including Obers) are non-trumps of their respective suits."}
                </p>
              </div>

              <div className="border-l-2 border-blue-400 pl-4 py-1">
                <h4 className="font-bold text-white">{isDe ? "Farbsolo (Eichel, Gras oder Schellen)" : "Suit Solo (Acorns, Leaves, or Bells)"}</h4>
                <p className="text-xs mt-1 text-slate-300">
                  <strong>{isDe ? "Trümpfe:" : "Trumps:"}</strong> {isDe ? "Ober & Unter (gleiche Reihenfolge wie beim Normalspiel), gefolgt von As, 10, König, 9, 8, 7 der angesagten Solo-Farbe." : "Obers & Unters (same order as normal game), followed by Ace, 10, King, 9, 8, 7 of the designated Solo suit."}
                </p>
              </div>
            </div>
          </section>

          {/* Contracts Section */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-400">
              <BookOpen className="h-4 w-4" />
              {isDe ? "3. Spielarten" : "3. Contract Types"}
            </h3>
            <div className="space-y-3">
              <div>
                <strong className="text-white">{isDe ? "Sauspiel (Rufspiel - Partnerschaft):" : "Sauspiel (Normal Partnership Game):"}</strong>
                <p className="text-xs text-slate-300 mt-1">
                  {isDe ? (
                    "Der Ansager ruft ein Nicht-Trumpf-As (Eichel-As, Gras-As oder Schellen-As), von dessen Farbe er selbst mindestens eine Karte besitzt, aber nicht das As selbst hat. Wer das gerufene As besitzt, ist der geheime Partner des Ansagers. Erst wenn die gerufene Farbe ausgespielt wird, offenbart sich die Partnerschaft!"
                  ) : (
                    "The declarer calls a non-trump suit (Acorns, Leaves, or Bells) which they hold at least one card of, but do NOT own the Ace. Whoever owns the called Ace is their partner but must remain secret. When the called suit is led or played, the partnership is revealed!"
                  )}
                </p>
              </div>
              <div>
                <strong className="text-white">{isDe ? "Solo (Einer gegen Drei):" : "Solo (Single against 3):"}</strong>
                <p className="text-xs text-slate-300 mt-1">
                  {isDe ? (
                    "Ein Spieler spielt alleine gegen die drei anderen Mitspieler und bestimmt eine beliebige Farbe als Trumpffarbe. Er muss mindestens 61 Augen sammeln, um zu gewinnen."
                  ) : (
                    "One player claims they can take 61 points on their own against the other three defenders, selecting any suit as the trump suit."
                  )}
                </p>
              </div>
              <div>
                <strong className="text-white">{isDe ? "Wenz (Einer gegen Drei):" : "Wenz (Single against 3):"}</strong>
                <p className="text-xs text-slate-300 mt-1">
                  {isDe ? (
                    "Ähnlich wie beim Solo, aber nur die vier Unter sind Trumpf. Alle anderen Karten (einschließlich der Ober) sind normale Farbkarten. Keine Trumpffarbe."
                  ) : (
                    "Similar to Solo, but only Unters are trumps. All other suits rank in standard order without any suit trump."
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Card Following Section */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-base font-bold text-emerald-400">
              <ShieldAlert className="h-4 w-4" />
              {isDe ? "4. Spielregeln & Spielzwang" : "4. Strict Play Restrictions"}
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-300">
              {isDe ? (
                <>
                  <li>
                    <strong>Farbzwang:</strong> Wird eine Farbe angespielt, MUSST du diese Farbe bedienen, wenn du eine passende Karte auf der Hand hast. Wird ein Trumpf angespielt, MUSST du mit Trumpf bedienen!
                  </li>
                  <li>
                    <strong>Ruf-As Regel (Sauspiel):</strong> Wenn du das gerufene As besitzt, MUSST du es spielen, sobald die gerufene Farbe das erste Mal angespielt wird. Du darfst das gerufene As nicht abwerfen, wenn du anderweitig bedienen kannst. Du darfst die gerufene Farbe auch nicht selbst anspielen, außer du spielst das Ruf-As direkt aus.
                  </li>
                  <li>
                    <strong>Schmieren und Abwerfen:</strong> Wenn du eine angespielte Farbe nicht bedienen kannst (und keinen Trumpf zugeben willst/kannst), darfst du jede beliebige Karte abwerfen. Das ist die perfekte Gelegenheit, deinem Partner ein As oder eine 10 (hohe Augen) „zu schmieren“.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>Follow Suit (Farbzwang):</strong> If a suit is led, you MUST follow with that suit if you have it. If a trump card is led, you MUST follow with a trump card!
                  </li>
                  <li>
                    <strong>Called Ace Rule (Sauspiel):</strong> If you hold the Called Ace, you MUST play it whenever the called suit is led. You cannot play the Called Ace as a discard on other suits if you have card following options. Furthermore, you cannot lead a non-Ace of the called suit if you possess the Called Ace.
                  </li>
                  <li>
                    <strong>Discarding / Smearing:</strong> If you cannot follow suit or trump, you may play any card. This is a great opportunity to "schmieren" (grease/smear) an Ace or 10 (high points) to your partner.
                  </li>
                </>
              )}
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-neutral-800 pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-550 text-white px-5 py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg"
          >
            {isDe ? "Ois klar, packmas!" : "Got it, let's play!"}
          </button>
        </div>
      </div>
    </div>
  );
}
