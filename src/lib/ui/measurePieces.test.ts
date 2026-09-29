import { describe, expect, it } from "vitest";
import measurePieces from "./measurePieces.js";

describe("measurePieces", () => {
  it("adds up the display cells of every run, a wide character taking two", () => {
    const fg = "#000000";
    expect(
      measurePieces([
        { text: "◉ alice", fg },
        { text: "🎉", fg },
      ]),
    ).toBe(9);
  });
});
