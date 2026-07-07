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

/**
 * One compact box per player. When it's this player's turn the box itself
 * pulses — it doubles as the turn indicator, no separate chip needed.
 */
export default function PlayerSeat({ player, position, active, contract, language }: PlayerSeatProps) {
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
    </div>
  );
}
