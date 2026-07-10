import { CardValue, GameState, GameType, Suit } from "../game/types";

/**
 * State as seen by one player: every other hand is replaced by face-down
 * placeholders and the Sauspiel partner stays hidden until the called Ace
 * has been played.
 *
 * This is THE privacy boundary of the host-authoritative model — nothing may
 * reach a guest that did not pass through here. Callers pass a snapshot
 * (`engine.getState()` already clones); the input object is not mutated.
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
    !calledAceWasPlayed(state)
  ) {
    redacted.currentContract = { ...redacted.currentContract, partnerId: undefined };
    // The engine stores the SAME contract object in currentContract and
    // biddingState.resolvedContract (finalizeBidding), so the partner must be
    // blanked in both — copying one and forgetting the other leaks the
    // partner's identity to the guest through the bidding state.
    if (redacted.biddingState?.resolvedContract) {
      redacted.biddingState = {
        ...redacted.biddingState,
        resolvedContract: { ...redacted.biddingState.resolvedContract, partnerId: undefined },
      };
    }
  }

  return redacted;
}

function calledAceWasPlayed(state: GameState): boolean {
  const calledSuit = state.currentContract?.calledSuit;
  if (!calledSuit) return true;
  return [...state.tricks.flatMap((trick) => trick.playedCards), ...(state.currentTrick?.playedCards ?? [])].some(
    (played) => played.card.suit === calledSuit && played.card.value === CardValue.ACE,
  );
}
