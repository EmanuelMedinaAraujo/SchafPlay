import { CardValue, GameState, GameType, Suit } from "../game/types";
import { getPlaySuit } from "../game/rules";

/**
 * State as seen by one player: every other hand is replaced by face-down
 * placeholders and the Sauspiel partner stays hidden until the called Ace
 * has been played.
 *
 * This is THE privacy boundary of the host-authoritative model — nothing may
 * reach a guest that did not pass through here. Callers pass a snapshot
 * (`engine.getState()` already clones); the input object is not mutated.
 *
 * Ramsch (#11) needs no contract redaction: its contract carries no
 * partnerId and an empty declarerId, so beyond the hand placeholders there
 * is nothing to hide.
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
