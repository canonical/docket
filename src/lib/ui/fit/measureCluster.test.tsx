import { describe, expect, it } from "vitest";
import measureCluster from "./measureCluster.js";

describe("measureCluster", () => {
  it("counts one character as measureClusters does", () => {
    expect(measureCluster("a")).toBe(1);
    expect(measureCluster("漢")).toBe(2);
    expect(measureCluster("👍🏽")).toBe(4);
  });
});
