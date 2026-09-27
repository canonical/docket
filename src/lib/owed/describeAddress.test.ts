import { describe, expect, it } from "vitest";
import describeAddress from "./describeAddress.js";

describe("describeAddress", () => {
  it("names the ungrouped list by its mode alone", () => {
    expect(describeAddress({ mode: "owed", grouping: "none" })).toEqual([
      "owed",
    ]);
  });
});
