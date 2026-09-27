import type { Capability } from "../provider/index.js";

/** The one host docket supports; its token comes from `gh`. */
export const host = "github.com";

/** The address of GitHub's API for `host`. */
export const apiUrl = "https://api.github.com";

/**
 * Threads per page of a full snapshot. A hundred per page took 7 of the
 * 10 seconds GitHub allows a query, so fifty leave room.
 */
export const fullPageSize = 50;

/**
 * Threads per page of an incremental snapshot. A few threads change
 * between cycles, and a smaller page costs fewer points.
 */
export const incrementalPageSize = 10;

/**
 * How far before the newest update seen the next snapshot starts. An
 * update GitHub records just before a query answers may appear in its
 * lists only later, so the next snapshot looks back this far, in
 * milliseconds, and fetches those threads twice rather than never.
 */
export const watermarkMargin = 60_000;

/** The optional facts the GitHub provider supplies: all of them. */
export const capabilities: ReadonlySet<Capability> = new Set<Capability>([
  "discussions",
  "stacks",
  "teamReviews",
  "checks",
  "botAccounts",
  "pushes",
  "changeProbe",
]);
