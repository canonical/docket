import type { Outcome } from "../endings/index.js";
import type { ThreadKind } from "../waits/index.js";
import type { FinishedGrouping } from "./types.js";

/** The groupings, in the order the reader steps through them; the first is the default. */
export const finishedGroupings: readonly FinishedGrouping[] = [
  "kind",
  "ending",
  "repo",
  "none",
];

/**
 * The outcomes each kind of thread ends in, in the order GitHub lists
 * them, which is the order of the `ending` sections within a kind.
 */
export const endingOrder: Readonly<Record<ThreadKind, readonly Outcome[]>> = {
  issue: ["completed", "notPlanned", "duplicate", "closed"],
  pullRequest: ["merged", "closed"],
  discussion: [],
};
