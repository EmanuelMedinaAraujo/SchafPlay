import {
  Card,
  CardValue,
  Contract,
  Difficulty,
  GameDeclaration,
  GamePriority,
  GameType,
  PlayedCard,
  Player,
  RoundResult,
  Suit,
  Trick,
} from "../types";

export function createDeck(): Card[] {
  const values: Array<{ value: CardValue; points: number }> = [
    { value: CardValue.SEVEN, points: 0 },
    { value: CardValue.EIGHT, points: 0 },
    { value: CardValue.NINE, points: 0 },
    { value: CardValue.UNTER, points: 2 },
    { value: CardValue.OBER, points: 3 },
    { value: CardValue.KING, points: 4 },
    { value: CardValue.TEN, points: 10 },
    { value: CardValue.ACE, points: 11 },
  ];

  return [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS].flatMap((suit) =>
    values.map(({ value, points }) => ({
      id: `${suit}-${value}`,
      suit,
      value,
      points,
    })),
  );
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

export function getLegalCards(hand: Card[], currentTrick: Trick | null, contract: Contract | null): Card[] {
  if (!contract || !currentTrick || currentTrick.playedCards.length === 0) {
    if (contract?.type === GameType.SAUSPIEL && contract.calledSuit) {
      const hasCalledAce = hand.some((card) => card.suit === contract.calledSuit && card.value === CardValue.ACE);
      if (hasCalledAce) {
        return hand.filter((card) => card.suit !== contract.calledSuit || card.value === CardValue.ACE);
      }
    }
    return hand;
  }

  const ledPlaySuit = getPlaySuit(currentTrick.playedCards[0].card, contract.type);
  const following = hand.filter((card) => getPlaySuit(card, contract.type) === ledPlaySuit);
  if (following.length === 0) return hand;

  if (contract.type === GameType.SAUSPIEL && contract.calledSuit === ledPlaySuit) {
    const calledAce = following.find((card) => card.value === CardValue.ACE);
    return calledAce ? [calledAce] : following;
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

export function getAIWillBid(player: Player): boolean {
  // Only announce interest when there is actually a declarable game, so the
  // AI never has to retreat immediately after saying "I would".
  return getAIBid(player, null) !== null;
}

export function getAIBid(player: Player, existingDeclaration?: GameDeclaration | null): GameDeclaration | null {
  const hand = player.cards;
  const unters = hand.filter((card) => card.value === CardValue.UNTER);
  const obers = hand.filter((card) => card.value === CardValue.OBER);
  const aces = hand.filter((card) => card.value === CardValue.ACE);
  const trumpsInNormal = hand.filter((card) => isTrump(card, GameType.SAUSPIEL));

  const declarations: GameDeclaration[] = [];

  // Sauspiel is the everyday game: a solid trump holding plus a suit whose
  // Ace can be called (a plain card of it, but not its Ace).
  const callableSuit = [Suit.ACORNS, Suit.LEAVES, Suit.BELLS].find((suit) => {
    const hasSuitCard = hand.some((card) => card.suit === suit && card.value !== CardValue.OBER && card.value !== CardValue.UNTER);
    const hasAce = hand.some((card) => card.suit === suit && card.value === CardValue.ACE);
    return hasSuitCard && !hasAce;
  });
  // A weak hand (few trumps, or four low trumps without an Ober) should pass
  // rather than call a Sauspiel it can't carry: need an Ober with four trumps,
  // or five-plus trumps.
  const goodSauspielHand = (trumpsInNormal.length >= 4 && obers.length >= 1) || trumpsInNormal.length >= 5;
  if (goodSauspielHand && callableSuit) declarations.push({ type: GameType.SAUSPIEL, calledSuit: callableSuit });

  // Wenz: only with genuine Unter strength backed by a high card — at least
  // two Unter plus an Ace, or three Unter. Kept intentionally rare (#19).
  const wenzWorthy = (unters.length >= 3 && aces.length >= 1) || (unters.length >= 2 && aces.length >= 2);
  if (wenzWorthy) declarations.push({ type: GameType.WENZ, isTout: unters.length === 4 && aces.length >= 2 });

  // Solo: the AI should basically never go solo — only when the hand is almost
  // nothing but trump (three-plus Ober and seven-plus trumps).
  const soloWorthy = obers.length >= 3 && trumpsInNormal.length >= 7;
  if (soloWorthy) declarations.push({ type: bestSoloType(hand), isTout: obers.length >= 4 && trumpsInNormal.length >= 8 });

  // Prefer the lowest-ranking viable game (Sauspiel before Wenz before Solo);
  // a higher game is only reached for when it is needed to overbid.
  return declarations
    .sort((a, b) => getGamePriority(a.type, a.isTout) - getGamePriority(b.type, b.isTout))
    .find((declaration) => canOverrideBid(existingDeclaration ?? null, declaration)) ?? null;
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

export function getSuitEmoji(suit: Suit): string {
  return {
    [Suit.ACORNS]: "🌰",
    [Suit.LEAVES]: "🍃",
    [Suit.HEARTS]: "❤️",
    [Suit.BELLS]: "🔔",
  }[suit];
}

export function getCardLabel(card: Card): string {
  return `${getSuitEmoji(card.suit)} ${card.value}`;
}

/**
 * Tournament tariff (plus/minus scoring), zero-sum per round.
 *
 * Kept deliberately small so the numbers stay in the single digits — the
 * common casual convention is "a solo counts roughly three times a normal
 * game" (issue #21).
 *
 * Normal game (Rufspiel): value per PLAYER (2 vs 2) —
 *   base 1, Schneider 2, Schwarz 3, plus 1 per Laufendem.
 * Solo/Wenz: value per DEFENDER; the soloist receives/pays 3x —
 *   base 1, Schneider 2, Schwarz 3, Tout 4, Sie 6, plus 1 per Laufendem.
 *   Soloist totals: 3 / 6 / 9 / 12 / 18 (+3 per Laufendem).
 * Laufende count from 3 upwards (Wenz from 2), "mit" and "ohne" alike.
 */
export const TARIFF = {
  rufspiel: { base: 1, schneider: 2, schwarz: 3, perLaufendem: 1 },
  solo: { base: 1, schneider: 2, schwarz: 3, tout: 4, sie: 6, perLaufendem: 1 },
  minLaufende: 3,
  minLaufendeWenz: 2,
  maxLaufende: 8,
  maxLaufendeWenz: 4,
} as const;

export function calculateRoundResult(
  players: Player[],
  contract: Contract,
  tricks: Trick[],
  initialHands: Record<string, Card[]>,
): RoundResult {
  const declarerTeam = [contract.declarerId, contract.partnerId].filter(Boolean) as string[];
  const defenderTeam: string[] = players.map((player) => player.id).filter((id) => !declarerTeam.includes(id));
  const declarerPoints = players.filter((player) => declarerTeam.includes(player.id)).reduce((sum, player) => sum + player.pointsCollected, 0);
  const defenderPoints = 120 - declarerPoints;
  const toutLost = contract.isTout && tricks.some((trick) => Boolean(trick.winnerId && defenderTeam.includes(trick.winnerId)));
  const declarerWon = contract.isTout ? !toutLost : declarerPoints >= 61;
  // Declarer side needs 31 points to escape Schneider, defenders need 30.
  const isSchneider = declarerWon ? defenderPoints < 30 : declarerPoints <= 30;
  const isSchwarz = declarerWon
    ? tricks.every((trick) => declarerTeam.includes(trick.winnerId ?? ""))
    : tricks.every((trick) => defenderTeam.includes(trick.winnerId ?? ""));
  const teamCards = declarerTeam.flatMap((id) => initialHands[id] ?? []);
  const laufende = countLaufende(teamCards, contract.type);
  const scoreChanges = scoreTournament(players, contract, declarerTeam, declarerWon, isSchneider, isSchwarz, laufende, initialHands);
  return {
    contract,
    declarerPoints,
    defenderPoints,
    declarerWon,
    isSchneider,
    isSchwarz,
    laufende,
    scoreChanges,
    winnerIds: declarerWon ? declarerTeam : defenderTeam,
  };
}

function scoreTournament(
  players: Player[],
  contract: Contract,
  declarerTeam: string[],
  declarerWon: boolean,
  isSchneider: boolean,
  isSchwarz: boolean,
  laufende: number,
  initialHands: Record<string, Card[]>,
): Record<string, number> {
  const soloLike = contract.type === GameType.WENZ || isSolo(contract.type);
  const tout = Boolean(contract.isTout);

  let perUnit: number;
  if (soloLike) {
    // "Sie": the soloist was dealt all four Obers and all four Unters.
    const declarerHand = initialHands[contract.declarerId] ?? [];
    const isSie =
      isSolo(contract.type) &&
      declarerHand.filter((card) => card.value === CardValue.OBER || card.value === CardValue.UNTER).length === 8;
    if (isSie) {
      perUnit = TARIFF.solo.sie;
    } else if (tout) {
      perUnit = TARIFF.solo.tout + laufende * TARIFF.solo.perLaufendem;
    } else {
      const base = isSchwarz ? TARIFF.solo.schwarz : isSchneider ? TARIFF.solo.schneider : TARIFF.solo.base;
      perUnit = base + laufende * TARIFF.solo.perLaufendem;
    }
  } else {
    const base = isSchwarz ? TARIFF.rufspiel.schwarz : isSchneider ? TARIFF.rufspiel.schneider : TARIFF.rufspiel.base;
    perUnit = base + laufende * TARIFF.rufspiel.perLaufendem;
  }

  const changes: Record<string, number> = {};
  for (const player of players) {
    const isDeclarerSide = declarerTeam.includes(player.id);
    // Solo-like: soloist stakes 3 units against 1 unit per defender (zero-sum).
    const stake = soloLike && isDeclarerSide ? perUnit * 3 : perUnit;
    changes[player.id] = (isDeclarerSide === declarerWon ? 1 : -1) * stake;
  }
  return changes;
}

/**
 * Count Laufende (matadors): the unbroken run of top trumps counted from the
 * highest trump down, held by ("mit") or missing from ("ohne") the declaring
 * party's dealt cards. Counted from 3 upwards (Wenz: from 2).
 */
export function countLaufende(teamCards: Card[], gameType: GameType): number {
  const topTrumps: Array<{ suit: Suit; value: CardValue }> = [];
  const suitsHighToLow = [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS];
  if (gameType === GameType.WENZ) {
    suitsHighToLow.forEach((suit) => topTrumps.push({ suit, value: CardValue.UNTER }));
  } else {
    suitsHighToLow.forEach((suit) => topTrumps.push({ suit, value: CardValue.OBER }));
    suitsHighToLow.forEach((suit) => topTrumps.push({ suit, value: CardValue.UNTER }));
  }

  const held = (slot: { suit: Suit; value: CardValue }) =>
    teamCards.some((card) => card.suit === slot.suit && card.value === slot.value);

  const withTop = held(topTrumps[0]);
  let run = 0;
  for (const slot of topTrumps) {
    if (held(slot) === withTop) run += 1;
    else break;
  }

  const min = gameType === GameType.WENZ ? TARIFF.minLaufendeWenz : TARIFF.minLaufende;
  const max = gameType === GameType.WENZ ? TARIFF.maxLaufendeWenz : TARIFF.maxLaufende;
  const capped = Math.min(run, max);
  return capped >= min ? capped : 0;
}
