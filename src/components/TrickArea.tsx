import { CSSProperties, useLayoutEffect, useRef } from "react";
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

/** Where the winner's name lives on screen, per table position. */
const FLY_TARGETS: Record<string, string> = {
  bottom: ".player-hand-name",
  left: ".seat-left .seat-name",
  top: ".seat-top .seat-name",
  right: ".seat-right .seat-name",
};

export default function TrickArea({ trick, players, contract, myIdx, collecting }: TrickAreaProps) {
  const feltRef = useRef<HTMLDivElement>(null);

  const positionOf = (playerId: string) => {
    const idx = players.findIndex((player) => player.id === playerId);
    const offset = ((idx - myIdx) % 4 + 4) % 4;
    return ["bottom", "left", "top", "right"][offset];
  };

  const winnerPos = collecting && trick?.winnerId ? positionOf(trick.winnerId) : null;

  // When collection starts, measure everything once: each card gathers at the
  // felt center, then all cards fly to the same point — the winner's name.
  useLayoutEffect(() => {
    const felt = feltRef.current;
    if (!winnerPos || !felt) return;

    const feltRect = felt.getBoundingClientRect();
    const feltX = feltRect.left + feltRect.width / 2;
    const feltY = feltRect.top + feltRect.height / 2;

    const target = document.querySelector(FLY_TARGETS[winnerPos]);
    const targetRect = target?.getBoundingClientRect();
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : feltX;
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : feltY;

    // In forced-landscape mode the page is rotated 90°, so screen-space
    // deltas must be mapped into the rotated local coordinate space.
    const rotated = document.documentElement.classList.contains("rotated");

    felt.querySelectorAll<HTMLElement>(".trick-card").forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cardX = rect.left + rect.width / 2;
      const cardY = rect.top + rect.height / 2;
      let gatherX = feltX - cardX;
      let gatherY = feltY - cardY;
      let flyX = targetX - cardX;
      let flyY = targetY - cardY;
      if (rotated) {
        [gatherX, gatherY] = [gatherY, -gatherX];
        [flyX, flyY] = [flyY, -flyX];
      }
      el.style.setProperty("--gather-x", `${gatherX}px`);
      el.style.setProperty("--gather-y", `${gatherY}px`);
      el.style.setProperty("--fly-x", `${flyX}px`);
      el.style.setProperty("--fly-y", `${flyY}px`);
    });
  }, [winnerPos]);

  return (
    <div className="trick-area">
      <div className="trick-felt" ref={feltRef}>
        {(trick?.playedCards ?? []).map((played, index) => {
          const slotPos = positionOf(played.playerId);
          // Unique rotation per card while stacked in the center, so every
          // card keeps an identifying corner (rank + suit) visible.
          const stackRot = { "--stack-rot": `${(index - 1.5) * 30}deg` } as CSSProperties;
          return (
            <div
              key={played.card.id}
              className={`trick-slot slot-${slotPos} ${winnerPos ? "collecting" : ""}`}
            >
              <div className="trick-card" style={stackRot}>
                <CardFace card={played.card} contract={contract} small />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
