# Project Rules

## Git Workflow

- **Use `gh` CLI** for all GitHub operations (PRs, issues, etc.). Never use the web UI or raw `git push` for PR creation.
- **Main folder** (`/Users/clarissazierl/Programmieren/SchafPlay`) stays on `main`. Never switch branches here.
- **Features** go in worktrees under `/Users/clarissazierl/Programmieren/SchafPlay-worktrees/`:
  ```bash
  git worktree add /Users/clarissazierl/Programmieren/SchafPlay-worktrees/<folder> -b <branch>
  ```
- **Naming**: folder names mirror branch names with `/` → `-` (e.g. `fix/issue-99` → `fix-issue-99`).
- **Cleanup**: `git worktree remove /Users/clarissazierl/Programmieren/SchafPlay-worktrees/<folder>`

## Testing

- **Mobile-first**: primary target is **iPhone 13 in landscape** (844×390 viewport). Always test and design for this size first.
- **Every feature must have Playwright E2E tests.** Create or update specs in `tests/e2e/*.spec.ts`.
- Tests run in the browser via Playwright — verify visually and functionally.
- Run tests: `npm run test:e2e` (headless, auto-starts Vite dev server on `127.0.0.1:5173`).
- Run single file: `npx playwright test tests/e2e/<file>.spec.ts`
- First-time setup: `npx playwright install --with-deps chromium`
- `npm run lint` type-checks both app and E2E tests — broken specs fail lint.
- **No unit tests** (no vitest/jsdom/testing-library) unless user explicitly asks.
- **Determinism**: tests use `?e2e-seed=<int>` for seeded shuffles. Changes to `game/`, `players/aiHeuristics.ts`, or `engine/GameEngine.ts` can shift seeds — always re-run the suite.

## Project Overview

**SchafPlay**: Bavarian Schafkopf for 2 humans as an offline-first PWA.
Tech: React 19 · TypeScript · Vite · Vanilla CSS · WebRTC (serverless P2P).

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run lint       # tsc --noEmit (app + E2E tests)
npm run build      # production build (dist/)
npm run test:e2e   # Playwright E2E suite
```

## Architecture (key layers)

```
game/        pure domain — types, deck, rules, scoring (no I/O)
players/     PlayerController + AIController + AI heuristics
engine/      GameEngine (state machine) + redaction
net/         Transport, Signaling, WebRTCPeer, sdpCodec, protocol
session/     Host/Guest/SoloSession + useGameSession
components/  presentational React (App.tsx is the UI shell)
persistence/ GameHistoryStore, IndexedDB store, ListRecorder
lib/         i18n, pwa, cardDisplay, settings
```

## Key Design Rules

- **Host-authoritative**: `GameEngine` runs only on host (seat p1) or solo. Guest renders redacted state.
- **Redaction boundary**: `redactStateFor()` is the only privacy layer — never bypass it.
- **Scoring**: `TARIFF` in `src/game/scoring.ts` is the single source of truth.
- **Bid legality**: `rules.ts` (`getLegalCards`, `getCallableSuits`, etc.) is shared by engine, UI, and AI — keep in sync.
- **Settings**: extend via `Settings` + `DEFAULT_SETTINGS` + `CODECS` in `src/lib/settings.ts`. Never hand-roll `localStorage` in components.
- **Persistence**: all reads/writes through `persistence/` module. IndexedDB failures must never break gameplay.
- **Test seams** (DEV only): `src/lib/e2e.ts`, `src/lib/seededShuffle.ts`, `data-card-id` attributes. Don't remove.
