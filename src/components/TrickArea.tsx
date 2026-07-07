import { Contract, Language, Player, Trick } from "../types";
import CardFace from "./CardFace";

interface TrickAreaProps {
  trick: Trick | null;
  players: Player[];
  contract: Contract | null;
  myIdx: number;
  language: Language;
  collecting: boolean;
}

export default function TrickArea({ trick, players, contract, myIdx, collecting }: TrickAreaProps) {
  const positionOf = (playerId: string) => {
    const idx = players.findIndex((player) => player.id === playerId);
    const offset = ((idx - myIdx) % 4 + 4) % 4;
    return ["bottom", "left", "top", "right"][offset];
  };

  const winnerPos = collecting && trick?.winnerId ? positionOf(trick.winnerId) : null;

  return (
    <div className="trick-area">
      <div className="trick-felt">
        {(trick?.playedCards ?? []).map((played) => {
          const slotPos = positionOf(played.playerId);
          return (
            <div
              key={played.card.id}
              className={`trick-slot slot-${slotPos} ${collecting ? "collecting" : ""} ${winnerPos ? `fly-${winnerPos}` : ""}`}
            >
              <div className="trick-card">
                <CardFace card={played.card} contract={contract} small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
