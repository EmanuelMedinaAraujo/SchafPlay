/**
 * Node-side mirror of a seeded SchafPlay game.
 *
 * The browser boots the engine with `?e2e-seed=<int>` (seededShuffle + zero-ish
 * pacing). Here we run the *identical* GameEngine with `aiDelayMs: 0` /
 * `trickHoldMs: 0`, so every AI turn and trick collection resolves
 * synchronously and control only ever returns to us on a human seat's turn or
 * at a terminal state. Because it is the same engine consuming the same RNG
 * stream (one deal per round, in order, plus an extra deal on an all-pass
 * redeal), the resulting trace matches what the UI will show for that seed —
 * every card id, contract and score is known ahead of the first click.
 *
 * DOM-free: imports engine + rules + seededShuffle directly (never src/lib/e2e.ts,
 * which reaches for import.meta.env).
 */
import { GameEngine } from "../../../src/engine/GameEngine";
import { seededShuffle } from "../../../src/lib/seededShuffle";
import {
  Card,
  GameDeclaration,
  GameType,
  PlayerActionType,
  SeatId,
  Suit,
} from "../../../src/game/types";
import { canOverrideBid, getCallableSuits, getLegalCards } from "../../../src/game/rules";

/** Decisions for the human seat(s) the simulation drives itself. */
export interface Policy {
  decideWill(hand: Card[]): boolean;
  /** Return a declaration to bid, or null to retreat/pass. */
  decideDeclare(hand: Card[], high: GameDeclaration | null): GameDeclaration | null;
  decideCard(legal: Card[], hand: Card[]): Card;
}

/**
 * The default human policy mirrors GameEngine.devSkipRound's own p1 logic so it
 * always makes a legal, progressing move: call the first callable Sauspiel when
 * nothing higher stands, else top a standing Sauspiel with a Wenz, else retreat;
 * play the first legal card.
 */
export const defaultPolicy: Policy = {
  decideWill: (hand) => getCallableSuits(hand).length > 0,
  decideDeclare: (hand, high) => {
    const calledSuit = high ? undefined : getCallableSuits(hand)[0];
    if (calledSuit) return { type: GameType.SAUSPIEL, calledSuit };
    if (canOverrideBid(high, { type: GameType.WENZ })) return { type: GameType.WENZ };
    return null;
  },
  decideCard: (legal) => legal[0],
};

/**
 * Mirrors GameEngine.devSkipRound's own p1 logic exactly: p1 always says "will",
 * then declares like defaultPolicy. Use this to predict the outcome of rounds
 * the browser advances with the DEV "skip round" button, whose p1 moves are
 * identical (and whose card play falls through to first-legal, same as here).
 */
export const alwaysWillPolicy: Policy = {
  ...defaultPolicy,
  decideWill: () => true,
};

export interface HumanTurn {
  seat: SeatId;
  handIds: string[];
  legalIds: string[];
  chosenId: string;
  /** Cards already on the table in the current trick when this seat played (0..3). */
  positionInTrick: number;
}

export interface HumanBid {
  seat: SeatId;
  kind: "will" | "declare";
  will?: boolean;
  declaration?: GameDeclaration | null;
}

export interface TraceContract {
  type: GameType;
  declarerId: string;
  calledSuit?: Suit;
  partnerId?: string;
}

export interface RoundTrace {
  roundNumber: number;
  hands: Record<string, Card[]>;
  contract: TraceContract | null;
  /** Every card played this round, in play order (all 32 for a completed round). */
  plays: { playerId: string; cardId: string }[];
  /** One entry per driven human card play, in chronological order. */
  turns: HumanTurn[];
  /** One entry per driven human bidding decision, in chronological order. */
  bids: HumanBid[];
  willBids: { playerId: string; wantsToPlay: boolean }[];
  result: {
    declarerPoints: number;
    defenderPoints: number;
    declarerWon: boolean;
    scoreChanges: Record<string, number>;
  } | null;
  /** Cumulative scores after this round resolved. */
  scores: Record<string, number>;
}

export type Trace = RoundTrace[];

export interface SimulateOptions {
  totalRounds?: number;
  name?: string;
  policy?: Policy;
}

interface InternalOptions extends SimulateOptions {
  soloMode: boolean;
}

function blankRound(roundNumber: number): RoundTrace {
  return {
    roundNumber,
    hands: {},
    contract: null,
    plays: [],
    turns: [],
    bids: [],
    willBids: [],
    result: null,
    scores: {},
  };
}

function simulate(seed: number, options: InternalOptions): Trace {
  const { totalRounds = 8, name = "Toni", policy = defaultPolicy, soloMode } = options;
  const engine = new GameEngine(name, undefined, totalRounds, {
    soloMode,
    aiDelayMs: 0,
    trickHoldMs: 0,
    shuffleFn: seededShuffle(seed),
    devToolsEnabled: false,
  });

  const humans: SeatId[] = soloMode ? ["p1"] : ["p1", "p3"];
  const rounds = new Map<number, RoundTrace>();
  const ensure = (n: number) => {
    let r = rounds.get(n);
    if (!r) rounds.set(n, (r = blankRound(n)));
    return r;
  };

  engine.onStateChange((s) => {
    if (s.status === "BIDDING" && s.biddingState) {
      ensure(s.roundNumber).willBids = s.biddingState.willBids.map((w) => ({
        playerId: w.playerId,
        wantsToPlay: w.wantsToPlay,
      }));
    }
    // Exactly the finalizeBidding edge: contract resolved, no card played yet, so
    // every seat still holds its full dealt hand (post any all-pass redeal).
    if (
      s.status === "PLAYING" &&
      s.currentContract &&
      s.tricks.length === 0 &&
      s.currentTrick &&
      s.currentTrick.playedCards.length === 0
    ) {
      const r = ensure(s.roundNumber);
      if (!r.contract) {
        r.contract = {
          type: s.currentContract.type,
          declarerId: s.currentContract.declarerId,
          calledSuit: s.currentContract.calledSuit,
          partnerId: s.currentContract.partnerId,
        };
        for (const p of s.players) r.hands[p.id] = p.cards.map((c) => ({ ...c }));
      }
    }
  });

  engine.dealCards();

  let lastSig = "";
  let stall = 0;
  for (let guard = 0; guard < 8000; guard += 1) {
    const s = engine.getState();
    if (s.status === "LIST_OVER") break;

    const sig = `${s.status}|${s.roundNumber}|${s.activePlayerIdx}|${s.biddingState?.phase ?? ""}|${
      s.biddingState?.declarations.length ?? 0
    }|${s.tricks.length}|${s.currentTrick?.playedCards.length ?? 0}`;
    if (sig === lastSig) {
      if ((stall += 1) > 3) throw new Error(`simulation stalled at ${sig}`);
    } else {
      stall = 0;
    }
    lastSig = sig;

    if (s.status === "ROUND_OVER") {
      const r = ensure(s.roundNumber);
      if (!r.result && s.lastResult) {
        r.result = {
          declarerPoints: s.lastResult.declarerPoints,
          defenderPoints: s.lastResult.defenderPoints,
          declarerWon: s.lastResult.declarerWon,
          scoreChanges: { ...s.lastResult.scoreChanges },
        };
        r.plays = s.tricks.flatMap((t) => t.playedCards.map((pc) => ({ playerId: pc.playerId, cardId: pc.card.id })));
        r.scores = { ...s.scores };
      }
      for (const seat of humans) engine.processAction({ type: PlayerActionType.READY_NEXT, playerId: seat });
      continue;
    }

    const active = s.players[s.activePlayerIdx];
    if (!humans.includes(active.id as SeatId)) {
      // AI seats resolve synchronously, so control never rests here.
      throw new Error(`simulation stuck on AI seat ${active.id}`);
    }
    const r = ensure(s.roundNumber);

    if (s.status === "BIDDING") {
      const bidding = s.biddingState!;
      if (bidding.phase === "WILL_PHASE") {
        const will = policy.decideWill(active.cards);
        r.bids.push({ seat: active.id, kind: "will", will });
        engine.processAction({ type: PlayerActionType.BID_WILL, playerId: active.id, data: { wantsToPlay: will } });
      } else {
        const high = bidding.highBid?.declaration ?? null;
        const declaration = policy.decideDeclare(active.cards, high);
        r.bids.push({ seat: active.id, kind: "declare", declaration });
        if (declaration) {
          engine.processAction({ type: PlayerActionType.BID_DECLARE, playerId: active.id, data: { declaration } });
        } else {
          engine.processAction({ type: PlayerActionType.BID_RETREAT, playerId: active.id });
        }
      }
    } else if (s.status === "PLAYING") {
      const legal = getLegalCards(active.cards, s.currentTrick, s.currentContract);
      const chosen = policy.decideCard(legal, active.cards);
      r.turns.push({
        seat: active.id,
        handIds: active.cards.map((c) => c.id),
        legalIds: legal.map((c) => c.id),
        chosenId: chosen.id,
        positionInTrick: s.currentTrick?.playedCards.length ?? 0,
      });
      engine.processAction({ type: PlayerActionType.PLAY_CARD, playerId: active.id, data: { cardId: chosen.id } });
    }
  }

  engine.destroy();
  return [...rounds.values()].sort((a, b) => a.roundNumber - b.roundNumber);
}

export function simulateSolo(seed: number, options: SimulateOptions = {}): Trace {
  return simulate(seed, { ...options, soloMode: true });
}

export function simulateMultiplayer(seed: number, options: SimulateOptions = {}): Trace {
  return simulate(seed, { ...options, soloMode: false });
}

export interface FindSeedOptions extends SimulateOptions {
  start?: number;
  limit?: number;
  /** Which simulator to run per seed. Defaults to solo. */
  simulate?: (seed: number, options: SimulateOptions) => Trace;
}

/** Search seeds until one produces a trace the predicate accepts. */
export function findSeed(
  predicate: (trace: Trace, seed: number) => boolean,
  options: FindSeedOptions = {},
): { seed: number; trace: Trace } {
  const { start = 1, limit = 300, simulate: sim = simulateSolo, ...rest } = options;
  for (let seed = start; seed < start + limit; seed += 1) {
    let trace: Trace;
    try {
      trace = sim(seed, rest);
    } catch {
      continue;
    }
    if (predicate(trace, seed)) return { seed, trace };
  }
  throw new Error(`findSeed: no matching seed in [${start}, ${start + limit})`);
}

/** Helper: overall play index of the called Ace in a Sauspiel round, or -1. */
export function calledAcePlayIndex(round: RoundTrace): number {
  if (!round.contract || round.contract.type !== GameType.SAUSPIEL || !round.contract.calledSuit) return -1;
  const aceId = `${round.contract.calledSuit}-A`;
  return round.plays.findIndex((p) => p.cardId === aceId);
}
