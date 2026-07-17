import { useMemo } from "react";
import { encodeQR, matrixToSvgPath } from "../lib/qr";

/** Quiet zone width in modules, as the QR spec requires. */
const QUIET = 4;

interface QRCodeViewProps {
  /** Payload text (a pairing code); rendered as a byte-mode QR symbol. */
  data: string;
  /** Accessible name for the symbol. */
  label: string;
}

/**
 * Crisp SVG rendering of a QR code via the in-repo encoder (src/lib/qr.ts).
 * Always dark-on-white regardless of theme — scanners want maximum contrast,
 * and the light quiet zone is part of the symbol.
 */
export default function QRCodeView({ data, label }: QRCodeViewProps) {
  const path = useMemo(() => {
    try {
      const matrix = encodeQR(data);
      return { d: matrixToSvgPath(matrix), size: matrix.length };
    } catch {
      return null; // payload too large for QR — the copy-paste flow still works
    }
  }, [data]);

  if (!path) return null;
  const dim = path.size + QUIET * 2;
  return (
    <svg
      className="qr-code"
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={path.d} fill="#000000" transform={`translate(${QUIET} ${QUIET})`} />
    </svg>
  );
}
