import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Language } from "../lib/i18n";
import { XIcon } from "./icons";
import { CardsChapter, OverviewChapter, TrumpsChapter } from "./manual/ManualBasics";
import { GamesChapter, RoundChapter } from "./manual/ManualRound";
import { GlossaryChapter, ScoringChapter } from "./manual/ManualScoring";
import { ChapterProps } from "./manual/parts";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

interface Chapter {
  id: string;
  title: Record<Language, string>;
  Body: (props: ChapterProps) => ReactNode;
}

/** In reading order: each chapter ends with a button to the next one. */
const CHAPTERS: Chapter[] = [
  { id: "overview", title: { de: "Überblick", en: "Overview" }, Body: OverviewChapter },
  { id: "cards", title: { de: "Die Karten", en: "The cards" }, Body: CardsChapter },
  { id: "trumps", title: { de: "Trumpf", en: "Trumps" }, Body: TrumpsChapter },
  { id: "round", title: { de: "Eine Runde", en: "A round" }, Body: RoundChapter },
  { id: "games", title: { de: "Die Spiele", en: "Game types" }, Body: GamesChapter },
  { id: "scoring", title: { de: "Abrechnung", en: "Scoring" }, Body: ScoringChapter },
  { id: "glossary", title: { de: "Wörterbuch", en: "Glossary" }, Body: GlossaryChapter },
];

/** Reopening the manual (e.g. mid-game) returns to the chapter last read. */
let lastChapter = 0;

export default function RulesModal({ isOpen, onClose, language }: RulesModalProps) {
  if (!isOpen) return null;
  return <Manual onClose={onClose} language={language} />;
}

function Manual({ onClose, language }: Omit<RulesModalProps, "isOpen">) {
  const de = language === "de";
  const [active, setActive] = useState(lastChapter);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const select = (index: number, focus = false) => {
    lastChapter = index;
    setActive(index);
    if (focus) tabRefs.current[index]?.focus();
  };

  // Move focus into the dialog so arrow keys and screen readers start on the chapter list.
  useEffect(() => {
    tabRefs.current[lastChapter]?.focus({ preventScroll: true });
  }, []);

  // A new chapter starts at its top.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [active]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = CHAPTERS.length - 1;
    const target = { ArrowDown: active + 1, ArrowRight: active + 1, ArrowUp: active - 1, ArrowLeft: active - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(Math.min(last, Math.max(0, target)), true);
  };

  const chapter = CHAPTERS[active];
  const next = CHAPTERS[active + 1];
  const Body = chapter.Body;

  return (
    <div
      className="rules-modal-overlay manual-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="rules-modal-container manual" role="dialog" aria-modal="true" aria-labelledby="manual-title">
        <nav className="manual-nav">
          <h2 id="manual-title" className="manual-brand">
            <span>{de ? "Die Regeln" : "The rules"}</span>
            Schafkopf
          </h2>
          <div
            className="manual-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label={de ? "Kapitel" : "Chapters"}
            onKeyDown={onTabKey}
          >
            {CHAPTERS.map((entry, index) => (
              <button
                key={entry.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`manual-tab-${entry.id}`}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-controls="manual-panel"
                tabIndex={index === active ? 0 : -1}
                className="manual-tab"
                onClick={() => select(index)}
              >
                <span className="manual-tab-number" aria-hidden="true">{index + 1}</span>
                {entry.title[language]}
              </button>
            ))}
          </div>
        </nav>

        <section className="manual-page">
          <header className="manual-page-header">
            <h3>
              <span className="manual-page-number" aria-hidden="true">{active + 1}</span>
              {chapter.title[language]}
            </h3>
            <button onClick={onClose} className="rules-modal-close-btn" type="button" aria-label={de ? "Schließen" : "Close"}>
              <XIcon className="rules-modal-close-icon" size={22} />
            </button>
          </header>

          <div
            ref={bodyRef}
            className="manual-body"
            id="manual-panel"
            role="tabpanel"
            aria-labelledby={`manual-tab-${chapter.id}`}
            tabIndex={0}
          >
            <div key={chapter.id} className="manual-chapter">
              <Body language={language} />
            </div>

            <footer className="manual-footer">
              {next ? (
                <button type="button" className="manual-next" onClick={() => select(active + 1)}>
                  {de ? "Weiter" : "Next"}: {next.title[language]} →
                </button>
              ) : (
                <button type="button" className="rules-modal-action-btn" onClick={onClose}>
                  {de ? "Ois klar, packmas!" : "Got it, let's play!"}
                </button>
              )}
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}
