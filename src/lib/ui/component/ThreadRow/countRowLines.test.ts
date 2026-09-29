import { describe, expect, it } from "vitest";
import {
  botReview,
  overReview,
  sharedClose,
} from "../../../../testing/rows.js";
import countRowLines from "./countRowLines.js";

describe("countRowLines", () => {
  it("counts two lines for a wait with one owner", () => {
    expect(countRowLines(overReview, 40)).toBe(2);
  });

  it("counts the owners' lines of a shared wait, which grow as the pane narrows", () => {
    expect(countRowLines(sharedClose, 40)).toBe(3);
    expect(countRowLines(sharedClose, 20)).toBe(4);
  });

  it("counts every line of a selected row's title in full, and a line for the owner when it does not fit beside the last", () => {
    expect(countRowLines(botReview, 40, true)).toBe(3);
    expect(countRowLines(botReview, 60, true)).toBe(2);
  });
});
