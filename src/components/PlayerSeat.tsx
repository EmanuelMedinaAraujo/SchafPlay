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

/** Pop the role badge into its spot beside the player's name. Runs once, on
 * the null -> role edge, so neither re-renders nor state re-emits (pause/
 * resume) retrigger it. The declarer badge appears at contract-decision time
 * and is sequenced to land *after* the contract chip's centre-stage reveal
 * (GameBoard drives that first), so it uses the delayed class. The partner
 * badge is revealed later in the hand (when the called Ace drops), with no
 * chip animation in flight, so it pops in immediately. */
function useRoleBadgeReveal(role: Role) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const prevRoleRef = useRef<Role>(null);

  useLayoutEffect(() => {
    const prevRole = prevRoleRef.current;
    prevRoleRef.current = role;
    if (!role || prevRole) return;

    const badge = badgeRef.current;
    if (!badge) return;

    const cls = role === "declarer" ? "role-badge-reveal" : "role-badge-reveal-now";
    badge.classList.add(cls);
    const clear = () => badge.classList.remove(cls);
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
