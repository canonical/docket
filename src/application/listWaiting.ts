import type { WaitRow } from "../lib/owed/index.js";

/**
 * The kind of each thread's most pressing wait, by reference, which the
 * accordion names beside a stacked pull request's open neighbours.
 *
 * @param rows owed's rows, most pressing first.
 */
export default function listWaiting(
  rows: readonly WaitRow[],
): Record<string, string> {
  const waiting: Record<string, string> = {};
  for (const row of rows) waiting[row.reference.text] ??= row.kind.text;
  return waiting;
}
