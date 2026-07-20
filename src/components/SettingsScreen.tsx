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
  enableRamsch: boolean;
  onEnableRamschChange: (enable: boolean) => void;
  enableStoss: boolean;
  onEnableStossChange: (enable: boolean) => void;
}

type UpdateStatus = "idle" | "checking" | "uptodate" | "installing" | "unsupported";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

/** A titled two-option toggle panel — the shared shape of every house-rule setting. */
function ToggleSection({
  title,
  hint,
  options,
}: {
  title: string;
  hint: string;
  options: Array<{ label: string; selected: boolean; onSelect: () => void }>;
}) {
  return (
    <section className="panel settings-panel">
      <h2>{title}</h2>
      <p className="muted">{hint}</p>
      <div className="mode-switch" role="group" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.label}
            className={option.selected ? "active" : ""}
            onClick={option.onSelect}
            aria-pressed={option.selected}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function SettingsScreen({
  language,
  onLanguageChange,
  disableLaufende,
  onDisableLaufendeChange,
  enableRamsch,
  onEnableRamschChange,
  enableStoss,
  onEnableStossChange,
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

      <ToggleSection
        title={t.settingsLaufende}
        hint={t.settingsLaufendeHint}
        options={[
          { label: t.settingsLaufendeCount, selected: !disableLaufende, onSelect: () => onDisableLaufendeChange(false) },
          { label: t.settingsLaufendeOff, selected: disableLaufende, onSelect: () => onDisableLaufendeChange(true) },
        ]}
      />

      <ToggleSection
        title={t.settingsRamsch}
        hint={t.settingsRamschHint}
        options={[
          { label: t.settingsRamschOff, selected: !enableRamsch, onSelect: () => onEnableRamschChange(false) },
          { label: t.settingsRamschPlay, selected: enableRamsch, onSelect: () => onEnableRamschChange(true) },
        ]}
      />

      <ToggleSection
        title={t.settingsStoss}
        hint={t.settingsStossHint}
        options={[
          { label: t.settingsStossPlay, selected: enableStoss, onSelect: () => onEnableStossChange(true) },
          { label: t.settingsStossOff, selected: !enableStoss, onSelect: () => onEnableStossChange(false) },
        ]}
      />

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
