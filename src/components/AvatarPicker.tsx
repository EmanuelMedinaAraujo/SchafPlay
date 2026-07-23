import { useRef, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { AVATAR_PRESETS, isPresetValue, presetValue, resolveAvatarSrc } from "../lib/avatars";
import { fileToAvatarDataUrl } from "../lib/image";
import { CheckIcon, ImagePlusIcon } from "./icons";

interface AvatarPickerProps {
  value: string;
  onChange: (value: string) => void;
  language: Language;
}

/**
 * Profile-picture chooser (#14): a big circular preview of the current pick,
 * a row of the five preselection avatars, and an upload tile for a custom
 * picture. The uploaded image is downscaled to a small square data URL before
 * it is stored/synced (see lib/image.ts). Everything is shown as a circle to
 * keep the round-avatar look the rest of the app uses.
 */
export default function AvatarPicker({ value, onChange, language }: AvatarPickerProps) {
  const t = translations[language];
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasCustom = value.startsWith("data:");
  const previewSrc = resolveAvatarSrc(value, true);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-picking the same file next time.
    event.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await fileToAvatarDataUrl(file));
    } catch {
      setError(t.avatarUploadFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-picker-preview">
        <img src={previewSrc} alt="" />
      </div>

      <div className="avatar-picker-choices" role="radiogroup" aria-label={t.avatarChoose}>
        {AVATAR_PRESETS.map((preset) => {
          const selected = isPresetValue(value) && value === presetValue(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`avatar-option ${selected ? "selected" : ""}`}
              onClick={() => {
                setError(null);
                onChange(presetValue(preset.id));
              }}
            >
              <img src={preset.src} alt="" />
              {selected && (
                <span className="avatar-option-check">
                  <CheckIcon size={14} />
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          className={`avatar-option avatar-upload ${hasCustom ? "selected" : ""}`}
          aria-label={t.avatarUpload}
          aria-pressed={hasCustom}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {hasCustom ? <img src={value} alt="" /> : <ImagePlusIcon size={22} />}
          {hasCustom && (
            <span className="avatar-option-check">
              <CheckIcon size={14} />
            </span>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="avatar-file-input"
          onChange={onFile}
        />
      </div>

      {error && <p className="error-message muted avatar-picker-error">{error}</p>}
    </div>
  );
}
