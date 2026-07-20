import { Card, CardValue, GameType, Suit } from "../game/types";
import { CARD_POINTS } from "../game/deck";
import { sortCardsForHand } from "../game/rules";
import { GameRecord } from "../persistence/GameHistoryStore";
import { Language } from "../types";
import { gameLabel, getCardSuitTranslated, getCardValueTranslated } from "./i18n";

/**
 * Every fixed label of the text export, per language. Schafkopf terms that are
 * kept untranslated (Schneider, Schwarz, "KI / AI") stay inline below.
 */
const STRINGS = {
  de: {
    locale: "de-DE",
    title: "=== SCHAFPLAY SPIELHISTORIE ===",
    exportedOn: "Exportiert am",
    totalGames: "Gesamtanzahl Spiele (Listen)",
    game: "Spiel",
    date: "Datum",
    mode: "Modus",
    role: "Rolle",
    players: "Spieler",
    modeSolo: "Solo",
    modeMultiplayer: "Mehrspieler",
    roleHost: "Host",
    roleGuest: "Gast",
    roleSolo: "Solo",
    human: "Mensch",
    rounds: "Runden",
    round: "Runde",
    by: "von",
    withPartner: "mit Partner",
    allPass: "Zusammengeworfen",
    points: "Augen",
    declarerWins: "Spielerpartei gewinnt",
    defendersWin: "Nichtspieler gewinnen",
    laufende: "Laufende",
    scoreChanges: "Punkteänderung",
    biddingPhase: "Ansagephase",
    willPlay: "Ich würde spielen!",
    pass: "Weiter",
    bids: "bietet:",
    retreats: "zieht zurück",
    dealtCards: "Ausgeteilte Karten (Anfang)",
    trickHistory: "Spielverlauf (Stiche)",
    trick: "Stich",
    leader: "Ausspieler",
    trickWonBy: "Stich geht an",
    finalStandings: "Endstand",
  },
  en: {
    locale: "en-US",
    title: "=== SCHAFPLAY GAME HISTORY ===",
    exportedOn: "Exported on",
    totalGames: "Total games (lists)",
    game: "Game",
    date: "Date",
    mode: "Mode",
    role: "Role",
    players: "Players",
    modeSolo: "Solo",
    modeMultiplayer: "Multiplayer",
    roleHost: "Host",
    roleGuest: "Guest",
    roleSolo: "Solo",
    human: "Human",
    rounds: "Rounds",
    round: "Round",
    by: "by",
    withPartner: "with partner",
    allPass: "All pass / Redeal",
    points: "pts",
    declarerWins: "Declarer side wins",
    defendersWin: "Defenders win",
    laufende: "Matadors",
    scoreChanges: "Score changes",
    biddingPhase: "Bidding Phase",
    willPlay: "Wants to play!",
    pass: "Pass",
    bids: "bids:",
    retreats: "retreats",
    dealtCards: "Dealt Cards (Start)",
    trickHistory: "Trick History (Tricks)",
    trick: "Trick",
    leader: "Leader",
    trickWonBy: "Trick won by",
    finalStandings: "Final Standings",
  },
} satisfies Record<Language, Record<string, string>>;

function signed(score: number): string {
  return score >= 0 ? `+${score}` : `${score}`;
}

function cardFromId(cardId: string): Card {
  const [suit, value] = cardId.split("-") as [Suit, CardValue];
  return { id: cardId, suit, value, points: CARD_POINTS[value] ?? 0 };
}

function formatCard(cardId: string, lang: Language): string {
  const parts = cardId.split("-");
  if (parts.length !== 2) return cardId;
  const suitText = getCardSuitTranslated(parts[0] as Suit, lang);
  const valueText = getCardValueTranslated(parts[1] as CardValue, lang);
  return lang === "de" ? `${suitText}-${valueText}` : `${suitText} ${valueText}`;
}

export function formatGamesForExport(games: GameRecord[], lang: Language): string {
  const L = STRINGS[lang];

  let out = `${L.title}\n`;
  out += `${L.exportedOn}: ${new Date().toLocaleString(L.locale)}\n`;
  out += `${L.totalGames}: ${games.length}\n`;
  out += `==============================================\n\n`;

  // Sort games oldest to newest so they read chronologically in the export
  const sortedGames = [...games].reverse();

  sortedGames.forEach((game, gameIdx) => {
    const date = new Date(game.finishedAt).toLocaleString(L.locale);
    const sortedPlayers = [...game.players].sort((a, b) => a.id.localeCompare(b.id));
    const playerName = (id: string) => game.players.find((p) => p.id === id)?.name || id;
    const humanOrAi = (isHuman: boolean) => (isHuman ? L.human : "KI / AI");

    out += `${L.game} #${gameIdx + 1}\n`;
    out += `${L.date}: ${date}\n`;
    out += `${L.mode}: ${game.mode === "solo" ? L.modeSolo : L.modeMultiplayer}\n`;
    out += `${L.role}: ${game.role === "host" ? L.roleHost : game.role === "guest" ? L.roleGuest : L.roleSolo}\n`;
    out += `${L.players}:\n`;
    for (const p of sortedPlayers) {
      out += `  ${p.id}: ${p.name} (${humanOrAi(p.isHuman)})\n`;
    }

    out += `${L.rounds}:\n`;
    for (const r of game.rounds) {
      const contract = r.contract;
      let roundText: string;
      if (contract) {
        const contractLabel = gameLabel(lang, contract.type, contract.calledSuit, contract.isTout);
        roundText = `${contractLabel} ${L.by} ${playerName(contract.declarerId)}`;
        if (contract.partnerId) roundText += ` (${L.withPartner} ${playerName(contract.partnerId)})`;
      } else {
        roundText = L.allPass;
      }

      const winStatus = r.result.declarerWon ? L.declarerWins : L.defendersWin;
      const extrasList: string[] = [];
      if (r.result.isSchneider) extrasList.push("Schneider");
      if (r.result.isSchwarz) extrasList.push("Schwarz");
      if (r.result.laufende > 0) extrasList.push(`${r.result.laufende} ${L.laufende}`);
      const extrasStr = extrasList.length > 0 ? ` [${extrasList.join(" · ")}]` : "";

      const scoresList = sortedPlayers.map((p) => `${p.name}: ${signed(r.result.scoreChanges[p.id] ?? 0)}`).join(", ");

      out += `  ${L.round} ${r.roundNumber}: ${roundText} (${r.result.declarerPoints} ${L.points} vs ${r.result.defenderPoints} ${L.points}, ${winStatus})${extrasStr}\n`;
      out += `    ${L.scoreChanges}: ${scoresList}\n`;

      if (r.bids && r.bids.length > 0) {
        out += `    ${L.biddingPhase}:\n`;
        for (const bid of r.bids) {
          out += `      ${playerName(bid.playerId)}: ${bid.wantsToPlay ? L.willPlay : L.pass}\n`;
        }
        for (const dec of r.declarations ?? []) {
          if (dec.declaration) {
            const label = gameLabel(lang, dec.declaration.type, dec.declaration.calledSuit, dec.declaration.isTout);
            out += `      ${playerName(dec.playerId)} ${L.bids} ${label}\n`;
          } else {
            out += `      ${playerName(dec.playerId)} ${L.retreats}\n`;
          }
        }
      }

      if (r.tricks.length > 0) {
        // Each player's dealt hand, reconstructed from the cards they played.
        out += `    ${L.dealtCards}:\n`;
        const initialHands: Record<string, string[]> = Object.fromEntries(game.players.map((p) => [p.id, []]));
        for (const trick of r.tricks) {
          for (const play of trick.plays) {
            initialHands[play.playerId]?.push(play.card);
          }
        }
        for (const p of sortedPlayers) {
          const sortedCards = sortCardsForHand(initialHands[p.id].map(cardFromId), contract?.type ?? GameType.SAUSPIEL);
          const formattedCards = sortedCards.map((c) => formatCard(c.id, lang)).join(", ");
          out += `      ${p.name} (${humanOrAi(p.isHuman)}): ${formattedCards}\n`;
        }

        out += `    ${L.trickHistory}:\n`;
        r.tricks.forEach((trick, trickIdx) => {
          out += `      ${L.trick} ${trickIdx + 1}:\n`;
          trick.plays.forEach((play, playIdx) => {
            const leaderSuffix = playIdx === 0 ? ` (${L.leader})` : "";
            out += `        ${playerName(play.playerId)}${leaderSuffix}: ${formatCard(play.card, lang)}\n`;
          });
          if (trick.winnerId) {
            out += `        -> ${L.trickWonBy}: ${playerName(trick.winnerId)}\n`;
          }
        });
      }
    }

    out += `${L.finalStandings}:\n`;
    for (const p of sortedPlayers) {
      out += `  ${p.name}: ${signed(game.finalScores[p.id] ?? 0)}\n`;
    }

    out += `\n----------------------------------------------\n\n`;
  });

  return out.trim();
}
