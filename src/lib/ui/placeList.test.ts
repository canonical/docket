import { describe, expect, it } from "vitest";
import placeList, { type PlacedBlock } from "./placeList.js";
import type { ListBlockKind } from "./types.js";

const makeRows = (count: number): ListBlockKind[] => Array(count).fill("row");

/** The heading of the block at `place`, named for it. */
const nameHeading = (place: number) =>
  ({ text: `heading ${place}`, kind: "words" }) as const;

/** Blocks of `kinds`, each as many lines as `heights` gives it. */
const makeBlocks = (
  kinds: readonly ListBlockKind[],
  heights: readonly number[],
): PlacedBlock[] =>
  kinds.map((kind, place) => {
    const lines = heights.at(place) ?? 0;
    return kind === "heading"
      ? { kind, lines, heading: nameHeading(place) }
      : { kind, lines };
  });

// A heading, then rows: three of two lines, and the selected row's block
// of seven lines (the row and its five-line accordion) where the tests
// put it.
const kinds: ListBlockKind[] = ["heading", ...makeRows(6)];
const heights = [1, 2, 2, 7, 2, 1, 2];

// Two groups: a heading and three rows, then a heading and two rows.
const grouped: ListBlockKind[] = [
  "heading",
  "row",
  "row",
  "row",
  "heading",
  "row",
  "row",
];
const lines = [1, 2, 2, 2, 1, 2, 2];

describe("placeList", () => {
  describe("where the list starts", () => {
    it("keeps the first block while the selection is in view", () => {
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 3,
          to: 3,
          room: 18,
          first: 0,
        }),
      ).toEqual({
        first: 0,
        shown: 7,
        below: 0,
      });
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 1,
          to: 1,
          room: 12,
          first: 0,
        }).first,
      ).toBe(0);
    });

    it("scrolls down only as far as the selected block needs, with the pinned heading's and the sign's lines", () => {
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 3,
          to: 3,
          room: 12,
          first: 0,
        }),
      ).toEqual({
        first: 2,
        shown: 2,
        below: 3,
        pinned: { heading: nameHeading(0), place: 2, size: 6 },
      });
      expect(
        placeList(makeBlocks(makeRows(7), heights), {
          from: 3,
          to: 3,
          room: 12,
          first: 0,
        }).first,
      ).toBe(1);
    });

    it("scrolls up to a selection above the first block shown, with its heading", () => {
      expect(
        placeList(makeBlocks(["heading", ...makeRows(3)], [1, 7, 2, 2]), {
          from: 0,
          to: 1,
          room: 12,
          first: 2,
        }),
      ).toEqual({ first: 0, shown: 4, below: 0 });
    });

    it("shows the selected block from its top when it is taller than the room, cut between the pinned heading and the sign", () => {
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 3,
          to: 3,
          room: 4,
          first: 0,
        }),
      ).toEqual({
        first: 3,
        shown: 1,
        below: 3,
        pinned: { heading: nameHeading(0), place: 3, size: 6 },
      });
      expect(
        placeList(makeBlocks(makeRows(2), [9, 2]), {
          from: 0,
          to: 0,
          room: 2,
          first: 0,
        }),
      ).toEqual({
        first: 0,
        shown: 1,
        below: 1,
      });
      // A line of room is the first block's alone.
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 3,
          to: 3,
          room: 1,
          first: 0,
        }),
      ).toEqual({
        first: 3,
        shown: 1,
        below: 0,
      });
    });

    it("scrolls back up when the room grows, as far as the blocks below fill it", () => {
      expect(
        placeList(makeBlocks(makeRows(6), [2, 7, 2, 3, 2, 2]), {
          from: 1,
          to: 1,
          room: 20,
          first: 1,
        }).first,
      ).toBe(0);
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 3,
          to: 3,
          room: 17,
          first: 2,
        }).first,
      ).toBe(0);
      // A row at the top costs the pinned heading's line.
      expect(
        placeList(makeBlocks(kinds, heights), {
          from: 3,
          to: 3,
          room: 16,
          first: 2,
        }),
      ).toEqual({
        first: 2,
        shown: 5,
        below: 0,
        pinned: { heading: nameHeading(0), place: 2, size: 6 },
      });
    });

    it("scrolls back up when blocks below go away", () => {
      expect(
        placeList(makeBlocks(["heading", ...makeRows(3)], [1, 2, 2, 7]), {
          from: 3,
          to: 3,
          room: 12,
          first: 2,
        }).first,
      ).toBe(0);
    });

    it("pins the heading over the selected row when both do not fit, and keeps the sign, cutting the row instead", () => {
      expect(
        placeList(makeBlocks(["heading", "row"], [1, 7]), {
          from: 0,
          to: 1,
          room: 8,
          first: 0,
        }),
      ).toEqual({
        first: 0,
        shown: 2,
        below: 0,
      });
      expect(
        placeList(makeBlocks(["heading", "row"], [1, 7]), {
          from: 0,
          to: 1,
          room: 7,
          first: 0,
        }),
      ).toEqual({
        first: 1,
        shown: 1,
        below: 0,
        pinned: { heading: nameHeading(0), place: 1, size: 1 },
      });
      expect(
        placeList(makeBlocks(grouped, [1, 5, 2, 2, 1, 2, 2]), {
          from: 1,
          to: 1,
          room: 6,
          first: 0,
        }),
      ).toEqual({
        first: 1,
        shown: 1,
        below: 4,
        pinned: { heading: nameHeading(0), place: 1, size: 3 },
      });
      expect(
        placeList(makeBlocks(grouped, [1, 5, 2, 2, 1, 2, 2]), {
          from: 1,
          to: 1,
          room: 7,
          first: 1,
        }),
      ).toEqual({
        first: 1,
        shown: 1,
        below: 4,
        pinned: { heading: nameHeading(0), place: 1, size: 3 },
      });
    });

    it("keeps the pinned heading in a room of two lines, the row's first line under it and no sign", () => {
      expect(
        placeList(makeBlocks(["heading", "row", "row"], [1, 3, 2]), {
          from: 1,
          to: 1,
          room: 2,
          first: 0,
        }),
      ).toEqual({
        first: 1,
        shown: 1,
        below: 0,
        pinned: { heading: nameHeading(0), place: 1, size: 2 },
      });
    });

    it("keeps the pinned heading and the sign over a thread whose events outgrow the whole room", () => {
      expect(
        placeList(makeBlocks(["heading", ...makeRows(4)], [1, 40, 3, 3, 3]), {
          from: 0,
          to: 1,
          room: 32,
          first: 0,
        }),
      ).toEqual({
        first: 1,
        shown: 1,
        below: 3,
        pinned: { heading: nameHeading(0), place: 1, size: 4 },
      });
    });

    it("gives the same place when placed again from the first block it gave", () => {
      for (const [from, to, room, first] of [
        [3, 3, 12, 0],
        [0, 1, 7, 5],
        [5, 5, 6, 0],
        [3, 3, 16, 2],
        [6, 6, 4, 0],
      ]) {
        const placed = placeList(makeBlocks(kinds, heights), {
          from: from,
          to: to,
          room: room,
          first: first,
        });
        expect(
          placeList(makeBlocks(kinds, heights), {
            from: from,
            to: to,
            room: room,
            first: placed.first,
          }),
        ).toEqual(placed);
      }
    });

    it("starts no further than the last block when told to start past it", () => {
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 99,
          to: 99,
          room: 4,
          first: 99,
        }),
      ).toEqual({
        first: 6,
        shown: 1,
        below: 0,
        pinned: { heading: nameHeading(4), place: 2, size: 2 },
      });
    });

    it("places nothing in a list with no block", () => {
      expect(
        placeList(makeBlocks([], []), { from: 0, to: 0, room: 5, first: 3 }),
      ).toEqual({
        first: 0,
        shown: 0,
        below: 0,
      });
    });
  });

  describe("the pinned heading", () => {
    it("pins nothing while the list starts at a heading, or has no heading", () => {
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 1,
          to: 1,
          room: 6,
          first: 0,
        }).pinned,
      ).toBeUndefined();
      expect(
        placeList(makeBlocks(makeRows(3), [2, 2, 2]), {
          from: 2,
          to: 2,
          room: 2,
          first: 0,
        }).pinned,
      ).toBeUndefined();
    });

    it("pins the group of the first row shown, with that row's place and the group's size", () => {
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 3,
          to: 3,
          room: 6,
          first: 0,
        }),
      ).toEqual({
        first: 2,
        shown: 2,
        below: 2,
        pinned: { heading: nameHeading(0), place: 2, size: 3 },
      });
    });

    it("gives way to the next group's heading as it reaches the top, and pins that group past it", () => {
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 3,
          to: 3,
          room: 6,
          first: 3,
        }).pinned,
      ).toEqual({
        heading: nameHeading(0),
        place: 3,
        size: 3,
      });
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 4,
          to: 5,
          room: 6,
          first: 3,
        }),
      ).toEqual({
        first: 4,
        shown: 3,
        below: 0,
      });
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 6,
          to: 6,
          room: 4,
          first: 4,
        }),
      ).toEqual({
        first: 6,
        shown: 1,
        below: 0,
        pinned: { heading: nameHeading(4), place: 2, size: 2 },
      });
    });
  });

  describe("the rows cut off below", () => {
    it("keeps the last line for the sign, and counts every row under it, in whichever group", () => {
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 1,
          to: 1,
          room: 6,
          first: 0,
        }),
      ).toEqual({
        first: 0,
        shown: 3,
        below: 3,
      });
    });

    it("counts no heading below", () => {
      expect(
        placeList(
          makeBlocks(["heading", "row", "heading", "row"], [2, 1, 2, 2]),
          {
            from: 1,
            to: 1,
            room: 4,
            first: 0,
          },
        ),
      ).toEqual({ first: 0, shown: 2, below: 1 });
    });

    it("keeps no line for the sign once every block below fits", () => {
      expect(
        placeList(makeBlocks(grouped, lines), {
          from: 6,
          to: 6,
          room: 12,
          first: 0,
        }),
      ).toEqual({
        first: 0,
        shown: 7,
        below: 0,
      });
    });
  });
});
