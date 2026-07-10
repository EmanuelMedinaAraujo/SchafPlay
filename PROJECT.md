# Project: SchafPlay

## Architecture
- Offline-first PWA: client-side only; custom hand-written service worker and manifest under public/.
- WebRTC peer-to-peer: host-authoritative 2-player game, signaling via serverless compressed base64 SDP codes exchanged directly between players, no game server.
- Layered: `game/` (pure domain) → `players/` + `engine/` → `session/` → `App`/`components/`, with `net/` and `persistence/` as leaf services. `src/types.ts` is a re-export barrel.
- Data flow:
  - Player 1 (Host): `HostSession` runs `GameEngine` (deal, bidding, validation, AI seats, scoring) and pushes redacted state to the guest after every change.
  - Player 2 (Guest): `GuestSession` renders the received redacted state, sends actions (`BID_WILL`, `BID_DECLARE`, `BID_RETREAT`, `PLAY_CARD`, `READY_NEXT`) back to the host. The host forces the guest's playerId to `p3` regardless of what is on the wire.
  - Disconnects: host pauses the engine (timers frozen, actions ignored); both sides show a re-pairing panel that exchanges fresh codes. The session (engine + recorder) survives, the game resumes where it stopped.

## Host ↔ Guest messages (`src/net/protocol.ts`)
- Host → Guest: `{ type: "GAME_STATE_UPDATE", payload: { state: RedactedGameState } }`
- Guest → Host: `{ type: "PLAYER_ACTION", payload: { action: PlayerAction } }`
- Guest → Host on connect: `{ type: "CONNECTION_ACK", payload: { name } }` (guest name)
- Transport-level `PING`/`PONG` keepalive lives inside `WebRTCPeer` (5s interval, 15s timeout).

## Code layout
- `src/game/` — pure domain: `types.ts`, `deck.ts`, `rules.ts` (incl. single-source bid legality), `scoring.ts` (`TARIFF`, `countLaufende`)
- `src/players/` — `PlayerController` interface, `AIController`, `aiHeuristics.ts`
- `src/engine/GameEngine.ts` — state machine (`aiDelayMs`/`trickHoldMs`/`shuffleFn`/`controllers`/`devToolsEnabled` injectable); `redaction.ts` — pure `redactStateFor`
- `src/net/` — `Transport`/`Signaling` interfaces, `WebRTCPeer.ts` (serverless WebRTC), `sdpCodec.ts`, `protocol.ts`
- `src/session/` — `HostSession`/`GuestSession`/`SoloSession`, `useGameSession.ts`
- `src/persistence/` — `GameHistoryStore` interface, `IdbGameHistoryStore` (IndexedDB), `idb.ts`, `ListRecorder.ts`
- `src/components/` — `GameBoard`, `PlayerSeat`, `TrickArea`, `PlayerHand`, `CardFace`, `BiddingPanel`, `RoundOverScreen`, `PairingPanel`, `HomeScreen`, `RulesModal`
- `src/lib/i18n.ts` — DE/EN strings, `gameLabel`, `formatLog` (engine logs are structured, rendered per language); `src/lib/cardDisplay.ts` — `getSuitEmoji`
