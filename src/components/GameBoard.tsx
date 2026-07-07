import { GameState, Language, PlayerAction, PlayerActionType } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import BiddingPanel from "./BiddingPanel";
import PlayerHand from "./PlayerHand";
import PlayerSeat from "./PlayerSeat";
import RoundOverScreen from "./RoundOverScreen";
import TrickArea from "./TrickArea";

/** Inline SVG icon — replaces lucide-react DoorOpen */
const DoorOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 4h3a2 2 0 0 1 2 2v14" /><path d="M2 20h3" /><path d="M13 20h9" /><path d="M10 12v.01" />
    <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />
  </svg>
);

interface GameBoardProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onAction: (action: PlayerAction) => void;
  onReady: () => void;
  onQuit: () => void;
}

export default function GameBoard({ state, language, myPlayerId, onAction, onReady, onQuit }: GameBoardProps) {
  const t = translations[language];
  const myIdx = Math.max(
    0,
    state.players.findIndex((player) => player.id === myPlayerId),
  );
  // Rotate seats so that I always sit at the bottom of the table.
  const seatAt = (offset: number) => state.players[(myIdx + offset) % 4];
  const me = seatAt(0);
  const activePlayer = state.players[state.activePlayerIdx];
  const isMyTurn = activePlayer?.id === myPlayerId && !state.collecting;

  function playCard(cardId: string) {
    onAction({ type: PlayerActionType.PLAY_CARD, playerId: myPlayerId, data: { cardId } });
  }

  const contractLabel = state.currentContract
    ? gameLabel(language, state.currentContract.type, state.currentContract.calledSuit, state.currentContract.isTout)
    : t.bidding;

  return (
    <main className="game-screen">
      <div className="game-toolbar">
        <span className="contract-chip">{contractLabel}</span>
        <span className="muted">
          {t.round} {state.roundNumber} · {t.trick} {Math.min(state.tricks.length + 1, 8)}/8
        </span>
        <span className="toolbar-spacer" />
        <button className="icon-button" onClick={onQuit} title={t.quit} type="button">
          <DoorOpenIcon />
        </button>
      </div>

      <section className="table">
        <PlayerSeat player={seatAt(2)} position="top" active={activePlayer?.id === seatAt(2).id} score={state.scores[seatAt(2).id]} contract={state.currentContract} language={language} />
        <PlayerSeat player={seatAt(1)} position="left" active={activePlayer?.id === seatAt(1).id} score={state.scores[seatAt(1).id]} contract={state.currentContract} language={language} />
        <TrickArea trick={state.currentTrick} players={state.players} contract={state.currentContract} myIdx={myIdx} language={language} collecting={state.collecting} />
        <PlayerSeat player={seatAt(3)} position="right" active={activePlayer?.id === seatAt(3).id} score={state.scores[seatAt(3).id]} contract={state.currentContract} language={language} />
        <PlayerSeat player={me} position="bottom" active={activePlayer?.id === me.id} score={state.scores[me.id]} contract={state.currentContract} language={language} />
      </section>

      {state.status === "BIDDING" && <BiddingPanel state={state} language={language} myPlayerId={myPlayerId} onAction={onAction} />}

      {state.status === "ROUND_OVER" && (
        <RoundOverScreen state={state} language={language} myPlayerId={myPlayerId} onReady={onReady} />
      )}

      <PlayerHand
        hand={me.cards}
        currentTrick={state.currentTrick}
        contract={state.currentContract}
        disabled={state.status !== "PLAYING" || !isMyTurn}
        onPlay={playCard}
      />
    </main>
  );
}
