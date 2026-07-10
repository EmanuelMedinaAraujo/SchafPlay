import { GameHistoryStore } from "./GameHistoryStore";
import { IdbGameHistoryStore } from "./IdbGameHistoryStore";

/** The app's single game-history store. Swap the implementation here. */
export const gameHistoryStore: GameHistoryStore = new IdbGameHistoryStore();
