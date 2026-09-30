import { describe, expect, it } from "vitest";
import describeTeam from "./describeTeam.js";

const reviewers = { team: "example-org/reviewers", members: ["alice", "Bob"] };
const text = { text: "example-org/reviewers", fit: "trimmed" };
const yours = { ...text, group: "you" };

describe("describeTeam", () => {
  it("names a team the viewer belongs to you, whatever the case", () => {
    expect(describeTeam(reviewers, "bob", [])).toEqual(yours);
  });

  it("names a team the viewer lists as theirs you, with no member read", () => {
    const unread = { team: "example-org/reviewers", members: [] };
    expect(describeTeam(unread, "carol", ["Example-Org/Reviewers"])).toEqual(
      yours,
    );
    expect(describeTeam(unread, undefined, ["example-org/reviewers"])).toEqual(
      yours,
    );
  });

  it("names any other team as text, and every unlisted team when the viewer is not known", () => {
    expect(describeTeam(reviewers, "carol", ["example-org/ui"])).toEqual(text);
    expect(describeTeam(reviewers, undefined, [])).toEqual(text);
  });
});
