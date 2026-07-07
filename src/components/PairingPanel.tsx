import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { PeerConnection, PeerConnectionState } from "../net/PeerConnection";
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
 * Copy-paste WebRTC signaling flow, used on the home screen and for
 * in-game reconnects (the flow is identical: new codes, same game).
 */
export default function PairingPanel({ language, mode, connectionState, onPeer }: PairingPanelProps) {
  const t = translations[language];
  const [peer, setPeer] = useState<PeerConnection | null>(null);
  const [myCode, setMyCode] = useState("");
  const [theirCode, setTheirCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [awaitingPeer, setAwaitingPeer] = useState(false);

  async function generateOffer() {
    setBusy(true);
    setError("");
    try {
      const next = new PeerConnection(true);
      onPeer(next);
      setPeer(next);
      setMyCode(await next.createOffer());
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function acceptOffer() {
    setBusy(true);
    setError("");
    try {
      const next = new PeerConnection(false);
      onPeer(next);
      setPeer(next);
      setMyCode(await next.acceptOffer(theirCode));
      setAwaitingPeer(true);
    } catch {
      setError(t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  async function completeConnection() {
    if (!peer) return;
    setBusy(true);
    setError("");
    try {
      await peer.completeConnection(theirCode);
      setAwaitingPeer(true);
    } catch {
      setError(t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    navigator.clipboard
      ?.writeText(myCode)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  const connecting = connectionState === "connecting" || awaitingPeer;

  if (mode === "host") {
    return (
      <div className="pairing-flow">
        <p className="muted">{t.hostIntro}</p>
        {!myCode && (
          <button className="primary-button" onClick={generateOffer} disabled={busy} type="button">
            {busy ? <Loader2 size={18} className="spin" /> : <Link2 size={18} />}
            {t.generateOffer}
          </button>
        )}
        {myCode && (
          <>
            <label className="field-label">{t.offerCode}</label>
            <textarea className="code-box" readOnly value={myCode} onFocus={(event) => event.target.select()} />
            <button className="secondary-button" onClick={copyCode} type="button">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t.copied : t.copy}
            </button>
            <label className="field-label">{t.pasteAnswer}</label>
            <textarea
              className="code-box"
              value={theirCode}
              onChange={(event) => setTheirCode(event.target.value)}
              placeholder={t.pasteAnswer}
            />
            <button className="primary-button" onClick={completeConnection} disabled={busy || !theirCode.trim()} type="button">
              {busy ? <Loader2 size={18} className="spin" /> : <Link2 size={18} />}
              {t.completeConnection}
            </button>
          </>
        )}
        {connecting && connectionState !== "connected" && <p className="muted pulse">{t.waitingForPeer}</p>}
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  return (
    <div className="pairing-flow">
      <p className="muted">{t.joinIntro}</p>
      {!myCode && (
        <>
          <textarea
            className="code-box"
            value={theirCode}
            onChange={(event) => setTheirCode(event.target.value)}
            placeholder={t.pasteOffer}
          />
          <button className="primary-button" onClick={acceptOffer} disabled={busy || !theirCode.trim()} type="button">
            {busy ? <Loader2 size={18} className="spin" /> : <Link2 size={18} />}
            {t.acceptOffer}
          </button>
        </>
      )}
      {myCode && (
        <>
          <label className="field-label">{t.answerCode}</label>
          <textarea className="code-box" readOnly value={myCode} onFocus={(event) => event.target.select()} />
          <button className="secondary-button" onClick={copyCode} type="button">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t.copied : t.copy}
          </button>
        </>
      )}
      {connecting && connectionState !== "connected" && <p className="muted pulse">{t.waitingForPeer}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
