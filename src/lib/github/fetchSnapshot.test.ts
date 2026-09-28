import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bob } from "../../testing/facts.js";
import {
  bot,
  comment,
  discussionNode,
  fakeGitHub,
  feedEntry,
  issueNode,
  page,
  pullNode,
  repository,
  restUser,
  type Sent,
  settle,
  token,
  user,
} from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchSnapshot from "./fetchSnapshot.js";
import listTeamMembers from "./listTeamMembers.js";

let github: ReturnType<typeof fakeGitHub>;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-09-28T10:00:00Z") });
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const repo = "example-org/example-repo";
const snapshot = (since: string | null = null) => {
  const client = createClient(token, "github.com", "1.2.3");
  return settle(
    fetchSnapshot(client, repo, since ? { since } : null, (team) =>
      listTeamMembers(client, team),
    ),
  );
};
const lists = (
  issues: unknown[] = [],
  pullRequests: unknown[] = [],
  discussions: unknown[] = [],
) =>
  repository({
    issues: page(issues),
    pullRequests: page(pullRequests),
    discussions: page(discussions),
  });
const variables = (sent: Sent) =>
  (sent.body?.variables ?? {}) as Record<string, unknown>;
const snapshotsSent = () =>
  github.sent.filter(({ url }) => url.pathname === "/graphql").map(variables);

describe("fetchSnapshot", () => {
  it("reads every open thread, fifty to a page, when there is no cursor", async () => {
    github.graphql(
      "Snapshot",
      lists(
        [
          issueNode({
            assignees: { nodes: [user("alice"), bot("example-sync")] },
            labels: { nodes: [{ name: "kind=bug" }] },
            comments: {
              nodes: [comment("bob", "2026-09-22T09:00:00Z", "MEMBER", "Hi")],
            },
          }),
        ],
        [],
        [discussionNode({ updatedAt: "2026-09-23T08:00:00Z" })],
      ),
    );
    const { threads, cursor } = await snapshot();
    expect(snapshotsSent()).toEqual([
      expect.objectContaining({
        owner: "example-org",
        name: "example-repo",
        size: 50,
        since: null,
        issueStates: ["OPEN"],
        pullStates: ["OPEN"],
        discussionStates: ["OPEN"],
      }),
    ]);
    expect(threads).toEqual([
      {
        repo,
        number: 1,
        url: "https://github.com/example-org/example-repo/issues/1",
        kind: "issue",
        title: "Example issue",
        author: { login: "dave", type: "user", member: false },
        createdAt: new Date("2026-09-22T08:00:00Z"),
        text: "Example opening",
        updatedAt: new Date("2026-09-22T08:00:00Z"),
        open: true,
        draft: false,
        labels: ["kind=bug"],
        assignees: [
          { login: "alice", type: "user" },
          { login: "example-sync", type: "bot" },
        ],
        comments: [
          { author: bob, at: new Date("2026-09-22T09:00:00Z"), text: "Hi" },
        ],
        reviews: [],
        reviewRequests: [],
        pushes: [],
      },
      expect.objectContaining({ number: 3, kind: "discussion", open: true }),
    ]);
    expect(cursor).toEqual({ since: "2026-09-23T07:59:00.000Z" });
  });

  it("reads each list's next page, and only the lists with pages left", async () => {
    github.graphql(
      "Snapshot",
      repository({
        issues: page([issueNode()]),
        pullRequests: page([pullNode()], "pulls-1"),
        discussions: page([]),
      }),
      repository({ pullRequests: page([pullNode({ number: 4 })]) }),
    );
    const { threads } = await snapshot();
    expect(snapshotsSent().at(1)).toMatchObject({
      pullsAfter: "pulls-1",
      withIssues: false,
      withPulls: true,
      withDiscussions: false,
    });
    expect(threads.map(({ number }) => number)).toEqual([1, 2, 4]);
  });

  it("reads every state since the cursor, ten to a page, and stops at the first older thread", async () => {
    github.graphql(
      "Snapshot",
      repository({
        issues: page([issueNode({ updatedAt: "2026-09-27T12:00:00Z" })]),
        pullRequests: page(
          [
            pullNode({ state: "MERGED", updatedAt: "2026-09-27T11:00:00Z" }),
            pullNode({ number: 5, updatedAt: "2026-09-26T09:00:00Z" }),
          ],
          "pulls-1",
        ),
        discussions: page(
          [discussionNode({ updatedAt: "2026-09-25T00:00:00Z" })],
          "discussions-1",
        ),
      }),
    );
    const { threads, cursor } = await snapshot("2026-09-27T00:00:00.000Z");
    expect(snapshotsSent()).toEqual([
      expect.objectContaining({
        size: 10,
        since: "2026-09-27T00:00:00.000Z",
        issueStates: ["OPEN", "CLOSED"],
        pullStates: ["OPEN", "CLOSED", "MERGED"],
        discussionStates: ["OPEN", "CLOSED"],
      }),
    ]);
    expect(threads.map(({ number, open }) => [number, open])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(cursor).toEqual({ since: "2026-09-27T11:59:00.000Z" });
  });

  it("keeps a thread met twice once, in its latest version", async () => {
    github.graphql(
      "Snapshot",
      repository({
        issues: page(
          [
            issueNode({ updatedAt: "2026-09-22T09:00:00Z" }),
            issueNode({
              number: 8,
              title: "Older",
              updatedAt: "2026-09-22T07:00:00Z",
            }),
          ],
          "i1",
        ),
        pullRequests: page([]),
        discussions: page([]),
      }),
      repository({
        issues: page([
          issueNode({ title: "Older", updatedAt: "2026-09-22T08:00:00Z" }),
          issueNode({ number: 8, updatedAt: "2026-09-22T08:30:00Z" }),
        ]),
      }),
    );
    const { threads } = await snapshot();
    expect(threads.map(({ number, title }) => [number, title])).toEqual([
      [1, "Example issue"],
      [8, "Example issue"],
    ]);
  });

  it("keeps the cursor it was given when nothing changed", async () => {
    github.graphql("Snapshot", lists());
    const since = "2026-09-27T00:00:00.000Z";
    expect(await snapshot(since)).toEqual({ threads: [], cursor: { since } });
  });

  it("gives no cursor when a full snapshot sees no thread", async () => {
    github.graphql("Snapshot", lists());
    expect(await snapshot()).toEqual({ threads: [], cursor: null });
  });

  const request = (at: string, reviewer: unknown, removed = false) => ({
    __typename: removed ? "ReviewRequestRemovedEvent" : "ReviewRequestedEvent",
    createdAt: at,
    requestedReviewer: reviewer,
  });

  it("reads the review requests the timeline leaves standing, however many withdrawals follow", async () => {
    const withdrawals = Array.from({ length: 20 }, (_, n) =>
      request(`2026-09-22T10:${10 + n}:00Z`, user("dave"), true),
    );
    const team = { __typename: "Team", combinedSlug: "example-org/reviewers" };
    github.graphql(
      "Snapshot",
      lists(
        [],
        [
          pullNode({
            requested: {
              nodes: [
                request("2026-09-22T09:40:00Z", { ...user("carol") }),
                request("2026-09-22T09:00:00Z", { ...user("bob") }),
                request("2026-09-22T09:05:00Z", { ...bot("example-review") }),
                request("2026-09-22T09:10:00Z", team),
                request("2026-09-22T09:15:00Z", null),
              ],
            },
            withdrawn: {
              nodes: [
                request("2026-09-22T09:30:00Z", { ...user("bob") }, true),
                ...withdrawals,
              ],
            },
          }),
        ],
      ),
    );
    github.graphql("TeamMembers", {
      body: {
        data: {
          organization: {
            team: { members: page([{ login: "alice" }, { login: "erin" }]) },
          },
        },
      },
    });
    const [pull] = (await snapshot()).threads;
    expect(pull?.reviewRequests).toEqual([
      {
        reviewer: { login: "example-review", type: "bot" },
        at: new Date("2026-09-22T09:05:00Z"),
      },
      {
        reviewer: { team: "example-org/reviewers", members: ["alice", "erin"] },
        at: new Date("2026-09-22T09:10:00Z"),
      },
      {
        reviewer: { login: "carol", type: "user" },
        at: new Date("2026-09-22T09:40:00Z"),
      },
    ]);
    const query = String(github.sent.at(0)?.body?.query);
    for (const [alias, kind] of [
      ["requested", "REVIEW_REQUESTED_EVENT"],
      ["withdrawn", "REVIEW_REQUEST_REMOVED_EVENT"],
    ]) {
      expect(query).toContain(
        `${alias}: timelineItems(last: 20, itemTypes: [${kind}])`,
      );
    }
    expect(variables(github.sent.at(1) as Sent)).toEqual({
      organisation: "example-org",
      team: "reviewers",
    });
  });

  it("reads a pull request's submitted reviews, checks, draft state and stack", async () => {
    github.graphql(
      "Snapshot",
      lists(
        [],
        [
          pullNode({
            isDraft: true,
            latestReviews: {
              nodes: [
                { ...comment("bob", ""), submittedAt: null },
                {
                  ...comment("carol", ""),
                  submittedAt: "2026-09-22T12:00:00Z",
                },
              ],
            },
            commits: {
              nodes: [
                {
                  commit: {
                    committedDate: "2026-09-22T07:55:00Z",
                    author: null,
                    statusCheckRollup: { state: "FAILURE" },
                  },
                },
              ],
            },
            stackEntry: {
              position: 2,
              stack: { number: 12, size: 5, baseRefName: "main" },
            },
          }),
        ],
      ),
    );
    github.rest("GET /repos/example-org/example-repo/activity", { body: [] });
    const [pull] = (await snapshot()).threads;
    expect(pull).toMatchObject({
      kind: "pullRequest",
      draft: true,
      reviews: [
        {
          author: { login: "carol", type: "user", member: true },
          at: new Date("2026-09-22T12:00:00Z"),
        },
      ],
      checks: "failing",
      stack: { number: 12, position: 2, size: 5, base: "main" },
    });
  });

  it("reads the pushes to a reviewed branch since its earliest review, page after page", async () => {
    github.graphql(
      "Snapshot",
      lists(
        [],
        [
          pullNode({
            latestReviews: {
              nodes: [
                { ...comment("bob", ""), submittedAt: "2026-09-22T12:00:00Z" },
                {
                  ...comment("carol", ""),
                  submittedAt: "2026-09-22T10:00:00Z",
                },
              ],
            },
          }),
        ],
      ),
    );
    const feed = "/repos/example-org/example-repo/activity";
    github.rest(
      `GET ${feed}`,
      {
        body: [
          feedEntry({ timestamp: "2026-09-22T13:00:00Z" }),
          feedEntry({
            activity_type: "branch_creation",
            timestamp: "2026-09-22T12:30:00Z",
          }),
        ],
        headers: {
          link: `<https://api.github.com${feed}?after=next-1>; rel="next"`,
        },
      },
      {
        body: [
          feedEntry({
            activity_type: "force_push",
            timestamp: "2026-09-22T11:00:00Z",
            actor: restUser("example-bot[bot]", "Bot"),
          }),
          feedEntry({ timestamp: "2026-09-22T09:00:00Z" }),
          feedEntry({ timestamp: "2026-09-22T08:00:00Z" }),
        ],
        headers: {
          link: `<https://api.github.com${feed}?after=next-2>; rel="next"`,
        },
      },
    );
    const [pull] = (await snapshot()).threads;
    const feeds = github.sent.filter(({ url }) => url.pathname === feed);
    expect(feeds.map(({ url }) => url.search)).toEqual([
      "?per_page=100&ref=refs%2Fheads%2Ffeat%2Fexample",
      "?after=next-1",
    ]);
    expect(pull?.pushes).toEqual([
      {
        author: { login: "alice", type: "user" },
        at: new Date("2026-09-22T13:00:00Z"),
      },
      {
        author: { login: "example-bot[bot]", type: "bot" },
        at: new Date("2026-09-22T11:00:00Z"),
      },
    ]);
  });

  it("dates a fork's latest push by its head commit, without the activity feed", async () => {
    const reviewed = {
      nodes: [{ ...comment("bob", ""), submittedAt: "2026-09-22T12:00:00Z" }],
    };
    const head = (author: unknown) => ({
      nodes: [
        {
          commit: {
            committedDate: "2026-09-22T14:00:00Z",
            author,
            statusCheckRollup: null,
          },
        },
      ],
    });
    github.graphql(
      "Snapshot",
      lists(
        [],
        [
          pullNode({
            isCrossRepository: true,
            latestReviews: reviewed,
            commits: head({ user: { login: "dave" } }),
          }),
          pullNode({
            number: 6,
            isCrossRepository: true,
            latestReviews: reviewed,
            commits: head({ user: null }),
          }),
          pullNode({
            number: 7,
            isCrossRepository: true,
            commits: { nodes: [] },
          }),
        ],
      ),
    );
    const threads = (await snapshot()).threads;
    expect(threads.map(({ pushes }) => pushes)).toEqual([
      [
        {
          author: { login: "dave", type: "user" },
          at: new Date("2026-09-22T14:00:00Z"),
        },
      ],
      [],
      [],
    ]);
    expect(github.sent).toHaveLength(1);
  });

  it("reads a discussion's replies as messages, and a closed one as closed", async () => {
    github.graphql(
      "Snapshot",
      lists(
        [],
        [],
        [
          discussionNode({
            closed: true,
            labels: { nodes: [{ name: "announcement" }] },
            comments: {
              nodes: [
                {
                  ...comment("dave", "2026-09-22T09:00:00Z", "NONE"),
                  replies: {
                    nodes: [comment("alice", "2026-09-22T10:00:00Z", "OWNER")],
                  },
                },
              ],
            },
          }),
        ],
      ),
    );
    const [discussion] = (await snapshot()).threads;
    expect(discussion).toMatchObject({
      open: false,
      labels: ["announcement"],
      comments: [
        { author: { login: "dave", member: false } },
        { author: { login: "alice", member: true } },
      ],
    });
  });
});
