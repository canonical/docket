import { describe, expect, it } from "vitest";
import placeList from "./placeList.js";
import type { ListBlockKind } from "./types.js";

const rows = (count: number): ListBlockKind[] => Array(count).fill("row");

// A heading, three two-line rows, and the selected row's block of seven
// lines (the row and its five-line accordion) where the tests put it.
const kinds: ListBlockKind[] = ["heading", ...rows(6)];
const heights = [1, 2, 2, 7, 2, 1, 2];

/** The first block the list shows, and nothing else. */
const findFirst = (...args: Parameters<typeof placeList>) =>
  placeList(...args).first;

describe("placeList", () => {
  describe("where the list starts", () => {
    it("keeps the first block while the selection is in view", () => {
      expect(findFirst(kinds, heights, 3, 3, 12, 0)).toBe(0);
    });

    it("scrolls down only as far as the selected block needs, with the pinned heading's line", () => {
      expect(findFirst(rows(7), heights, 3, 3, 9, 0)).toBe(2);
      expect(findFirst(kinds, heights, 3, 3, 9, 0)).toBe(3);
    });

    it("scrolls up to a selection above the first block shown, with its heading", () => {
      expect(findFirst(["heading", ...rows(3)], [1, 7, 2, 2], 0, 1, 8, 2)).toBe(
        0,
      );
    });

    it("shows the selected block from its top when it is taller than the room", () => {
      expect(findFirst(kinds, heights, 3, 3, 4, 0)).toBe(3);
    });

    it("scrolls back up when the room grows, as far as the blocks below fill it", () => {
      expect(findFirst(rows(6), [2, 7, 2, 3, 2, 2], 1, 1, 20, 1)).toBe(0);
      expect(findFirst(kinds, heights, 3, 3, 17, 2)).toBe(0);
      // A row at the top costs the pinned heading's line.
      expect(findFirst(kinds, heights, 3, 3, 16, 2)).toBe(2);
    });

    it("scrolls back up when blocks below go away", () => {
      expect(
        findFirst(["heading", ...rows(3)], [1, 2, 2, 7], 3, 3, 12, 2),
      ).toBe(0);
    });

    it("drops the heading before the selected row when both do not fit", () => {
      expect(placeList(["heading", "row"], [1, 7], 0, 1, 8, 0)).toEqual({
        first: 0,
        shown: 2,
      });
      expect(placeList(["heading", "row"], [1, 7], 0, 1, 7, 0)).toEqual({
        first: 1,
        shown: 1,
      });
    });

    it("gives the same place when placed again from the first block it gave", () => {
      for (const [from, to, room, first] of [
        [3, 3, 9, 0],
        [0, 1, 7, 5],
        [5, 5, 6, 0],
        [3, 3, 16, 2],
      ]) {
        const placed = placeList(kinds, heights, from, to, room, first);
        expect(placeList(kinds, heights, from, to, room, placed.first)).toEqual(
          placed,
        );
      }
    });

    it("places nothing in a list with no block", () => {
      expect(placeList([], [], 0, 0, 5, 3)).toEqual({ first: 0, shown: 0 });
    });
  });

  describe("the pinned heading", () => {
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

    it("pins nothing while the list starts at a heading, or has no heading", () => {
      expect(placeList(grouped, lines, 1, 1, 6, 0).pinned).toBeUndefined();
      expect(placeList(rows(3), [2, 2, 2], 2, 2, 2, 0).pinned).toBeUndefined();
    });

    it("pins the group of the first row shown, with that row's place and the group's size", () => {
      expect(placeList(grouped, lines, 3, 3, 5, 0)).toEqual({
        first: 2,
        shown: 2,
        pinned: { heading: 0, place: 2, size: 3 },
      });
    });

    it("gives way to the next group's heading as it reaches the top, and pins that group past it", () => {
      expect(placeList(grouped, lines, 3, 3, 5, 3)).toMatchObject({
        first: 3,
        pinned: { heading: 0, place: 3 },
      });
      expect(placeList(grouped, lines, 4, 5, 5, 3)).toEqual({
        first: 4,
        shown: 3,
      });
      expect(placeList(grouped, lines, 6, 6, 3, 4)).toEqual({
        first: 6,
        shown: 1,
        pinned: { heading: 4, place: 2, size: 2 },
      });
    });

    it("counts the pinned line in the room, showing only the whole blocks under it", () => {
      expect(placeList(grouped, lines, 2, 2, 5, 2)).toEqual({
        first: 2,
        shown: 2,
        pinned: { heading: 0, place: 2, size: 3 },
      });
    });

    it("pins nothing over a row too tall to share the room with it", () => {
      expect(placeList(grouped, [1, 5, 2], 1, 1, 5, 0)).toEqual({
        first: 1,
        shown: 1,
      });
    });

    it("pins nothing over a block that is not a row", () => {
      const help: ListBlockKind[] = ["heading", "row", "other"];
      expect(placeList(help, [2, 1, 2], 2, 2, 2, 2).pinned).toBeUndefined();
    });
  });
});
