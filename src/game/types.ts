/**
 * Domain types: cards, contracts, players, the full game state and the
 * player-action vocabulary the engine consumes. Pure data shapes — no
 * network or UI concerns (those live in net/protocol.ts and src/types.ts).
 */

export enum Suit {
  ACORNS = "ACORNS",
  LEAVES = "LEAVES",
  HEARTS = "HEARTS",
  BELLS = "BELLS",
}

export enum CardValue {
  SEVEN = "7",
  EIGHT = "8",
  NINE = "9",
  UNTER = "U",
  OBER = "O",
  KING = "K",
  TEN = "10",
  ACE = "A",
}

export interface Card {
  id: string;
  suit: Suit;
  value: CardValue;
  points: number;
}

export enum GameType {
  SAUSPIEL = "SAUSPIEL",
  WENZ = "WENZ",
  SOLO_ACORNS = "SOLO_ACORNS",
  SOLO_LEAVES = "SOLO_LEAVES",
  SOLO_HEARTS = "SOLO_HEARTS",
  SOLO_BELLS = "SOLO_BELLS",
  /**
   * Ramsch (#11) is never bid — it starts automatically on an all-pass when
   * the house rule is enabled. Everyone plays for themselves with normal
   * (Sauspiel-style) trumps; there is no declarer and no partner, so it needs
   * no `GamePriority` slot. Its contract carries `declarerId: ""`.
   */
  RAMSCH = "RAMSCH",
}

export enum GamePriority {
  SAUSPIEL = 1,
  WENZ = 2,
  SOLO = 3,
  WENZ_TOUT = 4,
  SOLO_TOUT = 5,
}

export enum Difficulty {
  EASY = "EASY",
  MEDIUM = "MEDIUM",
  HARD = "HARD",
}

export type SeatId = "p1" | "p2" | "p3" | "p4";
export type BiddingPhase = "WILL_PHASE" | "DECLARE_PHASE" | "RESOLVED";
export type GameStatus = "LOBBY" | "BIDDING" | "PLAYING" | "ROUND_OVER" | "LIST_OVER";

/** Structured log entry rendered client-side in the viewer's language. */
export interface LogEntry {
  key: string;
  params?: Record<string, string | number>;
}

export interface GameDeclaration {
  type: GameType;
  calledSuit?: Suit;
  isTout?: boolean;
}

export interface WillBid {
  playerId: string;
  wantsToPlay: boolean;
}

export interface BidDeclaration {
  playerId: string;
  declaration: GameDeclaration | null;
}

export interface Contract extends GameDeclaration {
  declarerId: string;
  partnerId?: string;
}

export interface Player {
  id: SeatId;
  name: string;
  isHuman: boolean;
  cards: Card[];
  pointsCollected: number;
  difficulty?: Difficulty;
  seatIndex: number;
  connected?: boolean;
}

export interface PlayedCard {
  playerId: string;
  card: Card;
}

export interface Trick {
  id: number;
  leaderId: string;
  playedCards: PlayedCard[];
  winnerId?: string;
}

export interface BiddingState {
  phase: BiddingPhase;
  willBids: WillBid[];
  interestedPlayerIds: string[];
  declarations: BidDeclaration[];
  currentBidderIndex: number;
  highBid: BidDeclaration | null;
  resolvedContract: Contract | null;
}

export type ReadyState = Record<string, boolean>;

/** Ramsch-only round detail (#11); present on a RoundResult iff the contract type is RAMSCH. */
export interface RamschResult {
  /**
   * The round's key player: on a Durchmarsch the player who took every trick
   * and WINS; otherwise the player with the most card points, who pays everyone.
   */
  playerId: string;
  isDurchmarsch: boolean;
  /** Players who took no trick (Jungfrau) — each doubles the payout. Empty on a Durchmarsch. */
  jungfrauIds: string[];
  /** Card points each player collected this round. */
  pointsByPlayer: Record<string, number>;
}

export interface RoundResult {
  contract: Contract;
  declarerPoints: number;
  defenderPoints: number;
  declarerWon: boolean;
  isSchneider: boolean;
  isSchwarz: boolean;
  laufende: number;
  scoreChanges: Record<string, number>;
  winnerIds: string[];
  /**
   * Ramsch detail (#11). Optional and additive — stored RoundRecords from
   * older versions simply lack it (no DB version bump needed).
   */
  ramsch?: RamschResult;
}

export interface GameState {
  status: GameStatus;
  players: Player[];
  dealerIdx: number;
  activePlayerIdx: number;
  currentContract: Contract | null;
  tricks: Trick[];
  currentTrick: Trick | null;
  /** True while a completed trick is held on the table before being collected. */
  collecting: boolean;
  /** True while the host paused the game (peer disconnected). */
  paused: boolean;
  biddingState: BiddingState | null;
  readyState: ReadyState;
  scores: Record<string, number>;
  roundNumber: number;
  totalRounds: number;
  logs: LogEntry[];
  lastResult?: RoundResult;
}

/**
 * A redacted state is the same shape as GameState — other players' hands are
 * face-down placeholders and the Sauspiel partner may be blanked. Produced
 * exclusively by engine/redaction.ts; the name exists for documentation.
 */
export type RedactedGameState = GameState;

export enum PlayerActionType {
  BID_WILL = "BID_WILL",
  BID_DECLARE = "BID_DECLARE",
  BID_RETREAT = "BID_RETREAT",
  PLAY_CARD = "PLAY_CARD",
  READY_NEXT = "READY_NEXT",
  REMATCH = "REMATCH",
}

export interface PlayerAction {
  type: PlayerActionType;
  playerId: string;
  data?: {
    wantsToPlay?: boolean;
    declaration?: GameDeclaration;
    cardId?: string;
  };
}
