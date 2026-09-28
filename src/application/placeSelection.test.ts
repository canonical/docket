import { describe, expect, it } from "vitest";
import { findActivityRow } from "../testing/activity.js";
import {
  draftClose,
  overReview,
  sharedClose,
  soonReply,
} from "../testing/rows.js";
import identifyRow from "./identifyRow.js";
import placeSelection from "./placeSelection.js";

const rows = [overReview, soonReply, draftClose];
const on = (place: number, row = rows[place] ?? overReview) => ({
  place,
  row: identifyRow(row),
});

describe("placeSelection", () => {
  it("stays where it was while the same wait is there", () => {
    expect(placeSelection(rows, on(1))).toBe(1);
  });

  it("follows the wait when the list moves it", () => {
    expect(placeSelection([soonReply, draftClose, overReview], on(0))).toBe(2);
  });

  it("keeps its place between two rows naming one wait", () => {
    expect(
      placeSelection([sharedClose, overReview, sharedClose], {
        place: 2,
        row: identifyRow(sharedClose),
      }),
    ).toBe(2);
  });

  it("keeps its place, within the list, when the wait is gone", () => {
    const gone = { place: 2, row: "example#99 close " };
    expect(placeSelection(rows, gone)).toBe(2);
    expect(placeSelection(rows.slice(0, 2), gone)).toBe(1);
    expect(placeSelection([], gone)).toBe(0);
  });

  it("follows activity's thread when newer events move it", () => {
    const [first, second] = [findActivityRow(12), findActivityRow(15)];
    const selected = { place: 0, row: identifyRow(first) };
    expect(placeSelection([second, first], selected)).toBe(1);
  });
});
