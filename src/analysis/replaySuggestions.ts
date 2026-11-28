import { cardFromId } from "../game/deck";
import { canOverrideBid, getCallableSuits, getLegalCards, isCalledAce, isRetreatAllowed } from "../game/rules";
import { BidDeclaration, Card, Contract, GameDeclaration, GameType, PlayedCard, Trick, WillBid } from "../game/types";
import { GameRecord, RoundRecord } from "../persistence/GameHistoryStore";
import { getAIBid, getAICardPlay, getAIWillBid } from "../players/aiHeuristics";
import { reconstructHands, ReplayStep } from "./replay";

interface ReplayDecisions {
  hands: Partial<Record<string, Card[]>>;
  play: { contract: Contract; tricks: Trick[] } | null;
  will: { recorded: WillBid; suggestion?: boolean }[];
  declarations: { recorded: BidDeclaration; suggestion?: GameDeclaration | null }[];
}

/** Rebuild only the inputs the live AI receives, leaving the stored round untouched. */
export function replayDecisions(game: GameRecord, round: RoundRecord): ReplayDecisions {
  const seatIds = game.players.map((player) => player.id);
  const reconstructed = reconstructHands(round);
  const cardsById = new Map<string, Card>();
  const duplicates = new Set<string>();
  for (const card of Object.values(reconstructed).flat()) {
    if (cardsById.has(card.id)) duplicates.add(card.id);
    cardsById.set(card.id, card);
  }

  const hands: ReplayDecisions["hands"] = {};
  for (const id of seatIds) {
    const cards = reconstructed[id];
    if (cards?.length === 8 && cards.every((card) => !duplicates.has(card.id))) hands[id] = cards;
  }
  const completeDeal = seatIds.length === 4 && Object.keys(hands).length === 4 && cardsById.size === 32;

  // The local hand retains its original deal order, which breaks ties in the AI.
  const localHand = (round.initialHand ?? []).map(cardFromId).filter((card) => card !== null);
  const localIds = new Set(localHand.map((card) => card.id));
  const localId = game.localPlayerId;
  if (localHand.length === 8 && localIds.size === 8 && seatIds.includes(localId) &&
      (reconstructed[localId] ?? []).every((card) => localIds.has(card.id)) &&
      seatIds.filter((id) => id !== localId).every((id) =>
        !(reconstructed[id] ?? []).some((card) => localIds.has(card.id)),
      )) {
    hands[localId] = localHand;
  }

  let play: ReplayDecisions["play"] = null;
  if (completeDeal && round.contract && round.tricks.length === 8 && round.tricks.every(
    (trick) => trick.plays.length === 4 && new Set(trick.plays.map((entry) => entry.playerId)).size === 4,
  )) {
    const contract = round.contract;
    // The live AI gets the engine's contract, including the actual Sauspiel team.
    const partnerId = contract.type === GameType.SAUSPIEL
      ? seatIds.find((id) => hands[id]?.some((card) => isCalledAce(card, contract)))
      : undefined;
    if (contract.type !== GameType.SAUSPIEL || (partnerId && partnerId !== contract.declarerId)) {
      play = {
        contract: { ...contract, partnerId },
        tricks: round.tricks.map((trick, index) => ({
          id: index + 1,
          leaderId: trick.leaderId,
          winnerId: trick.winnerId,
          playedCards: trick.plays.map((entry) => ({ playerId: entry.playerId, card: cardsById.get(entry.card)! })),
        })),
      };
    }
  }

  // Will decisions only see the earlier answers, starting at the opening lead's seat.
  const openingLeader = round.tricks[0]?.leaderId;
  const forehand = seatIds.indexOf(openingLeader);
  const priorWillBids: WillBid[] = [];
  const will: ReplayDecisions["will"] = [];
  for (const recorded of round.bids ?? []) {
    const { playerId } = recorded;
    if (forehand < 0 || priorWillBids.length >= seatIds.length ||
        playerId !== seatIds[(forehand + priorWillBids.length) % seatIds.length]) break;
    const cards = hands[playerId];
    will.push({ recorded, suggestion: cards && getAIWillBid({ id: playerId, cards }, priorWillBids, playerId === openingLeader) });
    priorWillBids.push(recorded);
  }

  let highBid: BidDeclaration | null = null;
  const declarations: ReplayDecisions["declarations"] = [];
  for (const recorded of round.declarations ?? []) {
    const { playerId, declaration } = recorded;
    const standing = highBid?.declaration ?? null;
    const canRetreat = highBid?.playerId !== playerId && isRetreatAllowed(standing);
    if (!seatIds.includes(playerId) || (declaration ? !canOverrideBid(standing, declaration) : !canRetreat)) break;

    const cards = hands[playerId];
    let suggestion: GameDeclaration | null | undefined;
    if (cards && forehand >= 0) {
      const candidate = getAIBid({ id: playerId, cards }, standing, canRetreat, playerId === openingLeader);
      if (candidate === null ? canRetreat : isLegalBid(candidate, standing, cards)) suggestion = candidate;
    }
    declarations.push({ recorded, suggestion });
    // The next decision follows the recorded auction, even when the AI disagrees.
    if (declaration) highBid = recorded;
  }
  return { hands, play, will, declarations };
}

function isLegalBid(candidate: GameDeclaration, standing: GameDeclaration | null, cards: Card[]): boolean {
  if (candidate.type === GameType.RAMSCH || !canOverrideBid(standing, candidate)) return false;
  return candidate.type !== GameType.SAUSPIEL ||
    (!candidate.isTout && !!candidate.calledSuit && getCallableSuits(cards).includes(candidate.calledSuit));
}

/** The decision before the next recorded play, including the next lead during a trick hold. */
export function replayCardSuggestion(decisions: ReplayDecisions, view: ReplayStep): PlayedCard | null {
  if (!decisions.play) return null;
  const { contract, tricks } = decisions.play;
  const trickIndex = view.trick.complete ? view.trick.index + 1 : view.trick.index;
  const playIndex = view.trick.complete ? 0 : view.cardNumber;
  const trick = tricks[trickIndex];
  const next = trick?.playedCards[playIndex];
  if (!next) return null;

  const { playerId } = next;
  const remainingIds = new Set(view.hands[playerId]?.map((card) => card.id));
  const cards = (decisions.hands[playerId] ?? []).filter((card) => remainingIds.has(card.id));
  const currentTrick = { id: trick.id, leaderId: trick.leaderId, playedCards: trick.playedCards.slice(0, playIndex) };
  const completed = tricks.slice(0, trickIndex);
  const legal = getLegalCards(cards, currentTrick, contract, completed);
  if (legal.length === 0) return null;
  const card = getAICardPlay({ id: playerId, cards }, currentTrick, contract, completed);
  return legal.some((candidate) => candidate.id === card?.id) ? { playerId, card } : null;
}
