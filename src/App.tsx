import { useEffect, useRef, useState } from "react";
import GameBoard from "./components/GameBoard";
import HomeScreen from "./components/HomeScreen";
import PairingPanel from "./components/PairingPanel";
import RulesModal from "./components/RulesModal";
import { GameEngine } from "./engine/GameEngine";
import { PeerConnection, PeerConnectionState } from "./net/PeerConnection";
import { createMessage } from "./net/protocol";
import { GameState, Language, P2PMessageType, PlayerAction, PlayerActionType } from "./types";
import { translations } from "./lib/i18n";

const NAME_KEY = "schafplay.name";
const LANG_KEY = "schafplay.language";

/** Inline SVG icons — replaces lucide-react */
const BookOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);
const LanguagesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
  </svg>
);
const WifiIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);
const PlugZapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" /><path d="m2 22 3-3" /><path d="M7.5 13.5 10 11" /><path d="M10.5 16.5 13 14" /><path d="m18 3-4 4h6l-4 4" />
  </svg>
);

export default function App() {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem(LANG_KEY) as Language) || "de");
  const [playerName, setPlayerName] = useState(() => localStorage.getItem(NAME_KEY) || "Bazi");
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [role, setRole] = useState<"host" | "guest" | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionState, setConnectionState] = useState<PeerConnectionState | "idle">("idle");
  const [rulesOpen, setRulesOpen] = useState(false);

  const engineRef = useRef<GameEngine | null>(null);
  const peerRef = useRef<PeerConnection | null>(null);
  const nameRef = useRef(playerName);
  nameRef.current = playerName;

  useEffect(() => {
    localStorage.setItem(NAME_KEY, playerName);
  }, [playerName]);

  // Landscape-only UI: on portrait screens the whole app is rotated 90°
  // via CSS (html.rotated). html.compact drives the one-screen phone layout
  // based on the *effective* height, which media queries can't see once
  // the UI is rotated.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const effectiveHeight = portrait ? window.innerWidth : window.innerHeight;
      root.classList.toggle("rotated", portrait);
      root.classList.toggle("compact", effectiveHeight <= 520);
    };
    update();
    window.addEventListener("resize", update);
    // iOS can rotate without a (timely) resize event.
    const orientation = window.matchMedia("(orientation: portrait)");
    orientation.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      orientation.removeEventListener("change", update);
      root.classList.remove("rotated", "compact");
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, language);
  }, [language]);

  const t = translations[language];
  const myPlayerId = role === "guest" ? "p3" : "p1";

  function sendGuestState() {
    const engine = engineRef.current;
    const peer = peerRef.current;
    if (!engine || !peer) return;
    try {
      peer.send(createMessage(P2PMessageType.GAME_STATE_UPDATE, { state: engine.getRedactedState("p3") }));
    } catch {
      // Channel not open (yet / anymore); the next state change will retry.
    }
  }

  /**
   * Host side. The engine is created once and survives reconnects —
   * attaching a fresh PeerConnection resumes the same game.
   */
  function attachHostPeer(peer: PeerConnection) {
    peerRef.current?.disconnect();
    peerRef.current = peer;
    setRole("host");

    if (!engineRef.current) {
      const engine = new GameEngine(nameRef.current);
      engineRef.current = engine;
      engine.onStateChange((state) => {
        setGameState(state);
        sendGuestState();
      });
    }

    peer.onConnectionStateChange((state) => {
      setConnectionState(state);
      const engine = engineRef.current;
      if (!engine) return;
      if (state === "connected") {
        setScreen("game");
        if (engine.getState().status === "LOBBY") {
          engine.dealCards();
        } else {
          engine.resume();
          sendGuestState();
        }
      }
      if (state === "disconnected" || state === "failed") {
        engine.pause();
      }
    });

    peer.onMessage((message) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (message.type === P2PMessageType.PLAYER_ACTION) {
        const action = (message.payload as { action: PlayerAction }).action;
        // The guest is always seat 3 — never trust the id on the wire.
        engine.processAction({ ...action, playerId: "p3" });
      }
      if (message.type === P2PMessageType.CONNECTION_ACK) {
        const name = (message.payload as { name?: string })?.name;
        if (name) engine.setGuestName(name);
      }
    });
  }

  /** Guest side: thin client rendering the host's redacted state. */
  function attachGuestPeer(peer: PeerConnection) {
    peerRef.current?.disconnect();
    peerRef.current = peer;
    setRole("guest");

    peer.onConnectionStateChange((state) => {
      setConnectionState(state);
      if (state === "connected") {
        setScreen("game");
        try {
          peer.send(createMessage(P2PMessageType.CONNECTION_ACK, { name: nameRef.current }));
        } catch {
          // Ignore; host falls back to a default name.
        }
      }
    });

    peer.onMessage((message) => {
      if (message.type === P2PMessageType.GAME_STATE_UPDATE) {
        setGameState((message.payload as { state: GameState }).state);
      }
    });
  }

  function handleAction(action: PlayerAction) {
    if (role === "host") {
      engineRef.current?.processAction(action);
      return;
    }
    try {
      peerRef.current?.send(createMessage(P2PMessageType.PLAYER_ACTION, { action }));
    } catch {
      // Disconnected; the reconnect overlay is already showing.
    }
  }

  function handleReady() {
    handleAction({ type: PlayerActionType.READY_NEXT, playerId: myPlayerId });
  }

  function quitGame() {
    peerRef.current?.disconnect();
    peerRef.current = null;
    engineRef.current?.destroy();
    engineRef.current = null;
    setGameState(null);
    setRole(null);
    setConnectionState("idle");
    setScreen("home");
  }

  const inGame = screen === "game" && gameState;
  // Keep the overlay up during the whole re-pairing flow ("connecting"
  // included) — it only closes once the peer is actually back.
  const needsReconnect = Boolean(inGame && connectionState !== "connected");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => !inGame && setScreen("home")} type="button">
          <span className="brand-mark">S</span>
          <span>SchafPlay</span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setRulesOpen(true)} title={t.rules} type="button">
            <BookOpenIcon />
          </button>
          <button className="text-button" onClick={() => setLanguage(language === "de" ? "en" : "de")} type="button">
            <LanguagesIcon />
            {language.toUpperCase()}
          </button>
          <span className={`connection-pill ${connectionState}`}>
            {connectionState === "connected" ? <WifiIcon /> : <PlugZapIcon />}
            {connectionState === "connected"
              ? t.connected
              : connectionState === "connecting"
                ? t.connecting
                : connectionState === "idle"
                  ? "—"
                  : t.disconnected}
          </span>
        </div>
      </header>

      {!inGame ? (
        <HomeScreen
          language={language}
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          connectionState={connectionState}
          onHostPeer={attachHostPeer}
          onGuestPeer={attachGuestPeer}
        />
      ) : (
        <GameBoard
          state={gameState}
          language={language}
          myPlayerId={myPlayerId}
          onAction={handleAction}
          onReady={handleReady}
          onQuit={quitGame}
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
              onPeer={role === "guest" ? attachGuestPeer : attachHostPeer}
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
