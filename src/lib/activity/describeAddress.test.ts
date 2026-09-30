import { describe, expect, it } from "vitest";
import describeAddress from "./describeAddress.js";

const window = { amount: 24, unit: "h" } as const;

describe("describeAddress", () => {
  it("names the ungrouped list by its mode and window", () => {
    const address = {
      mode: "activity",
      window: { amount: 1, unit: "w" },
      grouping: "none",
    } as const;
    expect(describeAddress(address)).toEqual({
      title: { text: "activity", kind: "words" },
      address: { text: "1w", kind: "words" },
    });
  });

  it("names a grouping after the window", () => {
    const addresses = (["kind", "repo"] as const).map(
      (grouping) =>
        describeAddress({ mode: "activity", window, grouping }).address?.text,
    );
    expect(addresses).toEqual(["24h · by kind", "24h · by repo"]);
  });
});
