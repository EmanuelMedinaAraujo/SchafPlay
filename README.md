# SchafPlay 🃏

Bavarian **Schafkopf for two players** as an offline-first PWA. Two humans (seats 1 & 3) play against each other over a serverless **WebRTC direct connection**; seats 2 & 4 are AI opponents (Resi & Sepp).

## How does the connection work?

No server, no third-party signaling servers, no sign-up — signaling is completely serverless and done directly:

1. **Host**: "Host game" → copies the generated **invitation code** (compressed base64 SDP blob) and sends it to the guest.
2. **Guest**: "Join game" → pastes the invitation code, generates a **reply code**, copies it, and sends it back to the host.
3. **Host**: Pastes the reply code → connection is established directly P2P over a local WebRTC data channel.

If the connection drops, the host pauses the game: they exchange fresh codes, and the entire game state is preserved.

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
npm run dev      # Vite dev server
npm run lint     # TypeScript type-check
npm run build    # Production build (dist/)
```

The output in `dist/` is a purely static site — deployable to any static host (GitHub Pages, Netlify, Cloudflare Pages, …). Installable as a PWA; both devices need to be on the same local network to establish the direct P2P WebRTC connection.

## Architecture

```
src/
├── engine/GameEngine.ts   # Host-authoritative game state machine (bidding, tricks, scoring, AI pacing)
├── net/PeerConnection.ts  # P2P connection (hand-rolled serverless WebRTC data channel wrapper)
├── net/protocol.ts        # P2P message format
├── utils/gameLogic.ts     # Rules: trump, legality, trick evaluation, AI, tournament scoring
├── components/            # GameBoard, PlayerHand, BiddingPanel, TrickArea, PairingPanel, …
└── lib/i18n.ts            # German/English incl. structured game log entries
```

- **Host** (player 1) runs the GameEngine, validates every action, and sends the guest only their **redacted** game state — other players' hands are never on the wire.
- **Guest** (player 3) renders the received state and sends actions (bidding, card, ready) back.

## Tech stack

React 19 · TypeScript · Vite · Vanilla CSS · WebRTC
