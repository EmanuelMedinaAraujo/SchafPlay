import { useEffect, useRef, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { XIcon } from "./icons";

/**
 * Camera QR scanning via `getUserMedia` + the native `BarcodeDetector` API —
 * no scanning library. Chromium-family browsers support it; everywhere else
 * `detectQrScanSupport()` resolves false and the pairing UI simply never
 * offers the scan button (the copy-paste flow is always available).
 */

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

function getBarcodeDetector(): BarcodeDetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

let supportProbe: Promise<boolean> | null = null;

/**
 * True when this device can scan QR codes: camera API present and the
 * BarcodeDetector actually lists `qr_code` (some desktop builds expose the
 * constructor but support no formats). Result is cached for the session.
 */
export function detectQrScanSupport(): Promise<boolean> {
  if (!supportProbe) {
    supportProbe = (async () => {
      try {
        const Detector = getBarcodeDetector();
        if (!Detector || !navigator.mediaDevices?.getUserMedia) return false;
        const formats = await Detector.getSupportedFormats();
        return formats.includes("qr_code");
      } catch {
        return false;
      }
    })();
  }
  return supportProbe;
}

interface QRScannerProps {
  language: Language;
  /** Fired once with the decoded text of the first QR code seen. */
  onResult: (text: string) => void;
  onClose: () => void;
}

/**
 * Fullscreen camera overlay that resolves with the first decoded QR code.
 * The stream is torn down (all tracks stopped) on unmount, cancel and
 * successful scan alike.
 */
export default function QRScanner({ language, onResult, onClose }: QRScannerProps) {
  const t = translations[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const Detector = getBarcodeDetector();
        if (!Detector) throw new Error("unsupported");
        const detector = new Detector({ formats: ["qr_code"] });
        // Prefer the rear camera on phones; laptops fall back to whatever exists.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        let detecting = false;
        intervalId = setInterval(async () => {
          if (detecting || cancelled || video.readyState < 2) return;
          detecting = true;
          try {
            const codes = await detector.detect(video);
            if (!cancelled && codes.length > 0 && codes[0].rawValue) {
              onResultRef.current(codes[0].rawValue);
            }
          } catch {
            // A single failed detection pass is not fatal — keep polling.
          } finally {
            detecting = false;
          }
        }, 250);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return (
    <div className="qr-scanner-overlay" role="dialog" aria-label={t.scanQrTitle}>
      <div className="qr-scanner-box">
        <video ref={videoRef} className="qr-scanner-video" playsInline muted />
        <div className="qr-scanner-frame" aria-hidden="true" />
      </div>
      {!error && <p className="muted qr-scanner-hint">{t.scanQrHint}</p>}
      {error && <p className="error-text">{t.cameraError}</p>}
      <button className="secondary-button qr-scanner-cancel" onClick={onClose} type="button">
        <XIcon size={16} /> {t.cancel}
      </button>
    </div>
  );
}
