import { TextBuffer } from "@opentui/core";
import { describe, expect, it, vi } from "vitest";
import measureClusters from "./measureClusters.js";

describe("measureClusters", () => {
  it("counts a printable ASCII character one cell and a line break none", () => {
    expect(measureClusters(["a", "\n", "\r\n"])).toEqual([1, 0, 0]);
  });

  it("measures the characters it has not measured together, in one emptied pass of each width method", () => {
    const setText = vi.spyOn(TextBuffer.prototype, "setText");
    const reset = vi.spyOn(TextBuffer.prototype, "reset");
    expect(measureClusters(["字", "❤", "字", "👍🏿"])).toEqual([2, 2, 2, 4]);
    expect(setText).toHaveBeenCalledTimes(2);
    expect(setText).toHaveBeenCalledWith("字\n❤\n👍🏿");
    expect(reset).toHaveBeenCalledTimes(2);
    expect(measureClusters(["❤", "字"])).toEqual([2, 2]);
    expect(setText).toHaveBeenCalledTimes(2);
    setText.mockRestore();
    reset.mockRestore();
  });
});
