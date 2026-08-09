# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## What this is

SchafPlay: Bavarian Schafkopf for two human players as an offline-first PWA. Seats 1 & 3 are humans connected via serverless WebRTC; seats 2 & 4 are AI (Resi & Sepp), and solo mode fills seat 3 with a third (Zenzi). No backend — signaling goes through compressed base64 SDP codes exchanged directly between players, then play happens over a direct P2P WebRTC data channel.

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run lint      # tsc --noEmit (app) && tsc --noEmit -p tests/e2e
npm run build     # production build (dist/)
npm run start     # vite preview of the built dist/
npm run test:e2e  # Playwright E2E suite
```

There is no ESLint config — `npm run lint` is a type-check over two projects, the app and the E2E tests, so a broken spec fails lint too.

## Architecture

Layers, dependencies flowing downward. `src/types.ts` is a re-export barrel over `game/types.ts` and `net/protocol.ts`.

```
game/        pure domain — types, deck, rules, scoring (no I/O, no React)
players/     PlayerController interface + AIController + AI heuristics
engine/      GameEngine (state machine) + redaction (pure redactStateFor)
net/         Transport & Signaling interfaces, WebRTCPeer, sdpCodec, protocol
persistence/ GameHistoryStore interface, IndexedDB store, ListRecorder
analysis/    pure replay derivation over stored RoundRecords
session/     Host/Guest/SoloSession + useGameSession + avatarSync
components/  presentational React; App.tsx is the UI shell
lib/         i18n, pwa, cardDisplay, settings
```

### Host-authoritative state machine over P2P

- **`GameEngine`** is the single source of truth. It runs only on the host (p1) and in solo, has zero I/O dependencies, and emits full-state snapshots via `onStateChange`.
- The host never sends full state to the guest — it sends `engine.getRedactedState("p3")`. **`redactStateFor` is the only privacy boundary**; treat any change that bypasses it as a potential info leak.
- **`HostSession` always overwrites the guest's action `playerId` with `"p3"`** — the wire value is never trusted.
- `processAction` is the single entry point for player and AI moves alike; AI decisions run through the same validation path as human ones.
- Progression is driven by `scheduleProgress()`, which sets **a single timer** (`this.timer`) per step — always `clearTimer()` before scheduling a new one. `pause()`/`resume()` freeze it for disconnects.

### Players & AI (`src/players/`)

- A **human seat has no controller**; its moves arrive as `PlayerAction`s. `EngineOptions.controllers` defaults to an `AIController` on every non-human seat.
- Controller decisions are synchronous — the engine owns pacing. Difficulty affects card play only, not bidding.

### Networking (`src/net/`)

- `WebRTCPeer.ts` implements `Transport` and both `Signaling` roles — hand-rolled, no broker, no STUN, LAN-only.
- A 5s ping / 15s timeout heartbeat detects silent drops and flips transport state to `"disconnected"`.
- On disconnect the host **pauses** the engine rather than tearing it down. Re-pairing attaches a fresh transport to the same session and resumes; nothing about the round is lost.

### Sessions (`src/session/`)

- `HostSession` creates the engine lazily on first connect and runs the redact→record→emit→broadcast pipeline. `broadcastState()` loops over the remote human seats (today `["p3"]`) — the fan-out seam for variable multiplayer.
- **Avatars are the wire's validation boundary** (`avatarSync.ts`, #14). Heavy `data:` avatars are stripped from the broadcast state and sent once per connection as `AVATAR_UPDATE`. There are **three** inbound paths and all three must stay sanitized: `CONNECTION_ACK.avatar` on the host, and on the guest both `AVATAR_UPDATE` *and* the avatars inside `GAME_STATE_UPDATE`. That last one is not optional — sanitizing only the out-of-band map is bypassable, since a hostile host can skip `AVATAR_UPDATE` and write straight into `players[i].avatar`. An avatar is the one peer-supplied string reaching an `<img src>`; keep it out of CSS `url()` and `href` sinks.
- `useGameSession` reuse rules: re-attaching the same role (reconnect) keeps the engine and recorder; switching roles destroys the old session; quitting drops the recorder, so an aborted list records nothing.

### Rules & scoring (`src/game/`)

- `rules.ts` is single-source bid and play legality — the engine, `BiddingPanel` and the AI all call the same functions, so they cannot drift.
- `TARIFF` is the single source of truth for point values (table in [README.md](README.md)). Change scoring rules there, not in `GameEngine`.
- `LogEntry` is `{ key, params }`, not a rendered string, so one engine log serves both languages. `formatLog` in `lib/i18n.ts` must have an entry for every `log.*` key the engine emits.

### Local statistics (`src/persistence/`)

Terminology (#22): a **list** is a whole session, made of **rounds** (one deal each), made of **tricks**. The session-end state is `LIST_OVER`.

- `ListRecorder` is a pure observer of `GameState` snapshots, so the same class serves host, solo and guest — each device records its own view.
- It calls `recordGame` **exactly once**, on the first `LIST_OVER`, because `ROUND_OVER`/`LIST_OVER` re-emit on every ready toggle and pause/resume. Round records are pushed on the *status edge* only.
- Initial-hand capture keys on "fresh `WILL_PHASE` with 0 will-bids", not `roundNumber`, so an all-pass redeal overwrites the draft with the hand actually played.
- Known edge: a guest who quits and re-joins mid-list gets a fresh recorder — earlier rounds are missing, but the `LIST_OVER` summary is still correct. A reconnect loses nothing.
- **Storage** (IndexedDB, db `schafplay`, `DB_VERSION` 1). Binding rules:
  1. Never remove or repurpose a stored field without bumping `DB_VERSION` **and** adding an `onupgradeneeded` branch.
  2. Every method degrades silently — a stats failure must never break a game.
  3. `totals` are authoritative lifetime counters, never pruned. `games` are pruned to `MAX_GAMES=2000`, oldest first.
  4. All games keep full per-round detail — no stripping.
  5. All reads and writes go through the `gameHistoryStore` singleton.

### Analysis & replay (`src/analysis/`)

- `replay.ts` is pure, with no engine import: a completed round's trick log holds all 32 cards, so hands reconstruct post-mortem from every stored game — including a guest's redacted recording — with no `DB_VERSION` bump.
- A finished trick stays on the table for exactly one step with its winner marked; its points bank from the *next* step on. **That one-step hold is what makes stepping readable — keep it.**
- Playback spans the **whole list**: the round is part of the cursor, so stepping rolls across round borders in both directions.
- The replay is chrome-free (`onReplayActiveChange` → `App.tsx` drops the topbar). Two CSS consequences to respect, both from source order: trick slots are namespaced `replay-slot-*` because `trick-area.css` owns the bare `slot-*` names and is imported after `analysis.css`; and card sizing is scoped `.replay-screen .replay-*-card .card-face.small` (three classes) to beat both `cards.css` and the `html.compact` override in `responsive.css`. Card metrics live in `--rc-w`/`--rc-h`/`--rc-dy` on `.replay-table` — **one fixed size shared by hands and felt**, never a flex fraction, so a card never resizes as a hand empties.

### UI

- Landscape-only: `App.tsx` rotates the app 90° via `html.rotated` on a portrait viewport, and sets `html.compact`/`html.narrow` from the *effective* post-rotation dimensions, which plain media queries cannot see.
- Components are presentational and never talk to the engine. Two exceptions by nature: `PairingPanel` constructs a transport and drives signaling; `StatsScreen` reads through `gameHistoryStore`.
- **Device settings** (`lib/settings.ts`): every persisted preference lives in one `Settings` shape behind a `SettingsStore` seam — synchronous, so the right value is on screen at first paint. Add a preference by extending `Settings` + `DEFAULT_SETTINGS` + the `CODECS` map; **never hand-roll a `localStorage` read/write in a component**.

## Testing

The Playwright E2E suite (`tests/e2e/*.spec.ts`, issue #5) **must be kept green** — it runs in CI on every pull request and push to `main`.

- **Running it**: `npm run test:e2e` runs the suite headless against the Vite dev server (started/reused on `127.0.0.1:5173`). `npx playwright install --with-deps chromium` is needed once. Single file: `npx playwright test tests/e2e/gameplay.spec.ts`.
- **Determinism**: `?e2e-seed=<int>` makes `src/lib/e2e.ts` (DEV-only) inject a seeded shuffle and fast AI pacing. `tests/e2e/helpers/simulate.ts` runs a Node-side mirror of the *same* engine to precompute the full trace before the first click. Because it imports the real engine, most behavior changes mirror automatically — but a change shifting which seeds produce a given scenario breaks `findSeed`-located tests, so re-run the suite after touching `game/`, `players/aiHeuristics.ts` or `engine/GameEngine.ts`.
- **Unit tests are deliberately absent.** The user tests manually; this suite is the only sanctioned automated testing. Do not add vitest/jsdom/testing-library unless the user explicitly asks.
- **Test seams** (DEV only): `lib/e2e.ts`, `lib/seededShuffle.ts`, and `data-card-id` attributes on hand and trick cards. Dead code in production — don't remove them casually, and don't rely on them for production behavior.
- Any change to `redaction.ts` or the partner-reveal logic must keep `partner-badge.spec.ts` passing — it exercises the redaction across a real WebRTC channel, not just in solo.
