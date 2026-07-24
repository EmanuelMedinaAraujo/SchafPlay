/**
 * Replay derivation (#85): turns a stored RoundRecord into the board state at
 * any step of the round. Pure — no engine, no timers, no React.
 *
 * Why not re-run GameEngine: the engine is timer-driven, needs the shuffle
 * seed (never stored) and would re-decide AI moves; playback only ever needs
 * what actually happened, and the trick log already holds it.
 *
 * A completed round contains all 8 tricks, i.e. all 32 cards with the seat
 * that played each one — so all four hands can be reconstructed exactly, even
 * from a guest's redacted recording (played cards are face-up on the wire).
 * Nothing here reads `RoundRecord.initialHand`, which only ever held the
 * local seat's cards.
 */

import { CARD_POINTS } from "../game/deck";
import { determineTrickWinner, sortCardsForHand } from "../game/rules";
import { Card, CardValue, Contract, GameType, PlayedCard, Suit } from "../game/types";
// Types only: the analysis layer must not pull the IndexedDB store into
// non-browser consumers (the E2E simulation imports this module in Node).
import type { CardId, RoundRecord, TrickRecord } from "../persistence/GameHistoryStore";

/**
 * Rebuild a Card from its stored id (`"${Suit}-${CardValue}"`). Returns null
 * for anything unparseable so a corrupt record degrades to a shorter replay
 * instead of throwing.
 */
export function cardFromId(id: CardId): Card | null {
  const separator = id.indexOf("-");
  if (separator <= 0) return null;
  const suit = id.slice(0, separator) as Suit;
  const value = id.slice(separator + 1) as CardValue;
  if (!Object.values(Suit).includes(suit)) return null;
  if (!Object.values(CardValue).includes(value)) return null;
  return { id, suit, value, points: CARD_POINTS[value] };
}

export interface ReplayPlay {
  playerId: string;
  card: Card;
  /** Index of the trick this card belongs to. */
  trickIndex: number;
  /** Position within that trick, 0..3. */
  positionInTrick: number;
}

export interface ReplayTrick {
  index: number;
  leaderId: string;
  /** From the record; derived via the rules when an old record lacks it. */
  winnerId: string | null;
  plays: ReplayPlay[];
  /** Card points (Augen) in this trick. */
  points: number;
}

export interface Replay {
  contract: Contract | null;
  /** Trump order used for display; a contract-less record falls back to Sauspiel. */
  gameType: GameType;
  /** Every seat that played a card, in first-appearance order. */
  seatIds: string[];
  /** The eight cards each seat was dealt, in hand order. */
  initialHands: Record<string, Card[]>;
  tricks: ReplayTrick[];
  /** Every card of the round in play order. */
  plays: ReplayPlay[];
  /** Steps after the deal; step 0 is the deal itself, step N shows N cards played. */
  totalSteps: number;
}

/** Board state at one step of a replay. */
export interface ReplayView {
  step: number;
  /** Index of the trick lying on the table (0-based); 0 before the first card. */
  trickIndex: number;
  /** Remaining cards per seat, in hand order. */
  hands: Record<string, Card[]>;
  /** Cards on the table right now, in play order. */
  tableCards: PlayedCard[];
  leaderId: string | null;
  /** Set once all four cards of the trick on the table are down. */
  trickWinnerId: string | null;
  /** The card played by this step; null at step 0. */
  lastPlay: ReplayPlay | null;
  /** Seat to play next; null once the round is over. */
  nextPlayerId: string | null;
  /** Card points collected so far — a trick counts once it is complete. */
  points: Record<string, number>;
  /** Tricks taken so far, same rule as `points`. */
  tricksWon: Record<string, number>;
  finished: boolean;
}

function buildTrick(record: TrickRecord, index: number, gameType: GameType): ReplayTrick {
  const plays: ReplayPlay[] = [];
  for (const play of record.plays) {
    const card = cardFromId(play.card);
    if (!card) continue;
    plays.push({ playerId: play.playerId, card, trickIndex: index, positionInTrick: plays.length });
  }
  const complete = plays.length === 4;
  const winnerId =
    record.winnerId ??
    (complete
      ? determineTrickWinner(
          plays.map((play): PlayedCard => ({ playerId: play.playerId, card: play.card })),
          gameType,
        )
      : null);
  return {
    index,
    leaderId: record.leaderId || plays[0]?.playerId || "",
    winnerId: complete ? winnerId : null,
    plays,
    points: plays.reduce((sum, play) => sum + play.card.points, 0),
  };
}

/** Precompute everything a replay needs; cheap enough to run on every render. */
export function buildReplay(round: RoundRecord): Replay {
  const contract = round.contract;
  const gameType = contract?.type ?? GameType.SAUSPIEL;
  const tricks = round.tricks.map((trick, index) => buildTrick(trick, index, gameType));
  const plays = tricks.flatMap((trick) => trick.plays);

  const seatIds: string[] = [];
  const dealt: Record<string, Card[]> = {};
  for (const play of plays) {
    if (!dealt[play.playerId]) {
      dealt[play.playerId] = [];
      seatIds.push(play.playerId);
    }
    dealt[play.playerId].push(play.card);
  }

  const initialHands: Record<string, Card[]> = {};
  for (const seatId of seatIds) initialHands[seatId] = sortCardsForHand(dealt[seatId], gameType);

  return { contract, gameType, seatIds, initialHands, tricks, plays, totalSteps: plays.length };
}

/** Board state after `step` cards have been played (clamped into range). */
export function replayViewAt(replay: Replay, step: number): ReplayView {
  const clamped = Math.max(0, Math.min(step, replay.totalSteps));
  const played = replay.plays.slice(0, clamped);
  const playedIds = new Set(played.map((play) => play.card.id));

  const hands: Record<string, Card[]> = {};
  for (const seatId of replay.seatIds) {
    hands[seatId] = replay.initialHands[seatId].filter((card) => !playedIds.has(card.id));
  }

  const lastPlay = clamped > 0 ? replay.plays[clamped - 1] : null;
  // The trick on the table is the one the last card belongs to — a finished
  // trick stays up until the next card is played, mirroring live play.
  const trickIndex = lastPlay ? lastPlay.trickIndex : 0;
  const trick: ReplayTrick | undefined = replay.tricks[trickIndex];
  const tableCards: PlayedCard[] = played
    .filter((play) => play.trickIndex === trickIndex)
    .map((play) => ({ playerId: play.playerId, card: play.card }));
  const trickComplete = !!trick && tableCards.length === trick.plays.length && tableCards.length > 0;

  const points: Record<string, number> = {};
  const tricksWon: Record<string, number> = {};
  for (const seatId of replay.seatIds) {
    points[seatId] = 0;
    tricksWon[seatId] = 0;
  }
  // Points land with the winner as soon as the trick is complete on screen.
  const scoredThrough = trickComplete ? trickIndex : trickIndex - 1;
  for (let index = 0; index <= scoredThrough; index += 1) {
    const scored = replay.tricks[index];
    if (!scored?.winnerId) continue;
    points[scored.winnerId] = (points[scored.winnerId] ?? 0) + scored.points;
    tricksWon[scored.winnerId] = (tricksWon[scored.winnerId] ?? 0) + 1;
  }

  const finished = clamped >= replay.totalSteps;
  const nextPlayerId = finished ? null : replay.plays[clamped].playerId;

  return {
    step: clamped,
    trickIndex,
    hands,
    tableCards,
    leaderId: trick?.leaderId ?? null,
    trickWinnerId: trickComplete ? trick!.winnerId : null,
    lastPlay,
    nextPlayerId,
    points,
    tricksWon,
    finished,
  };
}

/** Step index at which trick `trickIndex` starts (its first card is down). */
export function stepAtTrickStart(replay: Replay, trickIndex: number): number {
  let step = 0;
  for (let index = 0; index < trickIndex && index < replay.tricks.length; index += 1) {
    step += replay.tricks[index].plays.length;
  }
  return Math.min(step + 1, replay.totalSteps);
}
