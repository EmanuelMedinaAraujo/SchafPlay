export type TablePosition = "bottom" | "left" | "top" | "right";

const POSITIONS: TablePosition[] = ["bottom", "left", "top", "right"];

/** Where a seat sits on screen when the local player, at `localIndex`, is at the bottom. */
export function tablePosition(seatIndex: number, localIndex: number): TablePosition {
  return POSITIONS[(seatIndex - localIndex + 4) % 4];
}
