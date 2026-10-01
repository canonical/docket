import type { ThreadEvent } from "../events/index.js";
import { mergeCloseMargin } from "./constants.js";

/**
 * The close GitHub records with `merge`: the close nearest it in
 * `timeline`, within `mergeCloseMargin` and with no reopen between them.
 * A pull request that has none gives undefined.
 */
function findMergeClose(
  timeline: readonly ThreadEvent[],
  merge: ThreadEvent,
): ThreadEvent | undefined {
  const gap = (event: ThreadEvent) =>
    Math.abs(event.at.getTime() - merge.at.getTime());
  const nearest = (side: readonly ThreadEvent[]) => {
    const reopen = side.findIndex(({ kind }) => kind === "reopened");
    return side
      .slice(0, reopen < 0 ? side.length : reopen)
      .find(
        (event) => event.kind === "closed" && gap(event) <= mergeCloseMargin,
      );
  };
  const index = timeline.indexOf(merge);
  return [
    nearest(timeline.slice(index + 1)),
    nearest(timeline.slice(0, index).reverse()),
  ]
    .filter((close) => close !== undefined)
    .sort((a, b) => gap(a) - gap(b))
    .at(0);
}

/**
 * A thread's timeline with each merge counted once. GitHub records a
 * merge as a merge and a close, dated separately, so the two can be a
 * second apart; the merge alone counts. A close of a pull request never
 * merged, and a close before a reopen, stay.
 */
export default function dropMergeCloses(
  timeline: readonly ThreadEvent[],
): readonly ThreadEvent[] {
  const merges = timeline.filter(({ kind }) => kind === "merged");
  if (merges.length === 0) return timeline;
  const closes = new Set(
    merges.map((merge) => findMergeClose(timeline, merge)),
  );
  return timeline.filter((event) => !closes.has(event));
}
