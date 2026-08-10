/**
 * Replay derivation (#85, part of #16). Pure: no React, no I/O, no engine
 * import — re-running `GameEngine` would need a shuffle seed nobody stored.
 */

import { CARD_POINTS } from "../game/deck";
import { sortCardsForHand } from "../game/rules";
import { Card, CardValue, GameType, PlayedCard, Suit } from "../game/types";
import { CardId, RoundRecord } from "../persistence/GameHistoryStore";

/** A trick as far as it has been revealed at the current step. */
export interface ReplayTrick {
  /** Index into `round.tricks`. */
  index: number;
  leaderId: string;
  plays: PlayedCard[];
  /** Set only once the trick is complete at this step. */
  winnerId?: string;
  complete: boolean;
  /** Card points of the revealed plays. */
  points: number;
}

/** The full board at one playback step. */
export interface ReplayStep {
  /** 0 = before the opening lead; `stepCount(round) - 1` = the final card. */
  index: number;
  hands: Record<string, Card[]>;
  trick: ReplayTrick;
  /** Banked from *completed* tricks only. */
  pointsByPlayer: Record<string, number>;
  trickNumber: number;
  /** 1-based within the current trick; 0 before the opening lead. */
  cardNumber: number;
  trickSize: number;
}

/** `"ACORNS-A"` → a full `Card`. Returns null for an unparsable id. */
export function cardFromId(id: CardId): Card | null {
  const dash = id.lastIndexOf("-");
  if (dash <= 0) return null;
  const suit = id.slice(0, dash) as Suit;
  const value = id.slice(dash + 1) as CardValue;
  if (!Object.values(Suit).includes(suit)) return null;
  if (!Object.values(CardValue).includes(value)) return null;
  return { id, suit, value, points: CARD_POINTS[value] };
}

/**
 * Every card each seat held at the deal: a player's dealt hand is exactly the
 * set of cards they played, so a completed round's trick log holds all 32.
 * Sorted in the *contract's* trump order, as the live hand was.
 */
export function reconstructHands(round: RoundRecord): Record<string, Card[]> {
  const gameType = round.contract?.type ?? GameType.SAUSPIEL;
  const hands: Record<string, Card[]> = {};
  for (const trick of round.tricks) {
    for (const play of trick.plays) {
      const card = cardFromId(play.card);
      if (!card) continue;
      (hands[play.playerId] ??= []).push(card);
    }
  }
  for (const id of Object.keys(hands)) hands[id] = sortCardsForHand(hands[id], gameType);
  return hands;
}

/** Total plays in the round — the number of steps after the initial one. */
export function playCount(round: RoundRecord): number {
  return round.tricks.reduce((sum, trick) => sum + trick.plays.length, 0);
}

/** Number of addressable steps: the empty table plus one per card played. */
export function stepCount(round: RoundRecord): number {
  return playCount(round) + 1;
}

/** True when the round holds enough trick data to be replayed at all. */
export function isReplayable(round: RoundRecord): boolean {
  return playCount(round) > 0;
}

/**
 * The board after `index` cards have been played (`index` is clamped).
 * A finished trick stays on the table for exactly one step with its winner
 * marked; its points bank from the next step on. That hold is what makes
 * stepping readable — keep it.
 */
export function replayStep(round: RoundRecord, index: number): ReplayStep {
  const total = stepCount(round);
  const step = Math.max(0, Math.min(index, total - 1));
  const isFinalStep = step === total - 1;

  const hands = reconstructHands(round);
  const pointsByPlayer: Record<string, number> = {};
  for (const id of Object.keys(hands)) pointsByPlayer[id] = 0;

  let remaining = step;
  let current: ReplayTrick = {
    index: 0,
    leaderId: round.tricks[0]?.leaderId ?? "",
    plays: [],
    complete: false,
    points: 0,
  };
  let cardNumber = 0;
  let trickSize = round.tricks[0]?.plays.length ?? 0;

  for (let t = 0; t < round.tricks.length && remaining > 0; t += 1) {
    const trick = round.tricks[t];
    const revealed = Math.min(remaining, trick.plays.length);
    const plays: PlayedCard[] = [];
    let points = 0;

    for (let p = 0; p < revealed; p += 1) {
      const play = trick.plays[p];
      const card = cardFromId(play.card);
      if (!card) continue;
      plays.push({ playerId: play.playerId, card });
      points += card.points;
      const hand = hands[play.playerId];
      if (hand) hands[play.playerId] = hand.filter((held) => held.id !== card.id);
    }

    const complete = revealed === trick.plays.length;
    current = {
      index: t,
      leaderId: trick.leaderId,
      plays,
      winnerId: complete ? trick.winnerId : undefined,
      complete,
      points,
    };
    cardNumber = revealed;
    trickSize = trick.plays.length;
    remaining -= revealed;

    // `isFinalStep`: no further step would ever bank the last trick.
    if (complete && (remaining > 0 || isFinalStep) && trick.winnerId) {
      pointsByPlayer[trick.winnerId] = (pointsByPlayer[trick.winnerId] ?? 0) + points;
    }
  }

  return {
    index: step,
    hands,
    trick: current,
    pointsByPlayer,
    trickNumber: current.index + 1,
    cardNumber,
    trickSize,
  };
}
