import { useLayoutEffect, useRef } from "react";
import { Contract, GameType, Language, Player } from "../types";
import { Avatar } from "../lib/avatars";
import { translations } from "../lib/i18n";

interface PlayerSeatProps {
  player: Player;
  position: "top" | "left" | "right" | "bottom";
  active: boolean;
  contract: Contract | null;
  language: Language;
}

type Role = "declarer" | "partner" | null;

// Must match GameBoard's contract-chip-reveal timing: the chip holds at
// centre until 60% of its 1900ms animation, i.e. it starts flying away at
// this offset. The declarer badge's own centre reveal is timed to begin
// exactly then, so it takes over the spotlight as the chip departs.
const DECLARER_BADGE_DELAY_MS = 1900 * 0.6;

/** Runs once, on the null -> role edge, so neither re-renders nor state
 * re-emits (pause/resume) retrigger it.
 *
 * The declarer badge is sequenced with the contract chip's centre-stage
 * reveal (GameBoard drives that first): it appears large over the table
 * centre just as the chip starts flying away, holds there for ~a second,
 * then scales down and flies to its resting spot beside the name — the same
 * FLIP technique GameBoard uses for the chip, measured against `.trick-area`.
 *
 * The partner badge is revealed later in the hand (when the called Ace
 * drops), with no chip animation in flight, so it just pops into place. */
function useRoleBadgeReveal(role: Role) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevRoleRef = useRef<Role>(null);

  useLayoutEffect(() => {
    const prevRole = prevRoleRef.current;
    prevRoleRef.current = role;
    if (!role || prevRole) return;

    const badge = badgeRef.current;
    if (!badge) return;

    if (role !== "declarer") {
      badge.classList.add("role-badge-reveal-now");
      const clear = () => badge.classList.remove("role-badge-reveal-now");
      badge.addEventListener("animationend", clear, { once: true });
      return () => badge.removeEventListener("animationend", clear);
    }

    const center = document.querySelector(".trick-area");
    if (center) {
      const badgeRect = badge.getBoundingClientRect();
      const centerRect = center.getBoundingClientRect();
      let dx = centerRect.left + centerRect.width / 2 - (badgeRect.left + badgeRect.width / 2);
      let dy = centerRect.top + centerRect.height / 2 - (badgeRect.top + badgeRect.height / 2);
      // Forced-landscape mode rotates the page 90°, so screen-space deltas
      // must be mapped into the rotated local coordinate space.
      if (document.documentElement.classList.contains("rotated")) {
        [dx, dy] = [dy, -dx];
      }
      badge.style.setProperty("--reveal-x", `${dx}px`);
      badge.style.setProperty("--reveal-y", `${dy}px`);
    }
    badge.style.animationDelay = `${DECLARER_BADGE_DELAY_MS}ms`;
    badge.classList.add("role-badge-declarer-reveal");
    const clear = () => badge.classList.remove("role-badge-declarer-reveal");
    badge.addEventListener("animationend", clear, { once: true });
    return () => badge.removeEventListener("animationend", clear);
  }, [role]);

  return badgeRef;
}

/**
 * One compact box per player. When it's this player's turn the box itself
 * pulses — it doubles as the turn indicator, no separate chip needed.
 */
export default function PlayerSeat({ player, position, active, contract, language }: PlayerSeatProps) {
  const t = translations[language];
  const isDeclarer = contract?.declarerId === player.id;
  // partnerId is redacted by the host until the called Ace has been played.
  const isPartner = contract?.type === GameType.SAUSPIEL && contract.partnerId === player.id;
  const role: Role = isDeclarer ? "declarer" : isPartner ? "partner" : null;
  const badgeRef = useRoleBadgeReveal(role);

  return (
    <div className={`seat seat-${position} ${active ? "active" : ""} ${player.connected === false ? "offline" : ""}`}>
      <div className="seat-name">
        <Avatar id={player.avatar} size={22} className="seat-avatar" />
        <strong>{player.name}</strong>
        {isDeclarer && (
          <span ref={badgeRef} className="role-badge declarer">
            {t.caller}
          </span>
        )}
        {isPartner && !isDeclarer && (
          <span ref={badgeRef} className="role-badge partner">
            {t.partner}
          </span>
        )}
      </div>
    </div>
  );
}
