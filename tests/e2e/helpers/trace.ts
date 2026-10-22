import { Card } from "../../../src/game/types";
import { RoundTrace } from "./simulate";

/** The card behind an id, from the hands dealt in a simulated round. */
export function dealtCard(round: RoundTrace, cardId: string): Card {
  for (const hand of Object.values(round.hands)) {
    const card = hand.find((candidate) => candidate.id === cardId);
    if (card) return card;
  }
  throw new Error(`card ${cardId} was not dealt this round`);
}
