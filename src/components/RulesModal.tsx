/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Language } from "../lib/i18n";
import { XIcon, BookOpenIcon } from "./icons";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

const LayersIcon = ({ className }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 12 12 17 22 12"></polyline>
    <polyline points="2 17 12 22 22 17"></polyline>
  </svg>
);

const AwardIcon = ({ className }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="7"></circle>
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
  </svg>
);

const ShieldAlertIcon = ({ className }: { className?: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export default function RulesModal({ isOpen, onClose, language }: RulesModalProps) {
  if (!isOpen) return null;

  const isDe = language === "de";

  return (
    <div className="rules-modal-overlay">
      <div className="rules-modal-container">
        {/* Header */}
        <div className="rules-modal-header">
          <div className="rules-modal-title-container">
            <BookOpenIcon className="rules-modal-icon-red" />
            <h2 className="rules-modal-title">
              {isDe ? "Schafkopf Spielregeln & Guide" : "Schafkopf Rules & Guide"}
            </h2>
          </div>
          <button onClick={onClose} className="rules-modal-close-btn">
            <XIcon className="rules-modal-close-icon" />
          </button>
        </div>

        {/* Content */}
        <div className="rules-modal-content">
          {/* Card Deck Section */}
          <section className="rules-modal-section">
            <h3 className="rules-modal-section-title">
              <LayersIcon className="rules-modal-section-icon" />
              {isDe ? "1. Das bayerische Blatt (32 Karten)" : "1. The Bavarian Card Deck (32 Cards)"}
            </h3>
            <p className="rules-modal-paragraph">
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
            <div className="rules-modal-grid">
              <div className="rules-modal-grid-item">
                <span className="rules-modal-grid-item-value">{isDe ? "As / Sau" : "Ace"}</span>
                <span className="rules-modal-grid-item-label">{isDe ? "11 Augen" : "11 Points"}</span>
              </div>
              <div className="rules-modal-grid-item">
                <span className="rules-modal-grid-item-value">10</span>
                <span className="rules-modal-grid-item-label">{isDe ? "10 Augen" : "10 Points"}</span>
              </div>
              <div className="rules-modal-grid-item">
                <span className="rules-modal-grid-item-value">{isDe ? "König" : "King"}</span>
                <span className="rules-modal-grid-item-label">{isDe ? "4 Augen" : "4 Points"}</span>
              </div>
              <div className="rules-modal-grid-item">
                <span className="rules-modal-grid-item-value">Ober</span>
                <span className="rules-modal-grid-item-label">{isDe ? "3 Augen" : "3 Points"}</span>
              </div>
              <div className="rules-modal-grid-item">
                <span className="rules-modal-grid-item-value">Unter</span>
                <span className="rules-modal-grid-item-label">{isDe ? "2 Augen" : "2 Points"}</span>
              </div>
              <div className="rules-modal-grid-item rules-modal-grid-item-span">
                <span className="rules-modal-grid-item-value">9, 8, 7</span>
                <span className="rules-modal-grid-item-label">{isDe ? "0 Augen" : "0 Points"}</span>
              </div>
            </div>
            <p className="rules-modal-caption">
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
          <section className="rules-modal-section">
            <h3 className="rules-modal-section-title">
              <AwardIcon className="rules-modal-section-icon" />
              {isDe ? "2. Trumpf-Hierarchie" : "2. Trumps Hierarchy"}
            </h3>
            <p className="rules-modal-paragraph">
              {isDe ? "Je nach angesagtem Spiel gelten andere Karten als Trumpf:" : "Depending on the active contract, different cards are defined as trumps:"}
            </p>
            <div className="rules-modal-hierarchy-list">
              <div className="rules-modal-hierarchy-item rules-border-red">
                <h4 className="rules-modal-hierarchy-title">{isDe ? "Normales Spiel (Sauspiel) & Herz-Solo" : "Normal Game (Sauspiel) & Heart Solo"}</h4>
                <p className="rules-modal-hierarchy-subtitle">
                  <strong>{isDe ? "Trümpfe (Höchster bis Niedrigster):" : "Trumps (Highest to Lowest):"}</strong>
                </p>
                <p className="rules-modal-hierarchy-text">
                  <span className="inline-block rotate-180">🌰</span> Ober &rarr; 🍃 Ober &rarr; ❤️ Ober &rarr; 🔔 Ober &rarr; <span className="inline-block rotate-180">🌰</span> Unter &rarr; 🍃 Unter &rarr; ❤️ Unter &rarr; 🔔 Unter &rarr; ❤️ As &rarr; ❤️ 10 &rarr; ❤️ König &rarr; ❤️ 9 &rarr; ❤️ 8 &rarr; ❤️ 7
                </p>
              </div>

              <div className="rules-modal-hierarchy-item rules-border-amber">
                <h4 className="rules-modal-hierarchy-title">{isDe ? "Wenz (Nur die Unter sind Trumpf)" : "Wenz (Only Unters are Trump)"}</h4>
                <p className="rules-modal-hierarchy-text">
                  <strong>{isDe ? "Trümpfe:" : "Trumps:"}</strong> <span className="inline-block rotate-180">🌰</span> Unter &rarr; 🍃 Unter &rarr; ❤️ Unter &rarr; 🔔 Unter. {isDe ? "Alle anderen Karten (einschließlich der Ober) sind normale Farbkarten." : "All other cards (including Obers) are non-trumps of their respective suits."}
                </p>
              </div>

              <div className="rules-modal-hierarchy-item rules-border-blue">
                <h4 className="rules-modal-hierarchy-title">{isDe ? "Farbsolo (Eichel, Gras oder Schellen)" : "Suit Solo (Acorns, Leaves, or Bells)"}</h4>
                <p className="rules-modal-hierarchy-text">
                  <strong>{isDe ? "Trümpfe:" : "Trumps:"}</strong> {isDe ? "Ober & Unter (gleiche Reihenfolge wie beim Normalspiel), gefolgt von As, 10, König, 9, 8, 7 der angesagten Solo-Farbe." : "Obers & Unters (same order as normal game), followed by Ace, 10, King, 9, 8, 7 of the designated Solo suit."}
                </p>
              </div>
            </div>
          </section>

          {/* Contracts Section */}
          <section className="rules-modal-section">
            <h3 className="rules-modal-section-title">
              <BookOpenIcon className="rules-modal-section-icon" />
              {isDe ? "3. Spielarten" : "3. Contract Types"}
            </h3>
            <div className="rules-modal-hierarchy-list">
              <div className="rules-modal-contract-item">
                <strong className="rules-modal-contract-title">{isDe ? "Sauspiel (Rufspiel - Partnerschaft):" : "Sauspiel (Normal Partnership Game):"}</strong>
                <p className="rules-modal-contract-text">
                  {isDe ? (
                    "Der Ansager ruft ein Nicht-Trumpf-As (Eichel-As, Gras-As oder Schellen-As), von dessen Farbe er selbst mindestens eine Karte besitzt, aber nicht das As selbst hat. Wer das gerufene As besitzt, ist der geheime Partner des Ansagers. Erst wenn die gerufene Farbe ausgespielt wird, offenbart sich die Partnerschaft!"
                  ) : (
                    "The declarer calls a non-trump suit (Acorns, Leaves, or Bells) which they hold at least one card of, but do NOT own the Ace. Whoever owns the called Ace is their partner but must remain secret. When the called suit is led or played, the partnership is revealed!"
                  )}
                </p>
              </div>
              <div className="rules-modal-contract-item">
                <strong className="rules-modal-contract-title">{isDe ? "Solo (Einer gegen Drei):" : "Solo (Single against 3):"}</strong>
                <p className="rules-modal-contract-text">
                  {isDe ? (
                    "Ein Spieler spielt alleine gegen die drei anderen Mitspieler und bestimmt eine beliebige Farbe als Trumpffarbe. Er muss mindestens 61 Augen sammeln, um zu gewinnen."
                  ) : (
                    "One player claims they can take 61 points on their own against the other three defenders, selecting any suit as the trump suit."
                  )}
                </p>
              </div>
              <div className="rules-modal-contract-item">
                <strong className="rules-modal-contract-title">{isDe ? "Wenz (Einer gegen Drei):" : "Wenz (Single against 3):"}</strong>
                <p className="rules-modal-contract-text">
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
          <section className="rules-modal-section">
            <h3 className="rules-modal-section-title">
              <ShieldAlertIcon className="rules-modal-section-icon" />
              {isDe ? "4. Spielregeln & Spielzwang" : "4. Strict Play Restrictions"}
            </h3>
            <ul className="rules-modal-list">
              {isDe ? (
                <>
                  <li className="rules-modal-list-item">
                    <strong>Farbzwang:</strong> Wird eine Farbe angespielt, MUSST du diese Farbe bedienen, wenn du eine passende Karte auf der Hand hast. Wird ein Trumpf angespielt, MUSST du mit Trumpf bedienen!
                  </li>
                  <li className="rules-modal-list-item">
                    <strong>Ruf-As Regel (Sauspiel):</strong> Wenn du das gerufene As besitzt, MUSST du es spielen, sobald die gerufene Farbe das erste Mal angespielt wird. Du darfst das gerufene As nicht abwerfen, wenn du anderweitig bedienen kannst. Du darfst die gerufene Farbe auch nicht selbst anspielen, außer du spielst das Ruf-As direkt aus.
                  </li>
                  <li className="rules-modal-list-item">
                    <strong>Schmieren und Abwerfen:</strong> Wenn du eine angespielte Farbe nicht bedienen kannst (und keinen Trumpf zugeben willst/kannst), darfst du jede beliebige Karte abwerfen. Das ist die perfekte Gelegenheit, deinem Partner ein As oder eine 10 (hohe Augen) „zu schmieren“.
                  </li>
                </>
              ) : (
                <>
                  <li className="rules-modal-list-item">
                    <strong>Follow Suit (Farbzwang):</strong> If a suit is led, you MUST follow with that suit if you have it. If a trump card is led, you MUST follow with a trump card!
                  </li>
                  <li className="rules-modal-list-item">
                    <strong>Called Ace Rule (Sauspiel):</strong> If you hold the Called Ace, you MUST play it whenever the called suit is led. You cannot play the Called Ace as a discard on other suits if you have card following options. Furthermore, you cannot lead a non-Ace of the called suit if you possess the Called Ace.
                  </li>
                  <li className="rules-modal-list-item">
                    <strong>Discarding / Smearing:</strong> If you cannot follow suit or trump, you may play any card. This is a great opportunity to "schmieren" (grease/smear) an Ace or 10 (high points) to your partner.
                  </li>
                </>
              )}
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="rules-modal-footer">
          <button onClick={onClose} className="rules-modal-action-btn">
            {isDe ? "Ois klar, packmas!" : "Got it, let's play!"}
          </button>
        </div>
      </div>
    </div>
  );
}
