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
  // Position each played card towards the seat of the player who threw it,
  // from the viewer's rotated perspective (0=bottom, 1=left, 2=top, 3=right).
  const positionOf = (playerId: string) => {
    const idx = players.findIndex((player) => player.id === playerId);
    const offset = ((idx - myIdx) % 4 + 4) % 4;
    return ["bottom", "left", "top", "right"][offset];
  };

  return (
    <div className="trick-area">
      <div className="trick-felt">
        {(trick?.playedCards ?? []).map((played) => {
          const isWinner = collecting && trick?.winnerId === played.playerId;
          return (
            <div key={played.card.id} className={`trick-slot slot-${positionOf(played.playerId)} ${isWinner ? "winner" : ""}`}>
              <CardFace card={played.card} contract={contract} small />
              <small>{players.find((player) => player.id === played.playerId)?.name}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
