import { Contract, GameType, Language, Player } from "../types";
import { translations } from "../lib/i18n";

/** Inline SVG icons — replaces lucide-react Bot/User */
const UserIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const BotIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
  </svg>
);

interface PlayerSeatProps {
  player: Player;
  position: "top" | "left" | "right" | "bottom";
  active: boolean;
  score: number;
  contract: Contract | null;
  language: Language;
}

/**
 * One compact box per player. When it's this player's turn the box itself
 * pulses — it doubles as the turn indicator, no separate chip needed.
 */
export default function PlayerSeat({ player, position, active, score, contract, language }: PlayerSeatProps) {
  const t = translations[language];
  const isDeclarer = contract?.declarerId === player.id;
  // partnerId is redacted by the host until the called Ace has been played.
  const isPartner = contract?.type === GameType.SAUSPIEL && contract.partnerId === player.id;

  return (
    <div className={`seat seat-${position} ${active ? "active" : ""} ${player.connected === false ? "offline" : ""}`}>
      <div className="seat-name">
        {player.isHuman ? <UserIcon /> : <BotIcon />}
        <strong>{player.name}</strong>
        {isDeclarer && <span className="role-badge declarer">{t.caller}</span>}
        {isPartner && !isDeclarer && <span className="role-badge partner">{t.partner}</span>}
      </div>
      <div className="seat-meta">
        <span>
          {player.pointsCollected} {t.points}
        </span>
        <small className={score > 0 ? "pos" : score < 0 ? "neg" : ""}>
          {score > 0 ? "+" : ""}
          {score}
        </small>
      </div>
    </div>
  );
}
