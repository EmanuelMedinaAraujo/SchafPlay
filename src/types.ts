/**
 * Thin re-export barrel: UI components import their types from here so they
 * stay agnostic of the layer layout. Layer modules (game, engine, players,
 * net, session, persistence) import from the real source modules instead.
 */

export * from "./game/types";

export type Language = "de" | "en";
