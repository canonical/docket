import { describe, expect, it } from "vitest";
import describeAddress from "./describeAddress.js";

describe("describeAddress", () => {
  it("names the ungrouped list by its mode alone", () => {
    expect(describeAddress({ mode: "owed", grouping: "none" })).toEqual({
      title: { text: "owed", fit: "trimmed" },
    });
  });

  it("gives a grouping as the address beside the mode", () => {
    const addresses = (["owner", "repo", "stack"] as const).map(
      (grouping) => describeAddress({ mode: "owed", grouping }).address,
    );
    expect(addresses).toEqual([
      { text: "by owner", fit: "trimmed" },
      { text: "by repo", fit: "trimmed" },
      { text: "by stack", fit: "trimmed" },
    ]);
  });
});
