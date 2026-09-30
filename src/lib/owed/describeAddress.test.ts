import { describe, expect, it } from "vitest";
import describeAddress from "./describeAddress.js";

describe("describeAddress", () => {
  it("names the ungrouped list by its mode alone", () => {
    expect(describeAddress({ mode: "owed", grouping: "none" })).toEqual({
      title: { text: "owed", kind: "words" },
    });
  });

  it("gives a grouping as the address beside the mode", () => {
    const addresses = (["owner", "repo", "stack"] as const).map(
      (grouping) => describeAddress({ mode: "owed", grouping }).address,
    );
    expect(addresses).toEqual([
      { text: "by owner", kind: "words" },
      { text: "by repo", kind: "words" },
      { text: "by stack", kind: "words" },
    ]);
  });
});
