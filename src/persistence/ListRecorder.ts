import { GameState, GameStatus, Trick } from "../game/types";
import { CardId, GameHistoryStore, RoundRecord, StatsMode, TrickRecord } from "./GameHistoryStore";
import { gameHistoryStore } from "./store";

/**
 * A pure observer of GameState snapshots that calls `recordGame` exactly once,
 * on the first LIST_OVER. No engine or network dependency, so it serves host,
 * solo and guest alike — each device records its own view.
 */
export class ListRecorder {
  private prevStatus: GameStatus | null = null;
  private draftHand: CardId[] | null = null;
  private rounds: RoundRecord[] = [];
  private finalized = false;

  constructor(
    private mode: StatsMode,
    private role: "host" | "guest" | "solo",
    private localId: "p1" | "p3",
    private store: GameHistoryStore = gameHistoryStore,
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

    // Rematch: LIST_OVER deals straight into BIDDING — start a fresh record.
    if (state.status === "BIDDING" && this.finalized) {
      this.rounds = [];
      this.finalized = false;
    }

    // Keyed on a fresh WILL_PHASE (0 bids), not the round number, so an
    // all-pass redeal overwrites the draft with the hand actually played.
    if (
      state.status === "BIDDING" &&
      state.biddingState?.phase === "WILL_PHASE" &&
      state.biddingState.willBids.length === 0 &&
      me.cards.length === 8
    ) {
      this.draftHand = me.cards.map((card) => card.id);
    }

    // On the status *edge* only: ROUND_OVER / LIST_OVER re-emit on every
    // ready toggle and pause/resume.
    if (
      (state.status === "ROUND_OVER" || state.status === "LIST_OVER") &&
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
        bids: state.biddingState ? [...state.biddingState.willBids] : undefined,
        declarations: state.biddingState ? [...state.biddingState.declarations] : undefined,
      });
      this.draftHand = null;
    }

    // List completion — record exactly once.
    if (state.status === "LIST_OVER" && !this.finalized) {
      this.finalized = true;
      const top = Math.max(...state.players.map((player) => state.scores[player.id] ?? 0));
      const opponent =
        this.mode === "multiplayer"
          ? state.players.find((player) => player.isHuman && player.id !== this.localId)
          : undefined;
      this.store.recordGame({
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
