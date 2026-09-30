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
 * that row, so the group is named wherever its rows scroll. When rows are
 * cut off below, the list's last line is kept for the sign that counts
 * them, every row under it in whichever group. Both keep their lines
 * while the room leaves the first block one, and a first block taller
 * than the rest of the room is cut at the bottom. After the first block,
 * as many whole blocks as fit are shown. Placed
 * again from the first block it gives, it gives the same place, so a
 * list that keeps its first block between draws settles in one.
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
  const end = heights.length;
  // The lines a list starting at `top` spends on its pinned heading and on
  // the sign of the rows cut off below. Both keep their line while the
  // room leaves the first block a line of its own, and the first block is
  // cut instead, so what is above and below is always named.
  const frame = (top: number) => {
    const grouped = kinds.at(top) === "row" ? headings.at(top) : undefined;
    const cuts = (pin: number) => pin + measure(top, end) > room;
    const signs = (pin: number) => (cuts(pin) && room - pin >= 2 ? 1 : 0);
    const pin = grouped !== undefined && room >= 2 ? 1 : 0;
    return {
      pinned: pin === 1 ? grouped : undefined,
      signed: signs(pin) === 1,
      lines: pin + signs(pin),
      whole: !cuts(pin),
    };
  };
  const fits = (top: number, last: number) =>
    frame(top).lines + measure(top, last) <= room;
  let top = Math.max(0, Math.min(first, from, end - 1));
  while (top < to && !fits(top, to + 1)) top += 1;
  while (top > 0 && frame(top - 1).whole) top -= 1;
  const { pinned, signed, whole } = frame(top);
  let shown = whole ? end - top : 1;
  while (top + shown < end && fits(top, top + shown + 1)) shown += 1;
  shown = Math.min(shown, end - top);
  return {
    first: top,
    shown,
    below: signed
      ? kinds.slice(top + shown).filter((kind) => kind === "row").length
      : 0,
    ...(pinned !== undefined && {
      pinned: {
        heading: pinned,
        place: places.at(top) ?? 1,
        size: sizes.get(pinned) ?? 0,
      },
    }),
  };
}
