import { describe, expect, it } from "vitest";
import { overReview, sharedClose } from "../../../../testing/rows.js";
import countRowLines from "./countRowLines.js";

describe("countRowLines", () => {
  it("counts two lines for a wait with one owner", () => {
    expect(countRowLines(overReview, 40)).toBe(2);
  });

  it("counts the owners' lines of a shared wait, which grow as the pane narrows", () => {
    expect(countRowLines(sharedClose, 40)).toBe(3);
    expect(countRowLines(sharedClose, 20)).toBe(4);
  });
});
