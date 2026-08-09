/**
 * Pure Schafkopf rules. The single source of truth for the engine, the AI and
 * the UI alike, so their derivations cannot drift.
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
  // Ramsch (#11) is played with the normal trump order: Ober > Unter > Hearts.
  const trumpSuit = gameType === GameType.SAUSPIEL || gameType === GameType.RAMSCH ? Suit.HEARTS : getSoloSuit(gameType);
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

/** Trumps first, then plain suits Acorns/Leaves/Hearts/Bells, each high to low. */
export function sortCardsForHand(cards: Card[], gameType: GameType): Card[] {
  return [...cards].sort((a, b) => {
    const aTrump = isTrump(a, gameType);
    const bTrump = isTrump(b, gameType);
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (!aTrump && a.suit !== b.suit) return HAND_SUIT_ORDER[a.suit] - HAND_SUIT_ORDER[b.suit];
    return getCardRank(b, gameType) - getCardRank(a, gameType);
  });
}

/** Called-suit cards needed to unlock "Davonlaufen". */
const DAVONLAUFEN_MIN_CARDS = 4;

export function getLegalCards(
  hand: Card[],
  currentTrick: Trick | null,
  contract: Contract | null,
  tricks: Trick[] = []
): Card[] {
  if (!contract) return hand;

  const gameType = contract.type;
  const calledSuit = gameType === GameType.SAUSPIEL ? contract.calledSuit : undefined;
  const ledCard = currentTrick && currentTrick.playedCards.length > 0 ? currentTrick.playedCards[0].card : null;
  const ledPlaySuit = ledCard ? getPlaySuit(ledCard, gameType) : null;
  const following = ledPlaySuit ? hand.filter((card) => getPlaySuit(card, gameType) === ledPlaySuit) : [];
  // Plain Farbzwang: serve the led suit while you hold it, otherwise play anything.
  const followSuit = () => (ledPlaySuit && following.length > 0 ? following : hand);

  // Not a Sauspiel (or no called suit): plain follow-suit rules.
  if (!calledSuit) return followSuit();

  // Sauspiel "Rufsau" rules. `calledSuit` is a *play* suit throughout — the
  // Ober and Unter of that suit are trump, so no restriction below touches them.
  const calledSuitCards = hand.filter((card) => getPlaySuit(card, gameType) === calledSuit);
  const calledAce = calledSuitCards.find((card) => card.value === CardValue.ACE);
  // Once the called suit has been led the Ace is loose.
  const aceFreed = tricks.some(
    (trick) => trick.playedCards.length > 0 && getPlaySuit(trick.playedCards[0].card, gameType) === calledSuit,
  );
  if (!calledAce || aceFreed) return followSuit();

  // Leading: the Ace may be led any time; the rest of the suit is locked unless
  // the hand holds four or more of it (Davonlaufen — a lead only).
  if (!ledPlaySuit) {
    if (calledSuitCards.length >= DAVONLAUFEN_MIN_CARDS) return hand;
    return hand.filter((card) => getPlaySuit(card, gameType) !== calledSuit || card.id === calledAce.id);
  }

  // Called suit led ("gesucht"): the Ace must be given, four-in-hand or not.
  if (ledPlaySuit === calledSuit) return [calledAce];

  // Another suit led: serve it, else discard freely — but never the Ace,
  // unless it is the only card left.
  if (following.length > 0) return following;
  const withoutCalledAce = hand.filter((card) => card.id !== calledAce.id);
  return withoutCalledAce.length > 0 ? withoutCalledAce : hand;
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
 * Suits whose Ace this hand may call. Canonical order Acorns/Leaves/Bells —
 * callers rely on it (the AI takes the first).
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

/** "Doch passen" (#24): retreat only once a Wenz or Solo stands. */
export function isRetreatAllowed(highBid: GameDeclaration | null | undefined): boolean {
  return !!highBid && getGamePriority(highBid.type, Boolean(highBid.isTout)) >= GamePriority.WENZ;
}
