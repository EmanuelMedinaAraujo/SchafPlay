import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeViewProps {
  /** Payload text (a pairing code); rendered as a byte-mode QR symbol. */
  data: string;
  /** Accessible name for the symbol. */
  label: string;
}

/**
 * Crisp rendering of a QR code via the standard qrcode library.
 * Always dark-on-white regardless of theme — scanners want maximum contrast,
 * and the light quiet zone is part of the symbol.
 */
export default function QRCodeView({ data, label }: QRCodeViewProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(data, {
      margin: 4,
      errorCorrectionLevel: "L",
    })
      .then((url) => {
        setDataUrl(url);
      })
      .catch((err) => {
        console.error("QR Code generation failed", err);
      });
  }, [data]);

  if (!dataUrl) {
    // Return a placeholder of the same size to prevent layout shifts while loading
    return <div className="qr-code" style={{ opacity: 0 }} />;
  }

  return (
    <img
      src={dataUrl}
      className="qr-code"
      alt={label}
    />
  );
}
