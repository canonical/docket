import type { ActivityGrouping } from "./types.js";

/** The groupings, in the order the reader steps through them; the first is the default. */
export const activityGroupings: readonly ActivityGrouping[] = [
  "kind",
  "repo",
  "none",
];
