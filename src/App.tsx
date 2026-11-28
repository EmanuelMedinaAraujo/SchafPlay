import { useEffect, useLayoutEffect, useState } from "react";
import GameBoard from "./components/GameBoard";
import HomeScreen from "./components/HomeScreen";
import PairingPanel from "./components/PairingPanel";
import HostLobby from "./components/HostLobby";
import RulesModal from "./components/RulesModal";
import SettingsScreen from "./components/SettingsScreen";
import StatsScreen from "./components/StatsScreen";
import AnalysisScreen from "./components/AnalysisScreen";
import { OVERLAY_ROOT_ID } from "./components/OverlayPortal";
import { HumanCount } from "./session/HostSession";
import { useGameSession } from "./session/useGameSession";
import { translations } from "./lib/i18n";
import { useSettings } from "./lib/settings";
import { BookOpenIcon, BotIcon, ChartColumnIcon, HistoryIcon, HomeIcon, PlugZapIcon, SettingsIcon, WifiIcon } from "./components/icons";

/** Deep-link join (#7): the invite code from `…#invite=<code>`, or "". */
function readInviteFromHash(): string {
  try {
    const match = window.location.hash.match(/[#&]invite=([^&]*)/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

export default function App() {
  // All persisted device preferences flow through one store (see lib/settings).
  const [settings, updateSetting] = useSettings();
  const { language, playerName, totalRounds } = settings;
  const [screen, setScreen] = useState<"home" | "game" | "stats" | "analysis" | "settings">("home");
  const [rulesOpen, setRulesOpen] = useState(false);
  // A running replay takes the whole viewport, chrome-free (#85).
  const [replayActive, setReplayActive] = useState(false);
  // A replay is only on screen from within the analysis view.
  const inReplay = screen === "analysis" && replayActive;
  // Captured once at startup, before the fragment is scrubbed below.
  const [initialInvite, setInitialInvite] = useState(readInviteFromHash);
  const [humanCount, setHumanCount] = useState<HumanCount>(2);

  const session = useGameSession({ settings, onEnterGame: () => {
    setInitialInvite("");
    setScreen("game");
  } });
  const { gameState, connectionState, role, myPlayerId } = session;

  // Strip the fragment so a reload doesn't re-trigger a stale invite.
  useEffect(() => {
    if (!initialInvite) return;
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      // Ignore — a lingering fragment is harmless (it's only read on startup).
    }
  }, [initialInvite]);

  // Landscape-only UI: portrait screens rotate 90° via `html.rotated`.
  // `html.compact` / `html.narrow` key off the *effective* post-rotation
  // dimensions, which plain media queries cannot see.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const effectiveHeight = portrait ? window.innerWidth : window.innerHeight;
      const effectiveWidth = portrait ? window.innerHeight : window.innerWidth;
      root.classList.toggle("rotated", portrait);
      root.classList.toggle("compact", effectiveHeight <= 520);
      root.classList.toggle("narrow", effectiveWidth <= 820);
    };
    update();
    window.addEventListener("resize", update);
    // iOS can rotate without a (timely) resize event.
    const orientation = window.matchMedia("(orientation: portrait)");
    orientation.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      orientation.removeEventListener("change", update);
      root.classList.remove("rotated", "compact", "narrow");
    };
  }, []);

  // In-game the UI fits the viewport, so page scrolling is disabled.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("in-game", screen === "game" || inReplay);
    return () => root.classList.remove("in-game");
  }, [inReplay, screen]);

  const t = translations[language];

  function cancelPairing() {
    session.quit();
    setInitialInvite("");
  }

  function navigate(next: "home" | "stats" | "analysis" | "settings") {
    if (screen === "home" && next !== "home") cancelPairing();
    setScreen(next);
  }

  const navButtons = [
    { title: t.home, Icon: HomeIcon, onClick: () => navigate("home") },
    { title: t.stats, Icon: ChartColumnIcon, onClick: () => navigate("stats") },
    { title: t.analysis, Icon: HistoryIcon, onClick: () => navigate("analysis") },
    { title: t.settings, Icon: SettingsIcon, onClick: () => navigate("settings") },
    { title: t.rules, Icon: BookOpenIcon, onClick: () => setRulesOpen(true) },
  ];
  const connectionLabel = {
    connected: t.connected,
    connecting: t.connecting,
    idle: "—",
    disconnected: t.disconnected,
    failed: t.disconnected,
  }[connectionState];

  function quitGame() {
    cancelPairing();
    setScreen("home");
  }

  const inGame = screen === "game" && gameState;
  // The Wirtshaus look (styles/wirtshaus.css) dresses every screen except the
  // game and the replay; html[data-screen] is its switch. A layout effect, so
  // the switch lands before the first frame of the new screen is painted.
  const pubScreen = inGame || inReplay ? null : screen;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (pubScreen) root.dataset.screen = pubScreen;
    else delete root.dataset.screen;
  }, [pubScreen]);

  // Stays up through "connecting" — it only closes once the peer is back.
  const needsReconnect = Boolean(inGame && role !== "solo" && (gameState.paused || connectionState !== "connected"));

  return (
    <div className="app-shell">
      {pubScreen && (
        <div className="pub-backdrop" aria-hidden="true">
          <span className="pub-lamp" />
        </div>
      )}

      {/* The header is hidden in-game to free up vertical space (#26); the
          in-game toolbar carries the contract, round and quit controls. */}
      {!inGame && !inReplay && (
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")} type="button">
          <span className="brand-mark">S</span>
          <span>SchafPlay</span>
        </button>
        <div className="topbar-actions">
          {navButtons.map(({ title, Icon, onClick }) => (
            <button key={title} className="icon-button" onClick={onClick} title={title} type="button">
              <Icon />
            </button>
          ))}
          <span className={`connection-pill ${role === "solo" ? "solo" : connectionState}`}>
            {role === "solo" ? <BotIcon size={14} /> : connectionState === "connected" ? <WifiIcon /> : <PlugZapIcon />}
            {connectionLabel}
          </span>
        </div>
      </header>
      )}

      {inGame ? (
        <GameBoard
          state={gameState}
          language={language}
          myPlayerId={myPlayerId}
          onAction={session.dispatch}
          onQuit={quitGame}
          onDevSkip={role === "host" || role === "solo" ? session.devSkipTrick : undefined}
          onDevSkipRound={role === "host" || role === "solo" ? session.devSkipRound : undefined}
        />
      ) : screen === "stats" ? (
        <StatsScreen language={language} />
      ) : screen === "analysis" ? (
        <AnalysisScreen language={language} onReplayActiveChange={setReplayActive} />
      ) : screen === "settings" ? (
        <SettingsScreen settings={settings} onChange={updateSetting} />
      ) : (
        <HomeScreen
          language={language}
          playerName={playerName}
          onPlayerNameChange={(value) => updateSetting("playerName", value)}
          connectionState={connectionState}
          humanCount={humanCount}
          onHumanCountChange={(count) => {
            session.quit();
            setHumanCount(count);
          }}
          hostSeats={session.hostSeats}
          onHostPeer={session.attachHostPeer}
          onCancelPairing={cancelPairing}
          onGuestPeer={session.attachGuestPeer}
          totalRounds={totalRounds}
          onTotalRoundsChange={(value) => updateSetting("totalRounds", value)}
          onSoloStart={session.startSolo}
          initialInvite={initialInvite}
        />
      )}

      {needsReconnect && (
        <div className="reconnect-overlay">
          <div className="reconnect-panel">
            <h2>{t.paused}</h2>
            {role === "host" ? (
              <>
                <p className="muted">{t.reconnectHint}</p>
                <HostLobby language={language} count={humanCount} seats={session.hostSeats} onPeer={session.attachHostPeer} />
              </>
            ) : connectionState === "connected" ? (
              <p className="muted" role="status">{t.waitingForReconnect}</p>
            ) : (
              <>
                <p className="muted">{t.reconnectGuestHint}</p>
                <PairingPanel language={language} mode="join" connectionState={connectionState} onPeer={session.attachGuestPeer} />
              </>
            )}
            <button className="secondary-button" onClick={quitGame} type="button">
              {t.quit}
            </button>
          </div>
        </div>
      )}

      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} language={language} />

      {/* Fixed overlays portal here (see OverlayPortal); last, so they stack on top. */}
      <div id={OVERLAY_ROOT_ID} />
    </div>
  );
}
