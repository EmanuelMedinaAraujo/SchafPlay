/**
 * Real card art for the rules manual. Presentational only: a card is named
 * by its art file (`<suit>-<rank>.svg`), not a game `Card`, so the manual
 * never depends on the rules it explains.
 */

import type { ReactNode } from "react";
import { Language } from "../../lib/i18n";

export type ManualSuit = "acorns" | "leaves" | "hearts" | "bells";
export type ManualRank = "7" | "8" | "9" | "10" | "u" | "o" | "k" | "a";

/** "acorns-o" style shorthand, matching the art file names. */
export type CardCode = `${ManualSuit}-${ManualRank}`;

export const SUITS: ManualSuit[] = ["acorns", "leaves", "hearts", "bells"];

const SUIT_NAMES: Record<Language, Record<ManualSuit, string>> = {
  de: { acorns: "Eichel", leaves: "Gras", hearts: "Herz", bells: "Schellen" },
  en: { acorns: "Acorns", leaves: "Leaves", hearts: "Hearts", bells: "Bells" },
};

const RANK_NAMES: Record<Language, Record<ManualRank, string>> = {
  de: { "7": "Sieben", "8": "Acht", "9": "Neun", "10": "Zehn", u: "Unter", o: "Ober", k: "König", a: "Sau" },
  en: { "7": "7", "8": "8", "9": "9", "10": "10", u: "Unter", o: "Ober", k: "King", a: "Ace (Sau)" },
};

export function suitName(suit: ManualSuit, language: Language): string {
  return SUIT_NAMES[language][suit];
}

export function cardName(code: CardCode, language: Language): string {
  const [suit, rank] = code.split("-") as [ManualSuit, ManualRank];
  return language === "de" ? `${SUIT_NAMES.de[suit]}-${RANK_NAMES.de[rank]}` : `${SUIT_NAMES.en[suit]} ${RANK_NAMES.en[rank]}`;
}

interface ManualCardProps {
  code: CardCode;
  language: Language;
  /** Short label under the card (Augen, "wins", …). */
  caption?: string;
  /** Small corner mark, e.g. the card's place in the trump order. */
  badge?: string | number;
  /** Marks the card that takes the trick. */
  highlight?: boolean;
  /** Greys the card out (a card the example does not have). */
  dim?: boolean;
}

export default function ManualCard({ code, language, caption, badge, highlight = false, dim = false }: ManualCardProps) {
  const classes = ["manual-card", highlight && "is-highlight", dim && "is-dim"].filter(Boolean).join(" ");
  return (
    <figure className={classes}>
      <span className="manual-card-face">
        <img src={`${import.meta.env.BASE_URL}bavarian-cards/${code}.svg`} alt={cardName(code, language)} draggable={false} />
        {badge !== undefined && <span className="manual-card-badge" aria-hidden="true">{badge}</span>}
      </span>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** A labeled run of cards, e.g. one rung of the trump ladder. */
export function CardGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="manual-card-group">
      {label && <span className="manual-card-group-label">{label}</span>}
      <div className="manual-card-row">{children}</div>
    </div>
  );
}
