import { useState } from "react";
import { Card, CardValue, Language, Suit } from "../types";
import { CardDesign } from "../lib/settings";
import { translations } from "../lib/i18n";
import { checkForUpdate } from "../lib/pwa";
import CardFace from "./CardFace";
import { CheckIcon, LoaderIcon, RefreshIcon, SettingsIcon } from "./icons";

interface SettingsScreenProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  disableLaufende: boolean;
  onDisableLaufendeChange: (disable: boolean) => void;
  cardDesign: CardDesign;
  onCardDesignChange: (design: CardDesign) => void;
}

/** A couple of sample cards so the design toggle previews what it changes. */
const PREVIEW_CARDS: Card[] = [
  { id: "preview-ober", suit: Suit.ACORNS, value: CardValue.OBER, points: 3 },
  { id: "preview-ace", suit: Suit.HEARTS, value: CardValue.ACE, points: 11 },
];

type UpdateStatus = "idle" | "checking" | "uptodate" | "installing" | "unsupported";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

export default function SettingsScreen({
  language,
  onLanguageChange,
  disableLaufende,
  onDisableLaufendeChange,
  cardDesign,
  onCardDesignChange,
}: SettingsScreenProps) {
  const t = translations[language];
  const [status, setStatus] = useState<UpdateStatus>("idle");

  async function onCheckForUpdate() {
    setStatus("checking");
    try {
      const result = await checkForUpdate();
      if (result === "updating") {
        setStatus("installing");
        // Give the freshly installed worker a moment to take over, then reload
        // to pick up the new version.
        setTimeout(() => window.location.reload(), 900);
      } else {
        setStatus(result === "unsupported" ? "unsupported" : "uptodate");
      }
    } catch {
      setStatus("unsupported");
    }
  }

  const statusText =
    status === "checking"
      ? t.updateChecking
      : status === "installing"
        ? t.updateInstalling
        : status === "uptodate"
          ? t.updateUpToDate
          : status === "unsupported"
            ? t.updateUnsupported
            : "";

  return (
    <main className="home-screen settings-screen">
      <div className="stats-header">
        <h2>
          <SettingsIcon size={18} />
          {t.settings}
        </h2>
      </div>

      <section className="panel settings-panel">
        <h2>{t.settingsLanguage}</h2>
        <div className="mode-switch" role="tablist">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              className={language === code ? "active" : ""}
              onClick={() => onLanguageChange(code)}
              role="tab"
              aria-selected={language === code}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel settings-panel">
        <h2>{t.settingsLaufende}</h2>
        <p className="muted">{t.settingsLaufendeHint}</p>
        <div className="mode-switch" role="group" aria-label={t.settingsLaufende}>
          <button
            className={!disableLaufende ? "active" : ""}
            onClick={() => onDisableLaufendeChange(false)}
            aria-pressed={!disableLaufende}
            type="button"
          >
            {t.settingsLaufendeCount}
          </button>
          <button
            className={disableLaufende ? "active" : ""}
            onClick={() => onDisableLaufendeChange(true)}
            aria-pressed={disableLaufende}
            type="button"
          >
            {t.settingsLaufendeOff}
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <h2>{t.settingsCardDesign}</h2>
        <p className="muted">{t.settingsCardDesignHint}</p>
        <div className="card-design-preview">
          {PREVIEW_CARDS.map((card) => (
            <CardFace key={card.id} card={card} contract={null} design={cardDesign} small />
          ))}
        </div>
        <div className="mode-switch" role="group" aria-label={t.settingsCardDesign}>
          <button
            className={cardDesign === "bavarian" ? "active" : ""}
            onClick={() => onCardDesignChange("bavarian")}
            aria-pressed={cardDesign === "bavarian"}
            type="button"
          >
            {t.settingsCardDesignBavarian}
          </button>
          <button
            className={cardDesign === "minimal" ? "active" : ""}
            onClick={() => onCardDesignChange("minimal")}
            aria-pressed={cardDesign === "minimal"}
            type="button"
          >
            {t.settingsCardDesignMinimal}
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <h2>{t.settingsUpdates}</h2>
        <p className="muted">{t.settingsUpdatesHint}</p>
        <button
          className="secondary-button settings-update-btn"
          onClick={onCheckForUpdate}
          disabled={status === "checking" || status === "installing"}
          type="button"
        >
          {status === "checking" || status === "installing" ? (
            <LoaderIcon />
          ) : status === "uptodate" ? (
            <CheckIcon size={16} />
          ) : (
            <RefreshIcon />
          )}
          {t.checkForUpdate}
        </button>
        {statusText && <p className="settings-update-status muted">{statusText}</p>}
      </section>
    </main>
  );
}
