import { useLayoutEffect, useRef, useState } from "react";
import { GameState, Language, PlayerAction, PlayerActionType } from "../types";
import { gameLabel, translations } from "../lib/i18n";
import BiddingPanel from "./BiddingPanel";
import PlayerHand from "./PlayerHand";
import PlayerSeat from "./PlayerSeat";
import RoundOverScreen from "./RoundOverScreen";
import ListOverScreen from "./ListOverScreen";
import TrickArea from "./TrickArea";
import LastTrickPopup from "./LastTrickPopup";
import { DoorOpenIcon } from "./icons";

interface GameBoardProps {
  state: GameState;
  language: Language;
  myPlayerId: string;
  onAction: (action: PlayerAction) => void;
  onReady: () => void;
  onQuit: () => void;
  onDevSkip?: () => void;
  onDevSkipRound?: () => void;
}

/** The contract chip is the red game indicator. When the contract is first
 * decided it takes centre stage: it appears enlarged over the table centre,
 * holds for ~a second, then scales down and flies up to its resting spot in
 * the toolbar. Fires once on the undecided -> decided edge; state snapshots
 * re-emit on pause/resume with the contract still set, so they don't
 * retrigger it. Mirrors the FLIP measurement TrickArea uses for trick cards. */
function useContractChipReveal(decided: boolean) {
  const chipRef = useRef<HTMLSpanElement>(null);
  const prevDecidedRef = useRef(false);

  useLayoutEffect(() => {
    const prevDecided = prevDecidedRef.current;
    prevDecidedRef.current = decided;
    if (!decided || prevDecided) return;

    const chip = chipRef.current;
    const center = document.querySelector(".trick-area");
    if (!chip || !center) return;

    const chipRect = chip.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    let dx = centerRect.left + centerRect.width / 2 - (chipRect.left + chipRect.width / 2);
    let dy = centerRect.top + centerRect.height / 2 - (chipRect.top + chipRect.height / 2);
    // Forced-landscape mode rotates the page 90°, so screen-space deltas
    // must be mapped into the rotated local coordinate space.
    if (document.documentElement.classList.contains("rotated")) {
      [dx, dy] = [dy, -dx];
    }
    chip.style.setProperty("--reveal-x", `${dx}px`);
    chip.style.setProperty("--reveal-y", `${dy}px`);
    chip.classList.add("contract-chip-reveal");
    const clear = () => chip.classList.remove("contract-chip-reveal");
    chip.addEventListener("animationend", clear, { once: true });
    return () => chip.removeEventListener("animationend", clear);
  }, [decided]);

  return chipRef;
}

export default function GameBoard({
  state,
  language,
  myPlayerId,
  onAction,
  onReady,
  onQuit,
  onDevSkip,
  onDevSkipRound,
}: GameBoardProps) {
  const t = translations[language];
  const [lastTrickOpen, setLastTrickOpen] = useState(false);
  const contractChipRef = useContractChipReveal(!!state.currentContract);

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

  const lastCompletedTrick = state.tricks.length > 0 ? state.tricks[state.tricks.length - 1] : null;

  return (
    <main className="game-screen" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}game_background.png)` }}>
      <div className="game-toolbar">
        <span ref={contractChipRef} className="contract-chip">{contractLabel}</span>
        <span className="round-chip">
          {t.round} <strong>{state.roundNumber}</strong>/{state.totalRounds}
        </span>
        {import.meta.env.DEV && state.status === "PLAYING" && onDevSkip && (
          <button className="text-button dev-header-btn dev-trick-btn" onClick={onDevSkip} type="button">
            ⚡ {t.devSkip}
          </button>
        )}
        <PlayerSeat player={seatAt(2)} position="top" active={activePlayer?.id === seatAt(2).id} contract={state.currentContract} language={language} />
        {import.meta.env.DEV && (state.status === "PLAYING" || state.status === "BIDDING") && onDevSkipRound && (
          <button className="text-button dev-header-btn dev-round-btn" onClick={onDevSkipRound} type="button">
            ⚡ {t.devSkipRound}
          </button>
        )}
        <span className="toolbar-spacer" />
        <button className="icon-button" onClick={onQuit} title={t.quit} type="button">
          <DoorOpenIcon />
        </button>
      </div>

      <section className="table">
        <PlayerSeat player={seatAt(1)} position="left" active={activePlayer?.id === seatAt(1).id} contract={state.currentContract} language={language} />
        <TrickArea trick={state.currentTrick} players={state.players} contract={state.currentContract} myIdx={myIdx} language={language} collecting={state.collecting} />
        <PlayerSeat player={seatAt(3)} position="right" active={activePlayer?.id === seatAt(3).id} contract={state.currentContract} language={language} />
      </section>

      {state.status === "BIDDING" && <BiddingPanel state={state} language={language} myPlayerId={myPlayerId} onAction={onAction} />}

      {state.status === "ROUND_OVER" && (
        <RoundOverScreen state={state} language={language} myPlayerId={myPlayerId} onReady={onReady} />
      )}

      {state.status === "LIST_OVER" && (
        <ListOverScreen state={state} language={language} myPlayerId={myPlayerId} onAction={onAction} onQuit={onQuit} />
      )}

      <PlayerHand
        hand={me.cards}
        currentTrick={state.currentTrick}
        contract={state.currentContract}
        disabled={state.status !== "PLAYING" || !isMyTurn}
        playerName={me.name}
        showLastTrick={state.tricks.length > 0}
        language={language}
        onPlay={playCard}
        onLastTrick={() => setLastTrickOpen(true)}
      />

      {lastTrickOpen && lastCompletedTrick && (
        <LastTrickPopup
          trick={lastCompletedTrick}
          players={state.players}
          contract={state.currentContract}
          language={language}
          onClose={() => setLastTrickOpen(false)}
        />
      )}
    </main>
  );
}
