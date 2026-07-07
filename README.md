# SchafPlay 🃏

Bayerischer **Schafkopf für zwei Spieler** als Offline-first PWA. Zwei Menschen (Platz 1 & 3) spielen über eine serverlose **WebRTC-Direktverbindung** gegeneinander, die Plätze 2 & 4 übernehmen KI-Mitspieler (Resi & Sepp).

## Wie funktioniert die Verbindung?

Kein Server, keine Anmeldung — Signaling per **Copy-Paste**:

1. **Host**: „Spiel hosten" → Einladungs-Code erzeugen → per Messenger an den Mitspieler schicken
2. **Gast**: Code einfügen → Antwort-Code erzeugen → zurückschicken
3. **Host**: Antwort-Code einfügen → verbunden, Karten werden gegeben

Bricht die Verbindung ab, **pausiert** das Spiel auf dem Host. Neue Codes austauschen — der komplette Spielstand bleibt erhalten.

## Spielregeln

- **Zweistufiges Reizen**: erst „Magst du spielen?" (I dad spuin / Weiter), dann „Was spielst du?" mit Überbieten nach Priorität: Sauspiel < Wenz < Solo < Wenz Tout < Solo Tout
- **Alle weiter** → zusammenwerfen und neu geben (kein Ramsch)
- **Zwischen den Runden** müssen beide Spieler „Bereit" tippen, dann rotiert der Geber

### Turnierwertung (Plus/Minus, nullsummig)

| Spiel | Basis | Schneider | Schwarz | Tout | Sie | pro Laufendem |
|---|---|---|---|---|---|---|
| Sauspiel (pro Spieler) | 1 | 2 | 3 | – | – | +1 |
| Solo / Wenz (pro Gegenspieler) | 2 | 3 | 4 | 6 | 8 | +1 |

Der Solist erhält/zahlt das **Dreifache** des Gegenspieler-Werts (z. B. Solo gewonnen: +6 / je −2). Laufende zählen ab 3 (Wenz ab 2), „mit" wie „ohne". Die Werte stehen zentral in `TARIFF` ([gameLogic.ts](src/utils/gameLogic.ts)).

## Entwicklung

```bash
npm install
npm run dev      # Vite dev server auf http://localhost:5173
npm test         # Engine-, Scoring- und WebRTC-Tests
npm run lint     # TypeScript type-check
npm run build    # Produktions-Build inkl. Service Worker (dist/)
```

Das Ergebnis in `dist/` ist eine rein statische Site — auf jedem Static-Host (GitHub Pages, Netlify, Cloudflare Pages, …) deploybar. Als PWA installierbar, läuft offline (die WebRTC-Verbindung braucht natürlich Netz zwischen den Geräten).

## Architektur

```
src/
├── engine/GameEngine.ts   # Host-autoritative Spielzustandsmaschine (Reizen, Stiche, Wertung, KI-Pacing)
├── net/PeerConnection.ts  # WebRTC-DataChannel-Wrapper (Copy-Paste-SDP, Heartbeat)
├── net/protocol.ts        # P2P-Nachrichtenformat
├── utils/gameLogic.ts     # Regeln: Trumpf, Legalität, Stichvergabe, KI, Turnierwertung
├── components/            # GameBoard, PlayerHand, BiddingPanel, TrickArea, PairingPanel, …
└── lib/i18n.ts            # Deutsch/Englisch inkl. strukturierter Spiel-Log-Einträge
```

- **Host** (Spieler 1) führt die GameEngine aus, validiert jede Aktion und schickt dem Gast nur dessen **redigierten** Spielzustand — fremde Blätter sind nie auf der Leitung.
- **Gast** (Spieler 3) rendert den empfangenen Zustand und schickt Aktionen (Reizen, Karte, Bereit) zurück.

## Tech-Stack

React 19 · TypeScript · Vite · vite-plugin-pwa · Vanilla CSS · WebRTC · Vitest
