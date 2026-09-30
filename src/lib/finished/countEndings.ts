import type { FinishedCounts, FinishedRow } from "./types.js";

/**
 * Counts the rows by outcome and by verdict: `merged` counts the outcome
 * `merged`, `closed` every other outcome, and `over` the threads whose
 * time to close ended past its target, over the threads it is measured
 * on. A thread a label exempts counts as merged or closed, never as over.
 */
export default function countEndings(
  rows: readonly FinishedRow[],
): FinishedCounts {
  const count = (kind: string, outcome: string) =>
    rows.filter(
      ({ thread }) => thread.kind === kind && thread.ending.outcome === outcome,
    ).length;
  const merged = rows.filter(
    ({ thread }) => thread.ending.outcome === "merged",
  ).length;
  const measured = rows.filter(
    ({ measures }) => measures.close.state === "measured",
  );
  return {
    merged,
    closed: rows.length - merged,
    over: {
      value: measured.filter(({ verdict }) => verdict === "over").length,
      of: measured.length,
      pending: rows.filter(({ measures }) => measures.close.state === "pending")
        .length,
    },
    byKind: {
      issue: {
        completed: count("issue", "completed"),
        notPlanned: count("issue", "notPlanned"),
        duplicate: count("issue", "duplicate"),
        closed: count("issue", "closed"),
      },
      pullRequest: {
        merged: count("pullRequest", "merged"),
        closed: count("pullRequest", "closed"),
      },
    },
  };
}
