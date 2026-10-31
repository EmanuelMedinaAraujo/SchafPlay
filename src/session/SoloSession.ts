import { GameEngine } from "../engine/GameEngine";
import { redactStateFor } from "../engine/redaction";
import { PlayerAction } from "../game/types";
import { ListRecorder } from "../persistence";
import { engineOptions, GameSession, SessionDeps } from "./GameSession";

/**
 * Solo: 100% offline against three AI seats. The engine is created eagerly.
 * The live UI is redacted exactly like the host's own view: the human at p1 is
 * still a player in a Sauspiel, so the partner stays hidden until the called
 * Ace is played. The AI seats decide off the engine's true state regardless.
 */
export class SoloSession implements GameSession {
  private engine: GameEngine;
  private recorder: ListRecorder | null = new ListRecorder("solo", "solo", "p1");

  constructor(private readonly deps: SessionDeps) {
    const settings = deps.getSettings();
    this.engine = new GameEngine(settings.playerName, settings.totalRounds, { ...engineOptions(settings), soloMode: true });
    this.engine.onStateChange((state) => {
      this.recorder?.observe(state);
      deps.events.onGameState(redactStateFor(state, "p1"));
    });
  }

  start(): void {
    this.deps.events.onConnectionState("idle");
    this.deps.events.onEnterGame();
    this.engine.dealCards();
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
