/** AI decision heuristics — pure; the engine owns pacing and validation. */

import { Card, CardValue, Contract, GameDeclaration, GameType, StossKind, Suit, Trick, WillBid } from "../game/types";
import {
  canOverrideBid,
  countPoints,
  determineTrickWinner,
  getCallableSuits,
  getCardRank,
  getGamePriority,
  getLegalCards,
  isOberOrUnter,
  isTrump,
  soloTypeFor,
} from "../game/rules";
import { countGuaranteedWenzTricks, getWenzPlainMasters } from "./wenz";

interface AIHand {
  id: string;
  cards: Card[];
}

export function getAIWillBid(player: AIHand, willBids: WillBid[], leadsOpeningTrick = false): boolean {
  const someoneElseWantsToPlay = willBids.some((bid) => bid.playerId !== player.id && bid.wantsToPlay);
  // A "will" can't be taken back once a Sauspiel stands (#24). If another
  // player has committed, make sure we can beat at least that game.
  const minimumBid = someoneElseWantsToPlay ? { type: GameType.SAUSPIEL } : null;
  return getAIBid(player, minimumBid, true, leadsOpeningTrick) !== null;
}

/** `canRetreat` = "Doch passen" (#24): may only bow out once a Wenz/Solo stands. */
export function getAIBid(
  player: AIHand,
  existingDeclaration: GameDeclaration | null = null,
  canRetreat = true,
  leadsOpeningTrick = false,
): GameDeclaration | null {
  const hand = player.cards;
  const guaranteedTricks = countGuaranteedWenzTricks(hand, leadsOpeningTrick);
  const wenz = { type: GameType.WENZ };
  if (guaranteedTricks >= 5 && canOverrideBid(existingDeclaration, wenz)) return wenz;

  const obers = hand.filter((card) => card.value === CardValue.OBER).length;
  const normalTrumps = hand.filter((card) => isTrump(card, GameType.SAUSPIEL)).length;
  const declarations: GameDeclaration[] = [];

  const callableSuit = getCallableSuits(hand)[0];
  const goodSauspielHand = (normalTrumps >= 4 && obers >= 1) || normalTrumps >= 5;
  if (goodSauspielHand && callableSuit) declarations.push({ type: GameType.SAUSPIEL, calledSuit: callableSuit });

  if (guaranteedTricks === 8) declarations.push({ type: GameType.WENZ, isTout: true });

  if (obers >= 3 && normalTrumps >= 7) {
    declarations.push({ type: bestSoloType(hand), isTout: obers >= 4 && normalTrumps >= 8 });
  }

  // Lowest-ranking viable game first; reach higher only to overbid.
  const chosen = declarations
    .sort((a, b) => getGamePriority(a.type, a.isTout) - getGamePriority(b.type, b.isTout))
    .find((declaration) => canOverrideBid(existingDeclaration, declaration));
  if (chosen) return chosen;

  // Committed to topping the standing Sauspiel: pick the least-bad higher game.
  if (!canRetreat) {
    const unters = hand.filter((card) => card.value === CardValue.UNTER).length;
    const fallback = unters >= 2 ? wenz : { type: bestSoloType(hand) };
    if (canOverrideBid(existingDeclaration, fallback)) return fallback;
  }
  return null;
}

function bestSoloType(hand: Card[]): GameType {
  const counts = [Suit.HEARTS, Suit.ACORNS, Suit.LEAVES, Suit.BELLS].map((suit) => ({
    suit,
    count: hand.filter((card) => card.suit === suit && !isOberOrUnter(card)).length,
  }));
  // Stable sort: ties go to the earlier suit, Hearts first.
  return soloTypeFor(counts.sort((a, b) => b.count - a.count)[0].suit);
}

/**
 * Stoß (defender) / Retour (declarer). Deliberately conservative — a doubled
 * game is a big swing. Eligibility and timing are enforced by the engine.
 */
export function getAIStoss(hand: Card[], contract: Contract, kind: StossKind): boolean {
  if (contract.type === GameType.RAMSCH) return false;
  const obers = hand.filter((card) => card.value === CardValue.OBER).length;
  const trumps = hand.filter((card) => isTrump(card, contract.type)).length;
  if (kind === "retour") {
    return obers >= 3 && trumps >= 6;
  }
  return obers >= 3 || (obers >= 2 && trumps >= 6);
}

export function getAICardPlay(
  player: AIHand,
  currentTrick: Trick | null,
  contract: Contract | null,
  tricks: Trick[],
): Card {
  const legalCards = getLegalCards(player.cards, currentTrick, contract, tricks);
  if (legalCards.length === 1) return legalCards[0];
  const gameType = contract?.type ?? GameType.SAUSPIEL;

  // Ramsch (#11): everyone plays for themselves, so the team logic below
  // does not apply.
  if (gameType === GameType.RAMSCH) {
    return getRamschCardPlay(player.id, currentTrick, legalCards);
  }

  if (!contract || !currentTrick || currentTrick.playedCards.length === 0) {
    return chooseLead(player, legalCards, contract, gameType, tricks);
  }

  const played = currentTrick.playedCards;
  const currentWinnerId = determineTrickWinner(played, gameType);
  const partnerIsWinning = onSameTeam(player.id, currentWinnerId, contract);
  const trickPoints = countPoints(played.map((entry) => entry.card));
  const isLastToPlay = played.length === 3;
  const winners = legalCards.filter(
    (card) => determineTrickWinner([...played, { playerId: player.id, card }], gameType) === player.id,
  );

  // Void in the led plain suit ("frei"): trump in rather than throw away,
  // unless the trick is already secure. Prefer the trump Ace, then Ten — fat
  // point cards that are otherwise weak trumps.
  const ledCard = played[0].card;
  const voidInLedSuit =
    !isTrump(ledCard, gameType) &&
    !player.cards.some((card) => card.suit === ledCard.suit && !isTrump(card, gameType));
  const winnerCard = played.find((entry) => entry.playerId === currentWinnerId)!.card;
  const trickSecure = partnerIsWinning && (isLastToPlay || isTrump(winnerCard, gameType));
  if (voidInLedSuit && !trickSecure) {
    const trumpWinners = winners.filter((card) => isTrump(card, gameType));
    if (trumpWinners.length > 0) {
      return (
        trumpWinners.find((card) => card.value === CardValue.ACE) ??
        trumpWinners.find((card) => card.value === CardValue.TEN) ??
        lowestRankCard(trumpWinners, gameType)
      );
    }
  }

  if (partnerIsWinning) {
    // Only safe to schmier when no opponent is left to scoop up the points.
    return isLastToPlay ? schmierCard(legalCards, gameType) : lowestValueCard(legalCards, gameType);
  }

  const worthTaking = trickPoints >= 10 || (isLastToPlay && trickPoints >= 4);
  if (winners.length > 0 && worthTaking) return lowestRankCard(winners, gameType);
  return lowestValueCard(legalCards, gameType);
}

/**
 * Ramsch (#11): dodge points. A card that doesn't beat the current winner can
 * never take the trick, so the most valuable loser is a safe dump.
 */
function getRamschCardPlay(playerId: string, currentTrick: Trick | null, legal: Card[]): Card {
  const gameType = GameType.RAMSCH;
  const played = currentTrick?.playedCards ?? [];
  if (played.length === 0) {
    return [...legal].sort((a, b) => getCardRank(a, gameType) - getCardRank(b, gameType) || a.points - b.points)[0];
  }
  const losers = legal.filter(
    (card) => determineTrickWinner([...played, { playerId, card }], gameType) !== playerId,
  );
  if (losers.length > 0) {
    return [...losers].sort((a, b) => b.points - a.points || getCardRank(b, gameType) - getCardRank(a, gameType))[0];
  }
  return lowestValueCard(legal, gameType);
}

function isDeclaringSide(id: string, contract: Contract): boolean {
  return id === contract.declarerId || id === contract.partnerId;
}

function onSameTeam(a: string, b: string, contract: Contract): boolean {
  return isDeclaringSide(a, contract) === isDeclaringSide(b, contract);
}

function lowestRankCard(cards: Card[], gameType: GameType): Card {
  return [...cards].sort((a, b) => getCardRank(a, gameType) - getCardRank(b, gameType))[0];
}

function highestRankCard(cards: Card[], gameType: GameType): Card {
  return [...cards].sort((a, b) => getCardRank(b, gameType) - getCardRank(a, gameType))[0];
}

function highestValueCard(cards: Card[]): Card {
  return [...cards].sort((a, b) => b.points - a.points)[0];
}

/**
 * Pitch points onto a secured trick, but hold back trump honours: an Ober/Unter
 * is worth more as a future trump trick than its 2–3 points here.
 */
function schmierCard(cards: Card[], gameType: GameType): Card {
  const schmierable = cards.filter((card) => !isOberOrUnter(card));
  if (schmierable.length > 0) return highestValueCard(schmierable);
  return lowestValueCard(cards, gameType);
}

/** Least valuable throwaway: fewest points, then lowest rank. */
function lowestValueCard(cards: Card[], gameType: GameType): Card {
  return [...cards].sort((a, b) => a.points - b.points || getCardRank(a, gameType) - getCardRank(b, gameType))[0];
}

/** Declaring side pulls trumps; a defender opens safely and keeps Tens back. */
function chooseLead(player: AIHand, legal: Card[], contract: Contract | null, gameType: GameType, tricks: Trick[]): Card {
  const trumps = legal.filter((card) => isTrump(card, gameType));
  const nonTrumps = legal.filter((card) => !isTrump(card, gameType));
  if (contract && isDeclaringSide(player.id, contract)) {
    if (trumps.length > 0) return highestRankCard(trumps, gameType);
    if (gameType === GameType.WENZ) {
      const [master] = getWenzPlainMasters(legal, tricks);
      if (master) return master;
    }
  }

  const aces = nonTrumps.filter((card) => card.value === CardValue.ACE);
  if (aces.length > 0) return highestRankCard(aces, gameType);

  const withoutTens = nonTrumps.filter((card) => card.value !== CardValue.TEN);
  if (withoutTens.length > 0) return lowestValueCard(withoutTens, gameType);
  if (nonTrumps.length > 0) return lowestValueCard(nonTrumps, gameType);
  return lowestValueCard(trumps, gameType);
}
