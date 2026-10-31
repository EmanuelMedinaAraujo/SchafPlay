import { CardValue, GameState, GameType, Suit } from "../game/types";
import { getPlaySuit, isCalledAce } from "../game/rules";

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
  }

  return redacted;
}

/** Revealed by the called Ace falling, or by the partner playing into a called-suit lead. */
function isPartnerRevealed(state: GameState): boolean {
  const contract = state.currentContract;
  if (!contract || contract.type !== GameType.SAUSPIEL || !contract.calledSuit || !contract.partnerId) return true;

  const tricks = state.currentTrick ? [...state.tricks, state.currentTrick] : state.tricks;
  return tricks.some((trick) => {
    if (trick.playedCards.length === 0) return false;
    const calledSuitLed = getPlaySuit(trick.playedCards[0].card, contract.type) === contract.calledSuit;
    return trick.playedCards.some(
      (played) => played.playerId === contract.partnerId && (calledSuitLed || isCalledAce(played.card, contract)),
    );
  });
}
