import {
  BidDeclaration,
  Card,
  CardValue,
  Contract,
  GameDeclaration,
  GameState,
  GameType,
  LogEntry,
  Player,
  PlayerAction,
  PlayerActionType,
  SeatId,
  Suit,
} from "../types";
import {
  calculateRoundResult,
  canOverrideBid,
  countPoints,
  createDeck,
  determineTrickWinner,
  getAIBid,
  getAICardPlay,
  getAIWillBid,
  getLegalCards,
  shuffleDeck,
} from "../utils/gameLogic";

type Listener = (state: GameState) => void;

export interface EngineOptions {
  /** Delay before an AI seat acts. 0 = act synchronously (used by tests). */
  aiDelayMs?: number;
  /** How long a completed trick stays visible before it is collected. */
  trickHoldMs?: number;
  /** Deck arrangement, injectable for deterministic tests. */
  shuffleFn?: (deck: Card[]) => Card[];
}

const MAX_LOGS = 30;

export class GameEngine {
  private state: GameState;
  private listeners = new Set<Listener>();
  private initialHands: Record<string, Card[]> = {};
  private aiDelayMs: number;
  private trickHoldMs: number;
  private shuffleFn: (deck: Card[]) => Card[];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(hostName: string, guestName = "Gast", totalRounds = 8, options: EngineOptions = {}) {
    this.aiDelayMs = options.aiDelayMs ?? 900;
    this.trickHoldMs = options.trickHoldMs ?? 1600;
    this.shuffleFn = options.shuffleFn ?? shuffleDeck;

    const players: Player[] = [
      makePlayer("p1", hostName || "Host", true, 0),
      makePlayer("p2", "Resi (KI)", false, 1),
      makePlayer("p3", guestName || "Gast", true, 2),
      makePlayer("p4", "Sepp (KI)", false, 3),
    ];

    this.state = {
      status: "LOBBY",
      players,
      dealerIdx: 3,
      activePlayerIdx: 0,
      currentContract: null,
      tricks: [],
      currentTrick: null,
      collecting: false,
      paused: false,
      biddingState: null,
      readyState: { p1: false, p3: false },
      scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
      roundNumber: 0,
      totalRounds,
      logs: [{ key: "log.lobby" }],
    };
  }

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): GameState {
    return structuredClone(this.state);
  }

  /**
   * State as seen by one player: other hands are replaced by face-down
   * placeholders and the Sauspiel partner stays hidden until the called
   * Ace has been played.
   */
  getRedactedState(playerId: string): GameState {
    const state = this.getState();
    state.players = state.players.map((player) => {
      if (player.id === playerId) return player;
      return {
        ...player,
        cards: player.cards.map((_, index) => ({
          id: `hidden-${player.id}-${index}`,
          suit: Suit.HEARTS,
          value: CardValue.SEVEN,
          points: 0,
        })),
      };
    });

    if (
      state.status === "PLAYING" &&
      state.currentContract?.type === GameType.SAUSPIEL &&
      state.currentContract.partnerId !== playerId &&
      !this.calledAceWasPlayed()
    ) {
      state.currentContract.partnerId = undefined;
    }

    return state;
  }

  setGuestName(name: string): void {
    this.mutate((state) => {
      state.players[2].name = name.trim() || "Gast";
    });
  }

  destroy(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  dealCards(): void {
    this.clearTimer();
    this.mutate((state) => {
      this.dealInto(state);
      state.dealerIdx = (state.dealerIdx + 1) % 4;
      state.activePlayerIdx = (state.dealerIdx + 1) % 4;
      state.roundNumber += 1;
      state.readyState = { p1: false, p3: false };
      state.lastResult = undefined;
      state.logs = [{ key: "log.deal", params: { round: state.roundNumber, dealer: state.players[state.dealerIdx].name } }];
      this.resetBidding(state);
    });
    this.scheduleProgress();
  }

  processAction(action: PlayerAction): void {
    if (this.state.paused) return;
    if (action.type === PlayerActionType.BID_WILL) this.processBidWill(action.playerId, Boolean(action.data?.wantsToPlay));
    if (action.type === PlayerActionType.BID_DECLARE && action.data?.declaration) this.processBidDeclare(action.playerId, action.data.declaration);
    if (action.type === PlayerActionType.BID_RETREAT) this.processBidDeclare(action.playerId, null);
    if (action.type === PlayerActionType.PLAY_CARD && action.data?.cardId) this.processCardPlay(action.playerId, action.data.cardId);
    if (action.type === PlayerActionType.READY_NEXT) this.setReady(action.playerId, true);
    if (action.type === PlayerActionType.REMATCH) this.processRematch();
  }

  processBidWill(playerId: string, wantsToPlay: boolean): void {
    const bidding = this.state.biddingState;
    if (this.state.status !== "BIDDING" || bidding?.phase !== "WILL_PHASE") return;
    if (this.activePlayer().id !== playerId) return;

    this.mutate((state) => {
      const currentBidding = state.biddingState!;
      currentBidding.willBids.push({ playerId, wantsToPlay });
      if (wantsToPlay) currentBidding.interestedPlayerIds.push(playerId);
      this.log(state, wantsToPlay ? "log.will" : "log.pass", { name: this.playerName(playerId) });

      if (currentBidding.willBids.length === 4) {
        this.enterDeclarePhaseOrRedeal(state);
      } else {
        state.activePlayerIdx = (state.activePlayerIdx + 1) % 4;
        currentBidding.currentBidderIndex = state.activePlayerIdx;
      }
    });
    this.scheduleProgress();
  }

  processBidDeclare(playerId: string, declaration: GameDeclaration | null): void {
    const bidding = this.state.biddingState;
    if (this.state.status !== "BIDDING" || bidding?.phase !== "DECLARE_PHASE") return;
    if (this.activePlayer().id !== playerId) return;
    // The current high bidder cannot retreat from their own declaration.
    if (!declaration && bidding.highBid?.playerId === playerId) return;
    // Declarations must strictly outrank the current high bid.
    if (declaration && bidding.highBid?.declaration && !canOverrideBid(bidding.highBid.declaration, declaration)) return;
    // Sauspiel Tout does not exist.
    if (declaration?.type === GameType.SAUSPIEL && declaration.isTout) return;
    // Sauspiel: caller must hold a plain card of the called suit but not its Ace.
    if (declaration?.type === GameType.SAUSPIEL) {
      const suit = declaration.calledSuit;
      if (!suit || suit === Suit.HEARTS) return;
      const hand = this.activePlayer().cards;
      const hasPlainCard = hand.some((card) => card.suit === suit && card.value !== CardValue.OBER && card.value !== CardValue.UNTER);
      const hasAce = hand.some((card) => card.suit === suit && card.value === CardValue.ACE);
      if (!hasPlainCard || hasAce) return;
    }

    this.mutate((state) => {
      const currentBidding = state.biddingState!;
      if (!declaration) {
        currentBidding.interestedPlayerIds = currentBidding.interestedPlayerIds.filter((id) => id !== playerId);
        currentBidding.declarations.push({ playerId, declaration: null });
        this.log(state, "log.retreat", { name: this.playerName(playerId) });
      } else {
        const bid: BidDeclaration = { playerId, declaration };
        currentBidding.highBid = bid;
        currentBidding.declarations.push(bid);
        this.log(state, "log.declare", { name: this.playerName(playerId), ...declarationParams(declaration) });
      }

      const remaining = currentBidding.interestedPlayerIds;
      if (remaining.length === 0) {
        // Everyone who wanted to play retreated without a standing bid.
        this.log(state, "log.allPass");
        this.redealSameDealer(state);
        return;
      }
      if (currentBidding.highBid && remaining.length === 1) {
        this.finalizeBidding(state, currentBidding.highBid);
        return;
      }

      const next = this.nextInterestedAfter(playerId, remaining);
      state.activePlayerIdx = state.players.findIndex((player) => player.id === next);
      currentBidding.currentBidderIndex = state.activePlayerIdx;
    });
    this.scheduleProgress();
  }

  processCardPlay(playerId: string, cardId: string): void {
    if (this.state.status !== "PLAYING" || this.state.collecting) return;
    if (this.activePlayer().id !== playerId) return;

    this.mutate((state) => {
      const player = state.players[state.activePlayerIdx];
      const card = player.cards.find((candidate) => candidate.id === cardId);
      if (!card || !state.currentContract || !state.currentTrick) return;
      const legal = getLegalCards(player.cards, state.currentTrick, state.currentContract);
      if (!legal.some((candidate) => candidate.id === cardId)) return;

      player.cards = player.cards.filter((candidate) => candidate.id !== cardId);
      state.currentTrick.playedCards.push({ playerId, card });
      this.log(state, "log.play", { name: player.name, suit: card.suit, value: card.value });

      if (state.currentContract.type === GameType.SAUSPIEL && state.currentContract.calledSuit === card.suit && card.value === CardValue.ACE) {
        state.currentContract.partnerId = playerId;
      }

      if (state.currentTrick.playedCards.length === 4) {
        // Keep the finished trick on the table for a moment before collecting.
        state.currentTrick.winnerId = determineTrickWinner(state.currentTrick.playedCards, state.currentContract.type);
        state.collecting = true;
      } else {
        state.activePlayerIdx = (state.activePlayerIdx + 1) % 4;
      }
    });
    this.scheduleProgress();
  }

  setReady(playerId: string, ready: boolean): void {
    if (this.state.status !== "ROUND_OVER") return;
    if (playerId !== "p1" && playerId !== "p3") return;
    this.mutate((state) => {
      state.readyState[playerId] = ready;
      this.log(state, "log.ready", { name: this.playerName(playerId) });
    });
    if (this.state.readyState.p1 && this.state.readyState.p3) this.dealCards();
  }

  /** Freeze the game while the peer is gone. Timers stop, actions are ignored. */
  pause(): void {
    if (this.state.paused) return;
    this.clearTimer();
    this.mutate((state) => {
      state.paused = true;
      state.players[2].connected = false;
      this.log(state, "log.paused");
    });
  }

  resume(): void {
    if (!this.state.paused) return;
    this.mutate((state) => {
      state.paused = false;
      state.players[2].connected = true;
      this.log(state, "log.resumed");
    });
    this.scheduleProgress();
  }

  isPaused(): boolean {
    return this.state.paused;
  }

  // --- Internal progression -------------------------------------------------

  private scheduleProgress(): void {
    this.clearTimer();
    if (this.state.paused) return;

    if (this.state.collecting) {
      this.defer(() => this.collectTrick(), this.trickHoldMs);
      return;
    }
    if (this.state.status !== "BIDDING" && this.state.status !== "PLAYING") return;

    const active = this.activePlayer();
    if (!active || active.isHuman) return;
    this.defer(() => this.aiStep(), this.aiDelayMs);
  }

  private aiStep(): void {
    if (this.state.paused || this.state.collecting) return;
    const player = this.activePlayer();
    if (!player || player.isHuman) return;

    if (this.state.status === "BIDDING") {
      const bidding = this.state.biddingState!;
      if (bidding.phase === "WILL_PHASE") {
        this.processBidWill(player.id, getAIWillBid(player));
      } else {
        this.processBidDeclare(player.id, getAIBid(player, bidding.highBid?.declaration ?? null));
      }
    } else if (this.state.status === "PLAYING") {
      const card = getAICardPlay(player, this.state.currentTrick, this.state.currentContract, player.difficulty);
      this.processCardPlay(player.id, card.id);
    }
  }

  private collectTrick(): void {
    if (this.state.paused || !this.state.collecting) return;
    this.mutate((state) => {
      const trick = state.currentTrick!;
      const winnerId = trick.winnerId!;
      const winner = state.players.find((candidate) => candidate.id === winnerId)!;
      const points = countPoints(trick.playedCards.map((played) => played.card));
      winner.pointsCollected += points;
      state.tricks.push(trick);
      state.collecting = false;
      this.log(state, "log.trickWon", { name: winner.name, points });

      if (state.tricks.length === 8) {
        this.finishRound(state);
      } else {
        state.activePlayerIdx = state.players.findIndex((candidate) => candidate.id === winnerId);
        state.currentTrick = { id: state.tricks.length + 1, leaderId: winnerId, playedCards: [] };
      }
    });
    this.scheduleProgress();
  }

  private dealInto(state: GameState): void {
    const deck = this.shuffleFn(createDeck());
    this.initialHands = {};
    state.players.forEach((player, index) => {
      player.cards = deck.slice(index * 8, index * 8 + 8);
      player.pointsCollected = 0;
      this.initialHands[player.id] = [...player.cards];
    });
    state.currentContract = null;
    state.currentTrick = null;
    state.tricks = [];
    state.collecting = false;
    state.status = "BIDDING";
  }

  private resetBidding(state: GameState): void {
    state.biddingState = {
      phase: "WILL_PHASE",
      willBids: [],
      interestedPlayerIds: [],
      declarations: [],
      currentBidderIndex: state.activePlayerIdx,
      highBid: null,
      resolvedContract: null,
    };
  }

  private enterDeclarePhaseOrRedeal(state: GameState): void {
    const bidding = state.biddingState!;
    if (bidding.interestedPlayerIds.length === 0) {
      this.log(state, "log.allPass");
      this.redealSameDealer(state);
      return;
    }
    bidding.phase = "DECLARE_PHASE";
    bidding.interestedPlayerIds = orderFromForehand(bidding.interestedPlayerIds, state.dealerIdx, state.players);
    state.activePlayerIdx = state.players.findIndex((player) => player.id === bidding.interestedPlayerIds[0]);
    bidding.currentBidderIndex = state.activePlayerIdx;
  }

  private redealSameDealer(state: GameState): void {
    this.dealInto(state);
    state.activePlayerIdx = (state.dealerIdx + 1) % 4;
    this.resetBidding(state);
  }

  private finalizeBidding(state: GameState, highBid: BidDeclaration): void {
    const declaration = highBid.declaration!;
    const contract: Contract = { ...declaration, declarerId: highBid.playerId };
    if (contract.type === GameType.SAUSPIEL && contract.calledSuit) {
      contract.partnerId = state.players.find((player) =>
        player.cards.some((card) => card.suit === contract.calledSuit && card.value === CardValue.ACE),
      )?.id;
    }
    state.currentContract = contract;
    state.status = "PLAYING";
    state.biddingState!.phase = "RESOLVED";
    state.biddingState!.resolvedContract = contract;
    state.activePlayerIdx = (state.dealerIdx + 1) % 4;
    state.currentTrick = { id: 1, leaderId: state.players[state.activePlayerIdx].id, playedCards: [] };
    this.log(state, "log.contract", { name: this.playerName(contract.declarerId), ...declarationParams(declaration) });
  }

  private finishRound(state: GameState): void {
    const result = calculateRoundResult(state.players, state.currentContract!, state.tricks, this.initialHands);
    state.lastResult = result;
    Object.entries(result.scoreChanges).forEach(([id, change]) => {
      state.scores[id] = (state.scores[id] ?? 0) + change;
    });
    if (state.roundNumber >= state.totalRounds) {
      state.status = "MATCH_OVER";
    } else {
      state.status = "ROUND_OVER";
    }
    state.currentTrick = null;
    state.readyState = { p1: false, p3: false };
    this.log(state, "log.roundOver", { names: result.winnerIds.map((id) => this.playerName(id)).join(", ") });
  }

  processRematch(): void {
    this.clearTimer();
    this.mutate((state) => {
      state.readyState = { p1: false, p3: false };
      state.scores = { p1: 0, p2: 0, p3: 0, p4: 0 };
      state.roundNumber = 0;
      state.dealerIdx = 3;
      this.dealInto(state);
      state.dealerIdx = (state.dealerIdx + 1) % 4;
      state.activePlayerIdx = (state.dealerIdx + 1) % 4;
      state.roundNumber += 1;
      state.lastResult = undefined;
      state.logs = [{ key: "log.deal", params: { round: state.roundNumber, dealer: state.players[state.dealerIdx].name } }];
      this.resetBidding(state);
    });
    this.scheduleProgress();
  }

  devSkipTrick(): void {
    if (import.meta.env.DEV && this.state.status === "PLAYING" && !this.state.collecting) {
      this.clearTimer();
      while (this.state.status === "PLAYING" && !this.state.collecting) {
        const active = this.activePlayer();
        const legal = getLegalCards(active.cards, this.state.currentTrick, this.state.currentContract);
        if (legal.length === 0) break;
        const card = active.isHuman
          ? legal[0]
          : getAICardPlay(active, this.state.currentTrick, this.state.currentContract, active.difficulty);
        this.processCardPlay(active.id, card.id);
      }
    }
  }

  private calledAceWasPlayed(): boolean {
    const calledSuit = this.state.currentContract?.calledSuit;
    if (!calledSuit) return true;
    return [...this.state.tricks.flatMap((trick) => trick.playedCards), ...(this.state.currentTrick?.playedCards ?? [])].some(
      (played) => played.card.suit === calledSuit && played.card.value === CardValue.ACE,
    );
  }

  private activePlayer(): Player {
    return this.state.players[this.state.activePlayerIdx];
  }

  private playerName(playerId: string): string {
    return this.state.players.find((player) => player.id === playerId)?.name ?? playerId;
  }

  private nextInterestedAfter(playerId: string, interested: string[]): string {
    const index = interested.indexOf(playerId);
    return interested[(index + 1) % interested.length];
  }

  private log(state: GameState, key: string, params?: LogEntry["params"]): void {
    state.logs.unshift({ key, params });
    if (state.logs.length > MAX_LOGS) state.logs.length = MAX_LOGS;
  }

  private defer(fn: () => void, ms: number): void {
    if (ms <= 0) {
      fn();
    } else {
      this.timer = setTimeout(fn, ms);
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private mutate(mutator: (state: GameState) => void): void {
    mutator(this.state);
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function makePlayer(id: SeatId, name: string, isHuman: boolean, seatIndex: number): Player {
  return {
    id,
    name,
    isHuman,
    cards: [],
    pointsCollected: 0,
    seatIndex,
    connected: true,
  };
}

function orderFromForehand(ids: string[], dealerIdx: number, players: Player[]): string[] {
  return [...ids].sort((a, b) => {
    const aIndex = players.findIndex((player) => player.id === a);
    const bIndex = players.findIndex((player) => player.id === b);
    return ((aIndex - dealerIdx + 3) % 4) - ((bIndex - dealerIdx + 3) % 4);
  });
}

function declarationParams(declaration: GameDeclaration): Record<string, string | number> {
  const params: Record<string, string | number> = { gameType: declaration.type };
  if (declaration.calledSuit) params.calledSuit = declaration.calledSuit;
  if (declaration.isTout) params.isTout = 1;
  return params;
}
