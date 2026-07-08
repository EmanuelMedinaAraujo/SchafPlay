import { useState } from "react";
import { PeerConnection, PeerConnectionState } from "../net/PeerConnection";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import PairingPanel from "./PairingPanel";
import { UsersIcon, RadioIcon } from "./icons";

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
      <section className="home-grid">
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
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
          </div>

          {mode === "host" && (
            <div className="match-length-row">
              <label className="field-label">
                {t.matchLength} ({t.rounds})
              </label>
              <div className="mode-switch" role="group">
                {[4, 8, 12].map((r) => (
                  <button
                    key={r}
                    className={props.totalRounds === r ? "active" : ""}
                    onClick={() => props.onTotalRoundsChange(r)}
                    style={{ minHeight: "34px", fontSize: "13px" }}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
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
        </div>

        <div className="panel">
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
