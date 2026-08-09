import { useEffect, useRef, useState } from "react";
import { GuestSignaling, HostSignaling } from "../net/Signaling";
import { Transport, TransportState } from "../net/Transport";
import { createWebRTCPeer } from "../net/WebRTCPeer";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { CopyIcon, CheckIcon, LoaderIcon, LinkIcon, ShareIcon, QrCodeIcon, ScanIcon, XIcon, PasteIcon } from "./icons";
import QRCodeView from "./QRCodeView";
import QRScanner, { detectQrScanSupport } from "./QRScanner";

type Strings = (typeof translations)[Language];

interface PairingPanelProps {
  language: Language;
  mode: "host" | "join";
  connectionState: TransportState | "idle";
  /** Called with every freshly created transport so the app can attach handlers. */
  onPeer: (peer: Transport) => void;
  /** Guest-only: a deep-link (`#invite=…`) code, processed automatically on mount. */
  initialInvite?: string;
}

/** Read-only code display with copy / share / show-QR actions. */
function CodeDisplayRow({ value, t, onShowQr }: { value: string; t: Strings; onShowQr: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyText() {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => undefined);
  }

  function shareText() {
    if (navigator.share) {
      navigator.share({ text: value }).catch(() => undefined);
    } else {
      copyText();
    }
  }

  return (
    <div className="code-row">
      <textarea
        className="input code-textarea"
        readOnly
        value={value}
        rows={2}
        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
      />
      <button
        className="secondary-button"
        onClick={copyText}
        type="button"
        title={copied ? t.copied : t.copy}
        aria-label={copied ? t.copied : t.copy}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <button className="secondary-button" onClick={shareText} type="button" title={t.share} aria-label={t.share}>
        <ShareIcon />
      </button>
      <button className="secondary-button" onClick={onShowQr} type="button" title={t.showQr} aria-label={t.showQr}>
        <QrCodeIcon />
      </button>
    </div>
  );
}

/** Editable paste field with clipboard-paste and (where supported) QR-scan actions. */
function PasteCodeRow({
  value,
  placeholder,
  onChange,
  t,
  scanTitle,
  onScan,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  t: Strings;
  /** Undefined hides the scan button (camera unsupported). */
  scanTitle?: string;
  onScan: () => void;
}) {
  function pasteFromClipboard() {
    navigator.clipboard
      ?.readText()
      .then((text) => {
        if (text) onChange(text.trim());
      })
      .catch(() => undefined);
  }

  return (
    <div className="code-row">
      <textarea
        className="input code-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
      />
      <button className="secondary-button" onClick={pasteFromClipboard} type="button" title={t.paste} aria-label={t.paste}>
        <PasteIcon />
      </button>
      {scanTitle && (
        <button className="secondary-button" onClick={onScan} type="button" title={scanTitle} aria-label={scanTitle}>
          <ScanIcon />
        </button>
      )}
    </div>
  );
}

/** Fullscreen QR modal; clicking the backdrop or the X closes it. */
function QrPopup({ data, label, t, onClose }: { data: string; label: string; t: Strings; onClose: () => void }) {
  return (
    <div className="qr-popup-overlay" role="dialog" aria-label={t.showQr} onClick={onClose}>
      <div className="qr-popup-box" onClick={(e) => e.stopPropagation()}>
        <button className="qr-popup-close" onClick={onClose} type="button" aria-label={t.cancel}>
          <XIcon size={20} />
        </button>
        <QRCodeView data={data} label={label} />
      </div>
    </div>
  );
}

/** Two-way copy-paste pairing via compressed SDP blobs. */
export default function PairingPanel({ language, mode, connectionState, onPeer, initialInvite }: PairingPanelProps) {
  const t = translations[language];
  const [inviteCode, setInviteCode] = useState("");
  const [replyCode, setReplyCode] = useState("");
  const [pastedCode, setPastedCode] = useState(initialInvite?.trim() ?? "");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  // QR scanning needs a camera; QR *display* is always available (#7).
  const [scanSupported, setScanSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showingQrModal, setShowingQrModal] = useState(false);
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

  // Feature-detect QR scanning once; the scan buttons stay hidden otherwise.
  useEffect(() => {
    let alive = true;
    detectQrScanSupport().then((ok) => {
      if (alive) setScanSupported(ok);
    });
    return () => {
      alive = false;
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

  // A failed handshake can never recover — the offer is consumed. Start over.
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

  async function hostAcceptReply(codeArg?: string) {
    const peer = peerRef.current;
    const code = (codeArg ?? pastedCode).trim();
    if (!peer || !code) return;
    setPastedCode(code);
    setBusy(true);
    setError("");
    try {
      await peer.acceptAnswer(code);
      setAccepted(true);
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_CODE") {
        setError(t.invalidCode);
      } else {
        // Usually a stale reply already consumed the offer. Mint a fresh code.
        setPastedCode("");
        setInviteCode("");
        setError(t.codeExpired);
        createHostInvite();
      }
    } finally {
      setBusy(false);
    }
  }

  async function guestGenerateReply(codeArg?: string) {
    const code = (codeArg ?? pastedCode).trim();
    if (!code) return;
    setBusy(true);
    setError("");
    const peer = createWebRTCPeer();
    peerRef.current = peer;
    onPeer(peer);
    try {
      const reply = await peer.join(code);
      setReplyCode(reply);
    } catch {
      peer.disconnect();
      setError(t.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  // Deep-link join: same path as a pasted code, including its error UI.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (mode !== "join" || autoSubmittedRef.current) return;
    const code = initialInvite?.trim();
    if (!code) return;
    autoSubmittedRef.current = true;
    guestGenerateReply(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
            <CodeDisplayRow value={inviteCode} t={t} onShowQr={() => setShowingQrModal(true)} />

            {connectionState !== "connected" && (
              <>
                <label className="field-label">{t.pasteReply}</label>
                <PasteCodeRow
                  value={pastedCode}
                  onChange={setPastedCode}
                  placeholder={t.pasteReplyHint}
                  t={t}
                  scanTitle={scanSupported ? t.scanReplyQr : undefined}
                  onScan={() => setScanning(true)}
                />
                <button
                  className="primary-button"
                  onClick={() => hostAcceptReply()}
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

        {scanning && (
          <QRScanner
            language={language}
            onResult={(code) => {
              setScanning(false);
              hostAcceptReply(code);
            }}
            onClose={() => setScanning(false)}
          />
        )}

        {showingQrModal && <QrPopup data={inviteCode} label={t.inviteCode} t={t} onClose={() => setShowingQrModal(false)} />}
      </div>
    );
  }

  // --- GUEST MODE ---
  return (
    <div className="pairing-flow">
      {!replyCode && (
        <>
          <label className="field-label">{t.pasteInvite}</label>
          <PasteCodeRow
            value={pastedCode}
            onChange={setPastedCode}
            placeholder={t.pasteInviteHint}
            t={t}
            scanTitle={scanSupported ? t.scanInviteQr : undefined}
            onScan={() => setScanning(true)}
          />
          <button
            className="primary-button"
            onClick={() => guestGenerateReply()}
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
          <CodeDisplayRow value={replyCode} t={t} onShowQr={() => setShowingQrModal(true)} />
        </>
      )}

      {connectionState === "connected" && (
        <p className="muted" style={{ color: "var(--green)" }}>✓ {t.connected}</p>
      )}

      {busy && <p className="muted pulse-soft">{t.connecting}</p>}
      {error && <p className="error-text">{error}</p>}

      {scanning && (
        <QRScanner
          language={language}
          onResult={(code) => {
            setScanning(false);
            setPastedCode(code);
            guestGenerateReply(code);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {showingQrModal && <QrPopup data={replyCode} label={t.replyCode} t={t} onClose={() => setShowingQrModal(false)} />}
    </div>
  );
}
