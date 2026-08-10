# SchafPlay 🃏

Bavarian **Schafkopf for two players** as an offline-first PWA. Two humans (seats 1 & 3) play against each other over a serverless **WebRTC direct connection**; seats 2 & 4 are AI opponents (Resi & Sepp). Solo mode fills seat 3 with a third AI (Zenzi).

## How does the connection work?

No server, no third-party signaling servers, no sign-up — signaling is completely serverless and done directly:

1. **Host**: "Host game" → copies the generated **invitation code** (compressed base64 SDP blob) and sends it to the guest.
2. **Guest**: "Join game" → pastes the invitation code, generates a **reply code**, copies it, and sends it back to the host.
3. **Host**: Pastes the reply code → connection is established directly P2P over a local WebRTC data channel.

If the connection drops, the host pauses the game: they exchange fresh codes, and the entire game state is preserved.

## Game rules

- **Two-stage bidding**: first "Do you want to play?" (I dad spuin / Weiter), then "What do you play?" with overbidding by priority: Sauspiel < Wenz < Solo < Wenz Tout < Solo Tout
- **Everyone passes** → cards are thrown in and redealt, or the deal is played out as a **Ramsch** if that house rule is enabled in Settings
- **Between rounds** both players must tap "Ready", then the dealer rotates

Optional house rules (Settings, all off by default unless noted): Ramsch on an all-pass, Stoß/Retour doubling, and disabling Laufende.

### Tournament scoring (plus/minus, zero-sum)

| Game | Base | Schneider | Schwarz | Tout | Sie | per Laufender |
|---|---|---|---|---|---|---|
| Sauspiel (per player) | 1 | 2 | 3 | – | – | +1 |
| Solo / Wenz (per opponent) | 1 | 2 | 3 | 4 | 6 | +1 |

The soloist receives/pays **three times** the opponent value (e.g. Solo won: +3 / -1 each). The values are intentionally kept small — a solo counts roughly triple a normal game and stays in the single digits. Laufende count from 3 (Wenz from 2), "mit" the same as "ohne". The values live centrally in `TARIFF` ([scoring.ts](src/game/scoring.ts)).

## Development

```bash
npm install
npm run dev      # Vite dev server
npm run lint     # TypeScript type-check
npm run build    # Production build (dist/)
```

The output in `dist/` is a purely static site — deployable to any static host (GitHub Pages, Netlify, Cloudflare Pages, …). Installable as a PWA; both devices need to be on the same local network to establish the direct P2P WebRTC connection.

## Testing

The project has a Playwright E2E suite (`tests/e2e/`) covering WebRTC pairing and reconnect, bidding legality, card-play rule enforcement, scored gameplay across full rounds and lists, Sauspiel partner-reveal redaction, the analysis replay, settings persistence and local statistics.

```bash
npm run test:e2e              # run the suite headless (starts the Vite dev server automatically)
E2E_SLOW=1 npm run test:e2e   # slower in-game pacing, for machines that lose the race
```

The suite runs seeded games at 40 ms per AI move, which a CPU-starved machine can fall behind — a card can be gone from the table before the assertion looks. `E2E_SLOW=1` stretches that pacing; it changes timing only, never the deal or the outcome.

It runs automatically in CI (`.github/workflows/e2e.yml`) on every pull request and on pushes to `main`. There are no unit tests — the suite above is the project's only automated testing.

## Deployment (GitHub Pages)

The repo ships a workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) that type-checks, builds and publishes `dist/` to GitHub Pages on every release (and via manual dispatch).

One-time setup: in **Settings → Pages → Build and deployment**, set the source to **GitHub Actions**. The site is then served at `https://<user>.github.io/SchafPlay/`.

- **Base path**: production builds use `base: '/SchafPlay/'` (the project-site sub-path). Override it with the `BASE_PATH` env var when deploying to a custom domain or a different repo name; `npm run dev` always runs at `/`.
- **Offline-first**: the service worker serves the whole app from cache, so opening it never depends on the network. Version checks are **manual** — "Check for update" in Settings is the only code path that goes online; a found update activates and reloads the app without a restart.

## Hosting and Playing over Tailscale

If you want to play with someone who is not on the same physical Wi-Fi/local network, you can securely connect and host the game over a [Tailscale](https://tailscale.com/) tailnet.

### 1. Secure Context (HTTPS) Requirement
WebRTC data channels and Service Workers (required for offline-first PWA features) require a **Secure Context** (HTTPS) when accessed over non-localhost network addresses. Because Vite runs locally on HTTP, we use **Tailscale Serve** to act as a secure proxy that provides automated, valid TLS/HTTPS certificates directly on your tailnet.

### 2. Enable HTTPS in Tailscale Admin Console
To allow Tailscale to generate HTTPS certificates for your devices:
1. Log into your **Tailscale Admin Console**.
2. Go to **Settings > DNS**.
3. Scroll down to **HTTPS Certificates** and enable the feature.

### 3. Vite Configuration
Tailscale's local proxy forwards traffic to the local loopback address. This project is configured to support this out-of-the-box in [vite.config.ts](vite.config.ts):
- Vite binds to IPv4 loopback (`host: '127.0.0.1'`) to match Tailscale Serve's default target, unless you pass `--host`.
- The tailnet domain suffix (`.ts.net`) is added to Vite's `server.allowedHosts` configuration to prevent "Host header blocking" security errors when accessing it via Tailscale.

### 4. Running the Game
To run and serve the game on your tailnet, execute the following commands in separate terminals:

1. **Start the Vite dev server**:
   ```bash
   npm run dev
   ```
2. **Start the Tailscale Serve proxy**:
   ```bash
   tailscale serve 5173
   ```

### 5. Accessing the Game URL
Once Tailscale Serve is running, your tailnet peers can access the game using the HTTPS URL matching your device's tailnet domain:
`https://[your-device-name].[your-tailnet-domain].ts.net/`


## Architecture

```
src/
├── game/                  # Pure domain: types, deck, rules (+ bid legality), scoring (TARIFF, Laufende)
├── players/               # PlayerController interface, AIController, AI heuristics
├── engine/GameEngine.ts   # Host-authoritative game state machine (bidding, tricks, scoring, AI pacing)
├── engine/redaction.ts    # Pure redactStateFor — the privacy boundary
├── net/                   # Transport & Signaling interfaces, WebRTCPeer, sdpCodec, protocol
├── session/               # HostSession/GuestSession/SoloSession + useGameSession
├── persistence/           # GameHistoryStore interface, IndexedDB store, ListRecorder
├── analysis/              # Pure replay derivation over stored RoundRecords
├── components/            # GameBoard, PlayerHand, BiddingPanel, TrickArea, PairingPanel, …
└── lib/i18n.ts            # German/English incl. structured game log entries
```

- **Host** (player 1) runs the GameEngine, validates every action, and sends the guest only their **redacted** game state — other players' hands are never on the wire.
- **Guest** (player 3) renders the received state and sends actions (bidding, card, ready) back.

## Statistics

The statistics page (chart icon in the header) shows how many matches you have played, won and lost, split by multiplayer and solo.

- **Fully local, per device.** Statistics never leave the device — there is no backend to send them to. Each player's device records its own view of the match, so both players keep their own history.
- **A game counts once a match is finished.** Matches you quit or abandon are not recorded at all.
- Alongside the summary, the full raw data of every round is stored — the hand you were dealt, the contract, every trick in play order and the scoring result. The analysis view replays any recorded round from it, trick by trick.
- Stored in IndexedDB (database `schafplay`). Clearing the site data (or the browser's storage for the PWA) clears the statistics.

## Tech stack

React 19 · TypeScript · Vite · Vanilla CSS · WebRTC
