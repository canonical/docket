import { describe, expect, it } from "vitest";
import describeTeam from "./describeTeam.js";

const reviewers = { team: "example-org/reviewers", members: ["alice", "Bob"] };

describe("describeTeam", () => {
  it("names a team the viewer belongs to you, whatever the case", () => {
    expect(describeTeam(reviewers, "bob")).toEqual({
      text: "example-org/reviewers",
      fit: "trimmed",
      group: "you",
    });
  });

  it("names any other team as text, and every team when the viewer is not known", () => {
    const text = { text: "example-org/reviewers", fit: "trimmed" };
    expect(describeTeam(reviewers, "carol")).toEqual(text);
    expect(describeTeam(reviewers, undefined)).toEqual(text);
  });
});
