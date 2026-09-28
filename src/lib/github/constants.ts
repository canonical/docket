import type { Capability } from "../provider/index.js";

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

/**
 * How long, in milliseconds, one request to GitHub may take, answer and
 * all, before it is abandoned. GitHub gives up on a query after 10
 * seconds, so a request still open long after that hangs on a connection
 * that will never answer.
 */
export const requestTimeout = 30_000;
