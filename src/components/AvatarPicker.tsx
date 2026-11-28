import { useRef, useState } from "react";
import { Language } from "../types";
import { translations } from "../lib/i18n";
import { AVATAR_PRESETS, presetValue, resolveAvatarSrc } from "../lib/avatars";
import { fileToAvatarDataUrl } from "../lib/image";
import { AvatarChange } from "../lib/settings";
import { CheckIcon, ImagePlusIcon } from "./icons";

interface AvatarPickerProps {
  value: string;
  customAvatar: string;
  onChange: (change: AvatarChange) => void;
  language: Language;
}

export default function AvatarPicker({ value, customAvatar, onChange, language }: AvatarPickerProps) {
  const t = translations[language];
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choices = [
    { id: "default", value: "", label: t.avatarDefault, src: resolveAvatarSrc("", true) },
    ...AVATAR_PRESETS.map(({ id, name, src }) => ({ id, value: presetValue(id), label: name, src })),
  ];
  if (customAvatar) choices.push({ id: "custom", value: customAvatar, label: t.avatarCustom, src: customAvatar });
  const selectedValue = choices.some((choice) => choice.value === value) ? value : "";

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-picking the same file next time.
    event.target.value = "";
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    try {
      const photo = await fileToAvatarDataUrl(file);
      if (fileRef.current) onChange({ type: "upload", photo });
    } catch {
      setError(t.avatarUploadFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avatar-picker">
      <div className="avatar-picker-choices" role="radiogroup" aria-label={t.avatarChoose}>
        {choices.map((choice) => {
          const selected = choice.value === selectedValue;
          return (
            <label key={choice.id} className={`avatar-option ${selected ? "selected" : ""}`} title={choice.label}>
              <input
                className="avatar-option-input"
                type="radio"
                name="profile-avatar"
                aria-label={choice.label}
                checked={selected}
                disabled={busy}
                onChange={() => {
                  setError(null);
                  onChange(
                    choice.id === "custom"
                      ? { type: "selectCustom", photo: choice.value }
                      : { type: "select", value: choice.value },
                  );
                }}
              />
              <img src={choice.src} alt="" />
              {selected && (
                <span className="avatar-option-check" aria-hidden="true">
                  <CheckIcon size={14} />
                </span>
              )}
            </label>
          );
        })}
      </div>

      <button
        ref={uploadRef}
        type="button"
        className="avatar-option avatar-upload"
        aria-label={t.avatarUpload}
        title={t.avatarUpload}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <ImagePlusIcon size={22} />
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {customAvatar && (
        <button
          type="button"
          className="text-button avatar-delete"
          disabled={busy}
          onClick={() => {
            setError(null);
            onChange({ type: "delete", photo: customAvatar });
            uploadRef.current?.focus();
          }}
        >
          {t.avatarDelete}
        </button>
      )}

      {error && <p className="error-message muted avatar-picker-error" role="alert">{error}</p>}
    </div>
  );
}
