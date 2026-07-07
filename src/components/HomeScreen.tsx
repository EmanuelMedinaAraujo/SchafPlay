import { useState } from "react";
import { PeerConnection, PeerConnectionState } from "../net/PeerConnection";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import PairingPanel from "./PairingPanel";

/** Inline SVG icons — replaces lucide-react Radio/Users */
const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const RadioIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" /><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
    <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" /><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

interface HomeScreenProps {
  language: Language;
  playerName: string;
  connectionState: PeerConnectionState | "idle";
  onPlayerNameChange: (name: string) => void;
  onHostPeer: (peer: PeerConnection) => void;
  onGuestPeer: (peer: PeerConnection) => void;
  totalRounds: number;
  onTotalRoundsChange: (rounds: number) => void;
}

export default function HomeScreen(props: HomeScreenProps) {
  const t = translations[props.language];
  const [mode, setMode] = useState<"host" | "join">("host");

  return (
    <main className="home-screen">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Offline-first PWA · WebRTC P2P</span>
          <h1>SchafPlay</h1>
          <p>{t.heroTagline}</p>
          <p className="muted">{t.heroHint}</p>
        </div>
        <div className="hero-table" aria-hidden="true">
          <span>🌰</span>
          <span>🍃</span>
          <span>❤️</span>
          <span>🔔</span>
        </div>
      </section>

      <section className="home-grid">
        <div className="panel">
          <label className="field-label" htmlFor="player-name">
            {t.playerName}
          </label>
          <input
            id="player-name"
            className="input"
            maxLength={20}
            value={props.playerName}
            onChange={(event) => props.onPlayerNameChange(event.target.value)}
          />

          <div className="mode-switch" role="tablist">
            <button
              className={mode === "host" ? "active" : ""}
              onClick={() => setMode("host")}
              role="tab"
              aria-selected={mode === "host"}
              type="button"
            >
              <UsersIcon />
              {t.hostGame}
            </button>
            <button
              className={mode === "join" ? "active" : ""}
              onClick={() => setMode("join")}
              role="tab"
              aria-selected={mode === "join"}
              type="button"
            >
              <RadioIcon />
              {t.joinGame}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>
            {mode === "host" ? <UsersIcon /> : <RadioIcon />}
            {mode === "host" ? t.hostGame : t.joinGame}
          </h2>
          {mode === "host" && (
            <div style={{ marginBottom: "16px" }}>
              <label className="field-label">{t.matchLength}</label>
              <div className="mode-switch" role="group" style={{ marginTop: "4px" }}>
                {[4, 8, 12].map((r) => (
                  <button
                    key={r}
                    className={props.totalRounds === r ? "active" : ""}
                    onClick={() => props.onTotalRoundsChange(r)}
                    style={{ minHeight: "34px", fontSize: "13px" }}
                    type="button"
                  >
                    {r} {t.rounds}
                  </button>
                ))}
              </div>
            </div>
          )}
          <PairingPanel
            key={mode}
            language={props.language}
            mode={mode}
            connectionState={props.connectionState}
            onPeer={mode === "host" ? props.onHostPeer : props.onGuestPeer}
          />
        </div>
      </section>
    </main>
  );
}
