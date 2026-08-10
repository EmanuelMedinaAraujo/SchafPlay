import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { XIcon } from "./icons";

/** Camera QR scanning via `getUserMedia` + `jsQR`. */

let supportProbe: Promise<boolean> | null = null;

/** Cached for the session. */
export function detectQrScanSupport(): Promise<boolean> {
  if (!supportProbe) {
    supportProbe = Promise.resolve(
      !!(navigator.mediaDevices?.getUserMedia)
    );
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
 * Fullscreen camera overlay resolving with the first decoded QR code. The
 * stream is torn down on unmount, cancel and successful scan alike.
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
        // Rear camera where available; 720p+ so dense QR codes stay readable.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        let detecting = false;
        intervalId = setInterval(() => {
          if (detecting || cancelled || video.readyState < 2 || !context) return;
          if (video.videoWidth === 0 || video.videoHeight === 0) return;
          detecting = true;
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (!cancelled && code && code.data) {
              onResultRef.current(code.data);
            }
          } catch (err) {
            console.error("QR Scanner capture/detection error:", err);
          } finally {
            detecting = false;
          }
        }, 250);
      } catch (err) {
        console.error("Failed to acquire camera stream:", err);
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
