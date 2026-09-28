import { describe, expect, it } from "vitest";
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
  wait: identifyRow(row),
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
        wait: identifyRow(sharedClose),
      }),
    ).toBe(2);
  });

  it("keeps its place, within the list, when the wait is gone", () => {
    const gone = { place: 2, wait: "example#99 close " };
    expect(placeSelection(rows, gone)).toBe(2);
    expect(placeSelection(rows.slice(0, 2), gone)).toBe(1);
    expect(placeSelection([], gone)).toBe(0);
  });
});
