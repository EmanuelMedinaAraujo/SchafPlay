import { GameState, GameStatus, Trick } from "../types";
import { CardId, RoundRecord, StatsMode, TrickRecord, recordGame } from "./stats";

/**
 * Snapshot-driven match recorder: a pure observer of GameState snapshots
 * that persists a finished match via recordGame exactly once.
 *
 * It never mutates game state and has no engine or network dependency, so
 * it works identically for the host (redacted p1 view), solo (full state)
 * and the guest (redacted wire state) — each device records its own view.
 * A quit mid-match simply drops the recorder, leaving no trace.
 */
export class MatchRecorder {
  private prevStatus: GameStatus | null = null;
  private draftHand: CardId[] | null = null;
  private rounds: RoundRecord[] = [];
  private finalized = false;

  constructor(
    private mode: StatsMode,
    private role: "host" | "guest" | "solo",
    private localId: "p1" | "p3",
  ) {}

  observe(state: GameState): void {
    try {
      this.consume(state);
    } catch {
      // Recording must never break a running game.
    }
  }

  private consume(state: GameState): void {
    const me = state.players.find((player) => player.id === this.localId);
    if (!me) return;

    // Rematch: MATCH_OVER deals straight into BIDDING — start a fresh record.
    if (state.status === "BIDDING" && this.finalized) {
      this.rounds = [];
      this.finalized = false;
    }

    // Initial-hand capture. Keyed on a fresh WILL_PHASE (0 bids) rather than
    // the round number so an all-pass redeal — which keeps the same round
    // number — overwrites the draft with the hand that is actually played.
    if (
      state.status === "BIDDING" &&
      state.biddingState?.phase === "WILL_PHASE" &&
      state.biddingState.willBids.length === 0 &&
      me.cards.length === 8
    ) {
      this.draftHand = me.cards.map((card) => card.id);
    }

    // Round completion: only on the status *edge*, since ROUND_OVER /
    // MATCH_OVER re-emit on every ready toggle and pause/resume. The
    // draftHand guard makes a double push impossible either way.
    if (
      (state.status === "ROUND_OVER" || state.status === "MATCH_OVER") &&
      this.prevStatus !== state.status &&
      state.lastResult &&
      this.draftHand
    ) {
      this.rounds.push({
        roundNumber: state.roundNumber,
        initialHand: this.draftHand,
        contract: state.currentContract,
        tricks: state.tricks.map(slimTrick),
        result: state.lastResult,
        scoresAfter: { ...state.scores },
      });
      this.draftHand = null;
    }

    // Match completion — record exactly once.
    if (state.status === "MATCH_OVER" && !this.finalized) {
      this.finalized = true;
      const top = Math.max(...state.players.map((player) => state.scores[player.id] ?? 0));
      const opponent =
        this.mode === "multiplayer"
          ? state.players.find((player) => player.isHuman && player.id !== this.localId)
          : undefined;
      recordGame({
        mode: this.mode,
        role: this.role,
        localPlayerId: this.localId,
        localPlayerName: me.name,
        opponentName: opponent?.name ?? null,
        players: state.players.map(({ id, name, isHuman }) => ({ id, name, isHuman })),
        totalRounds: state.totalRounds,
        finalScores: { ...state.scores },
        won: (state.scores[this.localId] ?? 0) === top,
        rounds: this.rounds,
      });
    }

    this.prevStatus = state.status;
  }
}

function slimTrick(trick: Trick): TrickRecord {
  return {
    leaderId: trick.leaderId,
    winnerId: trick.winnerId,
    plays: trick.playedCards.map((played) => ({ playerId: played.playerId, card: played.card.id })),
  };
}
