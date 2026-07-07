import { Radio, Users } from "lucide-react";
import { useState } from "react";
import { PeerConnection, PeerConnectionState } from "../net/PeerConnection";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import PairingPanel from "./PairingPanel";

interface HomeScreenProps {
  language: Language;
  playerName: string;
  connectionState: PeerConnectionState | "idle";
  onPlayerNameChange: (name: string) => void;
  onHostPeer: (peer: PeerConnection) => void;
  onGuestPeer: (peer: PeerConnection) => void;
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
              <Users size={16} />
              {t.hostGame}
            </button>
            <button
              className={mode === "join" ? "active" : ""}
              onClick={() => setMode("join")}
              role="tab"
              aria-selected={mode === "join"}
              type="button"
            >
              <Radio size={16} />
              {t.joinGame}
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>
            {mode === "host" ? <Users size={18} /> : <Radio size={18} />}
            {mode === "host" ? t.hostGame : t.joinGame}
          </h2>
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
