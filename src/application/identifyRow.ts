import type { ThreadRow } from "../lib/activity/index.js";
import type { WaitRow } from "../lib/owed/index.js";

/**
 * Names what a row shows, so a selection can follow it as the clock
 * reorders the list, a refresh replaces it, or another grouping splits it.
 * owed's row is a wait, named by its thread, its kind, and whom it is owed
 * by, since each requested reviewer is a wait of its own on the same pull
 * request; activity's row is a thread, which its reference names.
 */
export default function identifyRow(row: WaitRow | ThreadRow): string {
  if (!("wait" in row)) return row.reference.text;
  const { kind, owners } = row.wait;
  return `${row.reference.text} ${kind} ${owners.join(",")}`;
}
