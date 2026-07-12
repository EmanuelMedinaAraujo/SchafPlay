/**
 * Player profile pictures (#14). A small in-repo preselection of crisp inline
 * SVG emblems with a Bavarian / card-game flair — no external assets, no new
 * dependencies, so everything works offline and travels over the WebRTC wire
 * as nothing more than a short stable id string.
 *
 * An avatar is identified by its `id`; that id is what is persisted in
 * `Settings`, stored on `Player.avatar`, and sent over the wire. Rendering is
 * done by `<Avatar id={…} />`, which looks the emblem up here. Unknown ids
 * (e.g. from an older/newer build on the other device) fall back to the
 * default sheep, so the app never renders a broken picture.
 */
import { ReactNode } from "react";

export interface AvatarDef {
  id: string;
  /** Circle background colour. */
  bg: string;
  /** Foreground emblem, drawn on a 48×48 viewBox on top of the circle. */
  emblem: ReactNode;
}

/**
 * The preselection. Kept deliberately small and consistent: a coloured circle
 * plus one simple light emblem each, so they read cleanly at seat-badge size.
 */
export const AVATARS: AvatarDef[] = [
  {
    // The namesake — a fluffy sheep.
    id: "sheep",
    bg: "#64748b",
    emblem: (
      <>
        <g fill="#fff">
          <circle cx="16" cy="22" r="5" />
          <circle cx="22" cy="18" r="5" />
          <circle cx="29" cy="19" r="5" />
          <circle cx="32" cy="25" r="5" />
          <circle cx="18" cy="28" r="5" />
          <circle cx="25" cy="29" r="5.5" />
          <circle cx="31" cy="29" r="4.5" />
        </g>
        <ellipse cx="30" cy="25" rx="4.2" ry="5" fill="#3f3f46" />
        <circle cx="30.5" cy="23.5" r="1" fill="#fff" />
      </>
    ),
  },
  {
    // Brezn.
    id: "pretzel",
    bg: "#b45309",
    emblem: (
      <path
        d="M15 31 C 11 20, 22 14, 24 23 C 26 14, 37 20, 33 31 C 31 35, 26 31, 24 28 C 22 31, 17 35, 15 31 Z"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    // A frothy Maß.
    id: "beer",
    bg: "#d97706",
    emblem: (
      <>
        <path d="M15 23 h13 v11 a3 3 0 0 1 -3 3 h-7 a3 3 0 0 1 -3 -3 z" fill="#fde68a" />
        <path d="M28 25 h3 a4 4 0 0 1 0 8 h-3" fill="none" stroke="#fff" strokeWidth="2.6" />
        <path d="M15 23 h13 v-1 a3 3 0 0 0 -3 -3 h-7 a3 3 0 0 0 -3 3 z" fill="#fff" />
        <g fill="#fff">
          <circle cx="17" cy="19" r="3" />
          <circle cx="22" cy="18" r="3.2" />
          <circle cx="26.5" cy="19.5" r="2.6" />
        </g>
      </>
    ),
  },
  {
    // Trachtenhut with a feather.
    id: "hat",
    bg: "#15803d",
    emblem: (
      <>
        <ellipse cx="24" cy="32" rx="15" ry="3.6" fill="#fff" />
        <path d="M15 32 q0 -14 9 -14 q9 0 9 14 z" fill="#fff" />
        <rect x="15" y="28" width="18" height="4" fill="#0f5132" />
        <path d="M32 27 q4 -8 6 -12 q-1 7 -2 12 z" fill="#facc15" />
      </>
    ),
  },
  {
    // Eichel — the card suit.
    id: "acorn",
    bg: "#7c2d12",
    emblem: (
      <>
        <path d="M24 11 v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="24" cy="20" rx="8.5" ry="4" fill="#fff" />
        <path d="M16.5 20 h15 l-2 9 a5.5 6 0 0 1 -11 0 z" fill="#fff" />
      </>
    ),
  },
  {
    // Gras — the card suit.
    id: "leaf",
    bg: "#16a34a",
    emblem: (
      <>
        <path d="M24 11 C 35 16, 35 30, 24 37 C 13 30, 13 16, 24 11 Z" fill="#fff" />
        <path d="M24 14 V 35" stroke="#16a34a" strokeWidth="1.8" />
      </>
    ),
  },
  {
    // Herz — the card suit.
    id: "heart",
    bg: "#dc2626",
    emblem: (
      <path
        d="M24 35 C 9 24, 12 13, 20 16 C 22.5 16.9, 24 19, 24 19 C 24 19, 25.5 16.9, 28 16 C 36 13, 39 24, 24 35 Z"
        fill="#fff"
      />
    ),
  },
  {
    // Schellen — the card suit, drawn as a jingle bell.
    id: "bell",
    bg: "#ca8a04",
    emblem: (
      <>
        <rect x="22" y="12" width="4" height="4" rx="1.5" fill="#fff" />
        <circle cx="24" cy="25" r="10.5" fill="#fff" />
        <path d="M14 25 h20" stroke="#ca8a04" strokeWidth="1.8" />
        <circle cx="24" cy="30.5" r="2" fill="#ca8a04" />
      </>
    ),
  },
  {
    // Edelweiss.
    id: "edelweiss",
    bg: "#0891b2",
    emblem: (
      <>
        <g fill="#fff">
          <ellipse cx="24" cy="16" rx="3" ry="6" />
          <ellipse cx="24" cy="32" rx="3" ry="6" />
          <ellipse cx="16" cy="24" rx="6" ry="3" />
          <ellipse cx="32" cy="24" rx="6" ry="3" />
          <ellipse cx="18.3" cy="18.3" rx="3" ry="6" transform="rotate(45 18.3 18.3)" />
          <ellipse cx="29.7" cy="29.7" rx="3" ry="6" transform="rotate(45 29.7 29.7)" />
          <ellipse cx="29.7" cy="18.3" rx="3" ry="6" transform="rotate(-45 29.7 18.3)" />
          <ellipse cx="18.3" cy="29.7" rx="3" ry="6" transform="rotate(-45 18.3 29.7)" />
        </g>
        <circle cx="24" cy="24" r="3.6" fill="#facc15" />
      </>
    ),
  },
  {
    // A jaunty moustache.
    id: "moustache",
    bg: "#7c3aed",
    emblem: (
      <>
        <circle cx="24" cy="18" r="2.4" fill="#fff" />
        <path
          d="M24 24 c -3 -3.4 -7.5 -3.4 -10.5 -0.4 c -2 2 0.6 6 3.8 5 c 2.2 -0.7 4.4 -3.2 6.7 -3.2 c 2.3 0 4.5 2.5 6.7 3.2 c 3.2 1 5.8 -3 3.8 -5 c -3 -3 -7.5 -3 -10.5 0.4 z"
          fill="#fff"
        />
      </>
    ),
  },
  {
    // Playing cards, fanned.
    id: "cards",
    bg: "#334155",
    emblem: (
      <>
        <rect x="14" y="17" width="11" height="15" rx="1.6" fill="#fff" transform="rotate(-14 19.5 24.5)" />
        <rect x="23" y="17" width="11" height="15" rx="1.6" fill="#fff" transform="rotate(14 28.5 24.5)" />
        <path
          d="M28.5 22 C 27.5 20.7, 26 21.4, 26 22.7 C 26 24, 28.5 25.8, 28.5 25.8 C 28.5 25.8, 31 24, 31 22.7 C 31 21.4, 29.5 20.7, 28.5 22 Z"
          fill="#dc2626"
        />
      </>
    ),
  },
  {
    // A curly-horned Steinbock.
    id: "goat",
    bg: "#0f766e",
    emblem: (
      <>
        <path
          d="M17 16 C 13 18, 13 24, 17 25 M31 16 C 35 18, 35 24, 31 25"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path d="M17 22 h14 v5 a7 7 0 0 1 -14 0 z" fill="#fff" />
        <path d="M21 34 l3 4 l3 -4 z" fill="#fff" />
        <circle cx="21" cy="26" r="1.1" fill="#0f766e" />
        <circle cx="27" cy="26" r="1.1" fill="#0f766e" />
      </>
    ),
  },
];

const AVATAR_BY_ID = new Map(AVATARS.map((avatar) => [avatar.id, avatar]));

/** The fallback used for a missing/unknown avatar id. */
export const DEFAULT_AVATAR = "sheep";

/** Distinct sensible defaults for the configurable AI seats and solo p3. */
export const DEFAULT_RESI_AVATAR = "edelweiss";
export const DEFAULT_SEPP_AVATAR = "moustache";
export const DEFAULT_SOLO_P3_AVATAR = "goat";

/** True when the string names one of the built-in preselection avatars. */
export function isAvatarId(value: string): boolean {
  return AVATAR_BY_ID.has(value);
}

interface AvatarProps {
  /** A preselection id. Missing/unknown ids fall back to the default. */
  id?: string;
  size?: number;
  className?: string;
}

/**
 * Renders an avatar by id as a self-contained inline SVG. Everything is drawn
 * from local data — no network, no external image — so it paints instantly
 * and works fully offline at any size.
 */
export function Avatar({ id, size = 28, className }: AvatarProps) {
  const def = (id !== undefined ? AVATAR_BY_ID.get(id) : undefined) ?? AVATAR_BY_ID.get(DEFAULT_AVATAR)!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={["avatar", className].filter(Boolean).join(" ")}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="24" fill={def.bg} />
      {def.emblem}
    </svg>
  );
}
