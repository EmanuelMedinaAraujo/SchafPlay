import { GameEngine } from "../engine/GameEngine";
import { PlayerAction, SeatId } from "../game/types";
import { ListRecorder } from "../persistence";
import { Transport } from "../net/Transport";
import { GameSession, SessionDeps } from "./GameSession";

/**
 * Solo: 100% offline against three AI seats. The engine is created eagerly
 * and the UI renders the full, unredacted state — there is no remote player
 * to hide anything from.
 */
export class SoloSession implements GameSession {
  readonly role = "solo" as const;
  readonly myPlayerId: SeatId = "p1";

  private engine: GameEngine;
  private recorder: ListRecorder | null = new ListRecorder("solo", "solo", "p1");

  constructor(private readonly deps: SessionDeps) {
    this.engine = new GameEngine(deps.getPlayerName(), "Zenzi (KI)", deps.getTotalRounds(), {
      soloMode: true,
      devToolsEnabled: import.meta.env.DEV,
      disableLaufende: deps.getDisableLaufende(),
    });
    this.engine.onStateChange((state) => {
      this.recorder?.observe(state);
      deps.events.onGameState(state);
    });
  }

  start(): void {
    this.deps.events.onConnectionState("idle");
    this.deps.events.onEnterGame();
    this.engine.dealCards();
  }

  attachTransport(_transport: Transport): void {
    // Solo has no peer.
  }

  dispatch(action: PlayerAction): void {
    this.engine.processAction(action);
  }

  devSkipTrick(): void {
    this.engine.devSkipTrick();
  }

  devSkipRound(): void {
    this.engine.devSkipRound();
  }

  destroy(): void {
    this.engine.destroy();
    this.recorder = null;
  }
}
