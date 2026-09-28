import { describe, expect, it } from "vitest";
import { overReview, sharedClose } from "../../../../testing/rows.js";
import listOwnerLines from "./listOwnerLines.js";

describe("listOwnerLines", () => {
  it("names every owner of a shared wait, each login cut at 12 cells", () => {
    expect(listOwnerLines(sharedClose, 40)).toEqual([
      "alice, bob, carol-at-ex…",
    ]);
  });

  it("wraps the owners in a narrow pane", () => {
    expect(listOwnerLines(sharedClose, 20)).toEqual([
      "alice, bob,",
      "carol-at-ex…",
    ]);
  });

  it("gives no line to a wait with one owner", () => {
    expect(listOwnerLines(overReview, 40)).toEqual([]);
  });
});
