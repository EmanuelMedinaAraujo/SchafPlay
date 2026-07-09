import { useState } from "react";
import { PeerConnection, PeerConnectionState } from "../net/PeerConnection";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import PairingPanel from "./PairingPanel";
import { UsersIcon, RadioIcon, BotIcon, PlayIcon } from "./icons";

interface HomeScreenProps {
  language: Language;
  playerName: string;
  connectionState: PeerConnectionState | "idle";
  onPlayerNameChange: (name: string) => void;
  onHostPeer: (peer: PeerConnection) => void;
  onGuestPeer: (peer: PeerConnection) => void;
  totalRounds: number;
  onTotalRoundsChange: (rounds: number) => void;
  onSoloStart: () => void;
}

export default function HomeScreen(props: HomeScreenProps) {
  const t = translations[props.language];
  const [mode, setMode] = useState<"host" | "join" | "solo">("host");

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

          {(mode === "host" || mode === "solo") && (
            <div className="list-length-row">
              <label className="field-label">
                {t.listLength} ({t.rounds})
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
              <button
                className={mode === "solo" ? "active" : ""}
                onClick={() => setMode("solo")}
                role="tab"
                aria-selected={mode === "solo"}
                type="button"
              >
                <BotIcon />
                {t.soloGame}
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          {mode === "solo" ? (
            <div className="pairing-flow">
              <h2>
                <BotIcon size={18} />
                {t.soloGame}
              </h2>
              <p className="muted" style={{ marginBottom: "12px" }}>{t.soloIntro}</p>
              <button className="primary-button" onClick={props.onSoloStart} type="button">
                <PlayIcon />
                {t.startGame}
              </button>
            </div>
          ) : (
            <PairingPanel
              key={mode}
              language={props.language}
              mode={mode}
              connectionState={props.connectionState}
              onPeer={mode === "host" ? props.onHostPeer : props.onGuestPeer}
            />
          )}
        </div>
      </section>
    </main>
  );
}
