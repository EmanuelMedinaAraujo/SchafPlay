/** Small building blocks shared by the manual's chapters. */

import type { ReactNode } from "react";
import { Language } from "../../lib/i18n";

export interface ChapterProps {
  language: Language;
}

/** A secondary section: closed by default so the basics stay short. */
export function More({ title, tag, children }: { title: ReactNode; tag?: string; children: ReactNode }) {
  return (
    <details className="manual-more">
      <summary>
        <span className="manual-more-title">{title}</span>
        {tag && <span className="manual-more-tag">{tag}</span>}
      </summary>
      <div className="manual-more-body">{children}</div>
    </details>
  );
}

/** A handwritten note pinned to the card: tips and pitfalls. */
export function Note({ kind = "tip", label, children }: { kind?: "tip" | "warn"; label: string; children: ReactNode }) {
  return (
    <aside className={`manual-note is-${kind}`}>
      <span className="manual-note-label">{label}</span>
      <div>{children}</div>
    </aside>
  );
}
