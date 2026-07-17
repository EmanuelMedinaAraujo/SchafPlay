/**
 * AI decision heuristics — pure functions from hand/trick/contract to a
 * decision. Stateless per call; the engine owns pacing and validation.
 */

import { Card, CardValue, Contract, Difficulty, GameDeclaration, GameType, Player, Suit, Trick } from "../game/types";
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

export function getAIWillBid(player: Player): boolean {
  // Only announce interest when there is actually a declarable game. Since a
  // "will" can no longer be taken back once a Sauspiel stands ("Doch passen",
  // #24) — the player would be forced up to a Wenz/Solo — the AI commits only
  // when it genuinely holds a game worth playing.
  return getAIBid(player, null, true) !== null;
}

/**
 * Pick the AI's declaration. `canRetreat` reflects the "Doch passen" rule
 * (#24): a player who said "I'd play" may only bow out once a Wenz or Solo
 * already stands. When it cannot retreat and holds no game worth calling it is
 * forced to top the Sauspiel with the least-bad higher game.
 */
export function getAIBid(
  player: Player,
  existingDeclaration?: GameDeclaration | null,
  canRetreat = true,
): GameDeclaration | null {
  const hand = player.cards;
  const unters = hand.filter((card) => card.value === CardValue.UNTER);
  const obers = hand.filter((card) => card.value === CardValue.OBER);
  const aces = hand.filter((card) => card.value === CardValue.ACE);
  const trumpsInNormal = hand.filter((card) => isTrump(card, GameType.SAUSPIEL));

  const declarations: GameDeclaration[] = [];

  // Sauspiel is the everyday game: a solid trump holding plus a suit whose
  // Ace can be called.
  const callableSuit = getCallableSuits(hand)[0];
  // A weak hand (few trumps, or four low trumps without an Ober) should pass
  // rather than call a Sauspiel it can't carry: need an Ober with four trumps,
  // or five-plus trumps.
  const goodSauspielHand = (trumpsInNormal.length >= 4 && obers.length >= 1) || trumpsInNormal.length >= 5;
  if (goodSauspielHand && callableSuit) declarations.push({ type: GameType.SAUSPIEL, calledSuit: callableSuit });

  // Wenz: AI declares Wenz if:
  // - At least 2 Unters, at least 2 Aces, and at least 2 Tens matching the suits of the Aces, OR
  // - At least 3 Unters, at least 2 Aces, and at least 1 Ten matching the suits of the Aces, OR
  // - 4 Unters and at least 2 Aces.
  const tensMatchingAces = hand.filter(
    (card) => card.value === CardValue.TEN && aces.some((ace) => ace.suit === card.suit)
  );
  const cond1 = unters.length >= 2 && aces.length >= 2 && tensMatchingAces.length >= 2;
  const cond2 = unters.length >= 3 && aces.length >= 2 && tensMatchingAces.length >= 1;
  const cond3 = unters.length >= 4 && aces.length >= 2;
  const wenzWorthy = cond1 || cond2 || cond3;
  if (wenzWorthy) declarations.push({ type: GameType.WENZ, isTout: unters.length === 4 && aces.length >= 2 });

  // Solo: the AI should basically never go solo — only when the hand is almost
  // nothing but trump (three-plus Ober and seven-plus trumps).
  const soloWorthy = obers.length >= 3 && trumpsInNormal.length >= 7;
  if (soloWorthy) declarations.push({ type: bestSoloType(hand), isTout: obers.length >= 4 && trumpsInNormal.length >= 8 });

  // Prefer the lowest-ranking viable game (Sauspiel before Wenz before Solo);
  // a higher game is only reached for when it is needed to overbid.
  const chosen = declarations
    .sort((a, b) => getGamePriority(a.type, a.isTout) - getGamePriority(b.type, b.isTout))
    .find((declaration) => canOverrideBid(existingDeclaration ?? null, declaration));
  if (chosen) return chosen;

  // "Doch passen" (#24): with no viable game the AI would rather pass, but it
  // may only do so when a Wenz/Solo already stands. Otherwise it said "will"
  // over a Sauspiel and is now committed to topping it — pick the least-bad
  // higher game (a Wenz when it has Unter, else a Solo in its longest suit).
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

export function getAICardPlay(player: Player, currentTrick: Trick | null, contract: Contract | null, difficulty = Difficulty.MEDIUM): Card {
  const legalCards = getLegalCards(player.cards, currentTrick, contract);
  if (legalCards.length === 1 || difficulty === Difficulty.EASY) return legalCards[0];
  const gameType = contract?.type ?? GameType.SAUSPIEL;

  // Leading the trick: the declaring side pulls trumps, defenders open safely.
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

  if (partnerIsWinning) {
    // Our side already holds the trick. As the last player it is safe to
    // schmier the highest-value card onto it; otherwise stay low so an
    // opponent still to play can't scoop up the points.
    return isLastToPlay ? highestValueCard(legalCards) : lowestValueCard(legalCards, gameType);
  }

  // An opponent is winning. Take the trick when it is worth it, using the
  // cheapest card that still wins; otherwise throw the least valuable card.
  const worthTaking = trickPoints >= 10 || (isLastToPlay && trickPoints >= 4);
  if (winners.length > 0 && worthTaking) {
    return [...winners].sort((a, b) => getCardRank(a, gameType) - getCardRank(b, gameType))[0];
  }
  return lowestValueCard(legalCards, gameType);
}

/** True when both players sit on the same side of the current contract. */
function onSameTeam(a: string, b: string, contract: Contract | null): boolean {
  if (!contract) return false;
  const onDeclaringSide = (id: string) => id === contract.declarerId || id === contract.partnerId;
  return onDeclaringSide(a) === onDeclaringSide(b);
}

/** Highest-point card — used to schmier an Ace or Ten to a winning partner. */
function highestValueCard(cards: Card[]): Card {
  return [...cards].sort((a, b) => b.points - a.points)[0];
}

/** Least valuable throwaway: fewest points, then lowest rank. */
function lowestValueCard(cards: Card[], gameType: GameType): Card {
  return [...cards].sort((a, b) => a.points - b.points || getCardRank(a, gameType) - getCardRank(b, gameType))[0];
}

/**
 * Opening lead. The declaring side (declarer or called partner) leads a high
 * trump to draw out the opponents' trumps; a defender opens with a safe
 * non-trump Ace, otherwise a low side card — keeping Tens back instead of
 * exposing them.
 */
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
