import { describe, expect, it } from "vitest";
import fitBlock from "./fitBlock.js";

const runs = [
  { text: "12345 ", look: "figure" },
  { text: "67890", look: "figure" },
];

describe("fitBlock", () => {
  it("wraps the runs of a kind the table wraps in a block", () => {
    expect(fitBlock(runs, "words", 8)).toEqual([
      [{ text: "12345", look: "figure" }],
      [{ text: "67890", look: "figure" }],
    ]);
  });

  it("keeps the runs of a kind the table keeps whole on one line, cut at its end", () => {
    expect(fitBlock(runs, "figure", 8)).toEqual([
      [
        { text: "12345 ", look: "figure" },
        { text: "6…", look: "figure" },
      ],
    ]);
  });
});
