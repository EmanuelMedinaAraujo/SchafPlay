import { PointerEvent, useEffect, useRef, useState } from "react";
import { Card, Contract, GameType, Language, Trick } from "../types";
import { getLegalCards, sortCardsForHand } from "../game/rules";
import { translations } from "../lib/i18n";
import CardFace from "./CardFace";
import { UserIcon } from "./icons";

interface PlayerHandProps {
  hand: Card[];
  currentTrick: Trick | null;
  contract: Contract | null;
  disabled: boolean;
  active: boolean;
  playerName: string;
  showLastTrick: boolean;
  language: Language;
  onPlay: (cardId: string) => void;
  onLastTrick: () => void;
  tricks?: Trick[];
}

interface DragState {
  id: string;
  el: HTMLButtonElement;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export default function PlayerHand({
  hand,
  currentTrick,
  contract,
  disabled,
  active,
  playerName,
  showLastTrick,
  language,
  onPlay,
  onLastTrick,
  tricks,
}: PlayerHandProps) {
  const t = translations[language];
  const gameType = contract?.type ?? GameType.SAUSPIEL;
  const legalCards = disabled ? [] : getLegalCards(hand, currentTrick, contract, tricks);
  const dragRef = useRef<DragState | null>(null);
  const [showIllegal, setShowIllegal] = useState(false);

  // Clear gray-out when state changes
  useEffect(() => {
    setShowIllegal(false);
  }, [hand.length, disabled]);

  // Trumps first (highest left), then plain suits grouped Acorns/Leaves/Hearts/Bells.
  const sorted = sortCardsForHand(hand, gameType);

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
    dragRef.current = { id: cardId, el, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
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
    try {
      drag.el.releasePointerCapture(drag.pointerId);
    } catch {
      // Already released or invalid pointer ID
    }
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

  return (
    <div className={`player-hand-container ${disabled ? "" : "my-turn"}`}>
      <div className="player-hand-col-left">
        <div className={`seat-name player-hand-name ${active ? "active" : ""}`}>
          <UserIcon />
          <strong>{playerName}</strong>
        </div>
      </div>

      <div className="player-hand-cards">
        {sorted.map((card) => {
          const isLegal = legalCards.some((candidate) => candidate.id === card.id);
          const isGrayed = showIllegal && !isLegal;

          return (
            <button
              key={card.id}
              data-card-id={card.id}
              className={`playing-card ${isGrayed ? "grayed-out" : ""}`}
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

      <div className="player-hand-col-right">
        {showLastTrick && (
          <button className="secondary-button last-trick-btn" onClick={onLastTrick} type="button">
            {t.lastTrick}
          </button>
        )}
      </div>
    </div>
  );
}
