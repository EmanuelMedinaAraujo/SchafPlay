import { useLayoutEffect, useRef, useState } from "react";
import { GameState, Language, PlayerAction, PlayerActionType, StossKind } from "../types";
import { isCalledAce, stossKindFor } from "../game/rules";
import { declarationLabel, translations } from "../lib/i18n";
import { playAnimationClass, setRevealOffset } from "../lib/rotation";
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
  onQuit: () => void;
  onDevSkip?: () => void;
  onDevSkipRound?: () => void;
}

/**
 * The contract chip's entrance: enlarged over the table centre, then flies up
 * to the toolbar. Fires once on the undecided -> decided edge, since snapshots
 * re-emit on pause/resume with the contract still set.
 */
function useContractChipReveal(decided: boolean) {
  const chipRef = useRef<HTMLSpanElement>(null);
  const prevDecidedRef = useRef(false);

  useLayoutEffect(() => {
    const prevDecided = prevDecidedRef.current;
    prevDecidedRef.current = decided;
    if (!decided || prevDecided) return;

    const chip = chipRef.current;
    if (!chip || !setRevealOffset(chip)) return;
    return playAnimationClass(chip, "contract-chip-reveal");
  }, [decided]);

  return chipRef;
}

export default function GameBoard({
  state,
  language,
  myPlayerId,
  onAction,
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

  function announceStoss() {
    onAction({ type: PlayerActionType.STOSS, playerId: myPlayerId });
  }

  const myStossKind: StossKind | null = state.stoss.find((entry) => entry.playerId === myPlayerId)?.kind ?? null;

  // Decided from OWN knowledge only, never the redacted partner id. Button
  // visibility only — the engine re-validates.
  const holdsCalledAce = me.cards.some((card) => isCalledAce(card, state.currentContract));
  const stossOption = stossKindFor(state, myPlayerId, holdsCalledAce);

  const contractLabel = state.currentContract ? declarationLabel(language, state.currentContract) : t.bidding;

  const lastCompletedTrick = state.tricks.at(-1);

  const renderSeat = (offset: number, position: "top" | "left" | "right") => {
    const player = seatAt(offset);
    return (
      <PlayerSeat
        player={player}
        position={position}
        active={activePlayer?.id === player.id}
        contract={state.currentContract}
        stoss={state.stoss}
        language={language}
      />
    );
  };

  return (
    <main className="game-screen" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}game_background.jpg)` }}>
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
        {renderSeat(2, "top")}
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
        {renderSeat(1, "left")}
        <TrickArea trick={state.currentTrick} players={state.players} contract={state.currentContract} myIdx={myIdx} collecting={state.collecting} />
        {renderSeat(3, "right")}
      </section>

      {state.status === "BIDDING" && <BiddingPanel state={state} language={language} myPlayerId={myPlayerId} onAction={onAction} />}

      {state.status === "ROUND_OVER" && (
        <RoundOverScreen state={state} language={language} myPlayerId={myPlayerId} onAction={onAction} />
      )}

      {state.status === "LIST_OVER" && (
        <ListOverScreen state={state} language={language} myPlayerId={myPlayerId} onAction={onAction} onQuit={onQuit} />
      )}

      <PlayerHand
        hand={me.cards}
        currentTrick={state.currentTrick}
        contract={state.currentContract}
        disabled={state.status !== "PLAYING" || !isMyTurn}
        active={activePlayer?.id === myPlayerId}
        playerName={me.name}
        playerAvatar={me.avatar}
        showLastTrick={state.tricks.length > 0}
        language={language}
        onPlay={playCard}
        onLastTrick={() => setLastTrickOpen(true)}
        tricks={state.tricks}
        stossOption={stossOption}
        myStossKind={myStossKind}
        onStoss={announceStoss}
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
