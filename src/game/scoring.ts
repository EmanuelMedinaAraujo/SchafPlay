/**
 * Scoring: the tournament tariff, round evaluation and Laufende counting.
 * Change point values in TARIFF, not in the engine.
 */

import { Card, CardValue, Contract, GameType, Player, RamschResult, RoundResult, Suit, Trick } from "./types";
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
 * Ramsch (#11): the loser pays `base` (Sauspiel level) to EACH opponent,
 *   doubled once per Jungfrau (a player without a trick). A Durchmarsch
 *   (one player takes every trick) WINS and receives `durchmarsch` from each
 *   opponent — the Schwarz-solo level (+9 total), since sweeping all tricks
 *   is the Ramsch equivalent of a solo won schwarz. No Laufende in Ramsch.
 */
export const TARIFF = {
  rufspiel: { base: 1, schneider: 2, schwarz: 3, perLaufendem: 1 },
  solo: { base: 1, schneider: 2, schwarz: 3, tout: 4, sie: 6, perLaufendem: 1 },
  ramsch: { base: 1, durchmarsch: 3 },
  minLaufende: 3,
  minLaufendeWenz: 2,
  maxLaufende: 8,
  maxLaufendeWenz: 4,
} as const;

/**
 * House-rule toggles that affect round scoring. Passed in from the engine so
 * scoring stays pure — no globals.
 */
export interface ScoringOptions {
  /** When true, Laufende (matadors) pay nothing — laufende is forced to 0. Default false. */
  disableLaufende?: boolean;
  /** Index of the dealer seat; used only for the Ramsch tiebreak (#11). Defaults to seat 4. */
  dealerIdx?: number;
  /**
   * Stoß/Retour multiplier: the whole round result (base tariff + Laufende) is
   * multiplied by this. 1 = no Stoß, 2 = one Stoß, 4 = Stoß + Retour. Default 1.
   * Not applicable to Ramsch (no declaring party, so no Stoß).
   */
  stossMultiplier?: number;
}

export function calculateRoundResult(
  players: Player[],
  contract: Contract,
  tricks: Trick[],
  initialHands: Record<string, Card[]>,
  options: ScoringOptions = {},
): RoundResult {
  if (contract.type === GameType.RAMSCH) {
    return calculateRamschResult(players, contract, tricks, options.dealerIdx ?? 3);
  }
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
  // House rule (#31): when Laufende are disabled they pay nothing, so the run
  // is never counted and no bonus flows into the tariff.
  const laufende = options.disableLaufende ? 0 : countLaufende(teamCards, contract.type);
  const scoreChanges = scoreTournament(players, contract, declarerTeam, declarerWon, isSchneider, isSchwarz, laufende, initialHands);
  // Stoß/Retour multiplies the whole round result. Ramsch already returned
  // above, so this only ever applies to a game with a declaring party.
  const stossMultiplier = options.stossMultiplier && options.stossMultiplier > 1 ? options.stossMultiplier : 1;
  if (stossMultiplier > 1) {
    for (const id of Object.keys(scoreChanges)) scoreChanges[id] *= stossMultiplier;
  }
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
    stossMultiplier,
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
 * Ramsch scoring (#11). Everyone plays for themselves; the player who
 * collected the MOST card points loses and pays TARIFF.ramsch.base to each
 * opponent, doubled once per Jungfrau (a player who took no trick).
 *
 * Tiebreak for "most points" (documented house choice): among the tied
 * players, the one with MORE tricks loses; if still tied, the tied player
 * seated LATER in play order from the dealer (forehand counts as first,
 * the dealer as last) loses.
 *
 * Durchmarsch: a player who takes ALL tricks wins instead and receives
 * TARIFF.ramsch.durchmarsch from each opponent. Schneider/Schwarz and
 * Laufende do not apply to Ramsch.
 */
function calculateRamschResult(players: Player[], contract: Contract, tricks: Trick[], dealerIdx: number): RoundResult {
  const pointsByPlayer: Record<string, number> = {};
  const trickCounts: Record<string, number> = {};
  for (const player of players) {
    pointsByPlayer[player.id] = player.pointsCollected;
    trickCounts[player.id] = 0;
  }
  for (const trick of tricks) {
    if (trick.winnerId) trickCounts[trick.winnerId] = (trickCounts[trick.winnerId] ?? 0) + 1;
  }

  const sweeper = players.find((player) => tricks.length > 0 && trickCounts[player.id] === tricks.length);
  // Position in play order: forehand (dealer's left) = 0 … dealer = 3.
  const posFromDealer = (player: Player) => (player.seatIndex - dealerIdx + 3) % 4;

  const changes: Record<string, number> = {};
  let ramsch: RamschResult;

  if (sweeper) {
    // Durchmarsch: the sweeper wins the premium from every opponent.
    ramsch = { playerId: sweeper.id, isDurchmarsch: true, jungfrauIds: [], pointsByPlayer };
    for (const player of players) {
      changes[player.id] =
        player.id === sweeper.id ? TARIFF.ramsch.durchmarsch * (players.length - 1) : -TARIFF.ramsch.durchmarsch;
    }
  } else {
    const loser = [...players].sort(
      (a, b) =>
        pointsByPlayer[b.id] - pointsByPlayer[a.id] ||
        trickCounts[b.id] - trickCounts[a.id] ||
        posFromDealer(b) - posFromDealer(a),
    )[0];
    const jungfrauIds = players.filter((player) => trickCounts[player.id] === 0).map((player) => player.id);
    // Each Jungfrau doubles the payout.
    const perOpponent = TARIFF.ramsch.base * 2 ** jungfrauIds.length;
    ramsch = { playerId: loser.id, isDurchmarsch: false, jungfrauIds, pointsByPlayer };
    for (const player of players) {
      changes[player.id] = player.id === loser.id ? -perOpponent * (players.length - 1) : perOpponent;
    }
  }

  const keyPoints = pointsByPlayer[ramsch.playerId] ?? 0;
  return {
    contract,
    // "Declarer" framing for a game without one: the key player (loser, or
    // Durchmarsch winner) fills the declarer slots so generic consumers keep
    // rendering something sensible.
    declarerPoints: keyPoints,
    defenderPoints: 120 - keyPoints,
    declarerWon: ramsch.isDurchmarsch,
    isSchneider: false,
    isSchwarz: false,
    laufende: 0,
    scoreChanges: changes,
    winnerIds: ramsch.isDurchmarsch ? [ramsch.playerId] : players.map((p) => p.id).filter((id) => id !== ramsch.playerId),
    ramsch,
  };
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
