/**
 * Pure Schafkopf rules: trump/rank order, follow-suit legality, trick
 * resolution and bid legality. Shared vocabulary for the engine, the AI and
 * the UI — the single source of truth so their derivations cannot drift.
 */

import { Card, CardValue, Contract, GameDeclaration, GamePriority, GameType, PlayedCard, Suit, Trick } from "./types";

export function isSolo(type: GameType): boolean {
  return type === GameType.SOLO_ACORNS || type === GameType.SOLO_LEAVES || type === GameType.SOLO_HEARTS || type === GameType.SOLO_BELLS;
}

export function getSoloSuit(type: GameType): Suit | null {
  if (type === GameType.SOLO_ACORNS) return Suit.ACORNS;
  if (type === GameType.SOLO_LEAVES) return Suit.LEAVES;
  if (type === GameType.SOLO_HEARTS) return Suit.HEARTS;
  if (type === GameType.SOLO_BELLS) return Suit.BELLS;
  return null;
}

export function isTrump(card: Card, gameType: GameType): boolean {
  if (gameType === GameType.WENZ) return card.value === CardValue.UNTER;
  if (card.value === CardValue.OBER || card.value === CardValue.UNTER) return true;
  const trumpSuit = gameType === GameType.SAUSPIEL ? Suit.HEARTS : getSoloSuit(gameType);
  return card.suit === trumpSuit;
}

export function getPlaySuit(card: Card, gameType: GameType): Suit | "TRUMP" {
  return isTrump(card, gameType) ? "TRUMP" : card.suit;
}

export function getCardRank(card: Card, gameType: GameType): number {
  if (gameType === GameType.WENZ) {
    if (card.value === CardValue.UNTER) return suitOrder(card.suit, 100);
    return plainSuitRank(card.value);
  }

  if (card.value === CardValue.OBER) return suitOrder(card.suit, 108);
  if (card.value === CardValue.UNTER) return suitOrder(card.suit, 104);
  if (isTrump(card, gameType)) return 90 + plainSuitRank(card.value);
  return plainSuitRank(card.value);
}

function suitOrder(suit: Suit, high: number): number {
  const offset = {
    [Suit.ACORNS]: 0,
    [Suit.LEAVES]: 1,
    [Suit.HEARTS]: 2,
    [Suit.BELLS]: 3,
  }[suit];
  return high - offset;
}

function plainSuitRank(value: CardValue): number {
  return {
    [CardValue.ACE]: 8,
    [CardValue.TEN]: 7,
    [CardValue.KING]: 6,
    [CardValue.OBER]: 5,
    [CardValue.UNTER]: 4,
    [CardValue.NINE]: 3,
    [CardValue.EIGHT]: 2,
    [CardValue.SEVEN]: 1,
  }[value];
}

const HAND_SUIT_ORDER: Record<Suit, number> = {
  [Suit.ACORNS]: 0,
  [Suit.LEAVES]: 1,
  [Suit.HEARTS]: 2,
  [Suit.BELLS]: 3,
};

/**
 * Order a hand the way it is laid out during play: trumps first (highest on
 * the left), then the plain suits grouped Acorns/Leaves/Hearts/Bells, each
 * from high to low.
 */
export function sortCardsForHand(cards: Card[], gameType: GameType): Card[] {
  return [...cards].sort((a, b) => {
    const aTrump = isTrump(a, gameType);
    const bTrump = isTrump(b, gameType);
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (!aTrump && a.suit !== b.suit) return HAND_SUIT_ORDER[a.suit] - HAND_SUIT_ORDER[b.suit];
    return getCardRank(b, gameType) - getCardRank(a, gameType);
  });
}

export function getLegalCards(
  hand: Card[],
  currentTrick: Trick | null,
  contract: Contract | null,
  tricks: Trick[] = []
): Card[] {
  if (!contract) return hand;

  const isSauspiel = contract.type === GameType.SAUSPIEL;
  const calledSuit = contract.calledSuit;

  // If not Sauspiel, or no called suit, use normal rules
  if (!isSauspiel || !calledSuit) {
    if (!currentTrick || currentTrick.playedCards.length === 0) {
      return hand;
    }
    const ledPlaySuit = getPlaySuit(currentTrick.playedCards[0].card, contract.type);
    const following = hand.filter((card) => getPlaySuit(card, contract.type) === ledPlaySuit);
    return following.length > 0 ? following : hand;
  }

  // Sauspiel called Ace rules
  const hasCalledAce = hand.some((card) => card.suit === calledSuit && card.value === CardValue.ACE);
  const isAceFreed = tricks.some((trick) => {
    if (trick.playedCards.length === 0) return false;
    const ledCard = trick.playedCards[0].card;
    return getPlaySuit(ledCard, contract.type) === calledSuit;
  });
  const isAceAllowed = isAceFreed || hand.length === 1;

  // 1. Leading the trick
  if (!currentTrick || currentTrick.playedCards.length === 0) {
    if (hasCalledAce && !isAceAllowed) {
      const nonCalledSuitCards = hand.filter((card) => card.suit !== calledSuit);
      if (nonCalledSuitCards.length > 0) {
        return nonCalledSuitCards;
      } else {
        return hand.filter((card) => card.value !== CardValue.ACE);
      }
    }
    return hand;
  }

  // 2. Following the trick
  const ledPlaySuit = getPlaySuit(currentTrick.playedCards[0].card, contract.type);
  const following = hand.filter((card) => getPlaySuit(card, contract.type) === ledPlaySuit);

  // If cannot follow suit
  if (following.length === 0) {
    if (hasCalledAce && !isAceAllowed) {
      const nonCalledSuitCards = hand.filter((card) => card.suit !== calledSuit);
      if (nonCalledSuitCards.length > 0) {
        return nonCalledSuitCards;
      } else {
        return hand.filter((card) => card.value !== CardValue.ACE);
      }
    }
    return hand;
  }

  // If can follow suit
  if (calledSuit === ledPlaySuit) {
    if (hasCalledAce) {
      if (following.length >= 4) {
        // Davonlaufen: holds 4 or more cards of the called suit.
        // Can play any card of the called suit (the Ace or any other)
        return following;
      } else {
        // Must play the called Ace
        const calledAce = following.find((card) => card.value === CardValue.ACE);
        return calledAce ? [calledAce] : following;
      }
    }
    return following;
  }

  return following;
}

export function determineTrickWinner(playedCards: PlayedCard[], gameType: GameType): string {
  const ledPlaySuit = getPlaySuit(playedCards[0].card, gameType);
  let winner = playedCards[0];

  for (const played of playedCards.slice(1)) {
    const winningSuit = getPlaySuit(winner.card, gameType);
    const playedSuit = getPlaySuit(played.card, gameType);
    const playedBeatsTrump = playedSuit === "TRUMP" && winningSuit !== "TRUMP";
    const playedFollowsAndRanksHigher = playedSuit === winningSuit && getCardRank(played.card, gameType) > getCardRank(winner.card, gameType);
    const playedBeatsLedSuit = winningSuit !== "TRUMP" && playedSuit === ledPlaySuit && playedFollowsAndRanksHigher;

    if (playedBeatsTrump || playedFollowsAndRanksHigher || playedBeatsLedSuit) {
      winner = played;
    }
  }

  return winner.playerId;
}

export function countPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.points, 0);
}

export function getGamePriority(type: GameType, isTout = false): GamePriority {
  if (type === GameType.SAUSPIEL) return GamePriority.SAUSPIEL;
  if (type === GameType.WENZ) return isTout ? GamePriority.WENZ_TOUT : GamePriority.WENZ;
  return isTout ? GamePriority.SOLO_TOUT : GamePriority.SOLO;
}

export function canOverrideBid(existing: GameDeclaration | null, incoming: GameDeclaration): boolean {
  return !existing || getGamePriority(incoming.type, incoming.isTout) > getGamePriority(existing.type, existing.isTout);
}

/**
 * Suits whose Ace this hand may call for a Sauspiel: a plain card (not
 * Ober/Unter) of the suit is held, but its Ace is not. Canonical order
 * Acorns/Leaves/Bells — callers rely on it (the AI calls the first).
 */
export function getCallableSuits(hand: Card[]): Suit[] {
  return [Suit.ACORNS, Suit.LEAVES, Suit.BELLS].filter((suit) => {
    const hasPlainCard = hand.some((card) => card.suit === suit && card.value !== CardValue.OBER && card.value !== CardValue.UNTER);
    const hasAce = hand.some((card) => card.suit === suit && card.value === CardValue.ACE);
    return hasPlainCard && !hasAce;
  });
}

/** A Sauspiel call is valid iff the suit is callable from this hand (Hearts never is). */
export function isValidSauspielCall(hand: Card[], suit: Suit): boolean {
  return getCallableSuits(hand).includes(suit);
}

/**
 * "Doch passen" (#24): retreating from the bidding is only permitted once a
 * Wenz or Solo already stands. A standing Sauspiel (or no bid yet) does not let
 * an interested player bow out — they must top it with a higher game.
 */
export function isRetreatAllowed(highBid: GameDeclaration | null | undefined): boolean {
  return !!highBid && getGamePriority(highBid.type, Boolean(highBid.isTout)) >= GamePriority.WENZ;
}
