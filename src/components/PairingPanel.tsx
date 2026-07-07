import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PeerConnection, PeerConnectionState, generateGameCode, normalizeGameCode } from "../net/PeerConnection";
import { Language } from "../types";
import { translations } from "../lib/i18n";

interface PairingPanelProps {
  language: Language;
  mode: "host" | "join";
  connectionState: PeerConnectionState | "idle";
  /** Called with every freshly created PeerConnection so the app can attach handlers. */
  onPeer: (peer: PeerConnection) => void;
}

/**
 * One-way pairing: the host displays a short game code, the guest types it
 * in. Used on the home screen and for in-game reconnects (same flow, new code).
 */
export default function PairingPanel({ language, mode, connectionState, onPeer }: PairingPanelProps) {
  const t = translations[language];
  const [code, setCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const onPeerRef = useRef(onPeer);
  onPeerRef.current = onPeer;

  // Host: register a code with the broker as soon as the panel shows.
  // Restartable (StrictMode remounts): a superseded run's peer is replaced
  // by the app when the next run hands over a fresh one — never disconnect
  // here, an established game link outlives this panel.
  useEffect(() => {
    if (mode !== "host") return;
    let cancelled = false;
    (async () => {
      // A taken code (or broker hiccup) just means we roll a new one.
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        const nextCode = generateGameCode();
        const peer = new PeerConnection();
        onPeerRef.current(peer);
        try {
          await peer.host(nextCode);
          if (!cancelled) setCode(nextCode);
          return;
        } catch {
          peer.disconnect();
        }
      }
      if (!cancelled) setError(t.failed);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function joinGame() {
    const target = normalizeGameCode(inputCode);
    if (!target) return;
    setBusy(true);
    setError("");
    const peer = new PeerConnection();
    onPeer(peer);
    try {
      await peer.join(target);
    } catch {
      peer.disconnect();
      setError(t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  if (mode === "host") {
    return (
      <div className="pairing-flow">
        <p className="muted">{t.hostIntro}</p>
        {!code && !error && (
          <p className="muted pulse-soft">
            <Loader2 size={16} className="spin" /> {t.creatingCode}
          </p>
        )}
        {code && (
          <>
            <div className="game-code" aria-label={t.yourCode}>
              {code.split("").map((char, index) => (
                <span key={index}>{char}</span>
              ))}
            </div>
            <button className="secondary-button" onClick={copyCode} type="button">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t.copied : t.copy}
            </button>
            {connectionState !== "connected" && <p className="muted pulse-soft">{t.waitingForPeer}</p>}
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pairing-flow">
      <p className="muted">{t.joinIntro}</p>
      <input
        className="input code-input"
        value={inputCode}
        onChange={(event) => setInputCode(normalizeGameCode(event.target.value))}
        onKeyDown={(event) => event.key === "Enter" && !busy && joinGame()}
        placeholder={t.enterCode}
        maxLength={8}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
      />
      <button className="primary-button" onClick={joinGame} disabled={busy || !inputCode.trim()} type="button">
        {busy ? <Loader2 size={18} className="spin" /> : <Link2 size={18} />}
        {t.join}
      </button>
      {busy && <p className="muted pulse-soft">{t.connecting}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
