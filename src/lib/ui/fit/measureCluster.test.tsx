import { TextBufferView } from "@opentui/core";
import { describe, expect, it, vi } from "vitest";
import measureCluster from "./measureCluster.js";

describe("measureCluster", () => {
  it("counts a character as Bun does, and keeps no answer, when OpenTUI's library cannot measure it", () => {
    // The native library is the boundary: it fails only when it cannot
    // allocate, which a test cannot bring about.
    const measure = vi
      .spyOn(TextBufferView.prototype, "measureForDimensions")
      .mockReturnValueOnce(null);
    expect(measureCluster("❤")).toBe(Bun.stringWidth("❤"));
    measure.mockRestore();
    expect(measureCluster("❤")).toBe(2);
    expect(Bun.stringWidth("❤")).toBe(1);
  });

  it("counts a printable ASCII character one cell", () => {
    expect(measureCluster("a")).toBe(1);
  });

  it("answers again what it has measured once", () => {
    expect(measureCluster("漢")).toBe(2);
    expect(measureCluster("漢")).toBe(2);
  });
});
