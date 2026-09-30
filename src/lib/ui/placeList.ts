import type { ListBlockKind, ListPlacement } from "./types.js";

/**
 * Where a list of blocks starts, and what it shows, so that the blocks
 * from `from` to `to` are whole in view: the selected row with what opens
 * under it, and the heading above it when it is the first row of its
 * group. The list scrolls no further than it must, so a selection that
 * stays in view leaves every line where it was, and the selected row
 * stays anchored while the accordion opens under it. When the room grows,
 * or blocks go away, it scrolls back up as far as the blocks below still
 * fill the room, so no block stays hidden above while lines stand empty
 * below.
 *
 * When the first block shown is a row of a group, the group's heading is
 * pinned above it on a line of the room, with the place in the group of
 * that row, so the group is named wherever its rows scroll, unless that
 * row is too tall to share the room with it. The first
 * block is shown whatever its height, and after it as many whole blocks
 * as fit. Placed again from the first block it gives, it gives the same
 * place, so a list that keeps its first block between draws settles in
 * one.
 *
 * @param kinds What each block of the list is, in order.
 * @param heights The lines each block takes, in order.
 * @param room The lines the list region has.
 * @param first The first block shown before.
 */
export default function placeList(
  kinds: readonly ListBlockKind[],
  heights: readonly number[],
  from: number,
  to: number,
  room: number,
  first: number,
): ListPlacement {
  // The heading each block falls under, the place of each row under it,
  // and how many rows each heading heads.
  const headings: (number | undefined)[] = [];
  const places: number[] = [];
  const sizes = new Map<number, number>();
  let heading: number | undefined;
  for (const [index, kind] of kinds.entries()) {
    if (kind === "heading") heading = index;
    headings.push(heading);
    const size = heading === undefined ? 0 : (sizes.get(heading) ?? 0);
    places.push(size + 1);
    if (kind === "row" && heading !== undefined) sizes.set(heading, size + 1);
  }
  const measure = (start: number, end: number) =>
    heights.slice(start, end).reduce((lines, height) => lines + height, 0);
  // A row too tall for the room under the heading takes the room alone.
  const pinnedAt = (top: number) =>
    kinds.at(top) === "row" && 1 + (heights.at(top) ?? 0) <= room
      ? headings.at(top)
      : undefined;
  const pins = (top: number) => (pinnedAt(top) === undefined ? 0 : 1);
  const fits = (top: number, end: number) =>
    pins(top) + measure(top, end) <= room;
  let top = Math.max(0, Math.min(first, from));
  while (top < to && !fits(top, to + 1)) top += 1;
  while (top > 0 && fits(top - 1, heights.length)) top -= 1;
  let shown = 1;
  while (top + shown < heights.length && fits(top, top + shown + 1)) {
    shown += 1;
  }
  const pinned = pinnedAt(top);
  return {
    first: top,
    shown: Math.min(shown, heights.length - top),
    ...(pinned !== undefined && {
      pinned: {
        heading: pinned,
        place: places.at(top) ?? 1,
        size: sizes.get(pinned) ?? 0,
      },
    }),
  };
}
