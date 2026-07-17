import { useState } from "react";
import { Transport, TransportState } from "../net/Transport";
import { Language } from "../types";
import { GameMode } from "../lib/settings";
import { translations } from "../lib/i18n";
import PairingPanel from "./PairingPanel";
import { UsersIcon, RadioIcon, BotIcon, PlayIcon } from "./icons";

interface HomeScreenProps {
  language: Language;
  playerName: string;
  connectionState: TransportState | "idle";
  onPlayerNameChange: (name: string) => void;
  onHostPeer: (peer: Transport) => void;
  onGuestPeer: (peer: Transport) => void;
  totalRounds: number;
  onTotalRoundsChange: (rounds: number) => void;
  onSoloStart: () => void;
  /** Last-used mode (#44), preselected on open unless an invite overrides it. */
  lastMode: GameMode;
  onLastModeChange: (mode: GameMode) => void;
  /** Invite code from a deep link (#invite=…); when set, opens the join flow. */
  initialInvite?: string;
}

export default function HomeScreen(props: HomeScreenProps) {
  const t = translations[props.language];
  // Preselect the last-used mode (#44), seeded synchronously from settings so
  // the correct tab is active on first paint. An invite deep-link always wins
  // — a shared link should land on join regardless of the stored preference,
  // and that transient override is not written back to settings.
  const [mode, setMode] = useState<GameMode>(props.initialInvite ? "join" : props.lastMode);

  // Report deliberate tab changes upward so they persist for next open.
  function selectMode(next: GameMode) {
    setMode(next);
    props.onLastModeChange(next);
  }

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
                onClick={() => selectMode("host")}
                role="tab"
                aria-selected={mode === "host"}
                type="button"
              >
                <UsersIcon />
                {t.hostGame}
              </button>
              <button
                className={mode === "join" ? "active" : ""}
                onClick={() => selectMode("join")}
                role="tab"
                aria-selected={mode === "join"}
                type="button"
              >
                <RadioIcon />
                {t.joinGame}
              </button>
              <button
                className={mode === "solo" ? "active" : ""}
                onClick={() => selectMode("solo")}
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
              initialInvite={mode === "join" ? props.initialInvite : undefined}
              localName={props.playerName}
            />
          )}
        </div>
      </section>
    </main>
  );
}
