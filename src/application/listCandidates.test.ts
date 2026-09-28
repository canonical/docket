import { describe, expect, it } from "vitest";
import { alice, bob, carol, dave, exampleSync } from "../testing/facts.js";
import { parserFix } from "../testing/recorded.js";
import listCandidates from "./listCandidates.js";

/** The pull request, with a comment from carol and a bot, and dave's review. */
const discussed = {
  ...parserFix,
  author: dave,
  comments: [
    { author: carol, at: parserFix.createdAt },
    { author: exampleSync, at: parserFix.createdAt },
  ],
  reviews: [{ author: { ...alice, login: "ALICE" }, at: parserFix.createdAt }],
};

describe("listCandidates", () => {
  it("offers to assign the assignees, the team, the people on the thread, then everyone assignable", () => {
    expect(
      listCandidates({
        action: "assign",
        thread: discussed,
        team: ["bob", "alice"],
        candidates: {
          current: ["alice"],
          offered: ["alice", "bob", "carol", "dave", "erin"],
        },
      }),
    ).toEqual(["alice", "bob", "dave", "carol", "erin"]);
  });

  it("leaves bots on the thread out", () => {
    const names = listCandidates({
      action: "assign",
      thread: discussed,
      team: [],
      candidates: { current: [], offered: [] },
    });
    expect(names).not.toContain(exampleSync.login);
  });

  it("offers each name once, whatever its case, as first written", () => {
    expect(
      listCandidates({
        action: "assign",
        thread: parserFix,
        team: ["Bob"],
        candidates: { current: ["bob"], offered: ["BOB"] },
      }),
    ).toEqual(["bob", "dave"]);
  });

  it("offers a review to the requests, then whom GitHub offers in its order, teams included", () => {
    expect(
      listCandidates({
        action: "review",
        thread: discussed,
        team: ["alice"],
        candidates: {
          current: [bob.login],
          offered: ["carol", "alice", "bob", "example-org/reviewers"],
        },
      }),
    ).toEqual(["bob", "carol", "alice", "example-org/reviewers"]);
  });
});
