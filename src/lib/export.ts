import { Card, CardValue, GameType, Suit } from "../game/types";
import { sortCardsForHand } from "../game/rules";
import { GameRecord } from "../persistence/GameHistoryStore";
import { Language } from "../types";
import { gameLabel, getCardSuitTranslated, getCardValueTranslated, translations } from "./i18n";

function cardFromId(cardId: string): Card {
  const parts = cardId.split("-");
  const suit = parts[0] as Suit;
  const value = parts[1] as CardValue;
  
  // Points mapping: Ace (A) = 11, Ten (10) = 10, King (K) = 4, Ober (O) = 3, Unter (U) = 2, others = 0
  const points = {
    [CardValue.ACE]: 11,
    [CardValue.TEN]: 10,
    [CardValue.KING]: 4,
    [CardValue.OBER]: 3,
    [CardValue.UNTER]: 2,
    [CardValue.NINE]: 0,
    [CardValue.EIGHT]: 0,
    [CardValue.SEVEN]: 0,
  }[value] ?? 0;

  return { id: cardId, suit, value, points };
}

function formatCard(cardId: string, lang: Language): string {
  const parts = cardId.split("-");
  if (parts.length !== 2) return cardId;
  const suit = parts[0] as Suit;
  const value = parts[1] as CardValue;

  const suitText = getCardSuitTranslated(suit, lang);
  const valueText = getCardValueTranslated(value, lang);

  return lang === "de" ? `${suitText}-${valueText}` : `${suitText} ${valueText}`;
}

export function formatGamesForExport(games: GameRecord[], lang: Language): string {
  const t = translations[lang];
  const dateStr = new Date().toLocaleString(lang === "de" ? "de-DE" : "en-US");

  let out = "";
  if (lang === "de") {
    out += `=== SCHAFPLAY SPIELHISTORIE ===\n`;
    out += `Exportiert am: ${dateStr}\n`;
    out += `Gesamtanzahl Spiele (Listen): ${games.length}\n`;
  } else {
    out += `=== SCHAFPLAY GAME HISTORY ===\n`;
    out += `Exported on: ${dateStr}\n`;
    out += `Total games (lists): ${games.length}\n`;
  }
  out += `==============================================\n\n`;

  // Sort games oldest to newest so they read chronologically in the export
  const sortedGames = [...games].reverse();

  for (let i = 0; i < sortedGames.length; i++) {
    const game = sortedGames[i];
    const gameNum = i + 1;
    const date = new Date(game.finishedAt).toLocaleString(lang === "de" ? "de-DE" : "en-US");

    const modeLabel = game.mode === "solo" ? (lang === "de" ? "Solo" : "Solo") : (lang === "de" ? "Mehrspieler" : "Multiplayer");
    const roleLabel = game.role === "host" ? (lang === "de" ? "Host" : "Host") : game.role === "guest" ? (lang === "de" ? "Gast" : "Guest") : (lang === "de" ? "Solo" : "Solo");

    if (lang === "de") {
      out += `Spiel #${gameNum}\n`;
      out += `Datum: ${date}\n`;
      out += `Modus: ${modeLabel}\n`;
      out += `Rolle: ${roleLabel}\n`;
      out += `Spieler:\n`;
    } else {
      out += `Game #${gameNum}\n`;
      out += `Date: ${date}\n`;
      out += `Mode: ${modeLabel}\n`;
      out += `Role: ${roleLabel}\n`;
      out += `Players:\n`;
    }

    const sortedPlayers = [...game.players].sort((a, b) => a.id.localeCompare(b.id));
    for (const p of sortedPlayers) {
      const typeStr = p.isHuman ? (lang === "de" ? "Mensch" : "Human") : "KI / AI";
      out += `  ${p.id}: ${p.name} (${typeStr})\n`;
    }

    out += lang === "de" ? `Runden:\n` : `Rounds:\n`;
    for (const r of game.rounds) {
      const contract = r.contract;
      let roundText = "";
      if (contract) {
        const declarer = game.players.find(p => p.id === contract.declarerId)?.name || contract.declarerId;
        const contractLabel = gameLabel(lang, contract.type, contract.calledSuit, contract.isTout);
        const partnerName = contract.partnerId ? (game.players.find(p => p.id === contract.partnerId)?.name || contract.partnerId) : "";
        if (partnerName) {
          if (lang === "de") {
            roundText = `${contractLabel} von ${declarer} (mit Partner ${partnerName})`;
          } else {
            roundText = `${contractLabel} by ${declarer} (with partner ${partnerName})`;
          }
        } else {
          if (lang === "de") {
            roundText = `${contractLabel} von ${declarer}`;
          } else {
            roundText = `${contractLabel} by ${declarer}`;
          }
        }
      } else {
        roundText = lang === "de" ? "Zusammengeworfen" : "All pass / Redeal";
      }

      // Add points
      const declarerPointsStr = lang === "de" ? `${r.result.declarerPoints} Augen` : `${r.result.declarerPoints} pts`;
      const defenderPointsStr = lang === "de" ? `${r.result.defenderPoints} Augen` : `${r.result.defenderPoints} pts`;
      const winStatus = r.result.declarerWon
        ? (lang === "de" ? "Spielerpartei gewinnt" : "Declarer side wins")
        : (lang === "de" ? "Nichtspieler gewinnen" : "Defenders win");

      const extrasList: string[] = [];
      if (r.result.isSchneider) extrasList.push(lang === "de" ? "Schneider" : "Schneider");
      if (r.result.isSchwarz) extrasList.push(lang === "de" ? "Schwarz" : "Schwarz");
      if (r.result.laufende > 0) {
        extrasList.push(lang === "de" ? `${r.result.laufende} Laufende` : `${r.result.laufende} Matadors`);
      }
      const extrasStr = extrasList.length > 0 ? ` [${extrasList.join(" · ")}]` : "";

      // Score changes
      const scoresList = sortedPlayers.map(p => {
        const change = r.result.scoreChanges[p.id] ?? 0;
        const changeStr = change >= 0 ? `+${change}` : `${change}`;
        return `${p.name}: ${changeStr}`;
      }).join(", ");

      if (lang === "de") {
        out += `  Runde ${r.roundNumber}: ${roundText} (${declarerPointsStr} vs ${defenderPointsStr}, ${winStatus})${extrasStr}\n`;
        out += `    Punkteänderung: ${scoresList}\n`;
      } else {
        out += `  Round ${r.roundNumber}: ${roundText} (${declarerPointsStr} vs ${defenderPointsStr}, ${winStatus})${extrasStr}\n`;
        out += `    Score changes: ${scoresList}\n`;
      }

      // Format bidding
      if (r.bids && r.bids.length > 0) {
        if (lang === "de") {
          out += `    Ansagephase:\n`;
        } else {
          out += `    Bidding Phase:\n`;
        }

        // 1. Will Phase
        for (const bid of r.bids) {
          const pName = game.players.find(p => p.id === bid.playerId)?.name || bid.playerId;
          const statusStr = bid.wantsToPlay
            ? (lang === "de" ? "Ich würde spielen!" : "Wants to play!")
            : (lang === "de" ? "Weiter" : "Pass");
          out += `      ${pName}: ${statusStr}\n`;
        }

        // 2. Declare Phase
        if (r.declarations && r.declarations.length > 0) {
          for (const dec of r.declarations) {
            const pName = game.players.find(p => p.id === dec.playerId)?.name || dec.playerId;
            if (dec.declaration) {
              const label = gameLabel(lang, dec.declaration.type, dec.declaration.calledSuit, dec.declaration.isTout);
              if (lang === "de") {
                out += `      ${pName} bietet: ${label}\n`;
              } else {
                out += `      ${pName} bids: ${label}\n`;
              }
            } else {
              if (lang === "de") {
                out += `      ${pName} zieht zurück\n`;
              } else {
                out += `      ${pName} retreats\n`;
              }
            }
          }
        }
      }

      // 1. Format Dealt Cards (Initial hands)
      if (r.tricks.length > 0) {
        if (lang === "de") {
          out += `    Ausgeteilte Karten (Anfang):\n`;
        } else {
          out += `    Dealt Cards (Start):\n`;
        }

        const playerInitialHands: Record<string, string[]> = {};
        for (const player of game.players) {
          playerInitialHands[player.id] = [];
        }
        for (const trick of r.tricks) {
          for (const play of trick.plays) {
            if (playerInitialHands[play.playerId]) {
              playerInitialHands[play.playerId].push(play.card);
            }
          }
        }

        for (const p of sortedPlayers) {
          const handCardIds = playerInitialHands[p.id];
          const cardsObj = handCardIds.map(cardFromId);
          const sortedCards = sortCardsForHand(cardsObj, contract?.type ?? GameType.SAUSPIEL);
          const formattedCards = sortedCards.map(c => formatCard(c.id, lang)).join(", ");

          const typeStr = p.isHuman ? (lang === "de" ? "Mensch" : "Human") : "KI / AI";
          out += `      ${p.name} (${typeStr}): ${formattedCards}\n`;
        }

        // 2. Format played cards/tricks details
        if (lang === "de") {
          out += `    Spielverlauf (Stiche):\n`;
        } else {
          out += `    Trick History (Tricks):\n`;
        }

        for (let tIdx = 0; tIdx < r.tricks.length; tIdx++) {
          const trick = r.tricks[tIdx];
          const trickNum = tIdx + 1;

          if (lang === "de") {
            out += `      Stich ${trickNum}:\n`;
          } else {
            out += `      Trick ${trickNum}:\n`;
          }

          for (let pIdx = 0; pIdx < trick.plays.length; pIdx++) {
            const play = trick.plays[pIdx];
            const pName = game.players.find(p => p.id === play.playerId)?.name || play.playerId;
            const pRole = pIdx === 0 ? (lang === "de" ? " (Ausspieler)" : " (Leader)") : "";
            out += `        ${pName}${pRole}: ${formatCard(play.card, lang)}\n`;
          }

          if (trick.winnerId) {
            const winnerName = game.players.find(p => p.id === trick.winnerId)?.name || trick.winnerId;
            if (lang === "de") {
              out += `        -> Stich geht an: ${winnerName}\n`;
            } else {
              out += `        -> Trick won by: ${winnerName}\n`;
            }
          }
        }
      }
    }

    if (lang === "de") {
      out += `Endstand:\n`;
    } else {
      out += `Final Standings:\n`;
    }
    for (const p of sortedPlayers) {
      const finalScore = game.finalScores[p.id] ?? 0;
      const finalScoreStr = finalScore >= 0 ? `+${finalScore}` : `${finalScore}`;
      out += `  ${p.name}: ${finalScoreStr}\n`;
    }

    out += `\n----------------------------------------------\n\n`;
  }

  return out.trim();
}
