import { CSSProperties, PointerEvent, useRef } from "react";
import { Card, Contract, GameType, Suit, Trick } from "../types";
import { getCardRank, getLegalCards, isTrump } from "../utils/gameLogic";
import CardFace from "./CardFace";

interface PlayerHandProps {
  hand: Card[];
  currentTrick: Trick | null;
  contract: Contract | null;
  disabled: boolean;
  onPlay: (cardId: string) => void;
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

export default function PlayerHand({ hand, currentTrick, contract, disabled, onPlay }: PlayerHandProps) {
  const gameType = contract?.type ?? GameType.SAUSPIEL;
  const legalCards = disabled ? [] : getLegalCards(hand, currentTrick, contract);
  const dragRef = useRef<DragState | null>(null);

  // Trumps first (highest left), then plain suits grouped Acorns/Leaves/Hearts/Bells.
  const sorted = [...hand].sort((a, b) => {
    const aTrump = isTrump(a, gameType);
    const bTrump = isTrump(b, gameType);
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (!aTrump && a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return getCardRank(b, gameType) - getCardRank(a, gameType);
  });

  function startDrag(event: PointerEvent<HTMLButtonElement>, cardId: string, legal: boolean) {
    if (disabled || !legal) return;
    const el = event.currentTarget;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // No active pointer with that id (synthetic events); drag still works.
    }
    dragRef.current = { id: cardId, el, startX: event.clientX, startY: event.clientY, moved: false };
    el.classList.add("dragging");
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    let dx = event.clientX - drag.startX;
    let dy = event.clientY - drag.startY;
    // In forced-landscape (portrait screen, rotated UI) the pointer moves in
    // screen coordinates while the card lives in the rotated frame.
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
    // Clearing the inline transform lets the CSS transition glide it back
    // into the fan. If it was dropped on the table, the re-render removes it.
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
    // A plain tap plays directly; a drag plays only when released on the table.
    if (!drag.moved || overTable) onPlay(drag.id);
  }

  const center = (sorted.length - 1) / 2;

  return (
    <div className={`player-hand ${disabled ? "" : "my-turn"}`}>
      {sorted.map((card, index) => {
        const legal = legalCards.some((candidate) => candidate.id === card.id);
        // Arc raises the middle of the fan; edge cards stay on the tray's
        // baseline so nothing sticks out below the hand.
        const arc = center * center - (index - center) * (index - center);
        const fan = {
          "--fan-rot": `${(index - center) * 3.5}deg`,
          "--fan-lift": `${-arc * 1.1}px`,
        } as CSSProperties;
        return (
          <button
            key={card.id}
            className={`playing-card ${disabled ? "" : legal ? "legal" : "illegal"}`}
            style={fan}
            onPointerDown={(event) => startDrag(event, card.id, legal)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            // Keyboard activation only (detail 0); pointer taps are handled above.
            onClick={(event) => event.detail === 0 && legal && onPlay(card.id)}
            disabled={disabled || !legal}
            type="button"
          >
            <CardFace card={card} contract={contract} />
          </button>
        );
      })}
    </div>
  );
}
