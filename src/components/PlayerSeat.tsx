import { Bot, User } from "lucide-react";
import { Contract, GameType, Language, Player } from "../types";
import { translations } from "../lib/i18n";

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
        {player.isHuman ? <User size={13} /> : <Bot size={13} />}
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
