import { useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { checkForUpdate } from "../lib/pwa";
import { CheckIcon, LoaderIcon, RefreshIcon, SettingsIcon } from "./icons";

interface SettingsScreenProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  disableLaufende: boolean;
  onDisableLaufendeChange: (disable: boolean) => void;
  enableRamsch: boolean;
  onEnableRamschChange: (enable: boolean) => void;
}

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
  enableRamsch,
  onEnableRamschChange,
}: SettingsScreenProps) {
  const t = translations[language];
  const [status, setStatus] = useState<UpdateStatus>("idle");

  async function onCheckForUpdate() {
    setStatus("checking");
    try {
      const result = await checkForUpdate();
      if (result === "updating") {
        setStatus("installing");
        // main.tsx's 'controllerchange' listener reloads the page once the
        // newly-activated worker actually takes over — no need to guess a
        // timeout here.
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
        <h2>{t.settingsRamsch}</h2>
        <p className="muted">{t.settingsRamschHint}</p>
        <div className="mode-switch" role="group" aria-label={t.settingsRamsch}>
          <button
            className={!enableRamsch ? "active" : ""}
            onClick={() => onEnableRamschChange(false)}
            aria-pressed={!enableRamsch}
            type="button"
          >
            {t.settingsRamschOff}
          </button>
          <button
            className={enableRamsch ? "active" : ""}
            onClick={() => onEnableRamschChange(true)}
            aria-pressed={enableRamsch}
            type="button"
          >
            {t.settingsRamschPlay}
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
