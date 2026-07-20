/**
 * AI decision heuristics — pure functions from hand/trick/contract to a
 * decision. Stateless per call; the engine owns pacing and validation.
 */

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

/** Card counts extracted once from a hand, shared across worthiness checks. */
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

/** Wenz: AI declares Wenz if:
 *  - At least 2 Unters, at least 2 Aces, and at least 2 Tens matching the suits of the Aces, OR
 *  - At least 3 Unters, at least 2 Aces, and at least 1 Ten matching the suits of the Aces, OR
 *  - 4 Unters and at least 2 Aces.
 */
function isWenzWorthy({ unters, aces, hand }: HandProfile): boolean {
  const tensMatchingAces = hand.filter(
    (card) => card.value === CardValue.TEN && aces.some((ace) => ace.suit === card.suit)
  );
  const cond1 = unters.length >= 2 && aces.length >= 2 && tensMatchingAces.length >= 2;
  const cond2 = unters.length >= 3 && aces.length >= 2 && tensMatchingAces.length >= 1;
  const cond3 = unters.length >= 4 && aces.length >= 2;
  return cond1 || cond2 || cond3;
}

/** Solo: almost nothing but trump — three-plus Ober and seven-plus trumps. */
function isSoloWorthy({ obers, trumpsInNormal }: HandProfile): boolean {
  return obers.length >= 3 && trumpsInNormal.length >= 7;
}

export function getAIWillBid(player: Player, willBids: WillBid[] = []): boolean {
  // If another player already bid wantsToPlay: true, the AI only bids
  // if it holds a hand strong enough to play solo or wenz.
  const someoneElseWantsToPlay = willBids.some((bid) => bid.playerId !== player.id && bid.wantsToPlay);

  if (someoneElseWantsToPlay) {
    const hp = analyzeHand(player.cards);
    return isWenzWorthy(hp) || isSoloWorthy(hp);
  }

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
  const hp = analyzeHand(hand);
  const { unters, obers, aces, trumpsInNormal } = hp;

  const declarations: GameDeclaration[] = [];

  // Sauspiel is the everyday game: a solid trump holding plus a suit whose
  // Ace can be called.
  const callableSuit = getCallableSuits(hand)[0];
  // A weak hand (few trumps, or four low trumps without an Ober) should pass
  // rather than call a Sauspiel it can't carry: need an Ober with four trumps,
  // or five-plus trumps.
  const goodSauspielHand = (trumpsInNormal.length >= 4 && obers.length >= 1) || trumpsInNormal.length >= 5;
  if (goodSauspielHand && callableSuit) declarations.push({ type: GameType.SAUSPIEL, calledSuit: callableSuit });

  if (isWenzWorthy(hp)) declarations.push({ type: GameType.WENZ, isTout: unters.length === 4 && aces.length >= 2 });

  if (isSoloWorthy(hp)) declarations.push({ type: bestSoloType(hand), isTout: obers.length >= 4 && trumpsInNormal.length >= 8 });

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

/**
 * Whether the AI should announce a Stoß (as a defender) or a Retour (as the
 * declarer). Deliberately conservative and deterministic — the double only
 * fires with a clearly outstanding hand for the announcing seat, so it stays
 * rare (a doubled game is a big swing). Pure: no engine/turn state involved,
 * eligibility and the timing window are already enforced by the engine.
 *
 * A defender doubles only when its own hand is unusually trump-heavy for the
 * side that did NOT declare — three or more Obers, or two Obers backed by a
 * long trump holding. The declarer's Retour needs an even stronger hand
 * (three-plus Obers AND a long trump holding), since answering a Stoß from a
 * position of weakness is a losing move.
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

  // Ramsch (#11): everyone plays for themselves and wants to AVOID points —
  // the team logic below does not apply.
  if (contract?.type === GameType.RAMSCH) {
    return getRamschCardPlay(player.id, currentTrick, legalCards);
  }

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

  // Void in the led plain suit ("frei"): take the trick by trumping rather than
  // throwing a card away, whenever it is not already safely ours. This matters
  // most when the called suit is led in a Sauspiel — the called Ace is forced
  // into the trick, so the big points are coming even while the table still
  // shows few, and the seat that led it may be a partner sitting on a weak card
  // the opponents behind will beat. The trick is "secure" only when our side
  // already holds it with a trump, or we are the last to play (no opponent left
  // to overtake a plain winning card). Prefer the trump Ace, then the trump Ten
  // (fat point cards that are otherwise weak trumps), otherwise the lowest trump
  // that wins.
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
    // Our side already holds the trick. As the last player it is safe to
    // schmier onto it; otherwise stay low so an opponent still to play can't
    // scoop up the points.
    return isLastToPlay ? schmierCard(legalCards, gameType) : lowestValueCard(legalCards, gameType);
  }

  // An opponent is winning. Take the trick when it is worth it, using the
  // cheapest card that still wins; otherwise throw the least valuable card.
  const worthTaking = trickPoints >= 10 || (isLastToPlay && trickPoints >= 4);
  if (winners.length > 0 && worthTaking) {
    return [...winners].sort((a, b) => getCardRank(a, gameType) - getCardRank(b, gameType))[0];
  }
  return lowestValueCard(legalCards, gameType);
}

/**
 * Ramsch card play (#11): dodge points instead of collecting them.
 * - Leading: open with the lowest-ranked card — least likely to hold the trick.
 * - Following, when a non-winning card exists: dump the most valuable one.
 *   A card that does not beat the current winner can never take the trick no
 *   matter what falls later, so this safely schmiers points onto whichever
 *   opponent has to take it.
 * - Forced to win (every legal card beats the trick): take it as cheaply as
 *   possible — fewest points, then lowest rank.
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

/**
 * Schmier onto a trick the partner has already secured: hand over as many
 * points as possible without sacrificing a trump honour. Aces, Tens and Kings
 * are worth pitching for their points, but Obers and Unters are held back — the
 * 2–3 points they carry here are worth less than the trump trick they can still
 * win later on. Only when every legal card is an Ober/Unter (following trump
 * with nothing else) is one given up, and then the least valuable of them.
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
