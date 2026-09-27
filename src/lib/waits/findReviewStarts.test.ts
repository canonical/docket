import { describe, expect, it } from "vitest";
import {
  alice,
  at,
  bob,
  carol,
  exampleSync,
  teamSettings,
  thread,
} from "../../testing/facts.js";
import type { Account, Author } from "../people/index.js";
import findReviewStarts from "./findReviewStarts.js";
import type { ReviewRequest, Team, Thread } from "./types.js";

const { people } = teamSettings;
const requested = at("2026-09-22T11:00+02:00");
const request = (reviewer: Account | Team, iso?: string): ReviewRequest => ({
  reviewer,
  at: iso ? at(iso) : requested,
});
const review = (author: Author, iso: string) => ({ author, at: at(iso) });
const pull = (facts: Partial<Thread>) =>
  thread({ kind: "pullRequest", author: carol, ...facts });
const reviewers: Team = {
  team: "example-org/reviewers",
  members: ["Alice", "example-sync"],
};

describe("findReviewStarts", () => {
  it("starts a wait at the request", () => {
    const waiting = pull({ reviewRequests: [request(alice)] });
    expect(findReviewStarts(waiting, people)).toEqual([
      { reviewer: "alice", started: requested },
    ]);
  });

  it("makes one wait per requested reviewer, each with its own start", () => {
    const waiting = pull({
      reviewRequests: [request(alice), request(bob, "2026-09-22T12:00+02:00")],
    });
    expect(findReviewStarts(waiting, people)).toEqual([
      { reviewer: "alice", started: requested },
      { reviewer: "bob", started: at("2026-09-22T12:00+02:00") },
    ]);
  });

  it("makes no wait for a review requested from a bot", () => {
    const botRequested = pull({
      reviewRequests: [request(exampleSync), request(bob)],
    });
    expect(findReviewStarts(botRequested, people)).toEqual([
      { reviewer: "bob", started: requested },
    ]);
    const configuredBot = new Map([...people, ["bob", "bot" as const]]);
    expect(findReviewStarts(botRequested, configuredBot)).toEqual([]);
  });

  it("makes no wait once the reviewer has reviewed since the request, until a push", () => {
    const reviewed = pull({
      reviewRequests: [request(alice)],
      reviews: [review(alice, "2026-09-22T12:00+02:00")],
      pushes: [at("2026-09-22T10:30+02:00")],
    });
    expect(findReviewStarts(reviewed, people)).toEqual([]);
  });

  it("starts again at the latest push after the reviewer's latest review", () => {
    const pushedSince = pull({
      reviewRequests: [request(alice)],
      reviews: [
        review(alice, "2026-09-22T14:00+02:00"),
        review(alice, "2026-09-22T12:00+02:00"),
      ],
      pushes: [
        at("2026-09-22T16:00+02:00"),
        at("2026-09-22T13:00+02:00"),
        at("2026-09-22T15:00+02:00"),
      ],
    });
    expect(findReviewStarts(pushedSince, people)).toEqual([
      { reviewer: "alice", started: at("2026-09-22T16:00+02:00") },
    ]);
  });

  it("starts at a request made again after an earlier review", () => {
    const askedAgain = pull({
      reviewRequests: [request(alice, "2026-09-23T09:00+02:00")],
      reviews: [review(alice, "2026-09-22T12:00+02:00")],
      pushes: [at("2026-09-22T16:00+02:00")],
    });
    expect(findReviewStarts(askedAgain, people)).toEqual([
      { reviewer: "alice", started: at("2026-09-23T09:00+02:00") },
    ]);
  });

  it("waits again for a reviewer who reviewed, once a push follows the review", () => {
    const pushedAfterReview = pull({
      reviewRequests: [request(alice)],
      reviews: [review(alice, "2026-09-22T12:00+02:00")],
      pushes: [at("2026-09-22T13:00+02:00")],
    });
    expect(findReviewStarts(pushedAfterReview, people)).toEqual([
      { reviewer: "alice", started: at("2026-09-22T13:00+02:00") },
    ]);
  });

  it("makes one wait for a reviewer asked twice, from the latest request", () => {
    const askedTwice = pull({
      reviewRequests: [
        request(alice, "2026-09-22T12:00+02:00"),
        request({ ...alice, login: "Alice" }),
        request(reviewers, "2026-09-22T12:00+02:00"),
        request(reviewers, "2026-09-22T13:00+02:00"),
      ],
    });
    expect(findReviewStarts(askedTwice, people)).toEqual([
      { reviewer: "alice", started: at("2026-09-22T12:00+02:00") },
      {
        reviewer: "example-org/reviewers",
        started: at("2026-09-22T13:00+02:00"),
      },
    ]);
  });

  it("counts a review given at the instant of the request", () => {
    const sameInstant = pull({
      reviewRequests: [request(alice)],
      reviews: [review(alice, "2026-09-22T11:00+02:00")],
    });
    expect(findReviewStarts(sameInstant, people)).toEqual([]);
  });

  it("starts no wait at a push made at the instant of the review", () => {
    const sameInstant = pull({
      reviewRequests: [request(alice)],
      reviews: [review(alice, "2026-09-22T12:00+02:00")],
      pushes: [at("2026-09-22T12:00+02:00")],
    });
    expect(findReviewStarts(sameInstant, people)).toEqual([]);
  });

  it("ends a person's wait at their review, whatever the case of the review author's login", () => {
    const reviewedAsAlice = pull({
      reviewRequests: [request(alice)],
      reviews: [review({ ...alice, login: "Alice" }, "2026-09-22T12:00+02:00")],
    });
    expect(findReviewStarts(reviewedAsAlice, people)).toEqual([]);
  });

  it("ends only at a review by the requested reviewer", () => {
    const otherReviewer = pull({
      reviewRequests: [request(alice)],
      reviews: [review(bob, "2026-09-22T12:00+02:00")],
    });
    expect(findReviewStarts(otherReviewer, people)).toEqual([
      { reviewer: "alice", started: requested },
    ]);
  });

  it("names a requested team, and ends its wait at a review by any member, whatever the login's case", () => {
    const teamRequested = pull({ reviewRequests: [request(reviewers)] });
    expect(findReviewStarts(teamRequested, people)).toEqual([
      { reviewer: "example-org/reviewers", started: requested },
    ]);
    const memberReviewed = pull({
      reviewRequests: [request(reviewers)],
      reviews: [review(alice, "2026-09-22T12:00+02:00")],
    });
    expect(findReviewStarts(memberReviewed, people)).toEqual([]);
  });

  it("lets no bot's review end a wait, even a bot in the requested team", () => {
    const botReviewed = pull({
      reviewRequests: [request(reviewers)],
      reviews: [review(exampleSync, "2026-09-22T12:00+02:00")],
    });
    expect(findReviewStarts(botReviewed, people)).toEqual([
      { reviewer: "example-org/reviewers", started: requested },
    ]);
  });
});
