import type { ThreadGroup } from "../lib/activity/index.js";
import type { FinishedGroup } from "../lib/finished/index.js";
import type { WaitGroup } from "../lib/owed/index.js";
import identifyRow from "./identifyRow.js";

/**
 * Where the selected row is in the list, as the counts line gives it:
 * `3/12`, its place of all, or with groups `1/4/12`, its place in its
 * group, the group's size, and all. A wait with two owners is drawn under
 * each in `by owner`, but counts once in all, as the counts do. Nothing
 * when there is no row.
 *
 * @param place The selected row's place among the rows, in the order drawn.
 */
export default function describePosition(
  groups: readonly (WaitGroup | ThreadGroup | FinishedGroup)[],
  place: number,
): string | undefined {
  const rows = groups.flatMap(
    ({
      rows,
    }): readonly (WaitGroup | ThreadGroup | FinishedGroup)["rows"][number][] =>
      rows,
  );
  if (rows.length === 0) return undefined;
  const all = new Set(rows.map(identifyRow)).size;
  let before = 0;
  for (const { heading, rows: members } of groups) {
    if (place < before + members.length) {
      return heading
        ? `${place - before + 1}/${members.length}/${all}`
        : `${place + 1}/${all}`;
    }
    before += members.length;
  }
  return undefined;
}
