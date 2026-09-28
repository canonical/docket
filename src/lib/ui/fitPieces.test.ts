import { describe, expect, it } from "vitest";
import fitPieces from "./fitPieces.js";

const pieces = [
  { text: "←→", look: "key" },
  { text: " mode", look: "label" },
  { text: " ", look: "gap" },
  { text: "g", look: "key" },
];

describe("fitPieces", () => {
  it("keeps every run whole when the line fits", () => {
    expect(fitPieces(pieces, 40)).toEqual(pieces);
  });

  it("cuts the run that crosses the width, keeps its look, and drops the rest", () => {
    expect(fitPieces(pieces, 5)).toEqual([
      { text: "←→", look: "key" },
      { text: " m…", look: "label" },
    ]);
  });

  it("keeps runs that end exactly at the width whole", () => {
    expect(fitPieces(pieces, 7)).toEqual(pieces.slice(0, 2));
  });
});
