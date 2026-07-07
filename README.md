# SchafPlay 🃏

Bavarian **Schafkopf for two players** as an offline-first PWA. Two humans (seats 1 & 3) play against each other over a serverless **WebRTC direct connection**; seats 2 & 4 are AI opponents (Resi & Sepp).

## How does the connection work?

No server, no sign-up — signaling goes through the public **PeerJS broker**, but the game itself runs directly **P2P** over a WebRTC data channel:

1. **Host**: "Host game" → automatically gets a short **game code** (5 characters)
2. **Guest**: type in the code → "Join" → connected, cards are dealt

Only the guest has to type anything in; nothing is copied back. If the connection drops, the host **pauses** the game: the host gets a new code, the guest enters it — the entire game state is preserved.

## Game rules

- **Two-stage bidding**: first "Do you want to play?" (I dad spuin / Weiter), then "What do you play?" with overbidding by priority: Sauspiel < Wenz < Solo < Wenz Tout < Solo Tout
- **Everyone passes** → cards are thrown in and redealt (no Ramsch)
- **Between rounds** both players must tap "Ready", then the dealer rotates

### Tournament scoring (plus/minus, zero-sum)

| Game | Base | Schneider | Schwarz | Tout | Sie | per Laufender |
|---|---|---|---|---|---|---|
| Sauspiel (per player) | 1 | 2 | 3 | – | – | +1 |
| Solo / Wenz (per opponent) | 2 | 3 | 4 | 6 | 8 | +1 |

The soloist receives/pays **three times** the opponent value (e.g. Solo won: +6 / -2 each). Laufende count from 3 (Wenz from 2), "mit" the same as "ohne". The values live centrally in `TARIFF` ([gameLogic.ts](src/utils/gameLogic.ts)).

## Development

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm test         # Engine and scoring tests
npm run lint     # TypeScript type-check
npm run build    # Production build incl. service worker (dist/)
```

The output in `dist/` is a purely static site — deployable to any static host (GitHub Pages, Netlify, Cloudflare Pages, …). Installable as a PWA; both devices need internet to connect (PeerJS broker for signaling, then a direct P2P connection).

## Architecture

```
src/
├── engine/GameEngine.ts   # Host-authoritative game state machine (bidding, tricks, scoring, AI pacing)
├── net/PeerConnection.ts  # P2P connection (PeerJS signaling via game code, heartbeat)
├── net/protocol.ts        # P2P message format
├── utils/gameLogic.ts     # Rules: trump, legality, trick evaluation, AI, tournament scoring
├── components/            # GameBoard, PlayerHand, BiddingPanel, TrickArea, PairingPanel, …
└── lib/i18n.ts            # German/English incl. structured game log entries
```

- **Host** (player 1) runs the GameEngine, validates every action, and sends the guest only their **redacted** game state — other players' hands are never on the wire.
- **Guest** (player 3) renders the received state and sends actions (bidding, card, ready) back.

## Tech stack

React 19 · TypeScript · Vite · vite-plugin-pwa · Vanilla CSS · WebRTC · Vitest
