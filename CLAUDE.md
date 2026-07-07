# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SchafPlay: Bavarian Schafkopf for two human players as an offline-first PWA. Seats 1 & 3 are humans connected via serverless WebRTC; seats 2 & 4 are AI (Resi & Sepp). No backend — signaling goes through the public PeerJS broker, then play happens over a direct P2P WebRTC data channel.

## Commands

```bash
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm test         # vitest run (tests/**/*.test.ts)
npm run lint     # tsc --noEmit (this is the project's "lint")
npm run build    # production build incl. service worker (dist/)
npm run start    # vite preview of the built dist/
```

Run a single test file: `npx vitest run tests/engine.test.ts`. Run a single test by name: `npx vitest run -t "test name"`.

There is no separate lint tool (no ESLint config) — `npm run lint` is a TypeScript type-check.

## Architecture

### Host-authoritative state machine over P2P

- **`src/engine/GameEngine.ts`** is the single source of truth for game state. It only ever runs on the **host** (seat p1). It owns bidding, dealing, trick resolution, scoring, AI pacing (via injectable `aiDelayMs`/`trickHoldMs`/`shuffleFn` for deterministic tests), and emits full-state snapshots to listeners via `onStateChange`.
- The host never sends full state to the guest. It calls `engine.getRedactedState("p3")` to strip other players' hands (replaced with face-down placeholders) and to hide the Sauspiel partner's identity until the called Ace has actually been played. This redaction is the only privacy boundary — treat any change that bypasses `getRedactedState` as a potential info leak to the guest.
- The **guest** (seat p3) runs no engine at all — `App.tsx` just renders whatever redacted `GameState` arrives over the wire and forwards user intents as `PlayerAction`s.
- The host **always overwrites the guest's action `playerId` with `"p3"`** before calling `engine.processAction` (see `attachHostPeer` in `src/App.tsx`) — the wire value is never trusted.
- `GameEngine.processAction` is the single entry point for all player and AI moves; each action type (`BID_WILL`, `BID_DECLARE`, `BID_RETREAT`, `PLAY_CARD`, `READY_NEXT`) has matching validation (turn order, phase, legality) before mutating state. AI moves go through the exact same `processBidWill`/`processBidDeclare`/`processCardPlay` methods as human ones.
- Progression (AI turns, collecting a finished trick, redeals) is driven by `scheduleProgress()`, which sets a single timer (`this.timer`) per step — always call `clearTimer()` before scheduling a new one; `pause()`/`resume()` freeze/unfreeze this timer for disconnects.

### Networking (`src/net/`)

- **`PeerConnection.ts`** wraps `peerjs`. The host registers a 5-character human-typeable code (`generateGameCode`, unambiguous alphabet, prefixed with `schafplay-7f3a-` to namespace the public broker) and waits for one guest to dial in via `host(code)`; the guest calls `join(code)`. Only the guest ever types anything — codes are one-way.
- Once connected, everything is a raw WebRTC data channel; the PeerJS broker is only needed for the initial handshake (and to re-establish it after a broker disconnect via `peer.reconnect()` — this does not affect an already-open data channel).
- A 5s ping / 15s timeout heartbeat (host pings, both sides reset the timeout on any traffic) detects silent drops and flips connection state to `"disconnected"`.
- On disconnect, the host **pauses** the engine (`engine.pause()`) rather than tearing it down — the `GameEngine` instance and all its state survive in `engineRef.current` in `App.tsx`. Re-pairing is just attaching a fresh `PeerConnection` and calling `engine.resume()`; nothing about the round is lost.
- **`protocol.ts`** defines the wire message shape: `createMessage(type, payload)` stamps a timestamp. Message types are host→guest `GAME_STATE_UPDATE`, guest→host `PLAYER_ACTION`, guest→host-on-connect `CONNECTION_ACK` (carries the guest's display name), plus transport-level `PING`/`PONG`.

### Rules & AI (`src/utils/gameLogic.ts`)

- Card/trump ordering, `getLegalCards` (follow-suit/trump enforcement, Sauspiel called-Ace lead/discard constraints), `determineTrickWinner`, `calculateRoundResult` (scoring), and `countLaufende` all live here as pure functions over `GameState`/`Card` data — no engine or network dependencies, which is why they're unit-testable in isolation (`tests/scoring.test.ts`).
- `TARIFF` is the single source of truth for point values (base/Schneider/Schwarz/Tout/Sie per game type) — see the table in [README.md](README.md) for the values it encodes. Change scoring rules here, not in `GameEngine`.
- Bidding priority is `GamePriority` (`src/types.ts`): Sauspiel < Wenz < Solo < Wenz Tout < Solo Tout. `canOverrideBid` enforces that a later declaration must strictly outrank the current high bid; ties go to the earlier bidder (seating-order tiebreak already baked into bidding order, not into the priority check).
- `getAIWillBid`/`getAIBid`/`getAICardPlay` implement the three AI decision points; difficulty (`Difficulty`) only affects card play, not bidding.

### State shape (`src/types.ts`)

- `GameState` is the full authoritative shape; a `RedactedGameState` is not a separate type — it's the same `GameState` shape with hidden cards and (conditionally) `currentContract.partnerId` blanked out, produced by `getRedactedState`.
- `LogEntry` is `{ key, params }`, not a rendered string — this lets the same engine log serve both languages. Rendering happens client-side via `formatLog` in `src/lib/i18n.ts`, which must have a matching entry for every `log.*` key the engine emits (`this.log(state, "log.xxx", params)` in `GameEngine.ts`).

### UI

- Landscape-only design: `src/App.tsx` rotates the whole app 90° via a `rotated` class on `<html>` when the viewport is portrait, and adds a `compact` class for short *effective* height (post-rotation) that plain CSS media queries can't detect on their own — both are driven by a `resize`/orientation-change listener, not CSS alone.
- `src/components/` are presentational, one per screen/panel (`GameBoard`, `PlayerHand`, `BiddingPanel`, `TrickArea`, `PlayerSeat`, `RoundOverScreen`, `PairingPanel`, `HomeScreen`, `RulesModal`); they receive `GameState` and an `onAction`/`onReady` callback from `App.tsx` and don't talk to the engine or network directly.

## Testing

- `tests/engine.test.ts` and `tests/scoring.test.ts` run under vitest with `environment: "node"` (no DOM). Engine tests construct a `GameEngine` with `aiDelayMs: 0`/`trickHoldMs: 0` so AI turns and trick collection resolve synchronously instead of via real timers.
- `TEST_INFRA.md` documents a much larger planned E2E suite (WebRTC, bidding, card play, scoring, reconnect flows) organized by category-partition/boundary-value methodology — useful as a spec of edge cases to consider, but the actual committed test files are only `engine.test.ts` and `scoring.test.ts`; don't assume other files it references (e.g. a `webrtc.test.ts`) exist without checking.
