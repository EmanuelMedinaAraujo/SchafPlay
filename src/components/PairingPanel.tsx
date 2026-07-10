import { useEffect, useRef, useState } from "react";
import { GuestSignaling, HostSignaling } from "../net/Signaling";
import { Transport, TransportState } from "../net/Transport";
import { createWebRTCPeer } from "../net/WebRTCPeer";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { CopyIcon, CheckIcon, LoaderIcon, LinkIcon, ShareIcon } from "./icons";

interface PairingPanelProps {
  language: Language;
  mode: "host" | "join";
  connectionState: TransportState | "idle";
  /** Called with every freshly created transport so the app can attach handlers. */
  onPeer: (peer: Transport) => void;
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
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const peerRef = useRef<(Transport & HostSignaling & GuestSignaling) | null>(null);
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

  async function createHostInvite() {
    const peer = createWebRTCPeer();
    peerRef.current = peer;
    onPeerRef.current(peer);
    try {
      const code = await peer.host();
      if (peerRef.current === peer) setInviteCode(code);
    } catch {
      if (peerRef.current === peer) setError(t.failed);
    }
  }

  // Host: create offer on mount.
  useEffect(() => {
    if (mode !== "host") return;
    createHostInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // A WebRTC session whose handshake failed can never recover — the offer is
  // consumed. When ICE fails, start over: the host mints a fresh invite code,
  // the guest goes back to the paste field.
  const prevStateRef = useRef(connectionState);
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = connectionState;
    if (connectionState !== "failed" || prev === "failed") return;
    setPastedCode("");
    setAccepted(false);
    if (mode === "host") {
      setInviteCode("");
      setError(t.codeExpired);
      createHostInvite();
    } else {
      setReplyCode("");
      setError(t.failed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState, mode]);

  async function hostAcceptReply() {
    const peer = peerRef.current;
    if (!peer || !pastedCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      await peer.acceptAnswer(pastedCode.trim());
      setAccepted(true);
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_CODE") {
        setError(t.invalidCode);
      } else {
        // The answer couldn't be applied (usually a stale reply already
        // consumed the offer). This peer is dead — mint a fresh code.
        setPastedCode("");
        setInviteCode("");
        setError(t.codeExpired);
        createHostInvite();
      }
    } finally {
      setBusy(false);
    }
  }

  async function guestGenerateReply() {
    if (!pastedCode.trim()) return;
    setBusy(true);
    setError("");
    const peer = createWebRTCPeer();
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

  function shareText(text: string) {
    if (navigator.share) {
      navigator.share({
        text: text,
      }).catch(() => undefined);
    } else {
      copyText(text);
    }
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
            <div className="code-row">
              <textarea
                className="input code-textarea"
                readOnly
                value={inviteCode}
                rows={2}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                className="secondary-button"
                onClick={() => copyText(inviteCode)}
                type="button"
                title={copied ? t.copied : t.copy}
                aria-label={copied ? t.copied : t.copy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              <button
                className="secondary-button"
                onClick={() => shareText(inviteCode)}
                type="button"
                title={t.share}
                aria-label={t.share}
              >
                <ShareIcon />
              </button>
            </div>

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

            {accepted && connectionState === "connecting" && (
              <p className="muted pulse-soft">
                <LoaderIcon /> {t.connecting}
              </p>
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
          <div className="code-row">
            <textarea
              className="input code-textarea"
              readOnly
              value={replyCode}
              rows={2}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              className="secondary-button"
              onClick={() => copyText(replyCode)}
              type="button"
              title={copied ? t.copied : t.copy}
              aria-label={copied ? t.copied : t.copy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
            <button
              className="secondary-button"
              onClick={() => shareText(replyCode)}
              type="button"
              title={t.share}
              aria-label={t.share}
            >
              <ShareIcon />
            </button>
          </div>
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
