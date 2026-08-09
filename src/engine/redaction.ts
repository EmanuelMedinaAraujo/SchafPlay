import { CardValue, GameState, GameType, Suit } from "../game/types";
import { getPlaySuit } from "../game/rules";

/**
 * State as seen by one player: other hands become face-down placeholders and
 * the Sauspiel partner stays hidden until the called Ace is played.
 *
 * THE privacy boundary of the host-authoritative model — nothing may reach a
 * guest without passing through here. Does not mutate the input.
 */
export function redactStateFor(state: GameState, viewerId: string): GameState {
  const redacted: GameState = {
    ...state,
    players: state.players.map((player) => {
      if (player.id === viewerId) return player;
      return {
        ...player,
        cards: player.cards.map((_, index) => ({
          id: `hidden-${player.id}-${index}`,
          suit: Suit.HEARTS,
          value: CardValue.SEVEN,
          points: 0,
        })),
      };
    }),
  };

  if (
    redacted.status === "PLAYING" &&
    redacted.currentContract?.type === GameType.SAUSPIEL &&
    redacted.currentContract.partnerId !== viewerId &&
    !isPartnerRevealed(state)
  ) {
    redacted.currentContract = { ...redacted.currentContract, partnerId: undefined };
    // The engine stores the SAME contract object in currentContract and
    // biddingState.resolvedContract, so the partner must be blanked in BOTH —
    // forgetting one leaks the partner through the bidding state.
    if (redacted.biddingState?.resolvedContract) {
      redacted.biddingState = {
        ...redacted.biddingState,
        resolvedContract: { ...redacted.biddingState.resolvedContract, partnerId: undefined },
      };
    }
  }

  return redacted;
}

function isPartnerRevealed(state: GameState): boolean {
  const contract = state.currentContract;
  if (!contract || contract.type !== GameType.SAUSPIEL || !contract.calledSuit || !contract.partnerId) return true;

  const allTricks = [...state.tricks];
  if (state.currentTrick) allTricks.push(state.currentTrick);

  for (const trick of allTricks) {
    if (trick.playedCards.length === 0) continue;
    const ledPlaySuit = getPlaySuit(trick.playedCards[0].card, contract.type);
    const isCalledSuitLed = ledPlaySuit === contract.calledSuit;

    for (const played of trick.playedCards) {
      if (played.playerId === contract.partnerId && played.card.suit === contract.calledSuit && played.card.value === CardValue.ACE) {
        return true;
      }
      if (isCalledSuitLed && played.playerId === contract.partnerId) {
        return true;
      }
    }
  }
  return false;
}
