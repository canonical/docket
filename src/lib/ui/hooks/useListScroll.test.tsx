import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draw } from "../../../testing/terminal.js";
import type { ListBlockKind } from "../types.js";
import useListScroll from "./useListScroll.js";

/** Where the list's selection is, and the room it has. */
interface Place {
  readonly from: number;
  readonly to: number;
  readonly room: number;
  readonly first?: number;
}

let move: (place: Place) => void = () => {};

/**
 * A list of blocks named by their place and height, such as `2:3` for the
 * third block, three lines tall, rows unless `kinds` says otherwise, that
 * prints the heading it would pin, then the blocks it would draw.
 */
function Listed({
  heights,
  kinds = [],
  start,
}: {
  heights: number[];
  kinds?: ListBlockKind[];
  start: Place;
}) {
  const [place, setPlace] = useState(start);
  move = setPlace;
  const blocks = heights.map((lines, index) => ({
    name: `${index}:${lines}`,
    kind: kinds.at(index) ?? "row",
    lines,
  }));
  const { shown, pinned } = useListScroll({ blocks, ...place });
  const pin = pinned
    ? [`[${pinned.heading.name} ${pinned.place} of ${pinned.size}]`]
    : [];
  return <text>{[...pin, ...shown.map(({ name }) => name)].join(" ")}</text>;
}

/**
 * Draws the list, rows of `heights` or the blocks of `list`, then moves
 * its selection or its room to each place.
 */
async function scroll(
  list: number[] | { heights: number[]; kinds: ListBlockKind[] },
  start: Place,
  ...places: Place[]
) {
  const { heights, kinds } = Array.isArray(list)
    ? { heights: list, kinds: undefined }
    : list;
  const screen = await draw(
    <Listed heights={heights} kinds={kinds} start={start} />,
    40,
    1,
  );
  const drawn = [(await screen.redraw()).lines.at(0)];
  for (const place of places) {
    drawn.push((await screen.redraw(() => move(place))).lines.at(0));
  }
  return drawn;
}

describe("useListScroll", () => {
  it("draws the whole blocks that fit from the top while the selection is in view", async () => {
    expect(await scroll([1, 2, 2, 2], { from: 0, to: 0, room: 4 })).toEqual([
      "0:1 1:2",
    ]);
  });

  it("scrolls down only as far as the selected block needs, then stays while it is in view", async () => {
    expect(
      await scroll(
        [1, 2, 2, 2],
        { from: 0, to: 0, room: 4 },
        { from: 3, to: 3, room: 4 },
        { from: 2, to: 2, room: 4 },
      ),
    ).toEqual(["0:1 1:2", "2:2 3:2", "2:2 3:2"]);
  });

  it("scrolls back up as far as the blocks below fill the room once it grows", async () => {
    expect(
      await scroll(
        [1, 2, 2, 2],
        { from: 3, to: 3, room: 4 },
        { from: 3, to: 3, room: 6 },
        { from: 3, to: 3, room: 7 },
      ),
    ).toEqual(["2:2 3:2", "1:2 2:2 3:2", "0:1 1:2 2:2 3:2"]);
  });

  it("draws the first block whatever its height, and nothing after it that does not fit", async () => {
    expect(await scroll([5, 1], { from: 0, to: 0, room: 3 })).toEqual(["0:5"]);
  });

  it("opens where it is told when drawn anew, keeping the selection in view from there", async () => {
    expect(
      await scroll([1, 2, 2, 2, 2], { from: 2, to: 2, room: 4, first: 2 }),
    ).toEqual(["2:2 3:2"]);
    expect(await scroll([1, 2, 2, 2, 2], { from: 2, to: 2, room: 4 })).toEqual([
      "1:2 2:2",
    ]);
  });

  it("pins the heading of the first row's group, with the row's place, counting its line in the room, until the next heading arrives", async () => {
    expect(
      await scroll(
        {
          heights: [1, 2, 2, 2, 1, 2],
          kinds: ["heading", "row", "row", "row", "heading", "row"],
        },
        { from: 3, to: 3, room: 5 },
        { from: 4, to: 5, room: 5 },
      ),
    ).toEqual(["[0:1 2 of 3] 2:2 3:2", "4:1 5:2"]);
  });
});
