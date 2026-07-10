import { useLayoutEffect, useRef } from "react";
import { Contract, GameType, Language, Player } from "../types";
import { translations } from "../lib/i18n";
import { UserIcon, BotIcon } from "./icons";

interface PlayerSeatProps {
  player: Player;
  position: "top" | "left" | "right" | "bottom";
  active: boolean;
  contract: Contract | null;
  language: Language;
}

type Role = "declarer" | "partner" | null;

/** Fly the role badge in from the table center (bigger) down to its resting
 * spot at natural size — mirrors the FLIP technique TrickArea.tsx uses for
 * gathering/flying trick cards. Runs once, on the null -> role edge, so
 * neither re-renders nor state re-emits (pause/resume) retrigger it. */
function useRoleBadgeReveal(role: Role) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevRoleRef = useRef<Role>(null);

  useLayoutEffect(() => {
    const prevRole = prevRoleRef.current;
    prevRoleRef.current = role;
    if (!role || prevRole) return;

    const badge = badgeRef.current;
    const center = document.querySelector(".trick-area");
    if (!badge || !center) return;

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
    badge.classList.add("role-badge-reveal");
    const clear = () => badge.classList.remove("role-badge-reveal");
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
        {player.isHuman ? <UserIcon /> : <BotIcon />}
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
