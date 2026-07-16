# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SchafPlay: Bavarian Schafkopf for two human players as an offline-first PWA. Seats 1 & 3 are humans connected via serverless WebRTC; seats 2 & 4 are AI (Resi & Sepp). No backend — signaling goes through compressed base64 SDP codes exchanged directly between players, then play happens over a direct P2P WebRTC data channel.

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run lint      # tsc --noEmit (app) && tsc --noEmit -p tests/e2e (E2E tests)
npm run build     # production build (dist/)
npm run start     # vite preview of the built dist/
npm run test:e2e  # Playwright E2E suite (see Testing below)
```

There is no separate lint tool (no ESLint config) — `npm run lint` is a TypeScript type-check, run over two projects: the app (`tsconfig.json`) and the E2E tests (`tests/e2e/tsconfig.json`), so a broken test file fails lint too.

## Architecture

The code is organised in layers, dependencies flowing downward. `src/types.ts` is a thin re-export barrel over `game/types.ts` and `net/protocol.ts` so UI components stay agnostic of the layout.

```
game/        pure domain — types, deck, rules, scoring (no I/O, no React)
players/     PlayerController interface + AIController + AI heuristics
engine/      GameEngine (state machine) + redaction (pure redactStateFor)
net/         Transport & Signaling interfaces, WebRTCPeer, sdpCodec, protocol
persistence/ GameHistoryStore interface, IndexedDB store, ListRecorder
session/     Host/Guest/SoloSession + useGameSession (orchestration)
components/  presentational React; App.tsx is the UI shell
lib/         i18n, pwa, cardDisplay, settings
```

### Host-authoritative state machine over P2P

- **`src/engine/GameEngine.ts`** is the single source of truth for game state. It only ever runs on the **host** (seat p1) and in solo. It owns bidding, dealing, trick resolution, scoring, AI pacing (via injectable `aiDelayMs`/`trickHoldMs`/`shuffleFn`), and emits full-state snapshots to listeners via `onStateChange`. It has zero I/O dependencies (imports only `game/` and `players/`).
- The host never sends full state to the guest. It calls `engine.getRedactedState("p3")` — which delegates to **`src/engine/redaction.ts`** `redactStateFor(state, viewerId)` — to strip other players' hands (replaced with face-down placeholders) and hide the Sauspiel partner's identity until the called Ace has been played. This redaction is the only privacy boundary — treat any change that bypasses `redactStateFor` as a potential info leak to the guest.
- The **guest** (seat p3) runs no engine at all — `GuestSession` renders whatever redacted `GameState` arrives over the wire and forwards user intents as `PlayerAction`s.
- **`HostSession`** **always overwrites the guest's action `playerId` with `"p3"`** before calling `engine.processAction` — the wire value is never trusted.
- `GameEngine.processAction` is the single entry point for all player and AI moves; each action type (`BID_WILL`, `BID_DECLARE`, `BID_RETREAT`, `PLAY_CARD`, `READY_NEXT`) has matching validation (turn order, phase, legality) before mutating state. AI moves go through the exact same `processBidWill`/`processBidDeclare`/`processCardPlay` methods as human ones.
- Progression (AI turns, collecting a finished trick, redeals) is driven by `scheduleProgress()`, which sets a single timer (`this.timer`) per step — always call `clearTimer()` before scheduling a new one; `pause()`/`resume()` freeze/unfreeze this timer for disconnects.

### Players & AI (`src/players/`)

- **`PlayerController`** is the decision interface for an engine-driven seat: `decideWill`/`decideBid`/`decideCard`, all synchronous (the engine owns pacing). A **human seat has no controller** — its moves arrive as `PlayerAction`s. **`AIController`** wraps the heuristics and takes a `Difficulty` in its constructor (the seam for future difficulty classes).
- `EngineOptions.controllers` defaults to an `AIController` on every non-human seat, so `aiStep` and the dev-skip helpers route through controllers into the same validation path.
- **`aiHeuristics.ts`** holds `getAIWillBid`/`getAIBid`/`getAICardPlay` as pure functions; difficulty only affects card play, not bidding.

### Networking (`src/net/`)

- **`Transport`** (interface) is the framed, keepalive-supervised message channel sessions/UI depend on. **`Signaling`** (`HostSignaling`/`GuestSignaling`) is the out-of-band code exchange. **`WebRTCPeer.ts`** implements all three — a hand-rolled serverless WebRTC wrapper (no broker, no STUN, LAN-only); **`sdpCodec.ts`** is the exported compress/decompress used for the invite/reply codes.
- A 5s ping / 15s timeout heartbeat (host pings, both sides reset the timeout on any traffic) detects silent drops and flips transport state to `"disconnected"`.
- On disconnect, `HostSession` **pauses** the engine (`engine.pause()`) rather than tearing it down — the `GameEngine` instance survives on the session. Re-pairing attaches a fresh transport to the same session and calls `engine.resume()`; nothing about the round is lost.
- **`protocol.ts`** defines the wire shape: `createMessage(type, payload)` stamps a timestamp. Types are host→guest `GAME_STATE_UPDATE`, guest→host `PLAYER_ACTION`, guest→host-on-connect `CONNECTION_ACK` (guest name), plus transport-level `PING`/`PONG`.

### Sessions (`src/session/`)

- **`HostSession`/`GuestSession`/`SoloSession`** own the engine (host/solo), the transport wiring and the stats recorder. `HostSession` creates the engine lazily on first connect, runs the redact→record→emit→broadcast pipeline, and maps transport state to engine pause/resume. `broadcastState()` loops over the remote human seats (today `["p3"]`) — the fan-out seam for variable multiplayer.
- **`useGameSession`** bridges sessions to React state. Reuse rules: re-attaching the same role (reconnect) keeps the engine and recorder; switching roles destroys the old session; quitting drops the recorder (an aborted list records nothing).
- **`App.tsx`** is a UI shell: screen routing, orientation/DOM effects, and prefs.

### Rules & scoring (`src/game/`)

- **`rules.ts`**: card/trump ordering, `getLegalCards`, `determineTrickWinner`, plus single-source bid legality — `getCallableSuits`, `isValidSauspielCall`, `isRetreatAllowed` (engine, `BiddingPanel` and the AI all call these, so they cannot drift). **`scoring.ts`**: `TARIFF`, `calculateRoundResult`, `countLaufende`. **`deck.ts`**: `createDeck`/`shuffleDeck`. All pure over `GameState`/`Card`.
- `TARIFF` is the single source of truth for point values — see the table in [README.md](README.md). Change scoring rules here, not in `GameEngine`.
- Bidding priority is `GamePriority` (`src/game/types.ts`): Sauspiel < Wenz < Solo < Wenz Tout < Solo Tout. `canOverrideBid` enforces that a later declaration strictly outranks the current high bid.

### State shape (`src/game/types.ts`)

- `GameState` is the full authoritative shape; `RedactedGameState` is a documentation alias of the same shape with hidden cards and (conditionally) `currentContract.partnerId` blanked out, produced by `redactStateFor`.
- `LogEntry` is `{ key, params }`, not a rendered string — this lets the same engine log serve both languages. Rendering happens client-side via `formatLog` in `src/lib/i18n.ts`, which must have a matching entry for every `log.*` key the engine emits.

### Local statistics (`src/persistence/`)

Terminology (see issue #22): a **list** is a whole session; it consists of **rounds** (one deal each); each round consists of **tricks**. The session-end state is `LIST_OVER`.

- **`ListRecorder`** is a pure observer of successive `GameState` snapshots — it never mutates state and has no engine or network dependency, so the same class serves the host (redacted `p1` view), solo (full state) and the guest (redacted wire state). Each device records its own local view. It takes an injectable `GameHistoryStore` (defaults to the shared singleton).
- It calls `store.recordGame` **exactly once**, on the first `LIST_OVER` snapshot (`finalized` flag), because `ROUND_OVER`/`LIST_OVER` re-emit on every ready toggle and every pause/resume. Round records are pushed on the *status edge* only. Quitting mid-list records nothing — the session drops the recorder.
- Initial-hand capture keys on "fresh `WILL_PHASE` with 0 will-bids", not on `roundNumber`, so an all-pass redeal overwrites the draft with the hand that is actually played. A rematch resets the recorder on the next `BIDDING` snapshot.
- Known edge: a guest who fully quits and re-joins mid-list gets a fresh recorder — earlier rounds are missing, but the `LIST_OVER` summary is still correct. A reconnect keeps the recorder and loses nothing.
- **Storage**: **`GameHistoryStore`** (interface) is the persistence boundary; **`IdbGameHistoryStore`** backs it with IndexedDB (db `schafplay`, `DB_VERSION` 1). `recordGame` is fire-and-forget `void`; `loadTotals`/`loadGames` are async. Binding stability rules:
  1. Never remove or repurpose a stored field without bumping `DB_VERSION` **and** adding an `onupgradeneeded` branch in `idb.ts`/`IdbGameHistoryStore.ts`.
  2. Every method degrades silently — IndexedDB unavailable (private mode, quota, blocked) means `recordGame` no-ops and reads resolve to empty defaults. A stats failure must never break a game.
  3. `totals` are the authoritative lifetime counters, incremented at record time and never pruned. `games` are pruned to `MAX_GAMES=2000` (oldest first) past the cap.
  4. All games keep their full per-round `rounds` detail — no stripping. A `RoundRecord` contains the dealt hand, the contract, every trick in play order (compact card ids), and the scoring result. Indexes `finishedAt`/`mode`/`players` support the planned analysis view (#16).
  5. All reads and writes go through the `persistence/` module (the `gameHistoryStore` singleton).

### UI

- Landscape-only design: `src/App.tsx` rotates the whole app 90° via a `rotated` class on `<html>` when the viewport is portrait, and adds a `compact` class for short *effective* height (post-rotation) that plain CSS media queries can't detect on their own — both are driven by a `resize`/orientation-change listener, not CSS alone.
- `src/components/` are presentational, one per screen/panel (`GameBoard`, `PlayerHand`, `BiddingPanel`, `TrickArea`, `PlayerSeat`, `RoundOverScreen`, `PairingPanel`, `HomeScreen`, `StatsScreen`, `RulesModal`); they receive `GameState` and an `onAction`/`onReady` callback from `App.tsx` and don't talk to the engine directly. Two exceptions depend on lower layers by nature: `PairingPanel` constructs a transport via `createWebRTCPeer()` and drives signaling; `StatsScreen` reads through the `gameHistoryStore`.
- **Device settings** (`src/lib/settings.ts`): every persisted local preference — `language`, `playerName`, `totalRounds`, `disableLaufende`, `lastMode` (#44) — lives in one `Settings` shape behind a `SettingsStore` seam (the same swap-the-backend pattern as `GameHistoryStore`, but synchronous so the right value is on screen at first paint). `App.tsx` holds the single `useSettings()` and passes values + `updateSetting(key, value)` setters down. Add a new preference by extending `Settings` + `DEFAULT_SETTINGS` + the `CODECS` map (which owns the tolerant parse/serialize and the historical `schafplay.*` `localStorage` keys) — never hand-roll a `localStorage` read/write in a component again. The default `LocalStorageSettingsStore` degrades silently when storage is unavailable, same contract as the persistence layer.

## Testing

A Playwright E2E suite exists (`tests/e2e/*.spec.ts`, 19 tests, resolves issue #5) and **must be kept green** — it runs in CI (`.github/workflows/e2e.yml`) on every pull request and on push to `main`. It covers WebRTC pairing/reconnect, bidding legality, card-play rule enforcement, scored full rounds, a full 4-round list, partner-badge redaction over the wire, settings persistence, and stats recording. `TEST_INFRA.md` maps which documented test cases each spec file covers.

- **Running it**: `npm run test:e2e` runs the whole suite headless against the Vite dev server (`playwright.config.ts` starts/reuses it on `127.0.0.1:5173`). `npx playwright install --with-deps chromium` is needed once to fetch the browser. Run a single file with `npx playwright test tests/e2e/gameplay.spec.ts`. `npm run lint` type-checks the app **and** the E2E tests (`tests/e2e/tsconfig.json`) as separate `tsc` projects — a broken spec fails lint.
- **Determinism model**: tests append `?e2e-seed=<int>` to the URL, which `src/lib/e2e.ts` (DEV-only, dead code in production builds) reads to inject a seeded shuffle (`src/lib/seededShuffle.ts`) and fast AI pacing into the `HostSession`/`SoloSession` engines. `tests/e2e/helpers/simulate.ts` runs a Node-side mirror of the *same* `GameEngine` code with the same seed to precompute the full hand/contract/trick trace before the first click, so gameplay specs can assert exact scores. Because the sim imports the real engine rather than reimplementing it, most engine/AI/shuffle behavior changes are mirrored automatically — but a change that shifts which seeds produce a given bidding/contract scenario can break `findSeed`-located scenarios, so re-run the suite after touching `game/`, `players/aiHeuristics.ts`, or `engine/GameEngine.ts`.
- **Unit tests are still deliberately absent.** The user tests the application manually; this Playwright suite is the only sanctioned automated testing. Do not add unit/integration tests (vitest, jsdom, `@testing-library/react`, etc.) unless the user explicitly asks.
- **Product test seams** (DEV builds only): `src/lib/e2e.ts` (seed injection), `src/lib/seededShuffle.ts`, and `data-card-id` attributes on hand cards (`PlayerHand.tsx`) and trick cards (`TrickArea.tsx`). These are dead code in production builds — don't remove them casually, and don't rely on them for any production behavior.
- Any change to `src/engine/redaction.ts` or the partner-reveal logic must keep `tests/e2e/partner-badge.spec.ts` passing — it exercises the "Mitspieler" badge redaction (hidden until the called Ace is played) across a real WebRTC channel between two browser contexts, not just in solo.
