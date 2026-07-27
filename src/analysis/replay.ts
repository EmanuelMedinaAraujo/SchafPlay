/**
 * Replay derivation (#85, part of #16).
 *
 * Pure functions turning a stored `RoundRecord` into the board state at an
 * arbitrary playback step. Deliberately **not** a re-run of `GameEngine`: the
 * engine is timer-driven, needs a shuffle seed we never stored, and would add
 * nothing here — a finished round's trick log already contains every card.
 *
 * Why no schema change was needed: a completed round has 8 tricks × 4 plays,
 * so all 32 cards appear in the log with their owner. Every hand can therefore
 * be reconstructed post-mortem, even from a guest's redacted recording (played
 * cards are face-up on the wire). Works retroactively on already-stored games.
 *
 * No React, no I/O, no engine import — the same layering rule as `game/`.
 */

import { CARD_POINTS } from "../game/deck";
import { Card, CardValue, PlayedCard, Suit } from "../game/types";
import { CardId, RoundRecord } from "../persistence/GameHistoryStore";

/** A trick as far as it has been revealed at the current step. */
export interface ReplayTrick {
  /** Index into `round.tricks` — the trick this step belongs to. */
  index: number;
  leaderId: string;
  /** Cards revealed so far, in play order. */
  plays: PlayedCard[];
  /** Set only once the trick is complete at this step. */
  winnerId?: string;
  /** True when every play of the trick is on the table. */
  complete: boolean;
  /** Card points on the table, of the revealed plays. */
  points: number;
}

/** The full board at one playback step. */
export interface ReplayStep {
  /** 0 = before the opening lead; `stepCount(round) - 1` = the final card. */
  index: number;
  /** Remaining cards per seat, in a stable (sorted) display order. */
  hands: Record<string, Card[]>;
  trick: ReplayTrick;
  /** Card points banked from *completed* tricks only, per seat. */
  pointsByPlayer: Record<string, number>;
  /** 1-based trick number for display. */
  trickNumber: number;
  /** 1-based card number within the current trick; 0 before the opening lead. */
  cardNumber: number;
  /** Cards in the current trick once fully played (for "2/4" style counters). */
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

/** Deck order, so a reconstructed hand reads the same way every step. */
const SUIT_ORDER: Suit[] = [Suit.ACORNS, Suit.LEAVES, Suit.HEARTS, Suit.BELLS];
const VALUE_ORDER: CardValue[] = [
  CardValue.ACE,
  CardValue.TEN,
  CardValue.KING,
  CardValue.OBER,
  CardValue.UNTER,
  CardValue.NINE,
  CardValue.EIGHT,
  CardValue.SEVEN,
];

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort(
    (a, b) =>
      SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) ||
      VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value),
  );
}

/**
 * Every card each seat held at the deal, reconstructed from the trick log:
 * a player's dealt hand is exactly the set of cards they played. Unparsable
 * ids are skipped rather than throwing — a replay must tolerate old records.
 */
export function reconstructHands(round: RoundRecord): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  for (const trick of round.tricks) {
    for (const play of trick.plays) {
      const card = cardFromId(play.card);
      if (!card) continue;
      (hands[play.playerId] ??= []).push(card);
    }
  }
  for (const id of Object.keys(hands)) hands[id] = sortCards(hands[id]);
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
 *
 * Step 0 shows all four full hands and an empty table. Each later step adds
 * exactly one card: it leaves the player's hand and joins the current trick.
 * The moment a trick is complete it stays on the table for that one step —
 * with its winner marked — and its points are banked from the next step on,
 * which is what makes stepping readable rather than jumping four cards at a time.
 */
export function replayStep(round: RoundRecord, index: number): ReplayStep {
  const total = stepCount(round);
  const step = Math.max(0, Math.min(index, total - 1));

  const hands = reconstructHands(round);
  const pointsByPlayer: Record<string, number> = {};
  for (const id of Object.keys(hands)) pointsByPlayer[id] = 0;

  let remaining = step;
  // The trick to display: the one holding the most recently played card, or
  // the first trick while the table is still empty.
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

    // Points are banked only once the *next* card is played, so the finished
    // trick reads as "still on the table" for exactly one step.
    if (complete && remaining > 0 && trick.winnerId) {
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

/** The step index of the first card of trick `trickIndex` (0-based). */
export function stepOfTrickStart(round: RoundRecord, trickIndex: number): number {
  let step = 0;
  for (let t = 0; t < trickIndex && t < round.tricks.length; t += 1) {
    step += round.tricks[t].plays.length;
  }
  return step + 1;
}
