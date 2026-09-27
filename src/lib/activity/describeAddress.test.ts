import { describe, expect, it } from "vitest";
import describeAddress from "./describeAddress.js";

describe("describeAddress", () => {
  it("names the ungrouped list by its mode and window", () => {
    const address = {
      mode: "activity",
      window: { amount: 1, unit: "w" },
      grouping: "none",
    } as const;
    expect(describeAddress(address)).toEqual(["activity", "1w"]);
  });
});
