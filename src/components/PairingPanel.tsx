import { useEffect, useRef, useState } from "react";
import { PeerConnection, PeerConnectionState } from "../net/PeerConnection";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { CopyIcon, CheckIcon, LoaderIcon, LinkIcon } from "./icons";

interface PairingPanelProps {
  language: Language;
  mode: "host" | "join";
  connectionState: PeerConnectionState | "idle";
  /** Called with every freshly created PeerConnection so the app can attach handlers. */
  onPeer: (peer: PeerConnection) => void;
}

/**
 * Two-way copy-paste pairing via compressed SDP blobs.
 *
 * Host flow:
 *   1. On mount, creates a PeerConnection, generates an invite code.
 *   2. Displays invite code for copying.
 *   3. Waits for user to paste the guest's reply code, then calls acceptAnswer().
 *
 * Guest flow:
 *   1. User pastes the host's invite code.
 *   2. Clicks "Generate reply" → generates reply code.
 *   3. Displays reply code for copying. Connection completes once host pastes it.
 */
export default function PairingPanel({ language, mode, connectionState, onPeer }: PairingPanelProps) {
  const t = translations[language];
  const [inviteCode, setInviteCode] = useState("");
  const [replyCode, setReplyCode] = useState("");
  const [pastedCode, setPastedCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const peerRef = useRef<PeerConnection | null>(null);
  const onPeerRef = useRef(onPeer);
  onPeerRef.current = onPeer;

  // Clean up unconnected peer on unmount
  useEffect(() => {
    return () => {
      if (peerRef.current && !peerRef.current.isConnected()) {
        peerRef.current.disconnect();
      }
    };
  }, []);

  // Host: create offer on mount.
  useEffect(() => {
    if (mode !== "host") return;
    let cancelled = false;
    (async () => {
      const peer = new PeerConnection();
      peerRef.current = peer;
      onPeerRef.current(peer);
      try {
        const code = await peer.host();
        if (!cancelled) setInviteCode(code);
      } catch {
        if (!cancelled) setError(t.failed);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function hostAcceptReply() {
    const peer = peerRef.current;
    if (!peer || !pastedCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      await peer.acceptAnswer(pastedCode.trim());
    } catch {
      setError(t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  async function guestGenerateReply() {
    if (!pastedCode.trim()) return;
    setBusy(true);
    setError("");
    const peer = new PeerConnection();
    peerRef.current = peer;
    onPeer(peer);
    try {
      const reply = await peer.join(pastedCode.trim());
      setReplyCode(reply);
    } catch {
      peer.disconnect();
      setError(t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  if (mode === "host") {
    return (
      <div className="pairing-flow">
        {!inviteCode && !error && (
          <p className="muted pulse-soft">
            <LoaderIcon /> {t.creatingCode}
          </p>
        )}

        {inviteCode && (
          <>
            <label className="field-label">{t.inviteCode}</label>
            <textarea
              className="input code-textarea"
              readOnly
              value={inviteCode}
              rows={2}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button className="secondary-button" onClick={() => copyText(inviteCode)} type="button">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t.copied : t.copy}
            </button>

            {connectionState !== "connected" && (
              <>
                <label className="field-label">{t.pasteReply}</label>
                <textarea
                  className="input code-textarea"
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  placeholder={t.pasteReplyHint}
                  rows={2}
                />
                <button
                  className="primary-button"
                  onClick={hostAcceptReply}
                  disabled={busy || !pastedCode.trim()}
                  type="button"
                >
                  {busy ? <LoaderIcon /> : <LinkIcon />}
                  {t.connect}
                </button>
              </>
            )}

            {connectionState === "connected" && (
              <p className="muted" style={{ color: "var(--green)" }}>✓ {t.connected}</p>
            )}
          </>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>
    );
  }

  // --- GUEST MODE ---
  return (
    <div className="pairing-flow">
      {!replyCode && (
        <>
          <label className="field-label">{t.pasteInvite}</label>
          <textarea
            className="input code-textarea"
            value={pastedCode}
            onChange={(e) => setPastedCode(e.target.value)}
            placeholder={t.pasteInviteHint}
            rows={2}
          />
          <button
            className="primary-button"
            onClick={guestGenerateReply}
            disabled={busy || !pastedCode.trim()}
            type="button"
          >
            {busy ? <LoaderIcon /> : <LinkIcon />}
            {t.generateReply}
          </button>
        </>
      )}

      {replyCode && (
        <>
          <label className="field-label">{t.replyCode}</label>
          <textarea
            className="input code-textarea"
            readOnly
            value={replyCode}
            rows={2}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
          <button className="secondary-button" onClick={() => copyText(replyCode)} type="button">
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? t.copied : t.copy}
          </button>
        </>
      )}

      {connectionState === "connected" && (
        <p className="muted" style={{ color: "var(--green)" }}>✓ {t.connected}</p>
      )}

      {busy && <p className="muted pulse-soft">{t.connecting}</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
