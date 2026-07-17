import { GameEngine } from "../engine/GameEngine";
import { PlayerAction, SeatId } from "../game/types";
import { getE2EOverrides } from "../lib/e2e";
import { ListRecorder } from "../persistence";
import { Transport } from "../net/Transport";
import { GameSession, SessionDeps } from "./GameSession";

/**
 * Solo: 100% offline against three AI seats. The engine is created eagerly.
 * The recorder gets the full, unredacted state — solo history is your own
 * device, your own games, so keeping the AI's actual hands in the persisted
 * RoundRecord is fine (and is what a future analysis view (#16) wants). The
 * *live* UI, though, is redacted exactly like the host's own view: the human
 * at p1 is still a player in a Sauspiel, so the partner's identity must stay
 * hidden until the called Ace is played, same as at a physical table — the
 * AI opponents decide off the engine's true state regardless of what's
 * rendered, so nothing about their play is affected.
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
      enableRamsch: deps.getEnableRamsch(),
      enableStoss: deps.getEnableStoss(),
      ...getE2EOverrides(),
    });
    this.engine.onStateChange((state) => {
      this.recorder?.observe(state);
      deps.events.onGameState(this.engine.getRedactedState("p1"));
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
