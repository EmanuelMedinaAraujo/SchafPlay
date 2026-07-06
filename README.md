# Schafkopf Coach 🃏

A mobile-first Bavarian **Schafkopf** card game as a web app — optimized for phones held in **landscape**. Play against three AI opponents, locally with friends (Pass & Play) or online via lobby codes, and get AI-powered post-game coaching.

## Features

- **Single player** — three AI opponents with three difficulty levels
- **Pass & Play** — up to four humans on one device, with a hand-concealment shield between turns
- **Online multiplayer** — host a table, share the 6-letter code, friends join over the network; empty seats are filled by AI. Server-side rule validation and hand redaction (nobody can read other hands from the wire)
- **Full ruleset** — Sauspiel, Wenz (incl. suit Wenz & Tout), Suit Solos, Ramsch, Contra, Schneider/Schwarz tariffs, list play over configurable game counts
- **KI-Trainer** — post-game trick-by-trick analysis powered by Gemini (optional, needs an API key)
- **Statistics** — win rates by role, contract-type frequencies, persisted locally
- **German & English** UI

## Getting Started

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev          # dev server (Vite + WebSocket) on http://localhost:3000
```

Optional: copy `.env.example` to `.env` and set `GEMINI_API_KEY` to enable the AI analysis feature. Everything else works without it.

## Production

```bash
npm run build        # builds the client (dist/) and the server bundle (dist/server.cjs)
npm start            # NODE_ENV=production node dist/server.cjs
```

The single Node process serves the static client, the REST API, and the WebSocket multiplayer — deploy it anywhere a Node server runs (set `PORT` as needed).

### Docker

```bash
docker build -t schafkopf .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_key schafkopf
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server with HMR |
| `npm run build` | Production build (client + server) |
| `npm start` | Run the production build |
| `npm run lint` | TypeScript type-check |
| `npm test` | Unit/component tests |
| `npm run test:e2e` | Multiplayer server e2e tests (lobby, bidding, gameplay, disconnects, stress) |
| `npm run test:all` | Both suites |

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | no | HTTP/WebSocket port (default `3000`) |
| `GEMINI_API_KEY` | no | Enables the KI-Trainer post-game analysis |
| `HEARTBEAT_INTERVAL` | no | WebSocket ping interval in ms (default `30000`) |

## Tech Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Motion · Express · ws · Vitest
