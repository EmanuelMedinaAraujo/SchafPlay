import { CardValue, Suit } from "../types";

/**
 * Original hand-drawn SVG art for the traditional Bavarian card pattern (#15).
 *
 * Nothing here is copied from a commercial deck — the suit symbols
 * (Eichel/Gras/Herz/Schellen) and the Ober/Unter/König figures are our own
 * stylised take on the centuries-old, public-domain Bayerisches Bild. Drawing
 * them as vectors keeps the PWA offline (no image assets to fetch) and crisp at
 * any card size.
 *
 * Everything is rendered inside one 64×96 viewBox so a single <svg> fills the
 * shared `.card-face` box; suit symbols are authored in a 0..24 unit box and
 * placed with transforms.
 */

interface SuitPalette {
  main: string;
  dark: string;
  accent: string;
}

const SUIT_PALETTE: Record<Suit, SuitPalette> = {
  [Suit.ACORNS]: { main: "#7a4a23", dark: "#4f2f14", accent: "#a07a3c" },
  [Suit.LEAVES]: { main: "#3a8a3d", dark: "#1f5c22", accent: "#6fbf5f" },
  [Suit.HEARTS]: { main: "#cc2b2b", dark: "#8f1b1b", accent: "#ef6a5c" },
  [Suit.BELLS]: { main: "#e0a51e", dark: "#a9740c", accent: "#f6d264" },
};

/** A suit symbol authored in a 0..24 unit box, origin top-left. */
function SuitGlyph({ suit }: { suit: Suit }) {
  const { main, dark, accent } = SUIT_PALETTE[suit];
  switch (suit) {
    case Suit.HEARTS:
      return (
        <g>
          <path
            d="M12 21.5C4.8 15.4 3 10.4 6.6 6.4C9.1 3.7 12 5.6 12 8.2C12 5.6 14.9 3.7 17.4 6.4C21 10.4 19.2 15.4 12 21.5Z"
            fill={main}
          />
          <path
            d="M12 8.2C12 5.6 9.1 3.7 6.6 6.4C4.7 8.5 4.6 11 5.5 13.4C6 9.9 8.4 7.5 12 8.2Z"
            fill={accent}
            opacity="0.5"
          />
        </g>
      );
    case Suit.ACORNS:
      return (
        <g>
          <rect x="11" y="3" width="2" height="4" rx="0.8" fill={dark} />
          <ellipse cx="12" cy="15" rx="5.6" ry="6.9" fill={main} />
          <ellipse cx="10" cy="13.5" rx="1.4" ry="2.4" fill={accent} opacity="0.55" />
          <path d="M5.8 11C5.8 6.4 18.2 6.4 18.2 11C18.2 13.4 5.8 13.4 5.8 11Z" fill={accent} />
          <path d="M6.6 10.2H17.4M7.4 12.2H16.6" stroke={dark} strokeWidth="0.5" opacity="0.5" />
        </g>
      );
    case Suit.LEAVES:
      return (
        <g>
          <path d="M12 22C4.6 17.4 5.6 8 12 2C18.4 8 19.4 17.4 12 22Z" fill={main} />
          <path
            d="M12 2C8.2 6 6.8 12 9 18C7.2 12 8.8 6.5 12 4Z"
            fill={accent}
            opacity="0.5"
          />
          <path d="M12 4V20" stroke={dark} strokeWidth="0.8" />
          <path
            d="M12 8L8.6 6.2M12 8L15.4 6.2M12 12.5L8 10.5M12 12.5L16 10.5M12 16.5L9 15M12 16.5L15 15"
            stroke={dark}
            strokeWidth="0.5"
            opacity="0.7"
          />
        </g>
      );
    case Suit.BELLS:
      return (
        <g>
          <path d="M9.6 7C9.6 4.6 14.4 4.6 14.4 7" fill="none" stroke={dark} strokeWidth="1.5" />
          <circle cx="12" cy="14" r="7" fill={main} />
          <circle cx="9.6" cy="11.4" r="1.9" fill={accent} opacity="0.6" />
          <rect x="6.6" y="15.4" width="10.8" height="1.9" rx="0.9" fill={dark} />
          <circle cx="12" cy="19.4" r="1.1" fill={dark} />
        </g>
      );
  }
}

/** Place a suit glyph at (x,y) scaled so its 24-unit box becomes `size` px. */
function PlacedGlyph({ suit, x, y, size }: { suit: Suit; x: number; y: number; size: number }) {
  const s = size / 24;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}>
      <SuitGlyph suit={suit} />
    </g>
  );
}

/** Court figure (Unter/Ober/König). The suit sits high for Ober/König and low
 * for Unter, echoing the traditional up/down placement that tells them apart. */
function CourtFigure({ suit, rank }: { suit: Suit; rank: CardValue }) {
  const { main, dark, accent } = SUIT_PALETTE[suit];
  const skin = "#e8bd93";
  const isKing = rank === CardValue.KING;
  const isOber = rank === CardValue.OBER;
  const glyphY = rank === CardValue.UNTER ? 60 : 30;

  return (
    <g>
      {/* Robe */}
      <path d="M20 82 L26 42 L38 42 L44 82 Z" fill={main} />
      <path d="M32 42 L32 82" stroke={dark} strokeWidth="1" opacity="0.5" />
      <rect x="25" y="60" width="14" height="3" fill={dark} />
      {/* Cape / shoulders */}
      <path d="M24 44 Q32 34 40 44 L38 49 Q32 44 26 49 Z" fill={dark} />
      {/* Neck + head */}
      <rect x="30" y="35" width="4" height="4" fill={skin} />
      <circle cx="32" cy="30" r="6" fill={skin} />
      <circle cx="30" cy="30" r="0.7" fill={dark} />
      <circle cx="34" cy="30" r="0.7" fill={dark} />
      {/* Headwear per rank */}
      {isKing ? (
        <g>
          <path d="M25 21 L27 13 L30 19 L32 11 L34 19 L37 13 L39 21 Z" fill={accent} stroke={dark} strokeWidth="0.5" />
          <rect x="25" y="21" width="14" height="3" fill={accent} stroke={dark} strokeWidth="0.5" />
          <circle cx="32" cy="22.5" r="1" fill={main} />
        </g>
      ) : isOber ? (
        <g>
          <path d="M23 21 Q32 8 41 21 Z" fill={dark} />
          <ellipse cx="32" cy="21" rx="12" ry="2.6" fill={dark} />
          <path d="M40 20 Q47 11 43 6" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M25 22 Q32 12 39 22 Z" fill={dark} />
          <ellipse cx="32" cy="22" rx="9" ry="2.2" fill={dark} />
        </g>
      )}
      {/* Suit emblem, placed high (Ober/König) or low (Unter) */}
      <PlacedGlyph suit={suit} x={32} y={glyphY} size={18} />
    </g>
  );
}

interface BavarianCardArtProps {
  suit: Suit;
  value: CardValue;
  trump: boolean;
}

const COURT = new Set<CardValue>([CardValue.UNTER, CardValue.OBER, CardValue.KING]);

export default function BavarianCardArt({ suit, value }: BavarianCardArtProps) {
  const { main } = SUIT_PALETTE[suit];
  const isCourt = COURT.has(value);
  // Ace shows a single large suit symbol (the "Sau"); other pip cards show a
  // medium symbol under the rank so the number stays the dominant read.
  const isAce = value === CardValue.ACE;

  return (
    <svg className="bavarian-card-svg" viewBox="0 0 64 96" preserveAspectRatio="xMidYMid meet">
      {/* Corner ranks: top-left upright, bottom-right rotated 180°. */}
      <g fill={main} fontWeight="700" fontFamily="'Georgia', serif">
        <text x="6" y="15" fontSize="13">{value}</text>
      </g>
      <PlacedGlyph suit={suit} x={9.5} y={22} size={11} />

      <g transform="rotate(180 32 48)">
        <text x="6" y="15" fontSize="13" fill={main} fontWeight="700" fontFamily="'Georgia', serif">
          {value}
        </text>
        <PlacedGlyph suit={suit} x={9.5} y={22} size={11} />
      </g>

      {/* Centre motif */}
      {isCourt ? (
        <CourtFigure suit={suit} rank={value} />
      ) : isAce ? (
        <PlacedGlyph suit={suit} x={32} y={50} size={40} />
      ) : (
        <PlacedGlyph suit={suit} x={32} y={54} size={26} />
      )}
    </svg>
  );
}
