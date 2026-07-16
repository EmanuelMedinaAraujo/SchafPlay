import { useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { checkForUpdate } from "../lib/pwa";
import { CheckIcon, DownloadIcon, LoaderIcon, RefreshIcon, SettingsIcon } from "./icons";
import { gameHistoryStore } from "../persistence";
import { formatGamesForExport } from "../lib/export";

interface SettingsScreenProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  disableLaufende: boolean;
  onDisableLaufendeChange: (disable: boolean) => void;
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
}: SettingsScreenProps) {
  const t = translations[language];
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  async function onExportGames() {
    setExportError(null);
    try {
      const games = await gameHistoryStore.loadGames();
      if (games.length === 0) {
        setExportError(t.exportNoGames);
        return;
      }
      const text = formatGamesForExport(games, language);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schafplay-history-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setExportError(t.exportFailed);
    }
  }

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

      <section className="panel settings-panel">
        <h2>{t.settingsExport}</h2>
        <p className="muted">{t.settingsExportHint}</p>
        <button
          className="secondary-button settings-export-btn"
          onClick={onExportGames}
          type="button"
        >
          <DownloadIcon />
          {t.exportGames}
        </button>
        {exportError && <p className="settings-update-status error-message muted">{exportError}</p>}
      </section>
    </main>
  );
}
