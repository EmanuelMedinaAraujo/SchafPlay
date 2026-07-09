import { useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { checkForUpdate } from "../lib/pwa";
import { CheckIcon, LoaderIcon, RefreshIcon, SettingsIcon } from "./icons";

interface SettingsScreenProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
}

type UpdateStatus = "idle" | "checking" | "uptodate" | "installing" | "unsupported";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

export default function SettingsScreen({ language, onLanguageChange }: SettingsScreenProps) {
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
