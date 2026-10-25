import { ReactNode } from "react";
import { createPortal } from "react-dom";

/** The overlay layer App renders last inside `.app-shell` (so it rotates with the app). */
export const OVERLAY_ROOT_ID = "overlay-root";

/**
 * Lifts a fixed overlay out of its parent's subtree. A `position: fixed`
 * element is trapped by any ancestor with a transform, filter or z-index —
 * which animated screens use freely — so modals render here instead.
 */
export default function OverlayPortal({ children }: { children: ReactNode }) {
  const target = document.getElementById(OVERLAY_ROOT_ID);
  return target ? createPortal(children, target) : <>{children}</>;
}
