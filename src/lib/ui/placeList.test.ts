import { describe, expect, it } from "vitest";
import placeList from "./placeList.js";
import type { ListBlockKind } from "./types.js";

const rows = (count: number): ListBlockKind[] => Array(count).fill("row");

// A heading, then rows: three of two lines, and the selected row's block
// of seven lines (the row and its five-line accordion) where the tests
// put it.
const kinds: ListBlockKind[] = ["heading", ...rows(6)];
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
      expect(placeList(kinds, heights, 3, 3, 18, 0)).toEqual({
        first: 0,
        shown: 7,
        below: 0,
      });
      expect(placeList(kinds, heights, 1, 1, 12, 0).first).toBe(0);
    });

    it("scrolls down only as far as the selected block needs, with the pinned heading's and the sign's lines", () => {
      expect(placeList(kinds, heights, 3, 3, 12, 0)).toEqual({
        first: 2,
        shown: 2,
        below: 3,
        pinned: { heading: 0, place: 2, size: 6 },
      });
      expect(placeList(rows(7), heights, 3, 3, 12, 0).first).toBe(1);
    });

    it("scrolls up to a selection above the first block shown, with its heading", () => {
      expect(
        placeList(["heading", ...rows(3)], [1, 7, 2, 2], 0, 1, 12, 2),
      ).toEqual({ first: 0, shown: 4, below: 0 });
    });

    it("shows the selected block from its top when it is taller than the room, cut between the pinned heading and the sign", () => {
      expect(placeList(kinds, heights, 3, 3, 4, 0)).toEqual({
        first: 3,
        shown: 1,
        below: 3,
        pinned: { heading: 0, place: 3, size: 6 },
      });
      expect(placeList(rows(2), [9, 2], 0, 0, 2, 0)).toEqual({
        first: 0,
        shown: 1,
        below: 1,
      });
      // A line of room is the first block's alone.
      expect(placeList(kinds, heights, 3, 3, 1, 0)).toEqual({
        first: 3,
        shown: 1,
        below: 0,
      });
    });

    it("scrolls back up when the room grows, as far as the blocks below fill it", () => {
      expect(placeList(rows(6), [2, 7, 2, 3, 2, 2], 1, 1, 20, 1).first).toBe(0);
      expect(placeList(kinds, heights, 3, 3, 17, 2).first).toBe(0);
      // A row at the top costs the pinned heading's line.
      expect(placeList(kinds, heights, 3, 3, 16, 2)).toEqual({
        first: 2,
        shown: 5,
        below: 0,
        pinned: { heading: 0, place: 2, size: 6 },
      });
    });

    it("scrolls back up when blocks below go away", () => {
      expect(
        placeList(["heading", ...rows(3)], [1, 2, 2, 7], 3, 3, 12, 2).first,
      ).toBe(0);
    });

    it("pins the heading over the selected row when both do not fit, and keeps the sign, cutting the row instead", () => {
      expect(placeList(["heading", "row"], [1, 7], 0, 1, 8, 0)).toEqual({
        first: 0,
        shown: 2,
        below: 0,
      });
      expect(placeList(["heading", "row"], [1, 7], 0, 1, 7, 0)).toEqual({
        first: 1,
        shown: 1,
        below: 0,
        pinned: { heading: 0, place: 1, size: 1 },
      });
      expect(placeList(grouped, [1, 5, 2, 2, 1, 2, 2], 1, 1, 6, 0)).toEqual({
        first: 1,
        shown: 1,
        below: 4,
        pinned: { heading: 0, place: 1, size: 3 },
      });
      expect(placeList(grouped, [1, 5, 2, 2, 1, 2, 2], 1, 1, 7, 1)).toEqual({
        first: 1,
        shown: 1,
        below: 4,
        pinned: { heading: 0, place: 1, size: 3 },
      });
    });

    it("keeps the pinned heading and the sign over a thread whose events outgrow the whole room", () => {
      expect(
        placeList(["heading", ...rows(4)], [1, 40, 3, 3, 3], 0, 1, 32, 0),
      ).toEqual({
        first: 1,
        shown: 1,
        below: 3,
        pinned: { heading: 0, place: 1, size: 4 },
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
        const placed = placeList(kinds, heights, from, to, room, first);
        expect(placeList(kinds, heights, from, to, room, placed.first)).toEqual(
          placed,
        );
      }
    });

    it("starts no further than the last block when told to start past it", () => {
      expect(placeList(grouped, lines, 99, 99, 4, 99)).toEqual({
        first: 6,
        shown: 1,
        below: 0,
        pinned: { heading: 4, place: 2, size: 2 },
      });
    });

    it("places nothing in a list with no block", () => {
      expect(placeList([], [], 0, 0, 5, 3)).toEqual({
        first: 0,
        shown: 0,
        below: 0,
      });
    });
  });

  describe("the pinned heading", () => {
    it("pins nothing while the list starts at a heading, or has no heading", () => {
      expect(placeList(grouped, lines, 1, 1, 6, 0).pinned).toBeUndefined();
      expect(placeList(rows(3), [2, 2, 2], 2, 2, 2, 0).pinned).toBeUndefined();
    });

    it("pins the group of the first row shown, with that row's place and the group's size", () => {
      expect(placeList(grouped, lines, 3, 3, 6, 0)).toEqual({
        first: 2,
        shown: 2,
        below: 2,
        pinned: { heading: 0, place: 2, size: 3 },
      });
    });

    it("gives way to the next group's heading as it reaches the top, and pins that group past it", () => {
      expect(placeList(grouped, lines, 3, 3, 6, 3).pinned).toEqual({
        heading: 0,
        place: 3,
        size: 3,
      });
      expect(placeList(grouped, lines, 4, 5, 6, 3)).toEqual({
        first: 4,
        shown: 3,
        below: 0,
      });
      expect(placeList(grouped, lines, 6, 6, 4, 4)).toEqual({
        first: 6,
        shown: 1,
        below: 0,
        pinned: { heading: 4, place: 2, size: 2 },
      });
    });

    it("pins nothing over a block that is not a row", () => {
      const help: ListBlockKind[] = ["heading", "row", "other"];
      expect(placeList(help, [2, 1, 2], 2, 2, 2, 2).pinned).toBeUndefined();
    });
  });

  describe("the rows cut off below", () => {
    it("keeps the last line for the sign, and counts every row under it, in whichever group", () => {
      expect(placeList(grouped, lines, 1, 1, 6, 0)).toEqual({
        first: 0,
        shown: 3,
        below: 3,
      });
    });

    it("counts no heading and nothing but rows below", () => {
      const help: ListBlockKind[] = ["heading", "row", "heading", "other"];
      expect(placeList(help, [2, 1, 2, 2], 1, 1, 4, 0)).toEqual({
        first: 0,
        shown: 2,
        below: 0,
      });
    });

    it("keeps no line for the sign once every block below fits", () => {
      expect(placeList(grouped, lines, 6, 6, 12, 0)).toEqual({
        first: 0,
        shown: 7,
        below: 0,
      });
    });
  });
});
