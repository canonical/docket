import type { ThreadKind } from "../waits/index.js";
import type { ActivityGrouping } from "./types.js";

/** The groupings, in the order the reader steps through them; the first is the default. */
export const activityGroupings: readonly ActivityGrouping[] = [
  "kind",
  "repo",
  "none",
];

/** The most display cells an owner takes on a row, so the title keeps its room. */
export const ownerCells = 12;

/** The word each kind of thread goes by on a row. */
export const threadWords: Readonly<Record<ThreadKind, string>> = {
  issue: "issue",
  pullRequest: "PR",
  discussion: "discussion",
};

/** The section of each kind of thread, in the order the sections come. */
export const kindSections: readonly (readonly [ThreadKind, string])[] = [
  ["issue", "ISSUES"],
  ["pullRequest", "PULL REQUESTS"],
  ["discussion", "DISCUSSIONS"],
];
