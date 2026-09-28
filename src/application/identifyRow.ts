import type { WaitRow } from "../lib/owed/index.js";

/**
 * Names the wait a row shows, so a selection can follow it as the list is
 * measured again, refreshed or grouped another way: its thread, its kind,
 * and whom it is owed by, since each requested reviewer is a wait of its
 * own on the same pull request.
 */
export default function identifyRow(row: WaitRow): string {
  const { kind, owners } = row.wait;
  return `${row.reference.text} ${kind} ${owners.join(",")}`;
}
