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
    expect(describeAddress(address)).toEqual(["activity", "1w"]);
  });

  it("names a grouping after the window", () => {
    const names = (["kind", "repo"] as const).map((grouping) =>
      describeAddress({ mode: "activity", window, grouping }).join(" · "),
    );
    expect(names).toEqual([
      "activity · 24h · by kind",
      "activity · 24h · by repo",
    ]);
  });
});
