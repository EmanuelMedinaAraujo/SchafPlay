/** Domain types. Pure data shapes — wire concerns live in net/protocol.ts. */

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
  /** Never bid — starts on an all-pass (#11). No declarer, so no `GamePriority` slot. */
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
  /** Profile picture (#14), resolved by `lib/avatars.ts`. Public — not redacted. */
  avatar?: string;
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

/**
 * A "Stoß" (Kontra) doubles the round; a "Retour" doubles it again. Chain
 * capped at 2 entries (4x). Public — carried to the guest unredacted.
 */
export type StossKind = "stoss" | "retour";

export interface StossEntry {
  playerId: string;
  kind: StossKind;
}

/** Present on a RoundResult iff the contract type is RAMSCH (#11). */
export interface RamschResult {
  /** The Durchmarsch winner, or the most-points loser who pays everyone. */
  playerId: string;
  isDurchmarsch: boolean;
  /** Took no trick — each doubles the payout. */
  jungfrauIds: string[];
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
  /** Optional and additive: older stored RoundRecords lack it, no DB bump needed. */
  ramsch?: RamschResult;
  /** 1, 2 or 4. Display only — `scoreChanges` already reflect it. Absent means 1. */
  stossMultiplier?: number;
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
  /** In order, max 2. Reset every round. */
  stoss: StossEntry[];
  /** The host's house-rule setting, in state so the guest UI can follow it. */
  stossEnabled: boolean;
}

/** Same shape as GameState; documentation alias for engine/redaction.ts output. */
export type RedactedGameState = GameState;

export enum PlayerActionType {
  BID_WILL = "BID_WILL",
  BID_DECLARE = "BID_DECLARE",
  BID_RETREAT = "BID_RETREAT",
  PLAY_CARD = "PLAY_CARD",
  READY_NEXT = "READY_NEXT",
  REMATCH = "REMATCH",
  /** Announce a Stoß (defender) or Retour (declarer). No `data` payload. */
  STOSS = "STOSS",
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
