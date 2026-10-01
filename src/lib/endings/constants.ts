import type { MeasureKind } from "./types.js";

/**
 * The measures no provider supplies yet: time to first reply and time to
 * first review need each thread's timeline, which is not read. A list
 * says so of them even when it holds no thread.
 */
export const unsupportedMeasures: ReadonlySet<MeasureKind> = new Set([
  "firstResponse",
  "firstReview",
]);
