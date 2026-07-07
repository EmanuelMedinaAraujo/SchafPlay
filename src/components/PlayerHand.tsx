import { CSSProperties, PointerEvent, useEffect, useRef, useState } from "react";
import { Card, Contract, GameType, Language, Suit, Trick } from "../types";
import { getCardRank, getLegalCards, isTrump } from "../utils/gameLogic";
import { translations } from "../lib/i18n";
import CardFace from "./CardFace";

interface PlayerHandProps {
  hand: Card[];
  currentTrick: Trick | null;
  contract: Contract | null;
  disabled: boolean;
  playerName: string;
  lastTrickDisabled: boolean;
  language: Language;
  onPlay: (cardId: string) => void;
  onLastTrick: () => void;
}

const SUIT_ORDER: Record<Suit, number> = {
  [Suit.ACORNS]: 0,
  [Suit.LEAVES]: 1,
  [Suit.HEARTS]: 2,
  [Suit.BELLS]: 3,
};

interface DragState {
  id: string;
  el: HTMLButtonElement;
  startX: number;
  startY: number;
  moved: boolean;
}

export default function PlayerHand({
  hand,
  currentTrick,
  contract,
  disabled,
  playerName,
  lastTrickDisabled,
  language,
  onPlay,
  onLastTrick,
}: PlayerHandProps) {
  const t = translations[language];
  const gameType = contract?.type ?? GameType.SAUSPIEL;
  const legalCards = disabled ? [] : getLegalCards(hand, currentTrick, contract);
  const dragRef = useRef<DragState | null>(null);
  const [showIllegal, setShowIllegal] = useState(false);

  // Clear gray-out when state changes
  useEffect(() => {
    setShowIllegal(false);
  }, [hand.length, disabled]);

  // Trumps first (highest left), then plain suits grouped Acorns/Leaves/Hearts/Bells.
  const sorted = [...hand].sort((a, b) => {
    const aTrump = isTrump(a, gameType);
    const bTrump = isTrump(b, gameType);
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (!aTrump && a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return getCardRank(b, gameType) - getCardRank(a, gameType);
  });

  function handleCardTap(cardId: string, isLegal: boolean) {
    if (disabled) return;
    if (!isLegal) {
      setShowIllegal(true);
      return;
    }
    onPlay(cardId);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, cardId: string, isLegal: boolean) {
    if (disabled) return;
    if (!isLegal) {
      setShowIllegal(true);
      return;
    }
    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // No active pointer with that id
    }
    dragRef.current = { id: cardId, el, startX: event.clientX, startY: event.clientY, moved: false };
    el.classList.add("dragging");
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    let dx = event.clientX - drag.startX;
    let dy = event.clientY - drag.startY;
    // In forced-landscape the pointer moves in screen coordinates
    if (document.documentElement.classList.contains("rotated")) {
      [dx, dy] = [dy, -dx];
    }
    if (Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
    drag.el.style.transform = `translate(${dx}px, ${dy}px) rotate(0deg)`;
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    drag.el.classList.remove("dragging");
    drag.el.style.transform = "";
    if (cancelled) return;
    const felt = document.querySelector(".trick-area");
    const rect = felt?.getBoundingClientRect();
    const overTable =
      !!rect &&
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!drag.moved || overTable) onPlay(drag.id);
  }

  const center = (sorted.length - 1) / 2;

  return (
    <div className={`player-hand-container ${disabled ? "" : "my-turn"}`}>
      <div className="player-hand-header">
        <span className="player-hand-name">{playerName}</span>
        <button
          className="secondary-button last-trick-btn"
          onClick={onLastTrick}
          disabled={lastTrickDisabled}
          type="button"
        >
          {t.lastTrick}
        </button>
      </div>

      <div className="player-hand-cards">
        {sorted.map((card, index) => {
          const isLegal = legalCards.some((candidate) => candidate.id === card.id);
          const isGrayed = showIllegal && !isLegal;
          const arc = center * center - (index - center) * (index - center);
          const fan = {
            "--fan-rot": `${(index - center) * 3.5}deg`,
            "--fan-lift": `${-arc * 1.1}px`,
          } as CSSProperties;

          return (
            <button
              key={card.id}
              className={`playing-card ${isGrayed ? "grayed-out" : ""}`}
              style={fan}
              onPointerDown={(event) => startDrag(event, card.id, isLegal)}
              onPointerMove={moveDrag}
              onPointerUp={(event) => endDrag(event)}
              onPointerCancel={(event) => endDrag(event, true)}
              onClick={(event) => event.detail === 0 && handleCardTap(card.id, isLegal)}
              disabled={disabled}
              type="button"
            >
              <CardFace card={card} contract={contract} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
