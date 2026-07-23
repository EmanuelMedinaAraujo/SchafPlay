import { useEffect, useState } from "react";
import GameBoard from "./components/GameBoard";
import HomeScreen from "./components/HomeScreen";
import PairingPanel from "./components/PairingPanel";
import RulesModal from "./components/RulesModal";
import SettingsScreen from "./components/SettingsScreen";
import StatsScreen from "./components/StatsScreen";
import { useGameSession } from "./session/useGameSession";
import { PlayerActionType } from "./types";
import { translations } from "./lib/i18n";
import { useSettings } from "./lib/settings";
import { BookOpenIcon, BotIcon, ChartColumnIcon, HomeIcon, PlugZapIcon, SettingsIcon, WifiIcon } from "./components/icons";

/**
 * Deep-link join (#7, Option A): read an invite code from the URL fragment
 * (`…#invite=<code>`). Returns "" when absent. The code is an opaque string
 * that was percent-encoded when the host copied the link.
 */
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
  const { language, playerName, avatar, totalRounds, disableLaufende, enableRamsch, enableStoss, lastMode } = settings;
  const [screen, setScreen] = useState<"home" | "game" | "stats" | "settings">("home");
  const [rulesOpen, setRulesOpen] = useState(false);
  // Captured once at startup, before we scrub the fragment below. Reading the
  // hash is synchronous and independent of the service-worker update check in
  // main.tsx, so nothing can race away the invite before we see it.
  const [initialInvite] = useState(readInviteFromHash);

  const session = useGameSession({
    getPlayerName: () => playerName,
    getPlayerAvatar: () => avatar,
    getTotalRounds: () => totalRounds,
    getDisableLaufende: () => disableLaufende,
    getEnableRamsch: () => enableRamsch,
    getEnableStoss: () => enableStoss,
    onEnterGame: () => setScreen("game"),
  });
  const { gameState, connectionState, role, myPlayerId } = session;

  // Strip the `#invite=…` fragment once we've captured it so a reload doesn't
  // re-trigger a stale invite. Uses replaceState (no navigation / history entry).
  useEffect(() => {
    if (!initialInvite) return;
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      // Ignore — a lingering fragment is harmless (it's only read on startup).
    }
  }, [initialInvite]);

  // Landscape-only UI: on portrait screens the whole app is rotated 90°
  // via CSS (html.rotated). html.compact / html.narrow drive the phone
  // layout based on the *effective* landscape height/width, which media
  // queries can't see once the UI is rotated.
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

  // In-game the whole UI fits the viewport; page scrolling is disabled and
  // only the game screen itself may scroll if it genuinely doesn't fit.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("in-game", screen === "game");
    return () => root.classList.remove("in-game");
  }, [screen]);

  const t = translations[language];

  function handleReady() {
    session.dispatch({ type: PlayerActionType.READY_NEXT, playerId: myPlayerId });
  }

  function quitGame() {
    session.quit();
    setScreen("home");
  }

  const inGame = screen === "game" && gameState;
  // Keep the overlay up during the whole re-pairing flow ("connecting"
  // included) — it only closes once the peer is actually back.
  const needsReconnect = Boolean(inGame && role !== "solo" && connectionState !== "connected");

  return (
    <div className="app-shell">
      {/* The header is hidden in-game to free up vertical space (#26); the
          in-game toolbar carries the contract, round and quit controls. */}
      {!inGame && (
      <header className="topbar">
        <button className="brand" onClick={() => !inGame && setScreen("home")} type="button">
          <span className="brand-mark">S</span>
          <span>SchafPlay</span>
        </button>
        <div className="topbar-actions">
          {!inGame && (
            <>
              <button className="icon-button" onClick={() => setScreen("home")} title={t.home} type="button">
                <HomeIcon />
              </button>
              <button className="icon-button" onClick={() => setScreen("stats")} title={t.stats} type="button">
                <ChartColumnIcon />
              </button>
              <button className="icon-button" onClick={() => setScreen("settings")} title={t.settings} type="button">
                <SettingsIcon />
              </button>
            </>
          )}
          <button className="icon-button" onClick={() => setRulesOpen(true)} title={t.rules} type="button">
            <BookOpenIcon />
          </button>
          <span className={`connection-pill ${role === "solo" ? "solo" : connectionState}`}>
            {role === "solo" ? <BotIcon size={14} /> : connectionState === "connected" ? <WifiIcon /> : <PlugZapIcon />}
            {role === "solo" && inGame
              ? t.soloOffline
              : connectionState === "connected"
                ? t.connected
                : connectionState === "connecting"
                  ? t.connecting
                  : connectionState === "idle"
                    ? "—"
                    : t.disconnected}
          </span>
        </div>
      </header>
      )}

      {!inGame && screen === "stats" ? (
        <StatsScreen language={language} />
      ) : !inGame && screen === "settings" ? (
        <SettingsScreen
          language={language}
          onLanguageChange={(value) => updateSetting("language", value)}
          avatar={avatar}
          onAvatarChange={(value) => updateSetting("avatar", value)}
          disableLaufende={disableLaufende}
          onDisableLaufendeChange={(value) => updateSetting("disableLaufende", value)}
          enableRamsch={enableRamsch}
          onEnableRamschChange={(value) => updateSetting("enableRamsch", value)}
          enableStoss={enableStoss}
          onEnableStossChange={(value) => updateSetting("enableStoss", value)}
        />
      ) : !inGame ? (
        <HomeScreen
          language={language}
          playerName={playerName}
          onPlayerNameChange={(value) => updateSetting("playerName", value)}
          connectionState={connectionState}
          onHostPeer={session.attachHostPeer}
          onGuestPeer={session.attachGuestPeer}
          totalRounds={totalRounds}
          onTotalRoundsChange={(value) => updateSetting("totalRounds", value)}
          onSoloStart={session.startSolo}
          lastMode={lastMode}
          onLastModeChange={(value) => updateSetting("lastMode", value)}
          initialInvite={initialInvite}
        />
      ) : (
        <GameBoard
          state={gameState}
          language={language}
          myPlayerId={myPlayerId}
          onAction={session.dispatch}
          onReady={handleReady}
          onQuit={quitGame}
          onDevSkip={role === "host" || role === "solo" ? session.devSkipTrick : undefined}
          onDevSkipRound={role === "host" || role === "solo" ? session.devSkipRound : undefined}
        />
      )}

      {needsReconnect && (
        <div className="reconnect-overlay">
          <div className="reconnect-panel">
            <h2>{t.paused}</h2>
            <p className="muted">{t.reconnectHint}</p>
            <PairingPanel
              key={`reconnect-${role}`}
              language={language}
              mode={role === "guest" ? "join" : "host"}
              connectionState={connectionState}
              onPeer={role === "guest" ? session.attachGuestPeer : session.attachHostPeer}
            />
            <button className="secondary-button" onClick={quitGame} type="button">
              {t.quit}
            </button>
          </div>
        </div>
      )}

      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} language={language} />
    </div>
  );
}
