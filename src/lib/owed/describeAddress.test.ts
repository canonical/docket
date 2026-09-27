import { describe, expect, it } from "vitest";
import describeAddress from "./describeAddress.js";

describe("describeAddress", () => {
  it("names the ungrouped list by its mode alone", () => {
    expect(describeAddress({ mode: "owed", grouping: "none" })).toEqual([
      "owed",
    ]);
  });

  it("names a grouping after its mode", () => {
    const names = (["owner", "repo", "stack"] as const).map((grouping) =>
      describeAddress({ mode: "owed", grouping }).join(" · "),
    );
    expect(names).toEqual([
      "owed · by owner",
      "owed · by repo",
      "owed · by stack",
    ]);
  });
});
