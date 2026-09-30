import type { Owner } from "../owed/index.js";

/** What placing a list reads of each block: what it is, and its lines. */
export type PlacedBlock =
  | {
      readonly kind: "heading";
      readonly lines: number;
      readonly heading: Owner;
    }
  | { readonly kind: "row"; readonly lines: number };

/** Where a scrolled list starts, and what it shows from there. */
export interface ListPlacement {
  /** The place of the first block shown. */
  readonly first: number;
  /** How many blocks are shown from the first, whole but for the first. */
  readonly shown: number;
  /**
   * How many rows are cut off below the blocks shown, in whichever group,
   * which the list's last line signs; none while the room is the first
   * block's alone.
   */
  readonly below: number;
  /**
   * The heading pinned above the first block, when that block is a row of
   * a group: the heading's name, the place in the group of the first row
   * shown, counted from one, and the group's rows.
   */
  readonly pinned?: {
    readonly heading: Owner;
    readonly place: number;
    readonly size: number;
  };
}

/** Where the selection is, the room the list has, and where it was. */
export interface PlaceListOptions {
  /**
   * The first block that must be whole in view: the selected row, or the
   * heading above it when the row is the first of its group.
   */
  readonly from: number;
  /** The last block that must be whole in view: the selected row. */
  readonly to: number;
  /** The lines the list region has. */
  readonly room: number;
  /** The first block shown before. */
  readonly first: number;
}

/** A group's heading and its rows, as its rows see it. */
interface Group {
  readonly heading: Owner;
  size: number;
}

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
 * as many whole blocks as fit are shown. Placed again from the first
 * block it gives, it gives the same place, so a list that keeps its first
 * block between draws settles in one.
 */
export default function placeList(
  blocks: readonly PlacedBlock[],
  { from, to, room, first }: PlaceListOptions,
): ListPlacement {
  // Each row's group, when it has one, and its place in it.
  const groups: ({ group: Group; place: number } | undefined)[] = [];
  let group: Group | undefined;
  for (const block of blocks) {
    if (block.kind === "heading") {
      group = { heading: block.heading, size: 0 };
      groups.push(undefined);
    } else if (group) {
      group.size += 1;
      groups.push({ group, place: group.size });
    } else {
      groups.push(undefined);
    }
  }
  const end = blocks.length;
  const measure = (start: number, last: number) =>
    blocks.slice(start, last).reduce((lines, block) => lines + block.lines, 0);
  // What a list starting at `top` spends on its pinned heading and on the
  // sign of the rows cut off below. Both keep their line while the room
  // leaves the first block a line of its own, and the first block is cut
  // instead, so what is above and below is always named.
  const measureFrame = (top: number) => {
    const grouped = groups.at(top);
    const pinned = grouped !== undefined && room >= 2;
    const pin = Number(pinned);
    const cut = pin + measure(top, end) > room;
    const signed = cut && room - pin >= 2;
    return {
      pinned: pinned ? grouped : undefined,
      signed,
      lines: pin + Number(signed),
      whole: !cut,
    };
  };
  const fits = (top: number, last: number) =>
    measureFrame(top).lines + measure(top, last) <= room;
  let top = Math.max(0, Math.min(first, from, end - 1));
  while (top < to && !fits(top, to + 1)) top += 1;
  while (top > 0 && measureFrame(top - 1).whole) top -= 1;
  const { pinned, signed, whole } = measureFrame(top);
  let shown = whole ? end - top : 1;
  while (top + shown < end && fits(top, top + shown + 1)) shown += 1;
  shown = Math.min(shown, end - top);
  return {
    first: top,
    shown,
    below: signed
      ? blocks.slice(top + shown).filter(({ kind }) => kind === "row").length
      : 0,
    ...(pinned && {
      pinned: {
        heading: pinned.group.heading,
        place: pinned.place,
        size: pinned.group.size,
      },
    }),
  };
}
