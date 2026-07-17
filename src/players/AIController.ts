import { Card, Contract, Difficulty, GameDeclaration, Player, Trick, WillBid } from "../game/types";
import { getAIBid, getAICardPlay, getAIStoss, getAIWillBid } from "./aiHeuristics";
import { BidContext, PlayerController, StossContext } from "./PlayerController";

/** The built-in heuristic AI. Difficulty only affects card play, not bidding. */
export class AIController implements PlayerController {
  constructor(private readonly difficulty: Difficulty = Difficulty.MEDIUM) {}

  decideWill(player: Player, willBids?: WillBid[]): boolean {
    return getAIWillBid(player, willBids);
  }

  decideBid(player: Player, context: BidContext): GameDeclaration | null {
    return getAIBid(player, context.highBid, context.canRetreat);
  }

  decideCard(player: Player, currentTrick: Trick | null, contract: Contract | null, tricks?: Trick[]): Card {
    return getAICardPlay(player, currentTrick, contract, this.difficulty, tricks);
  }

  decideStoss(player: Player, contract: Contract, context: StossContext): boolean {
    return getAIStoss(player.cards, contract, context.kind);
  }
}
