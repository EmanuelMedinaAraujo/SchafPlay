import { ReactNode } from "react";
import { createPortal } from "react-dom";

/** The overlay layer App renders last inside `.app-shell` (so it rotates with the app). */
export const OVERLAY_ROOT_ID = "overlay-root";

/**
 * Lifts a fixed overlay out of its parent's subtree. A `position: fixed`
 * element is positioned against any ancestor with a transform or filter
 * instead of the viewport, and stacks no higher than an ancestor's z-index
 * context — the pinned, tilted order slip has both — so modals render here.
 */
export default function OverlayPortal({ children }: { children: ReactNode }) {
  const target = document.getElementById(OVERLAY_ROOT_ID);
  return target ? createPortal(children, target) : <>{children}</>;
}
