import { Card, Contract, Difficulty, GameDeclaration, Player, Trick } from "../game/types";
import { getAIBid, getAICardPlay, getAIWillBid } from "./aiHeuristics";
import { BidContext, PlayerController } from "./PlayerController";

/** The built-in heuristic AI. Difficulty only affects card play, not bidding. */
export class AIController implements PlayerController {
  constructor(private readonly difficulty: Difficulty = Difficulty.MEDIUM) {}

  decideWill(player: Player): boolean {
    return getAIWillBid(player);
  }

  decideBid(player: Player, context: BidContext): GameDeclaration | null {
    return getAIBid(player, context.highBid, context.canRetreat);
  }

  decideCard(player: Player, currentTrick: Trick | null, contract: Contract | null): Card {
    return getAICardPlay(player, currentTrick, contract, this.difficulty);
  }
}
