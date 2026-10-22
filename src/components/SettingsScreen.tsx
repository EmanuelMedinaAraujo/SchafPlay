import { ReactNode, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { Settings } from "../lib/settings";
import { checkForUpdate } from "../lib/pwa";
import { CheckIcon, DownloadIcon, HelpCircleIcon, LoaderIcon, RefreshIcon, SettingsIcon } from "./icons";
import { gameHistoryStore } from "../persistence";
import { formatGamesForExport } from "../lib/export";
import AvatarPicker from "./AvatarPicker";

interface SettingsScreenProps {
  settings: Settings;
  onChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

type UpdateStatus = "idle" | "checking" | "uptodate" | "installing" | "unsupported";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

/**
 * A help button with its tooltip. Tap-to-toggle so it works on touch; the
 * hint doubles as the button's accessible label.
 */
function HelpHint({ hint }: { hint: string }) {
  const [showHint, setShowHint] = useState(false);
  return (
    <>
      <button
        type="button"
        className="settings-help"
        aria-label={hint}
        aria-expanded={showHint}
        onClick={() => setShowHint((v) => !v)}
        onBlur={() => setShowHint(false)}
      >
        <HelpCircleIcon size={15} />
      </button>
      {showHint && (
        <span role="tooltip" className="settings-tooltip">
          {hint}
        </span>
      )}
    </>
  );
}

/** One settings line: label (plus optional help) on the left, the control on the right. */
function SettingRow({
  label,
  hint,
  status,
  children,
}: {
  label: string;
  hint?: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel settings-panel settings-row">
      <div className="settings-row-label">
        <h2>{label}</h2>
        {hint && <HelpHint hint={hint} />}
      </div>
      <div className="settings-row-control">{children}</div>
      {status}
    </section>
  );
}

/** A house-rule setting: a one-line row whose control is a two-option toggle. */
function ToggleRow({
  title,
  hint,
  options,
}: {
  title: string;
  hint: string;
  options: Array<{ label: string; selected: boolean; onSelect: () => void }>;
}) {
  return (
    <SettingRow label={title} hint={hint}>
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
    </SettingRow>
  );
}

export default function SettingsScreen({ settings, onChange }: SettingsScreenProps) {
  const { language, avatar, disableLaufende, enableRamsch, enableStoss } = settings;
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

      <SettingRow label={t.settingsLanguage}>
        <div className="mode-switch" role="tablist">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              className={language === code ? "active" : ""}
              onClick={() => onChange("language", code)}
              role="tab"
              aria-selected={language === code}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </SettingRow>

      <ToggleRow
        title={t.settingsLaufende}
        hint={t.settingsLaufendeHint}
        options={[
          { label: t.settingsLaufendeCount, selected: !disableLaufende, onSelect: () => onChange("disableLaufende", false) },
          { label: t.settingsLaufendeOff, selected: disableLaufende, onSelect: () => onChange("disableLaufende", true) },
        ]}
      />

      <ToggleRow
        title={t.settingsRamsch}
        hint={t.settingsRamschHint}
        options={[
          { label: t.settingsRamschOff, selected: !enableRamsch, onSelect: () => onChange("enableRamsch", false) },
          { label: t.settingsRamschPlay, selected: enableRamsch, onSelect: () => onChange("enableRamsch", true) },
        ]}
      />

      <ToggleRow
        title={t.settingsStoss}
        hint={t.settingsStossHint}
        options={[
          { label: t.settingsStossPlay, selected: enableStoss, onSelect: () => onChange("enableStoss", true) },
          { label: t.settingsStossOff, selected: !enableStoss, onSelect: () => onChange("enableStoss", false) },
        ]}
      />

      <section className="panel settings-panel settings-avatar">
        <div className="settings-row-label">
          <h2>{t.settingsAvatar}</h2>
          <HelpHint hint={t.settingsAvatarHint} />
        </div>
        <AvatarPicker value={avatar} onChange={(value) => onChange("avatar", value)} language={language} />
      </section>

      <SettingRow
        label={t.settingsUpdates}
        hint={t.settingsUpdatesHint}
        status={statusText && <p className="settings-update-status muted">{statusText}</p>}
      >
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
      </SettingRow>

      <SettingRow
        label={t.settingsExport}
        hint={t.settingsExportHint}
        status={
          exportError && <p className="settings-update-status error-message muted">{exportError}</p>
        }
      >
        <button
          className="secondary-button settings-export-btn"
          onClick={onExportGames}
          type="button"
        >
          <DownloadIcon />
          {t.exportGames}
        </button>
      </SettingRow>
    </main>
  );
}
