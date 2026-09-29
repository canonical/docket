import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draw } from "../../../testing/terminal.js";
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
 * third block, three lines tall, that prints the blocks it would draw.
 */
function Listed({ heights, start }: { heights: number[]; start: Place }) {
  const [place, setPlace] = useState(start);
  move = setPlace;
  const blocks = heights.map((lines, index) => ({
    name: `${index}:${lines}`,
    lines,
  }));
  const { shown } = useListScroll({ blocks, ...place });
  return <text>{shown.map(({ name }) => name).join(" ")}</text>;
}

/** Draws the list, then moves its selection or its room to each place. */
async function scroll(heights: number[], start: Place, ...places: Place[]) {
  const screen = await draw(<Listed heights={heights} start={start} />, 40, 1);
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
});
