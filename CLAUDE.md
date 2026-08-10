# CLAUDE.md

SchafPlay: Bavarian Schafkopf for two humans as an offline-first PWA. Seats 1 & 3 are humans over serverless WebRTC (base64 SDP codes, no backend); seats 2 & 4 are AI, and solo mode fills seat 3 with a third.

## Commands

`lint` is a type-check over two projects, app and E2E tests — a broken spec fails lint. There is no ESLint.

## Pull requests

Never sign work as AI-generated. No "Generated with Claude Code" footer, no bot attribution line, no equivalent phrasing anywhere in a PR title, description or review comment.

## Invariants

Layers run `game/` → `players/` → `engine/` → `session/` → `components/`, with `net/` and `persistence/` as services and `analysis/` deriving over stored records. Dependencies flow downward only; `game/` and `analysis/` stay pure (no React, no I/O, no engine import).

**Host-authoritative.** `GameEngine` is the single source of truth and runs only on the host and in solo — the guest runs no engine.

- **`redactStateFor` is the only privacy boundary.** Treat anything reaching a guest without passing through it as an info leak.
- **`HostSession` overwrites the guest's action `playerId` with `"p3"`** — the wire value is never trusted.
- `processAction` is the single entry point; AI moves take the same validation path as human ones.
- `scheduleProgress()` sets **one** timer — `clearTimer()` before scheduling another. `pause()`/`resume()` freeze it for disconnects.
- On disconnect the host **pauses** rather than tearing down; re-pairing attaches a fresh transport to the same session and loses nothing.

**Avatars are the wire's validation boundary** (`avatarSync.ts`). Three inbound paths must all stay sanitized: `CONNECTION_ACK.avatar` on the host, and on the guest both `AVATAR_UPDATE` *and* the avatars inside `GAME_STATE_UPDATE`. The last is not optional — sanitizing only the out-of-band map is bypassable, since a hostile host can skip `AVATAR_UPDATE` and write straight into `players[i].avatar`. An avatar is the one peer-supplied string reaching an `<img src>`; keep it out of CSS `url()` and `href` sinks.

**Single sources of truth.** `rules.ts` for bid and play legality (engine, UI and AI all call it, so they cannot drift). `TARIFF` for point values. `lib/settings.ts` for persisted preferences — extend `Settings` + `DEFAULT_SETTINGS` + `CODECS`, never hand-roll a `localStorage` read in a component.

`LogEntry` is `{ key, params }`, not a rendered string, so one log serves both languages; `formatLog` needs an entry for every `log.*` key the engine emits.

## Persistence

Terminology: a **list** is a session, made of **rounds**, made of **tricks**.

- `ListRecorder` observes snapshots and calls `recordGame` **exactly once**, on the first `LIST_OVER` — `ROUND_OVER`/`LIST_OVER` re-emit on every ready toggle and pause/resume. Round records push on the *status edge* only.
- Initial-hand capture keys on "fresh `WILL_PHASE`, 0 will-bids", not `roundNumber`, so an all-pass redeal overwrites the draft with the hand actually played.
- Never remove or repurpose a stored field without bumping `DB_VERSION` **and** adding an `onupgradeneeded` branch.
- Every store method degrades silently — a stats failure must never break a game. `totals` are never pruned; games keep full per-round detail.

## Replay (`analysis/`)

A completed round's trick log holds all 32 cards, so hands reconstruct from any stored game — including a guest's redacted recording — with no `DB_VERSION` bump.

- A finished trick stays on the table for exactly one step with its winner marked, banking from the next step on. **That hold is what makes stepping readable — keep it.**
- Playback spans the whole list; the round is part of the cursor.
- Chrome-free, which forces two CSS workarounds, both from source order: trick slots are namespaced `replay-slot-*` because `trick-area.css` owns the bare names and is imported later, and card sizing needs three classes to beat `cards.css` and the `html.compact` override. Card metrics on `.replay-table` are **one fixed size shared by hands and felt**, never a flex fraction, so a card never resizes as a hand empties.

## UI

Landscape-only: `App.tsx` rotates 90° on a portrait viewport and sets `html.compact`/`html.narrow` from *effective* post-rotation dimensions, which media queries cannot see.

Components are presentational and never talk to the engine, except `PairingPanel` (drives signaling) and `StatsScreen` (reads the store).

## Testing

The Playwright suite **must be kept green** — CI runs it on every PR and push to `main`.

- `?e2e-seed=<int>` injects a seeded shuffle and fast pacing via `lib/e2e.ts` (DEV only). `helpers/simulate.ts` mirrors the *same* engine in Node to precompute the trace before the first click, so most behavior changes mirror automatically — but a change shifting which seeds produce a scenario breaks `findSeed`-located tests. Re-run the suite after touching `game/`, `aiHeuristics.ts` or `GameEngine.ts`.
- **Unit tests are deliberately absent.** The user tests manually. Do not add vitest/jsdom/testing-library unless asked.
- Test seams (`lib/e2e.ts`, `lib/seededShuffle.ts`, `data-card-id`) are dead code in production — don't remove them casually or rely on them for production behavior.
- Any change to `redaction.ts` or partner-reveal logic must keep `partner-badge.spec.ts` passing — it exercises redaction across a real WebRTC channel, not just solo.
