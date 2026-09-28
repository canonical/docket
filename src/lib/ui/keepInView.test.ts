import { describe, expect, it } from "vitest";
import keepInView from "./keepInView.js";

// A heading, three two-line rows, and the selected row's block of seven
// lines (the row and its five-line accordion) where the tests put it.
const heights = [1, 2, 2, 7, 2, 1, 2];

describe("keepInView", () => {
  it("keeps the first block while the selection is in view", () => {
    expect(keepInView(heights, 3, 3, 12, 0)).toBe(0);
  });

  it("scrolls down only as far as the selected block needs", () => {
    expect(keepInView(heights, 3, 3, 9, 0)).toBe(2);
  });

  it("scrolls up to a selection above the first block shown, with its heading", () => {
    expect(keepInView([1, 7, 2, 2], 0, 1, 8, 2)).toBe(0);
  });

  it("shows the selected block from its top when it is taller than the room", () => {
    expect(keepInView(heights, 3, 3, 4, 0)).toBe(3);
  });

  it("scrolls back up when the room grows, as far as the blocks below fill it", () => {
    expect(keepInView([2, 7, 2, 3, 2, 2], 1, 1, 20, 1)).toBe(0);
    expect(keepInView(heights, 3, 3, 16, 2)).toBe(1);
  });

  it("scrolls back up when blocks below go away", () => {
    expect(keepInView([1, 2, 2, 7], 3, 3, 12, 2)).toBe(0);
  });

  it("drops the heading before the selected row when both do not fit", () => {
    expect(keepInView([1, 7], 0, 1, 7, 0)).toBe(1);
  });
});
