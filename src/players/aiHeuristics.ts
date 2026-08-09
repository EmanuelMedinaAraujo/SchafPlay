/** AI decision heuristics — pure; the engine owns pacing and validation. */

import { Card, CardValue, Contract, Difficulty, GameDeclaration, GameType, Player, StossKind, Suit, Trick, WillBid } from "../game/types";
import {
  canOverrideBid,
  countPoints,
  determineTrickWinner,
  getCallableSuits,
  getCardRank,
  getGamePriority,
  getLegalCards,
  isTrump,
} from "../game/rules";

interface HandProfile {
  unters: Card[];
  obers: Card[];
  aces: Card[];
  trumpsInNormal: Card[];
  hand: Card[];
}

function analyzeHand(hand: Card[]): HandProfile {
  return {
    unters: hand.filter((card) => card.value === CardValue.UNTER),
    obers: hand.filter((card) => card.value === CardValue.OBER),
    aces: hand.filter((card) => card.value === CardValue.ACE),
    trumpsInNormal: hand.filter((card) => isTrump(card, GameType.SAUSPIEL)),
    hand,
  };
}

function isWenzWorthy({ unters, aces, hand }: HandProfile): boolean {
  const tensMatchingAces = hand.filter(
    (card) => card.value === CardValue.TEN && aces.some((ace) => ace.suit === card.suit)
  );
  const cond1 = unters.length >= 2 && aces.length >= 2 && tensMatchingAces.length >= 2;
  const cond2 = unters.length >= 3 && aces.length >= 2 && tensMatchingAces.length >= 1;
  const cond3 = unters.length >= 4 && aces.length >= 2;
  return cond1 || cond2 || cond3;
}

function isSoloWorthy({ obers, trumpsInNormal }: HandProfile): boolean {
  return obers.length >= 3 && trumpsInNormal.length >= 7;
}

export function getAIWillBid(player: Player, willBids: WillBid[] = []): boolean {
  const someoneElseWantsToPlay = willBids.some((bid) => bid.playerId !== player.id && bid.wantsToPlay);

  if (someoneElseWantsToPlay) {
    const hp = analyzeHand(player.cards);
    return isWenzWorthy(hp) || isSoloWorthy(hp);
  }

  // A "will" can't be taken back once a Sauspiel stands (#24), so only commit
  // when there is actually a declarable game.
  return getAIBid(player, null, true) !== null;
}

/** `canRetreat` = "Doch passen" (#24): may only bow out once a Wenz/Solo stands. */
export function getAIBid(
  player: Player,
  existingDeclaration?: GameDeclaration | null,
  canRetreat = true,
): GameDeclaration | null {
  const hand = player.cards;
  const hp = analyzeHand(hand);
  const { unters, obers, aces, trumpsInNormal } = hp;

  const declarations: GameDeclaration[] = [];

  const callableSuit = getCallableSuits(hand)[0];
  const goodSauspielHand = (trumpsInNormal.length >= 4 && obers.length >= 1) || trumpsInNormal.length >= 5;
  if (goodSauspielHand && callableSuit) declarations.push({ type: GameType.SAUSPIEL, calledSuit: callableSuit });

  if (isWenzWorthy(hp)) declarations.push({ type: GameType.WENZ, isTout: unters.length === 4 && aces.length >= 2 });

  if (isSoloWorthy(hp)) declarations.push({ type: bestSoloType(hand), isTout: obers.length >= 4 && trumpsInNormal.length >= 8 });

  // Lowest-ranking viable game first; reach higher only to overbid.
  const chosen = declarations
    .sort((a, b) => getGamePriority(a.type, a.isTout) - getGamePriority(b.type, b.isTout))
    .find((declaration) => canOverrideBid(existingDeclaration ?? null, declaration));
  if (chosen) return chosen;

  // Committed to topping the standing Sauspiel: pick the least-bad higher game.
  if (!canRetreat) return forcedHigherGame(player);
  return null;
}

function forcedHigherGame(player: Player): GameDeclaration {
  const unters = player.cards.filter((card) => card.value === CardValue.UNTER);
  return unters.length >= 2 ? { type: GameType.WENZ } : { type: bestSoloType(player.cards) };
}

function bestSoloType(hand: Card[]): GameType {
  const counts = [Suit.HEARTS, Suit.ACORNS, Suit.LEAVES, Suit.BELLS].map((suit) => ({
    suit,
    count: hand.filter((card) => card.suit === suit && card.value !== CardValue.OBER && card.value !== CardValue.UNTER).length,
  }));
  const best = counts.sort((a, b) => b.count - a.count)[0].suit;
  if (best === Suit.ACORNS) return GameType.SOLO_ACORNS;
  if (best === Suit.LEAVES) return GameType.SOLO_LEAVES;
  if (best === Suit.BELLS) return GameType.SOLO_BELLS;
  return GameType.SOLO_HEARTS;
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
  player: Player,
  currentTrick: Trick | null,
  contract: Contract | null,
  difficulty = Difficulty.MEDIUM,
  tricks: Trick[] = []
): Card {
  const legalCards = getLegalCards(player.cards, currentTrick, contract, tricks);
  if (legalCards.length === 1 || difficulty === Difficulty.EASY) return legalCards[0];
  const gameType = contract?.type ?? GameType.SAUSPIEL;

  // Ramsch (#11): everyone plays for themselves, so the team logic below
  // does not apply.
  if (contract?.type === GameType.RAMSCH) {
    return getRamschCardPlay(player.id, currentTrick, legalCards);
  }

  if (!contract || !currentTrick || currentTrick.playedCards.length === 0) {
    return chooseLead(player, legalCards, contract, gameType);
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
        [...trumpWinners].sort((a, b) => getCardRank(a, gameType) - getCardRank(b, gameType))[0]
      );
    }
  }

  if (partnerIsWinning) {
    // Only safe to schmier when no opponent is left to scoop up the points.
    return isLastToPlay ? schmierCard(legalCards, gameType) : lowestValueCard(legalCards, gameType);
  }

  const worthTaking = trickPoints >= 10 || (isLastToPlay && trickPoints >= 4);
  if (winners.length > 0 && worthTaking) {
    return [...winners].sort((a, b) => getCardRank(a, gameType) - getCardRank(b, gameType))[0];
  }
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

function onSameTeam(a: string, b: string, contract: Contract | null): boolean {
  if (!contract) return false;
  const onDeclaringSide = (id: string) => id === contract.declarerId || id === contract.partnerId;
  return onDeclaringSide(a) === onDeclaringSide(b);
}

function highestValueCard(cards: Card[]): Card {
  return [...cards].sort((a, b) => b.points - a.points)[0];
}

/**
 * Pitch points onto a secured trick, but hold back trump honours: an Ober/Unter
 * is worth more as a future trump trick than its 2–3 points here.
 */
function schmierCard(cards: Card[], gameType: GameType): Card {
  const keepBack = (card: Card) => card.value === CardValue.OBER || card.value === CardValue.UNTER;
  const schmierable = cards.filter((card) => !keepBack(card));
  if (schmierable.length > 0) return highestValueCard(schmierable);
  return lowestValueCard(cards, gameType);
}

/** Least valuable throwaway: fewest points, then lowest rank. */
function lowestValueCard(cards: Card[], gameType: GameType): Card {
  return [...cards].sort((a, b) => a.points - b.points || getCardRank(a, gameType) - getCardRank(b, gameType))[0];
}

/** Declaring side pulls trumps; a defender opens safely and keeps Tens back. */
function chooseLead(player: Player, legal: Card[], contract: Contract | null, gameType: GameType): Card {
  const trumps = legal.filter((card) => isTrump(card, gameType));
  const nonTrumps = legal.filter((card) => !isTrump(card, gameType));
  const onDeclaringSide = Boolean(contract && (player.id === contract.declarerId || player.id === contract.partnerId));

  if (onDeclaringSide && trumps.length > 0) {
    return [...trumps].sort((a, b) => getCardRank(b, gameType) - getCardRank(a, gameType))[0];
  }

  const aces = nonTrumps.filter((card) => card.value === CardValue.ACE);
  if (aces.length > 0) {
    return [...aces].sort((a, b) => getCardRank(b, gameType) - getCardRank(a, gameType))[0];
  }

  const withoutTens = nonTrumps.filter((card) => card.value !== CardValue.TEN);
  if (withoutTens.length > 0) return lowestValueCard(withoutTens, gameType);
  if (nonTrumps.length > 0) return lowestValueCard(nonTrumps, gameType);
  return lowestValueCard(trumps, gameType);
}
