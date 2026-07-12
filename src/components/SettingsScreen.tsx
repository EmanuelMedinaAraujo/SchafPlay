import { useState } from "react";
import { Language } from "../types";
import { Avatar, AVATARS } from "../lib/avatars";
import { translations } from "../lib/i18n";
import { checkForUpdate } from "../lib/pwa";
import { CheckIcon, LoaderIcon, RefreshIcon, SettingsIcon } from "./icons";

interface SettingsScreenProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  disableLaufende: boolean;
  onDisableLaufendeChange: (disable: boolean) => void;
  avatar: string;
  onAvatarChange: (id: string) => void;
  resiAvatar: string;
  onResiAvatarChange: (id: string) => void;
  seppAvatar: string;
  onSeppAvatarChange: (id: string) => void;
}

type UpdateStatus = "idle" | "checking" | "uptodate" | "installing" | "unsupported";

const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
];

interface AvatarPickerProps {
  /** Group label, also used as the accessible name and in per-option labels. */
  label: string;
  selected: string;
  onSelect: (id: string) => void;
}

/** One row of the preselection: every built-in avatar as a toggle button. */
function AvatarPicker({ label, selected, onSelect }: AvatarPickerProps) {
  return (
    <div className="avatar-picker-row">
      <span className="field-label">{label}</span>
      <div className="avatar-picker" role="group" aria-label={label}>
        {AVATARS.map(({ id }) => (
          <button
            key={id}
            className={`avatar-option ${selected === id ? "active" : ""}`}
            onClick={() => onSelect(id)}
            aria-pressed={selected === id}
            aria-label={`${label}: ${id}`}
            type="button"
          >
            <Avatar id={id} size={34} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsScreen({
  language,
  onLanguageChange,
  disableLaufende,
  onDisableLaufendeChange,
  avatar,
  onAvatarChange,
  resiAvatar,
  onResiAvatarChange,
  seppAvatar,
  onSeppAvatarChange,
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
        <h2>{t.settingsAvatars}</h2>
        <p className="muted">{t.settingsAvatarsHint}</p>
        <AvatarPicker label={t.settingsAvatarYours} selected={avatar} onSelect={onAvatarChange} />
        <AvatarPicker label={t.settingsAvatarResi} selected={resiAvatar} onSelect={onResiAvatarChange} />
        <AvatarPicker label={t.settingsAvatarSepp} selected={seppAvatar} onSelect={onSeppAvatarChange} />
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
    </main>
  );
}
