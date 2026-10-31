/**
 * Forced landscape (`html.rotated`, see App.tsx) turns the page 90°, so a
 * screen-space delta has to be mapped into the page's rotated local space.
 */
export function toPageDelta(dx: number, dy: number): [number, number] {
  return document.documentElement.classList.contains("rotated") ? [dy, -dx] : [dx, dy];
}

/**
 * Sets `--reveal-x`/`--reveal-y` on `el` to the offset from its centre to the
 * table centre (`.trick-area`), for animations that start there. Returns
 * false, leaving `el` untouched, when no table is on screen.
 */
export function setRevealOffset(el: HTMLElement): boolean {
  const center = document.querySelector(".trick-area");
  if (!center) return false;
  const rect = el.getBoundingClientRect();
  const centerRect = center.getBoundingClientRect();
  const [dx, dy] = toPageDelta(
    centerRect.left + centerRect.width / 2 - (rect.left + rect.width / 2),
    centerRect.top + centerRect.height / 2 - (rect.top + rect.height / 2),
  );
  el.style.setProperty("--reveal-x", `${dx}px`);
  el.style.setProperty("--reveal-y", `${dy}px`);
  return true;
}

/** Runs a one-shot CSS animation class on `el`; returns the effect cleanup. */
export function playAnimationClass(el: HTMLElement, className: string): () => void {
  el.classList.add(className);
  const clear = () => el.classList.remove(className);
  el.addEventListener("animationend", clear, { once: true });
  return () => el.removeEventListener("animationend", clear);
}
