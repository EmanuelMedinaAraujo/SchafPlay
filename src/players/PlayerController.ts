import { Card, Contract, GameDeclaration, Player, Trick, WillBid } from "../game/types";

export interface BidContext {
  highBid: GameDeclaration | null;
  /** "Doch passen" (#24): whether bowing out of the bidding is currently permitted. */
  canRetreat: boolean;
}

export interface StossContext {
  /**
   * "stoss" = a first double as a defender; "retour" = the declarer's counter
   * after a defender's Stoß. The engine has already checked eligibility and the
   * timing window; the controller only decides whether it wants to double.
   */
  kind: import("../game/types").StossKind;
}

/**
 * Decision-maker for an engine-driven seat. Human seats have no controller —
 * their decisions arrive as PlayerActions from the UI or the wire.
 *
 * Decisions are synchronous: the engine owns pacing (aiDelayMs) and feeds
 * every result through the same processBidWill/processBidDeclare/
 * processCardPlay validation path as human actions.
 */
export interface PlayerController {
  decideWill(player: Player, willBids?: WillBid[]): boolean;
  /** The declaration to bid, or null to retreat. */
  decideBid(player: Player, context: BidContext): GameDeclaration | null;
  decideCard(player: Player, currentTrick: Trick | null, contract: Contract | null, tricks?: Trick[]): Card;
  /** Whether to announce a Stoß/Retour when offered one (see StossContext). */
  decideStoss(player: Player, contract: Contract, context: StossContext): boolean;
}
