import { useLayoutEffect, useRef } from "react";
import { Contract, GameType, Language, Player, StossEntry } from "../types";
import { translations } from "../lib/i18n";
import { resolveAvatarSrc } from "../lib/avatars";
import { UserIcon, BotIcon } from "./icons";

interface PlayerSeatProps {
  player: Player;
  position: "top" | "left" | "right" | "bottom";
  active: boolean;
  contract: Contract | null;
  /** Stoß/Retour announcements this round; a badge shows on the announcer's seat. */
  stoss?: StossEntry[];
  language: Language;
}

type Role = "declarer" | "partner" | null;

// Must match GameBoard's contract-chip reveal: 60% of its 1900ms animation,
// where the chip starts flying away and this badge takes over the spotlight.
const DECLARER_BADGE_DELAY_MS = 1900 * 0.6;

/**
 * Runs once, on the null -> role edge, so re-renders and pause/resume state
 * re-emits don't retrigger it. Only the declarer badge is sequenced with the
 * contract chip; the partner badge reveals later and just pops into place.
 */
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
      // Forced landscape rotates the page 90°: map screen-space deltas into it.
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

/** One box per player; it pulses on their turn, doubling as the turn indicator. */
export default function PlayerSeat({ player, position, active, contract, stoss, language }: PlayerSeatProps) {
  const t = translations[language];
  const stossEntry = stoss?.find((entry) => entry.playerId === player.id);
  const isDeclarer = contract?.declarerId === player.id;
  // partnerId is redacted by the host until the called Ace has been played.
  const isPartner = contract?.type === GameType.SAUSPIEL && contract.partnerId === player.id;
  const role: Role = isDeclarer ? "declarer" : isPartner ? "partner" : null;
  const badgeRef = useRoleBadgeReveal(role);

  const avatarUrl = resolveAvatarSrc(player.avatar, player.isHuman);

  return (
    <div className={`seat seat-${position} ${active ? "active" : ""} ${player.connected === false ? "offline" : ""}`}>
      <div className="seat-avatar-container">
        <img src={avatarUrl} alt={player.name} className="seat-avatar-img" />
      </div>
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
        {stossEntry && (
          <span className="role-badge stoss">
            {stossEntry.kind === "retour" ? t.retour : t.stoss}
          </span>
        )}
      </div>
    </div>
  );
}
