import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { thread } from "../../testing/facts.js";
import {
  bot,
  fakeGitHub,
  page,
  rateLimit,
  repository,
  settle,
  token,
  user,
} from "../../testing/github.js";
import createClient from "./createClient.js";
import listReviewCandidates from "./listReviewCandidates.js";

let github: ReturnType<typeof fakeGitHub>;
const teams = "/repos/example-org/example-repo/teams";

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const candidates = () =>
  settle(
    listReviewCandidates(createClient(token, "1.2.3"), {
      ...thread(),
      number: 2,
      kind: "pullRequest",
    }),
  );
const assignable = (...pages: [string[], string | null][]) =>
  github.graphql(
    "Assignable",
    ...pages.map(([logins, next]) =>
      repository({
        assignableUsers: page(
          logins.map((login) => ({ login })),
          next,
        ),
      }),
    ),
  );

describe("listReviewCandidates", () => {
  it("lists the requests, the suggestions, the people and the teams", async () => {
    github.graphql(
      "Candidates",
      repository({
        pullRequest: {
          reviewRequests: {
            nodes: [
              { requestedReviewer: user("bob") },
              {
                requestedReviewer: {
                  __typename: "Team",
                  combinedSlug: "example-org/reviewers",
                },
              },
              { requestedReviewer: null },
            ],
          },
          suggestedReviewers: [
            { reviewer: user("carol") },
            { reviewer: bot("example-review") },
          ],
        },
      }),
    );
    github.rest(
      `GET ${teams}`,
      {
        body: [{ slug: "reviewers" }],
        headers: {
          link: `<https://api.github.com${teams}?page=2>; rel="next"`,
        },
      },
      { body: [{ slug: "design" }] },
    );
    assignable([["alice"], "u1"], [["bob"], null]);
    expect(await candidates()).toEqual({
      requested: [
        { login: "bob", type: "user" },
        { team: "example-org/reviewers" },
      ],
      suggested: [
        { login: "carol", type: "user" },
        { login: "example-review", type: "bot" },
      ],
      people: [
        { login: "alice", type: "user" },
        { login: "bob", type: "user" },
      ],
      teams: ["example-org/reviewers", "example-org/design"],
    });
  });

  it("lists no request or suggestion for a pull request GitHub does not find", async () => {
    github.graphql("Candidates", {
      body: {
        data: { rateLimit, repository: { pullRequest: null } },
        errors: [
          {
            type: "NOT_FOUND",
            path: ["repository", "pullRequest"],
            message: "Could not resolve to a PullRequest with the number of 2.",
          },
        ],
      },
    });
    github.rest(`GET ${teams}`, { body: [] });
    assignable([[], null]);
    expect(await candidates()).toMatchObject({ requested: [], suggested: [] });
  });
});
