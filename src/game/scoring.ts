/**
 * Scoring: the tournament tariff, round evaluation and Laufende counting.
 * Change point values in TARIFF, not in the engine.
 */

import { Card, CardValue, Contract, GameType, Player, RoundResult, Suit, Trick } from "./types";
import { isSolo } from "./rules";

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
