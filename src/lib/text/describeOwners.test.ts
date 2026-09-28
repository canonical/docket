import { describe, expect, it } from "vitest";
import describeOwners from "./describeOwners.js";

describe("describeOwners", () => {
  it("says unassigned when no one owns it", () => {
    expect(describeOwners([])).toBe("unassigned");
  });

  it("names one owner, or every owner", () => {
    expect(describeOwners(["alice"])).toBe("owner alice");
    expect(describeOwners(["alice", "bob"])).toBe("owners alice, bob");
  });
});
