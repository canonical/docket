import { describe, expect, it } from "vitest";
import { overReview, sharedClose } from "../../../../testing/rows.js";
import listOwnerLines from "./listOwnerLines.js";

/** Each line's text, its runs joined. */
const readLines = (lines: ReturnType<typeof listOwnerLines>) =>
  lines.map((line) => line.map(({ text }) => text).join(""));

describe("listOwnerLines", () => {
  it("names every owner of a shared wait, each login cut at 12 cells", () => {
    expect(readLines(listOwnerLines(sharedClose, 40))).toEqual([
      "● alice, ● bob, ◐ carol-at-ex…",
    ]);
  });

  it("wraps the owners in a narrow pane", () => {
    expect(readLines(listOwnerLines(sharedClose, 20))).toEqual([
      "● alice, ● bob,",
      "◐ carol-at-ex…",
    ]);
  });

  it("gives no line to a wait with one owner", () => {
    expect(listOwnerLines(overReview, 40)).toEqual([]);
  });
});
