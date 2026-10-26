import { CSSProperties, useState } from "react";
import { Transport, TransportState } from "../net/Transport";
import { Language } from "../types";
import { GameMode, ROUND_OPTIONS } from "../lib/settings";
import { translations } from "../lib/i18n";
import PairingPanel from "./PairingPanel";

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
  /** Invite code from a deep link (#invite=…); when set, opens the join flow. */
  initialInvite?: string;
}

/** Solo leads (#94): it is the default mode and the common case. */
const MODES: GameMode[] = ["solo", "host", "join"];

/** Chalk tally strokes the traditional way: four down, the fifth across. */
function Tally({ count }: { count: number }) {
  const strokes = [];
  for (let i = 0; i < count; i++) {
    const group = Math.floor(i / 5);
    const pos = i % 5;
    const x0 = group * 34;
    strokes.push(
      pos < 4 ? (
        <path key={i} pathLength={1} style={{ "--k": i } as CSSProperties} d={`M${x0 + 4 + pos * 7} ${5 + (pos % 2)} l${pos % 2 ? 1 : -1} 28`} />
      ) : (
        <path key={i} pathLength={1} style={{ "--k": i } as CSSProperties} d={`M${x0} 27 L${x0 + 30} 9`} />
      ),
    );
  }
  const width = Math.ceil(count / 5) * 34;
  return (
    <svg className="wh-tally-marks" viewBox={`-2 0 ${width} 38`} width={width * 0.8} height={30} aria-hidden="true">
      {strokes}
    </svg>
  );
}

/**
 * The Wirtshaus setup screen: the modes are beer mats on the table, name and
 * list length go on the chalk slate (the list length as a Strichliste), and
 * the chosen mode's next step is an order slip pinned beside it.
 */
export default function HomeScreen(props: HomeScreenProps) {
  const t = translations[props.language];
  // Solo on every open (#94): host would mint an invite and run signaling
  // before the player has chosen multiplayer at all. An invite deep-link is
  // the one exception — a shared link lands on join.
  const [mode, setMode] = useState<GameMode>(props.initialInvite ? "join" : "solo");

  const modeLabel = (m: GameMode) => (m === "solo" ? t.soloGame : m === "host" ? t.hostGame : t.joinGame);
  const modeHint = (m: GameMode) => (m === "solo" ? t.homeHintSolo : m === "host" ? t.homeHintHost : t.homeHintJoin);

  return (
    <main className="home-screen pub-home">
      <div className="wh">
        <section className="wh-left">
          <div className="wh-mats" role="tablist">
            {MODES.map((m, i) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`wh-mat-btn wh-mat-${m}${mode === m ? " active" : ""}`}
                style={{ "--i": i } as CSSProperties}
                onClick={() => setMode(m)}
              >
                <span className="wh-mat">
                  <span className="wh-mat-top" aria-hidden="true">
                    ★ Nº {i + 1} ★
                  </span>
                  <span className="wh-mat-label">{modeLabel(m)}</span>
                  <span className="wh-mat-hint" aria-hidden="true">
                    {modeHint(m)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="wh-slate">
            <label className="wh-slate-row">
              <span className="wh-chalk-label">{t.playerName}</span>
              <input
                id="player-name"
                className="wh-chalk-input"
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
                value={props.playerName}
                onChange={(event) => props.onPlayerNameChange(event.target.value)}
              />
            </label>
            {/* The list length only matters to whoever runs the engine: solo and host. */}
            {mode !== "join" && (
              <div className="list-length-row wh-slate-row wh-tally">
                <span className="wh-chalk-label">{t.homeTally}</span>
                <div className="home-rounds" role="group" aria-label={t.listLength}>
                  {ROUND_OPTIONS.map((r) => {
                    const active = props.totalRounds === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        // The tally strokes are decorative; the name stays the bare number.
                        aria-label={String(r)}
                        aria-pressed={active}
                        className={active ? "active" : ""}
                        onClick={() => props.onTotalRoundsChange(r)}
                      >
                        <Tally count={r} />
                        <span className="wh-tally-num">{r}</span>
                        <svg className="wh-chalk-ring" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
                          <path pathLength={1} d="M88 10C70 0 20 2 8 18s10 30 44 29 46-12 40-28c-3-6-12-9-20-10" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Keyed by mode: a new slip drops in, and pairing starts fresh. */}
        <section className="wh-note" key={mode}>
          <span className="wh-pin" aria-hidden="true" />
          <h2 className="wh-note-title">{modeLabel(mode)}</h2>
          {mode === "solo" ? (
            <>
              <p className="wh-hand">{t.soloIntro}</p>
              <button className="wh-sign" onClick={props.onSoloStart} type="button">
                {t.startGame}
              </button>
            </>
          ) : (
            <PairingPanel
              language={props.language}
              mode={mode}
              connectionState={props.connectionState}
              onPeer={mode === "host" ? props.onHostPeer : props.onGuestPeer}
              initialInvite={mode === "join" ? props.initialInvite : undefined}
            />
          )}
        </section>
      </div>
    </main>
  );
}
