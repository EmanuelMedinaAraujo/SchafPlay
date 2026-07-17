import {
  BidDeclaration,
  BiddingState,
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
  StossKind,
} from "../game/types";
import { createDeck, shuffleDeck } from "../game/deck";
import {
  canOverrideBid,
  countPoints,
  determineTrickWinner,
  getCallableSuits,
  getLegalCards,
  isRetreatAllowed,
  isValidSauspielCall,
} from "../game/rules";
import { calculateRoundResult } from "../game/scoring";
import { redactStateFor } from "./redaction";
import { AIController } from "../players/AIController";
import { BidContext, PlayerController } from "../players/PlayerController";

type Listener = (state: GameState) => void;

export interface EngineOptions {
  /** Delay before an AI seat acts. 0 = act synchronously (used by tests). */
  aiDelayMs?: number;
  /** How long a completed trick stays visible before it is collected. */
  trickHoldMs?: number;
  /** Deck arrangement, injectable for deterministic tests. */
  shuffleFn?: (deck: Card[]) => Card[];
  /** Solo mode: seat p3 is a third AI instead of the remote human. */
  soloMode?: boolean;
  /** Decision-makers for engine-driven seats; defaults to an AIController on every non-human seat. */
  controllers?: Partial<Record<SeatId, PlayerController>>;
  /** Enables devSkipTrick/devSkipRound (the app wires this to its dev build flag). */
  devToolsEnabled?: boolean;
  /** House rule (#31): when true, Laufende (matadors) pay nothing. Default false. */
  disableLaufende?: boolean;
  /** House rule (#11): when true, an all-pass starts a Ramsch instead of a redeal. Default false. */
  enableRamsch?: boolean;
  /** House rule (#57): when true, defenders may Stoß (double) and the declarer may Retour. Default false. */
  enableStoss?: boolean;
}

/** Dev-skip fallback for seats without a controller of their own. */
const devFallbackAI = new AIController();

const MAX_LOGS = 30;

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
  private enableStoss: boolean;

  constructor(hostName: string, guestName = "Gast", totalRounds = 8, options: EngineOptions = {}) {
    this.aiDelayMs = options.aiDelayMs ?? 900;
    this.trickHoldMs = options.trickHoldMs ?? 1600;
    this.shuffleFn = options.shuffleFn ?? shuffleDeck;
    this.devToolsEnabled = options.devToolsEnabled ?? false;
    this.disableLaufende = options.disableLaufende ?? false;
    this.enableRamsch = options.enableRamsch ?? false;
    this.enableStoss = options.enableStoss ?? false;

    const players: Player[] = [
      makePlayer("p1", hostName || "Host", true, 0),
      makePlayer("p2", "Resi (KI)", false, 1),
      options.soloMode ? makePlayer("p3", "Zenzi (KI)", false, 2) : makePlayer("p3", guestName || "Gast", true, 2),
      makePlayer("p4", "Sepp (KI)", false, 3),
    ];

    // A seat is engine-driven iff it has a controller; defaults keep the
    // controller map and the players' isHuman flags in agreement.
    this.controllers =
      options.controllers ??
      Object.fromEntries(players.filter((player) => !player.isHuman).map((player) => [player.id, new AIController()]));

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
      readyState: { p1: false, p3: !players[2].isHuman },
      scores: { p1: 0, p2: 0, p3: 0, p4: 0 },
      roundNumber: 0,
      totalRounds,
      logs: [{ key: "log.lobby" }],
      stoss: [],
      stossEnabled: this.enableStoss,
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
   * State as seen by one player — see engine/redaction.ts, the privacy
   * boundary of the host-authoritative model.
   */
  getRedactedState(playerId: string): GameState {
    return redactStateFor(this.getState(), playerId);
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
      state.readyState = { p1: false, p3: !state.players[2].isHuman };
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
    if (action.type === PlayerActionType.REMATCH) this.processRematchReady(action.playerId);
    if (action.type === PlayerActionType.STOSS) this.processStoss(action.playerId);
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
    // "Doch passen" (#24): a player who said "I'd play" may only bow out once a
    // Wenz or Solo already stands. You cannot retreat out of a Sauspiel — you
    // must top it with a higher game.
    if (!declaration && !isRetreatAllowed(bidding.highBid?.declaration)) return;
    // Declarations must strictly outrank the current high bid.
    if (declaration && bidding.highBid?.declaration && !canOverrideBid(bidding.highBid.declaration, declaration)) return;
    // Sauspiel Tout does not exist.
    if (declaration?.type === GameType.SAUSPIEL && declaration.isTout) return;
    // Sauspiel: caller must hold a plain card of the called suit but not its Ace.
    if (declaration?.type === GameType.SAUSPIEL) {
      const suit = declaration.calledSuit;
      if (!suit || !isValidSauspielCall(this.activePlayer().cards, suit)) return;
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
        this.handleAllPass(state);
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
      const legal = getLegalCards(player.cards, state.currentTrick, state.currentContract, state.tricks);
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

  /**
   * Announce a Stoß (defender) or Retour (declarer). The doubling window runs
   * from the moment the contract is announced (PLAYING) until the second card
   * of the first trick is played. The chain is capped at Stoß + Retour: the
   * first entry must be a Stoß from a defender (not the declarer and — in a
   * Sauspiel — not the hidden partner); the second must be a Retour from the
   * declarer. Retour is restricted to the declarer so the Sauspiel partner is
   * never revealed early. Each announcement doubles the round value.
   */
  processStoss(playerId: string): void {
    const kind = this.stossKindFor(playerId);
    if (!kind) return;
    this.mutate((state) => {
      state.stoss.push({ playerId, kind });
      this.log(state, kind === "retour" ? "log.retour" : "log.stoss", { name: this.playerName(playerId) });
      // A defender's Stoß gives an AI declarer the chance to answer with a Retour.
      if (kind === "stoss") this.maybeAiRetour(state);
    });
  }

  /** The kind of announcement `playerId` may make right now, or null if none. */
  private stossKindFor(playerId: string): StossKind | null {
    const state = this.state;
    if (!state.stossEnabled) return null;
    if (state.status !== "PLAYING") return null;
    const contract = state.currentContract;
    if (!contract || contract.type === GameType.RAMSCH) return null;
    // Timing window: still in the first trick, before its second card falls.
    if (state.tricks.length !== 0) return null;
    if ((state.currentTrick?.playedCards.length ?? 0) >= 2) return null;
    // Cap the chain at Stoß + Retour.
    if (state.stoss.length >= 2) return null;

    const isDeclarer = playerId === contract.declarerId;
    const isPartner = contract.type === GameType.SAUSPIEL && contract.partnerId === playerId;

    if (state.stoss.length === 0) {
      // First announcement: a Stoß, only from a defender.
      return isDeclarer || isPartner ? null : "stoss";
    }
    // Second announcement: a Retour, only from the declarer, answering a Stoß.
    if (state.stoss[state.stoss.length - 1].kind !== "stoss") return null;
    return isDeclarer ? "retour" : null;
  }

  /**
   * Give AI defenders the chance to Stoß the instant a contract is fixed (the
   * whole hand is still in front of them, which is when the decision is made).
   * Only one Stoß is allowed, so the first willing defender in play order takes
   * the slot; an AI declarer may then answer with a Retour. Human seats are
   * skipped — they decide via the UI within the same first-trick window.
   */
  private runAiStossPass(state: GameState): void {
    if (!state.stossEnabled) return;
    const contract = state.currentContract;
    if (!contract || contract.type === GameType.RAMSCH) return;

    for (let i = 1; i <= 4 && state.stoss.length === 0; i += 1) {
      const player = state.players[(state.dealerIdx + i) % 4];
      const controller = this.controllers[player.id];
      if (!controller) continue;
      const isDeclarer = player.id === contract.declarerId;
      const isPartner = contract.type === GameType.SAUSPIEL && contract.partnerId === player.id;
      if (isDeclarer || isPartner) continue;
      if (controller.decideStoss(player, contract, { kind: "stoss" })) {
        state.stoss.push({ playerId: player.id, kind: "stoss" });
        this.log(state, "log.stoss", { name: player.name });
      }
    }
    this.maybeAiRetour(state);
  }

  /** An AI declarer's Retour in answer to a standing Stoß. */
  private maybeAiRetour(state: GameState): void {
    const contract = state.currentContract;
    if (!contract) return;
    if (state.stoss.length !== 1 || state.stoss[0].kind !== "stoss") return;
    const declarer = state.players.find((player) => player.id === contract.declarerId);
    const controller = declarer ? this.controllers[declarer.id] : undefined;
    if (!declarer || !controller) return; // a human declarer answers via the UI
    if (controller.decideStoss(declarer, contract, { kind: "retour" })) {
      state.stoss.push({ playerId: declarer.id, kind: "retour" });
      this.log(state, "log.retour", { name: declarer.name });
    }
  }

  setReady(playerId: string, ready: boolean): void {
    if (this.state.status !== "ROUND_OVER") return;
    if (playerId !== "p1" && playerId !== "p3") return;
    this.mutate((state) => {
      state.readyState[playerId] = ready;
      this.log(state, "log.ready", { name: this.playerName(playerId) });
    });
    if (this.state.readyState.p1 && this.state.readyState.p3) {
      // After the last round's summary, advance to the list summary instead of
      // dealing a new round (#27).
      if (this.state.roundNumber >= this.state.totalRounds) this.finishList();
      else this.dealCards();
    }
  }

  private finishList(): void {
    this.clearTimer();
    this.mutate((state) => {
      state.status = "LIST_OVER";
      state.readyState = { p1: false, p3: !state.players[2].isHuman };
    });
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
    if (!active || !this.controllers[active.id]) return;
    this.defer(() => this.aiStep(), this.aiDelayMs);
  }

  private aiStep(): void {
    if (this.state.paused || this.state.collecting) return;
    const player = this.activePlayer();
    const controller = player ? this.controllers[player.id] : undefined;
    if (!player || !controller) return;

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
    state.stoss = [];
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
      this.handleAllPass(state);
      return;
    }
    bidding.phase = "DECLARE_PHASE";
    bidding.interestedPlayerIds = orderFromForehand(bidding.interestedPlayerIds, state.dealerIdx, state.players);
    state.activePlayerIdx = state.players.findIndex((player) => player.id === bidding.interestedPlayerIds[0]);
    bidding.currentBidderIndex = state.activePlayerIdx;
  }

  /**
   * Nobody plays: with the Ramsch house rule (#11) the same deal is played out
   * as a Ramsch; otherwise the cards are thrown in and redealt (unchanged
   * default behavior).
   */
  private handleAllPass(state: GameState): void {
    if (this.enableRamsch) {
      this.startRamsch(state);
    } else {
      this.log(state, "log.allPass");
      this.redealSameDealer(state);
    }
  }

  /**
   * Ramsch (#11): no declarer, no partner — everyone plays for themselves
   * with normal (Sauspiel-style) trumps. `declarerId: ""` marks the missing
   * declarer; no seat id ever matches it, so nothing in the UI or the AI
   * treats any seat as the declaring side.
   */
  private startRamsch(state: GameState): void {
    const contract: Contract = { type: GameType.RAMSCH, declarerId: "" };
    state.currentContract = contract;
    state.status = "PLAYING";
    state.biddingState!.phase = "RESOLVED";
    state.biddingState!.resolvedContract = contract;
    state.activePlayerIdx = (state.dealerIdx + 1) % 4;
    state.currentTrick = { id: 1, leaderId: state.players[state.activePlayerIdx].id, playedCards: [] };
    this.log(state, "log.ramsch");
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
    // With the contract fixed and every hand still full, AI defenders get their
    // one chance to Stoß; a human defender still has the first-trick window.
    this.runAiStossPass(state);
  }

  private finishRound(state: GameState): void {
    const result = calculateRoundResult(state.players, state.currentContract!, state.tricks, this.initialHands, {
      disableLaufende: this.disableLaufende,
      dealerIdx: state.dealerIdx,
      // Each Stoß/Retour doubles the round: 0 -> 1x, 1 -> 2x, 2 -> 4x.
      stossMultiplier: 2 ** state.stoss.length,
    });
    state.lastResult = result;
    Object.entries(result.scoreChanges).forEach(([id, change]) => {
      state.scores[id] = (state.scores[id] ?? 0) + change;
    });
    // Every round — including the last — first shows its own round summary
    // (#27). The final round only advances to the list summary once both
    // players are ready (see setReady).
    state.status = "ROUND_OVER";
    state.currentTrick = null;
    state.readyState = { p1: false, p3: !state.players[2].isHuman };
    this.log(state, "log.roundOver", { names: result.winnerIds.map((id) => this.playerName(id)).join(", ") });
  }

  processRematchReady(playerId: string): void {
    if (this.state.status !== "LIST_OVER") return;
    if (playerId !== "p1" && playerId !== "p3") return;
    this.mutate((state) => {
      state.readyState[playerId] = true;
      this.log(state, "log.ready", { name: this.playerName(playerId) });
    });
    if (this.state.readyState.p1 && this.state.readyState.p3) {
      this.processRematch();
    }
  }

  processRematch(): void {
    this.clearTimer();
    this.mutate((state) => {
      state.readyState = { p1: false, p3: !state.players[2].isHuman };
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
    if (this.devToolsEnabled && this.state.status === "PLAYING" && !this.state.collecting) {
      this.clearTimer();
      while (this.state.status === "PLAYING" && !this.state.collecting) {
        if (!this.playStepFor(this.activePlayer())) break;
      }
    }
  }

  devSkipRound(): void {
    if (this.devToolsEnabled && (this.state.status === "PLAYING" || this.state.status === "BIDDING") && !this.state.paused) {
      this.clearTimer();
      let safetyCount = 0;
      while ((this.state.status === "PLAYING" || this.state.status === "BIDDING") && safetyCount < 200) {
        safetyCount++;
        if (this.state.collecting) {
          // Don't wait for the trick-hold timer — resolve the trick right away,
          // otherwise processCardPlay ignores every further play and the loop
          // would only ever finish the current trick.
          this.clearTimer();
          this.collectTrick();
          continue;
        }
        if (this.state.status === "BIDDING") {
          const active = this.activePlayer();
          if (this.state.biddingState!.phase === "WILL_PHASE") {
            const wantsToPlay = active.id === "p1";
            this.processBidWill(active.id, wantsToPlay);
          } else {
            if (active.id === "p1") {
              // Always make a legal, progressing declaration for the human seat.
              // A Sauspiel needs a *plain* card (not Ober/Unter, not the Ace) of
              // the suit and only stands when nothing higher was bid. Otherwise:
              // top a standing Sauspiel with a Wenz, or retreat under a Wenz/Solo.
              const high = this.state.biddingState!.highBid?.declaration ?? null;
              const calledSuit = high ? undefined : getCallableSuits(active.cards)[0];
              if (calledSuit) this.processBidDeclare(active.id, { type: GameType.SAUSPIEL, calledSuit });
              else if (canOverrideBid(high, { type: GameType.WENZ })) this.processBidDeclare(active.id, { type: GameType.WENZ });
              else this.processBidDeclare(active.id, null);
            } else {
              const bidding = this.state.biddingState!;
              const controller = this.controllers[active.id] ?? devFallbackAI;
              this.processBidDeclare(active.id, controller.decideBid(active, this.bidContext(bidding)));
            }
          }
        } else if (this.state.status === "PLAYING") {
          if (!this.playStepFor(this.activePlayer())) break;
        }
      }
    }
  }

  /**
   * Dev-skip helper: play one card for the given seat — its controller's
   * choice, or the first legal card for a human. False when nothing is legal.
   */
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
