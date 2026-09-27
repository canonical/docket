import type { WaitKind } from "../waits/index.js";
import type { OwedGrouping } from "./types.js";

/** The groupings, in the order the reader steps through them; the first is the default. */
export const owedGroupings: readonly OwedGrouping[] = [
  "none",
  "owner",
  "repo",
  "stack",
];

/**
 * A wait is due soon once less than this share of its target is left, so
 * a short target and a long one warn at the same point in their life.
 */
export const soonShare = 0.25;

/** The most display cells an owner takes on a row, so the title keeps its room. */
export const ownerCells = 12;

/** The word each kind of wait goes by on screen. */
export const waitWords: Readonly<Record<WaitKind, string>> = {
  response: "reply",
  review: "review",
  close: "close",
};
