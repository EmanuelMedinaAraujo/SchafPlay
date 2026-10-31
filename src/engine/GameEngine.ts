import {
  BidDeclaration,
  BiddingState,
  Card,
  Contract,
  GameDeclaration,
  GameState,
  GameType,
  Player,
  PlayerAction,
  PlayerActionType,
  SeatId,
  StossKind,
} from "../game/types";
import { createDeck, shuffleDeck } from "../game/deck";
import {
  canOverrideBid,
  countPoints,
  determineTrickWinner,
  getCallableSuits,
  getLegalCards,
  isCalledAce,
  isRetreatAllowed,
  stossKindFor,
} from "../game/rules";
import { calculateRoundResult } from "../game/scoring";
import { AIController } from "../players/AIController";
import { BidContext, PlayerController } from "../players/PlayerController";

type Listener = (state: GameState) => void;

export interface EngineOptions {
  /** 0 = act synchronously (tests). */
  aiDelayMs?: number;
  trickHoldMs?: number;
  /** Injectable for deterministic tests. */
  shuffleFn?: (deck: Card[]) => Card[];
  /** Seat p3 is a third AI instead of the remote human. */
  soloMode?: boolean;
  /** Enables devSkipTrick/devSkipRound. */
  devToolsEnabled?: boolean;
  /** House rule #31. */
  disableLaufende?: boolean;
  /** House rule #11: an all-pass starts a Ramsch instead of a redeal. */
  enableRamsch?: boolean;
  /** House rule #57. */
  enableStoss?: boolean;
  hostAvatar?: string;
}

const devFallbackAI = new AIController();

/** Opaque preset keys (#14); must match `AVATAR_PRESETS` in `lib/avatars.ts`,
 *  which the engine cannot import — it stays DOM-free for the Node-side sim. */
const AI_SEAT_AVATAR: Record<"p2" | "p3" | "p4", string> = {
  p2: "preset:resi",
  p3: "preset:zenzi",
  p4: "preset:sepp",
};

export class GameEngine {
  private state: GameState;
  private listeners = new Set<Listener>();
  private initialHands: Record<string, Card[]> = {};
  private aiDelayMs: number;
  private trickHoldMs: number;
  private shuffleFn: (deck: Card[]) => Card[];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controllers: Partial<Record<SeatId, PlayerController>>;
  private devToolsEnabled: boolean;
  private disableLaufende: boolean;
  private enableRamsch: boolean;

  /** The guest's name and avatar arrive later, via `setGuestName`/`setGuestAvatar`. */
  constructor(hostName: string, totalRounds = 8, options: EngineOptions = {}) {
    this.aiDelayMs = options.aiDelayMs ?? 900;
    this.trickHoldMs = options.trickHoldMs ?? 1600;
    this.shuffleFn = options.shuffleFn ?? shuffleDeck;
    this.devToolsEnabled = options.devToolsEnabled ?? false;
    this.disableLaufende = options.disableLaufende ?? false;
    this.enableRamsch = options.enableRamsch ?? false;

    const players: Player[] = [
      makePlayer("p1", hostName || "Host", true, 0, options.hostAvatar || ""),
      makePlayer("p2", "Resi (KI)", false, 1, AI_SEAT_AVATAR.p2),
      options.soloMode
        ? makePlayer("p3", "Zenzi (KI)", false, 2, AI_SEAT_AVATAR.p3)
        : makePlayer("p3", "Gast", true, 2, ""),
      makePlayer("p4", "Sepp (KI)", false, 3, AI_SEAT_AVATAR.p4),
    ];

    // A seat is engine-driven iff it has a controller.
    this.controllers = Object.fromEntries(
      players.filter((player) => !player.isHuman).map((player) => [player.id, new AIController()]),
    );

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
      readyState: freshReadyState(players),
      scores: freshScores(),
      roundNumber: 0,
      totalRounds,
      stoss: [],
      stossEnabled: options.enableStoss ?? false,
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

  setGuestName(name: string): void {
    this.mutate((state) => {
      state.players[2].name = name.trim() || "Gast";
    });
  }

  /** Already sanitized by `HostSession` — the wire boundary is the session's job. */
  setGuestAvatar(avatar: string): void {
    this.mutate((state) => {
      state.players[2].avatar = avatar;
    });
  }

  destroy(): void {
    this.clearTimer();
    this.listeners.clear();
  }

  dealCards(): void {
    this.clearTimer();
    this.mutate((state) => this.beginRound(state));
    this.scheduleProgress();
  }

  /** Deal the next round: advance the dealer, reset per-round state, open bidding. */
  private beginRound(state: GameState): void {
    state.dealerIdx = (state.dealerIdx + 1) % 4;
    state.roundNumber += 1;
    state.readyState = freshReadyState(state.players);
    state.lastResult = undefined;
    this.deal(state);
  }

  processAction(action: PlayerAction): void {
    if (this.state.paused) return;
    switch (action.type) {
      case PlayerActionType.BID_WILL:
        return this.processBidWill(action.playerId, Boolean(action.data?.wantsToPlay));
      case PlayerActionType.BID_DECLARE:
        return action.data?.declaration ? this.processBidDeclare(action.playerId, action.data.declaration) : undefined;
      case PlayerActionType.BID_RETREAT:
        return this.processBidDeclare(action.playerId, null);
      case PlayerActionType.PLAY_CARD:
        return action.data?.cardId ? this.processCardPlay(action.playerId, action.data.cardId) : undefined;
      case PlayerActionType.READY_NEXT:
        return this.markReady(action.playerId, "ROUND_OVER");
      case PlayerActionType.REMATCH:
        return this.markReady(action.playerId, "LIST_OVER");
      case PlayerActionType.STOSS:
        return this.processStoss(action.playerId);
    }
  }

  private processBidWill(playerId: string, wantsToPlay: boolean): void {
    const bidding = this.state.biddingState;
    if (this.state.status !== "BIDDING" || bidding?.phase !== "WILL_PHASE") return;
    if (this.activePlayer().id !== playerId) return;

    this.mutate((state) => {
      const currentBidding = state.biddingState!;
      currentBidding.willBids.push({ playerId, wantsToPlay });
      if (wantsToPlay) currentBidding.interestedPlayerIds.push(playerId);

      if (currentBidding.willBids.length === 4) {
        this.enterDeclarePhaseOrRedeal(state);
      } else {
        state.activePlayerIdx = (state.activePlayerIdx + 1) % 4;
      }
    });
    this.scheduleProgress();
  }

  private processBidDeclare(playerId: string, declaration: GameDeclaration | null): void {
    const bidding = this.state.biddingState;
    if (this.state.status !== "BIDDING" || bidding?.phase !== "DECLARE_PHASE") return;
    if (this.activePlayer().id !== playerId) return;
    // The current high bidder cannot retreat from their own declaration.
    if (!declaration && bidding.highBid?.playerId === playerId) return;
    // "Doch passen" (#24): you cannot retreat out of a Sauspiel, only top it.
    if (!declaration && !isRetreatAllowed(bidding.highBid?.declaration)) return;
    if (declaration && bidding.highBid?.declaration && !canOverrideBid(bidding.highBid.declaration, declaration)) return;
    // Sauspiel Tout does not exist.
    if (declaration?.type === GameType.SAUSPIEL && declaration.isTout) return;
    if (declaration?.type === GameType.SAUSPIEL) {
      const suit = declaration.calledSuit;
      if (!suit || !getCallableSuits(this.activePlayer().cards).includes(suit)) return;
    }

    this.mutate((state) => {
      const currentBidding = state.biddingState!;
      // Seat order among the interested players; a retreat drops this seat, so
      // the turn passes to whoever now sits at its index.
      const bidderIndex = currentBidding.interestedPlayerIds.indexOf(playerId);
      if (!declaration) {
        currentBidding.interestedPlayerIds = currentBidding.interestedPlayerIds.filter((id) => id !== playerId);
        currentBidding.declarations.push({ playerId, declaration: null });
      } else {
        const bid: BidDeclaration = { playerId, declaration };
        currentBidding.highBid = bid;
        currentBidding.declarations.push(bid);
      }

      // A retreat needs a standing bid, whose bidder never retreats, so
      // `remaining` is never empty.
      const remaining = currentBidding.interestedPlayerIds;
      if (currentBidding.highBid && remaining.length === 1) {
        this.finalizeBidding(state, currentBidding.highBid);
        return;
      }

      const next = remaining[(declaration ? bidderIndex + 1 : bidderIndex) % remaining.length];
      state.activePlayerIdx = seatIndexOf(state, next);
    });
    this.scheduleProgress();
  }

  private processCardPlay(playerId: string, cardId: string): void {
    if (this.state.status !== "PLAYING" || this.state.collecting) return;
    if (this.activePlayer().id !== playerId) return;

    this.mutate((state) => {
      const player = state.players[state.activePlayerIdx];
      const card = player.cards.find((candidate) => candidate.id === cardId);
      if (!card || !state.currentContract || !state.currentTrick) return;
      const legal = getLegalCards(player.cards, state.currentTrick, state.currentContract, state.tricks);
      if (!legal.some((candidate) => candidate.id === cardId)) return;

      player.cards = player.cards.filter((candidate) => candidate.id !== cardId);
      state.currentTrick.playedCards.push({ playerId, card });

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

  private processStoss(playerId: string): void {
    const kind = this.stossKindFor(playerId);
    if (!kind) return;
    this.mutate((state) => {
      state.stoss.push({ playerId, kind });
      // A defender's Stoß gives an AI declarer the chance to answer with a Retour.
      if (kind === "stoss") this.maybeAiRetour(state);
    });
  }

  /** The engine knows the partner; the UI decides from its own hand instead. */
  private stossKindFor(playerId: string): StossKind | null {
    const contract = this.state.currentContract;
    return stossKindFor(this.state, playerId, contract?.type === GameType.SAUSPIEL && contract.partnerId === playerId);
  }

  /**
   * The first willing AI defender in play order takes the single Stoß slot.
   * Human seats decide via the UI within the same first-trick window.
   * Runs inside `mutate`, where `state` is `this.state`.
   */
  private runAiStossPass(state: GameState): void {
    for (let i = 1; i <= 4 && state.stoss.length === 0; i += 1) {
      const player = state.players[(state.dealerIdx + i) % 4];
      const controller = this.controllers[player.id];
      if (!controller || this.stossKindFor(player.id) !== "stoss") continue;
      if (controller.decideStoss(player, state.currentContract!, { kind: "stoss" })) {
        state.stoss.push({ playerId: player.id, kind: "stoss" });
      }
    }
    this.maybeAiRetour(state);
  }

  /** An AI declarer's Retour in answer to a standing Stoß. */
  private maybeAiRetour(state: GameState): void {
    const contract = state.currentContract;
    const declarer = state.players.find((player) => player.id === contract?.declarerId);
    const controller = declarer ? this.controllers[declarer.id] : undefined;
    if (!declarer || !controller) return; // a human declarer answers via the UI
    if (this.stossKindFor(declarer.id) !== "retour") return;
    if (controller.decideStoss(declarer, contract!, { kind: "retour" })) {
      state.stoss.push({ playerId: declarer.id, kind: "retour" });
    }
  }

  /**
   * A human's ready click on the round or list summary. Once both humans are
   * ready the game advances: the next deal, the list summary after the last
   * round (#27), or a rematch.
   */
  private markReady(playerId: string, status: "ROUND_OVER" | "LIST_OVER"): void {
    if (this.state.status !== status) return;
    if (playerId !== "p1" && playerId !== "p3") return;
    this.mutate((state) => {
      state.readyState[playerId] = true;
    });
    if (!this.state.readyState.p1 || !this.state.readyState.p3) return;
    if (status === "LIST_OVER") this.rematch();
    else if (this.state.roundNumber >= this.state.totalRounds) this.finishList();
    else this.dealCards();
  }

  private finishList(): void {
    this.clearTimer();
    this.mutate((state) => {
      state.status = "LIST_OVER";
      state.readyState = freshReadyState(state.players);
    });
  }

  /** Freeze the game while the peer is gone. Timers stop, actions are ignored. */
  pause(): void {
    if (this.state.paused) return;
    this.clearTimer();
    this.mutate((state) => {
      state.paused = true;
      state.players[2].connected = false;
    });
  }

  resume(): void {
    if (!this.state.paused) return;
    this.mutate((state) => {
      state.paused = false;
      state.players[2].connected = true;
    });
    this.scheduleProgress();
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

    if (!this.controllers[this.activePlayer().id]) return;
    this.defer(() => this.aiStep(), this.aiDelayMs);
  }

  private aiStep(): void {
    if (this.state.paused || this.state.collecting) return;
    const player = this.activePlayer();
    const controller = this.controllers[player.id];
    if (!controller) return;

    if (this.state.status === "BIDDING") {
      const bidding = this.state.biddingState!;
      if (bidding.phase === "WILL_PHASE") {
        this.processBidWill(player.id, controller.decideWill(player, bidding.willBids));
      } else {
        this.processBidDeclare(player.id, controller.decideBid(player, this.bidContext(bidding)));
      }
    } else if (this.state.status === "PLAYING") {
      const card = controller.decideCard(player, this.state.currentTrick, this.state.currentContract, this.state.tricks);
      this.processCardPlay(player.id, card.id);
    }
  }

  private bidContext(bidding: BiddingState): BidContext {
    return {
      highBid: bidding.highBid?.declaration ?? null,
      canRetreat: isRetreatAllowed(bidding.highBid?.declaration),
    };
  }

  private collectTrick(): void {
    if (this.state.paused || !this.state.collecting) return;
    this.mutate((state) => {
      const trick = state.currentTrick!;
      const winnerId = trick.winnerId!;
      const winnerIdx = seatIndexOf(state, winnerId);
      state.players[winnerIdx].pointsCollected += countPoints(trick.playedCards.map((played) => played.card));
      state.tricks.push(trick);
      state.collecting = false;

      if (state.tricks.length === 8) {
        this.finishRound(state);
      } else {
        state.activePlayerIdx = winnerIdx;
        state.currentTrick = { id: state.tricks.length + 1, leaderId: winnerId, playedCards: [] };
      }
    });
    this.scheduleProgress();
  }

  /** Fresh hands and per-deal state; bidding opens with the forehand. The dealer is the caller's. */
  private deal(state: GameState): void {
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
    state.stoss = [];
    state.activePlayerIdx = forehandIdx(state);
    state.biddingState = {
      phase: "WILL_PHASE",
      willBids: [],
      interestedPlayerIds: [],
      declarations: [],
      highBid: null,
    };
  }

  private enterDeclarePhaseOrRedeal(state: GameState): void {
    const bidding = state.biddingState!;
    if (bidding.interestedPlayerIds.length === 0) {
      // `declarerId: ""` marks Ramsch's missing declarer — no seat id ever matches it.
      if (this.enableRamsch) this.enterPlaying(state, { type: GameType.RAMSCH, declarerId: "" });
      else this.deal(state);
      return;
    }
    bidding.phase = "DECLARE_PHASE";
    bidding.interestedPlayerIds = orderFromForehand(bidding.interestedPlayerIds, state);
    state.activePlayerIdx = seatIndexOf(state, bidding.interestedPlayerIds[0]);
  }

  private enterPlaying(state: GameState, contract: Contract): void {
    state.currentContract = contract;
    state.status = "PLAYING";
    state.activePlayerIdx = forehandIdx(state);
    state.currentTrick = { id: 1, leaderId: state.players[state.activePlayerIdx].id, playedCards: [] };
  }

  private finalizeBidding(state: GameState, highBid: BidDeclaration): void {
    const declaration = highBid.declaration!;
    const contract: Contract = { ...declaration, declarerId: highBid.playerId };
    if (contract.type === GameType.SAUSPIEL && contract.calledSuit) {
      // Only the holder can ever play the called Ace, so this is final.
      contract.partnerId = state.players.find((player) => player.cards.some((card) => isCalledAce(card, contract)))?.id;
    }
    this.enterPlaying(state, contract);
    this.runAiStossPass(state);
  }

  private finishRound(state: GameState): void {
    const result = calculateRoundResult(state.players, state.currentContract!, state.tricks, this.initialHands, {
      disableLaufende: this.disableLaufende,
      dealerIdx: state.dealerIdx,
      stossMultiplier: 2 ** state.stoss.length,
    });
    state.lastResult = result;
    Object.entries(result.scoreChanges).forEach(([id, change]) => {
      state.scores[id] = (state.scores[id] ?? 0) + change;
    });
    // Even the last round shows its own summary first (#27); markReady then
    // advances to the list summary.
    state.status = "ROUND_OVER";
    state.currentTrick = null;
    state.readyState = freshReadyState(state.players);
  }

  private rematch(): void {
    this.clearTimer();
    this.mutate((state) => {
      state.scores = freshScores();
      state.roundNumber = 0;
      state.dealerIdx = 3;
      this.beginRound(state);
    });
    this.scheduleProgress();
  }

  devSkipTrick(): void {
    if (!this.devToolsEnabled || this.state.status !== "PLAYING" || this.state.collecting || this.state.paused) return;
    this.clearTimer();
    while (this.state.status === "PLAYING" && !this.state.collecting) {
      if (!this.playStepFor(this.activePlayer())) break;
    }
  }

  devSkipRound(): void {
    if (!this.devToolsEnabled || this.state.paused) return;
    const inRound = () => this.state.status === "PLAYING" || this.state.status === "BIDDING";
    if (!inRound()) return;
    this.clearTimer();
    for (let safetyCount = 0; inRound() && safetyCount < 200; safetyCount += 1) {
      if (this.state.collecting) {
        // Don't wait for the trick-hold timer — resolve the trick right away,
        // otherwise processCardPlay ignores every further play and the loop
        // would only ever finish the current trick.
        this.collectTrick();
      } else if (this.state.status === "BIDDING") {
        this.devBidStep(this.activePlayer());
      } else if (!this.playStepFor(this.activePlayer())) {
        break;
      }
    }
  }

  /** Dev-skip: the seat's next bid. p1 always takes any legal, progressing game. */
  private devBidStep(active: Player): void {
    const bidding = this.state.biddingState!;
    if (bidding.phase === "WILL_PHASE") {
      this.processBidWill(active.id, active.id === "p1");
      return;
    }
    if (active.id !== "p1") {
      const controller = this.controllers[active.id] ?? devFallbackAI;
      this.processBidDeclare(active.id, controller.decideBid(active, this.bidContext(bidding)));
      return;
    }
    const high = bidding.highBid?.declaration ?? null;
    const calledSuit = high ? undefined : getCallableSuits(active.cards)[0];
    if (calledSuit) this.processBidDeclare(active.id, { type: GameType.SAUSPIEL, calledSuit });
    else if (canOverrideBid(high, { type: GameType.WENZ })) this.processBidDeclare(active.id, { type: GameType.WENZ });
    else this.processBidDeclare(active.id, null);
  }

  /** Dev-skip: one card for the seat. False when nothing is legal. */
  private playStepFor(player: Player): boolean {
    const legal = getLegalCards(player.cards, this.state.currentTrick, this.state.currentContract, this.state.tricks);
    if (legal.length === 0) return false;
    const card =
      this.controllers[player.id]?.decideCard(player, this.state.currentTrick, this.state.currentContract, this.state.tricks) ?? legal[0];
    this.processCardPlay(player.id, card.id);
    return true;
  }

  private activePlayer(): Player {
    return this.state.players[this.state.activePlayerIdx];
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

  /** Listeners share one snapshot, detached from the engine's state and read-only by contract. */
  private mutate(mutator: (state: GameState) => void): void {
    mutator(this.state);
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

/** Fresh ready flags: humans must click ready; an AI at seat 3 (solo) auto-readies. */
function freshReadyState(players: Player[]): GameState["readyState"] {
  return { p1: false, p3: !players[2].isHuman };
}

function makePlayer(id: SeatId, name: string, isHuman: boolean, seatIndex: number, avatar: string): Player {
  return {
    id,
    name,
    isHuman,
    cards: [],
    pointsCollected: 0,
    seatIndex,
    connected: true,
    avatar,
  };
}

function freshScores(): GameState["scores"] {
  return { p1: 0, p2: 0, p3: 0, p4: 0 };
}

function seatIndexOf(state: GameState, playerId: string): number {
  return state.players.findIndex((player) => player.id === playerId);
}

/** The seat left of the dealer: first to bid, first to lead. */
function forehandIdx(state: GameState): number {
  return (state.dealerIdx + 1) % 4;
}

function orderFromForehand(ids: string[], state: GameState): string[] {
  const position = (id: string) => (seatIndexOf(state, id) - state.dealerIdx + 3) % 4;
  return [...ids].sort((a, b) => position(a) - position(b));
}
