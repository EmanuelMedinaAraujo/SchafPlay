import { Card, Contract, GameDeclaration, Player, Trick, WillBid } from "../game/types";

export interface BidContext {
  highBid: GameDeclaration | null;
  /** "Doch passen" (#24): whether bowing out of the bidding is currently permitted. */
  canRetreat: boolean;
}

export interface StossContext {
  /** Eligibility and the timing window are already checked by the engine. */
  kind: import("../game/types").StossKind;
}

/**
 * Decision-maker for an engine-driven seat. Human seats have no controller.
 * Synchronous: the engine owns pacing and runs every result through the same
 * validation path as human actions.
 */
export interface PlayerController {
  decideWill(player: Player, willBids?: WillBid[]): boolean;
  /** The declaration to bid, or null to retreat. */
  decideBid(player: Player, context: BidContext): GameDeclaration | null;
  decideCard(player: Player, currentTrick: Trick | null, contract: Contract | null, tricks?: Trick[]): Card;
  /** Whether to announce a Stoß/Retour when offered one (see StossContext). */
  decideStoss(player: Player, contract: Contract, context: StossContext): boolean;
}
