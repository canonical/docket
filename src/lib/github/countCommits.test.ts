import { describe, expect, it } from "vitest";
import countCommits from "./countCommits.js";

const commits = ["a1", "b2", "c3", "d4"];

describe("countCommits", () => {
  it("counts the commits between the heads before and after a push", () => {
    expect(countCommits(commits, "a1", "d4")).toBe(3);
    expect(countCommits(commits, "c3", "d4")).toBe(1);
  });

  it("counts nothing when either head is not among the commits", () => {
    expect(countCommits(commits, "f0", "d4")).toBeUndefined();
    expect(countCommits(commits, "a1", "e5")).toBeUndefined();
    expect(countCommits(commits, "d4", "a1")).toBeUndefined();
  });
});
