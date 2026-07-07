# Project: SchafPlay

## Architecture
- Offline-first PWA: client-side only; custom hand-written service worker and manifest under public/.
- WebRTC peer-to-peer: host-authoritative 2-player game, signaling via serverless compressed base64 SDP codes exchanged directly between players, no game server.
- Data flow:
  - Player 1 (Host): runs `GameEngine` (deal, bidding, validation, AI seats, scoring) and pushes redacted state to the guest after every change.
  - Player 2 (Guest): renders the received redacted state, sends actions (`BID_WILL`, `BID_DECLARE`, `BID_RETREAT`, `PLAY_CARD`, `READY_NEXT`) back to the host. The host forces the guest's playerId to `p3` regardless of what is on the wire.
  - Disconnects: host pauses the engine (timers frozen, actions ignored); both sides show a re-pairing panel that exchanges fresh codes. The engine survives, the game resumes where it stopped.

## Host ↔ Guest messages (`src/net/protocol.ts`)
- Host → Guest: `{ type: "GAME_STATE_UPDATE", payload: { state: RedactedGameState } }`
- Guest → Host: `{ type: "PLAYER_ACTION", payload: { action: PlayerAction } }`
- Guest → Host on connect: `{ type: "CONNECTION_ACK", payload: { name } }` (guest name)
- Transport-level `PING`/`PONG` keepalive lives inside `PeerConnection` (5s interval, 15s timeout).

## Code layout
- `src/engine/GameEngine.ts` — pure state machine; `aiDelayMs`/`trickHoldMs`/`shuffleFn` injectable for tests
- `src/net/PeerConnection.ts` — Hand-rolled serverless WebRTC data channel wrapper (heartbeat, pause/resume)
- `src/utils/gameLogic.ts` — rules, AI, `TARIFF` scoring table, `countLaufende`
- `src/components/` — `GameBoard`, `PlayerSeat`, `TrickArea`, `PlayerHand`, `CardFace`, `BiddingPanel`, `RoundOverScreen`, `PairingPanel`, `HomeScreen`, `RulesModal`
- `src/lib/i18n.ts` — DE/EN strings, `gameLabel`, `formatLog` (engine logs are structured, rendered per language)
