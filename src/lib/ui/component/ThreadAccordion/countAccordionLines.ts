import type { WaitRow } from "../../../owed/index.js";
import { marginCells } from "../Margin/constants.js";
import describeDetail, { type Reading } from "./describeDetail.js";
import fitAccordion from "./fitAccordion.js";
import type { RestingThread } from "./types.js";

/**
 * How many lines the accordion takes under `row` at `width` before any
 * read: as many as its content, at most eight, known from the snapshot, so
 * the list makes room for it at once. The details fill the snapshot's
 * lines in place; a thread the snapshot holds nothing of takes its one
 * `loading…` line until they arrive. What the details add beyond these,
 * a closed thread's close body or a failed read's lines, the list learns
 * from what the accordion draws.
 */
export default function countAccordionLines(
  row: WaitRow | RestingThread,
  reading: Reading,
  width: number,
): number {
  return fitAccordion(
    describeDetail(row, undefined, reading),
    width - marginCells,
  ).length;
}
