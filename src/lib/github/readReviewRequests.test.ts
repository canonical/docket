import { describe, expect, it } from "vitest";
import readReviewRequests from "./readReviewRequests.js";
import type { RequestNode } from "./types.js";

const requested = (
  createdAt: string,
  requestedReviewer: RequestNode["requestedReviewer"],
): RequestNode => ({
  __typename: "ReviewRequestedEvent",
  createdAt,
  requestedReviewer,
});
const withdrawn = (
  createdAt: string,
  requestedReviewer: RequestNode["requestedReviewer"],
): RequestNode => ({
  __typename: "ReviewRequestRemovedEvent",
  createdAt,
  requestedReviewer,
});
const alice = { __typename: "User", login: "alice" };
const reviewers = { __typename: "Team", combinedSlug: "example-org/reviewers" };
const none = new Map<string, readonly string[]>();

describe("readReviewRequests", () => {
  it("reads each standing request, with when it was made", () => {
    expect(
      readReviewRequests([requested("2026-09-22T09:00:00Z", alice)], none),
    ).toEqual([
      {
        reviewer: { login: "alice", type: "user" },
        at: new Date("2026-09-22T09:00:00Z"),
      },
    ]);
  });

  it("names who asked for each request, and a deleted account as GitHub shows it", () => {
    const [byBob, byNobody] = readReviewRequests(
      [
        {
          ...requested("2026-09-22T09:00:00Z", alice),
          actor: { __typename: "User", login: "bob" },
        },
        { ...requested("2026-09-22T09:00:00Z", reviewers), actor: null },
      ],
      none,
    );
    expect(byBob?.requester).toEqual({ login: "bob", type: "user" });
    expect(byNobody?.requester).toEqual({ login: "ghost", type: "user" });
  });

  it("keeps the latest request to the same reviewer, and who made it, whatever the order given", () => {
    const requests = readReviewRequests(
      [
        {
          ...requested("2026-09-23T09:00:00Z", alice),
          actor: { __typename: "User", login: "carol" },
        },
        {
          ...requested("2026-09-22T09:00:00Z", { ...alice, login: "Alice" }),
          actor: { __typename: "User", login: "bob" },
        },
      ],
      none,
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.at).toEqual(new Date("2026-09-23T09:00:00Z"));
    expect(requests[0]?.requester).toEqual({ login: "carol", type: "user" });
  });

  it("drops a request a later withdrawal cancelled", () => {
    expect(
      readReviewRequests(
        [
          withdrawn("2026-09-23T09:00:00Z", alice),
          requested("2026-09-22T09:00:00Z", alice),
        ],
        none,
      ),
    ).toEqual([]);
  });

  it("keeps a request made again after a withdrawal", () => {
    expect(
      readReviewRequests(
        [
          requested("2026-09-22T09:00:00Z", alice),
          withdrawn("2026-09-23T09:00:00Z", alice),
          requested("2026-09-24T09:00:00Z", alice),
        ],
        none,
      ).map(({ at }) => at),
    ).toEqual([new Date("2026-09-24T09:00:00Z")]);
  });

  it("gives a team its listed members, or none when it is not listed", () => {
    const node = requested("2026-09-22T09:00:00Z", reviewers);
    expect(
      readReviewRequests(
        [node],
        new Map([["example-org/reviewers", ["alice", "bob"]]]),
      )[0]?.reviewer,
    ).toEqual({ team: "example-org/reviewers", members: ["alice", "bob"] });
    expect(readReviewRequests([node], none)[0]?.reviewer).toEqual({
      team: "example-org/reviewers",
      members: [],
    });
  });

  it("skips a request to a reviewer GitHub does not show", () => {
    expect(
      readReviewRequests([requested("2026-09-22T09:00:00Z", null)], none),
    ).toEqual([]);
  });
});
