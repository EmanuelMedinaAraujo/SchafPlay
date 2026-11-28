import { RemoteSeatId } from "../game/types";
import { translations } from "../lib/i18n";
import { Transport } from "../net/Transport";
import { HumanCount, LobbySeat } from "../session/HostSession";
import { Language } from "../types";
import PairingPanel from "./PairingPanel";

interface HostLobbyProps {
  language: Language;
  count: HumanCount;
  seats: LobbySeat[];
  onPeer: (id: RemoteSeatId, peer: Transport, count: HumanCount) => void;
}

export default function HostLobby({ language, count, seats, onPeer }: HostLobbyProps) {
  const t = translations[language];
  // Finish an exchange in progress before moving on to another missing seat.
  const pending = seats.find((seat) => seat.state === "connecting") ??
    seats.find((seat) => seat.state !== "connected");
  const id = pending?.id ?? "p3";
  const reachedCapacity = seats.length > 0 && !pending;

  return (
    <>
      {count > 2 && seats.length > 0 && (
        <ul className="lobby-seats" aria-label={t.humanPlayers}>
          {seats.map((seat, index) => (
            <li key={seat.id} aria-current={seat.id === pending?.id ? "step" : undefined}>
              <strong>{seat.name || `${t.guestSeat} ${index + 1}`}</strong>
              <span>{seat.state === "connected" ? t.connected : seat.id === pending?.id ? t.invitingSeat : t.waitingSeat}</span>
            </li>
          ))}
        </ul>
      )}
      {!reachedCapacity && (
        <PairingPanel
          key={id}
          language={language}
          mode="host"
          connectionState={pending?.state ?? "idle"}
          onPeer={(peer) => onPeer(id, peer, count)}
        />
      )}
    </>
  );
}
