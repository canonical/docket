/**
 * The first block a list shows, so that the blocks from `from` to `to`
 * are whole in view: the selected row with its accordion, and the heading
 * above it when it is the first row of its group. The list scrolls no
 * further than it must, so a selection that stays in view leaves every
 * line where it was, and the selected row stays anchored while the
 * accordion opens under it. When the room grows, or blocks go away, the
 * list scrolls back up as far as the blocks below still fill the room, so
 * no block stays hidden above while lines stand empty below.
 *
 * @param heights The lines each block of the list takes, in order.
 * @param room The lines the list region has.
 * @param first The first block shown before.
 */
export default function keepInView(
  heights: readonly number[],
  from: number,
  to: number,
  room: number,
  first: number,
): number {
  const measure = (start: number, end: number) =>
    heights.slice(start, end).reduce((lines, height) => lines + height, 0);
  let top = Math.min(first, from);
  while (top < to && measure(top, to + 1) > room) top += 1;
  while (top > 0 && measure(top - 1, heights.length) <= room) top -= 1;
  return top;
}
