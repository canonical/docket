import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bot,
  fakeGitHub,
  feedEntry,
  page,
  repository,
  settle,
  token,
  user,
} from "../../testing/github.js";
import type { ThreadEvent } from "../events/index.js";
import createClient from "./createClient.js";
import fetchEvents from "./fetchEvents.js";

let github: ReturnType<typeof fakeGitHub>;
const repo = "example-org/example-repo";
const since = new Date("2026-09-22T00:00:00Z");
const feed = `GET /repos/${repo}/activity`;

beforeEach(() => {
  vi.useFakeTimers();
  github = fakeGitHub();
  vi.stubGlobal("fetch", github.fetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const events = () =>
  settle(fetchEvents(createClient(token, "github.com", "1.2.3"), repo, since));

/** What an event line reads from an event: its thread, kind and actor. */
const lines = (found: readonly ThreadEvent[]) =>
  found.map((event) => {
    const { thread, actor, at, kind, ...detail } = event;
    return [
      thread.number,
      kind,
      actor.type === "bot" ? `${actor.login} (bot)` : actor.login,
      at.toISOString().slice(11, 16),
      // A close names its ending by the words shown for it.
      ...Object.values(detail).map((value) =>
        typeof value === "object" && "label" in value ? value.label : value,
      ),
    ];
  });

const item = (typename: string, at: string, fields = {}) => ({
  __typename: typename,
  actor: user("alice"),
  createdAt: at,
  ...fields,
});

const opened = (fields: Record<string, unknown>) => ({
  number: 1,
  title: "Example",
  createdAt: "2026-09-22T08:00:00Z",
  updatedAt: "2026-09-22T12:00:00Z",
  author: user("dave"),
  timelineItems: { nodes: [] },
  ...fields,
});

const pull = (fields: Record<string, unknown>) =>
  opened({
    number: 2,
    url: "https://github.com/example-org/example-repo/pull/2",
    author: user("alice"),
    headRefName: "feat/example",
    isCrossRepository: false,
    stackEntry: null,
    commits: {
      nodes: ["a1", "b2", "c3"].map((oid) => ({ commit: { oid } })),
    },
    head: {
      nodes: [
        {
          commit: {
            committedDate: "2026-09-22T09:00:00Z",
            author: { user: { login: "alice" } },
            statusCheckRollup: null,
          },
        },
      ],
    },
    ...fields,
  });

const lists = (issues: unknown[], pulls: unknown[], discussions: unknown[]) =>
  repository({
    issues: page(issues),
    pullRequests: page(pulls),
    discussions: page(discussions),
  });

describe("fetchEvents", () => {
  it("reads an issue's opening and timeline in the window", async () => {
    github.graphql(
      "Events",
      lists(
        [
          opened({
            timelineItems: {
              nodes: [
                {
                  __typename: "IssueComment",
                  author: user("bob"),
                  createdAt: "2026-09-22T09:00:00Z",
                },
                item("AssignedEvent", "2026-09-22T09:10:00Z", {
                  assignee: { login: "bob" },
                }),
                item("AssignedEvent", "2026-09-22T09:11:00Z", {
                  assignee: null,
                }),
                item("LabeledEvent", "2026-09-22T09:20:00Z", {
                  label: { name: "kind=bug" },
                }),
                item("LabeledEvent", "2026-09-22T09:21:00Z", { label: null }),
                item("ClosedEvent", "2026-09-22T10:00:00Z", {
                  actor: null,
                  stateReason: "NOT_PLANNED",
                }),
                item("ReopenedEvent", "2026-09-22T11:00:00Z"),
              ],
            },
          }),
          opened({ number: 5, createdAt: "2026-09-20T08:00:00Z" }),
        ],
        [],
        [],
      ),
    );
    github.rest(feed, { body: [] });
    expect(lines(await events())).toEqual([
      [1, "opened", "dave", "08:00"],
      [1, "commented", "bob", "09:00"],
      [1, "assigned", "alice", "09:10", "bob"],
      [1, "labelled", "alice", "09:20", "kind=bug"],
      [1, "closed", "ghost", "10:00", "closed as not planned"],
      [1, "reopened", "alice", "11:00"],
    ]);
    expect(github.sent.at(0)?.body?.variables).toMatchObject({
      owner: "example-org",
      name: "example-repo",
      since: "2026-09-22T00:00:00.000Z",
    });
  });

  it("reads a pull request's reviews, requests and merge, with its stack", async () => {
    github.graphql(
      "Events",
      lists(
        [],
        [
          pull({
            stackEntry: {
              position: 1,
              stack: { number: 12, size: 2, baseRefName: "main" },
            },
            timelineItems: {
              nodes: [
                {
                  __typename: "PullRequestReview",
                  author: bot("example-review"),
                  submittedAt: "2026-09-22T09:00:00Z",
                },
                {
                  __typename: "PullRequestReview",
                  author: user("bob"),
                  submittedAt: null,
                },
                item("ReviewRequestedEvent", "2026-09-22T09:30:00Z"),
                item("MergedEvent", "2026-09-22T11:00:00Z"),
              ],
            },
          }),
        ],
        [],
      ),
    );
    github.rest(feed, { body: [] });
    const found = await events();
    expect(lines(found)).toEqual([
      [2, "opened", "alice", "08:00"],
      [2, "reviewed", "example-review (bot)", "09:00"],
      [2, "reviewRequested", "alice", "09:30"],
      [2, "merged", "alice", "11:00"],
    ]);
    expect(found.at(0)?.thread).toEqual({
      repo,
      number: 2,
      url: "https://github.com/example-org/example-repo/pull/2",
      kind: "pullRequest",
      title: "Example",
      stack: { number: 12, position: 1, size: 2, base: "main" },
    });
  });

  /** Answers with pull requests whose timelines hold these items. */
  const answer = (...items: unknown[][]) => {
    const pulls = items.map((nodes, index) =>
      pull({ number: index + 2, timelineItems: { nodes } }),
    );
    github.graphql("Events", lists([], pulls, []));
    github.rest(feed, { body: [] });
  };

  /** The events read, openings aside. */
  const endings = async () =>
    lines((await events()).filter(({ kind }) => kind !== "opened"));

  it("counts a merge once, whichever second GitHub dates its close at", async () => {
    answer(
      [
        item("MergedEvent", "2026-09-22T11:00:00Z"),
        item("ClosedEvent", "2026-09-22T11:00:00Z"),
      ],
      [
        item("ClosedEvent", "2026-09-22T11:00:00Z"),
        item("MergedEvent", "2026-09-22T11:00:01Z"),
      ],
      [
        item("MergedEvent", "2026-09-22T11:00:00Z"),
        item("ClosedEvent", "2026-09-22T11:00:01Z", { actor: user("bob") }),
      ],
    );
    expect(await endings()).toEqual([
      [2, "merged", "alice", "11:00"],
      [3, "merged", "alice", "11:00"],
      [4, "merged", "alice", "11:00"],
    ]);
  });

  it("keeps a close that is not the merge's", async () => {
    answer(
      [
        item("ClosedEvent", "2026-09-22T11:00:38Z", { actor: user("bob") }),
        item("ReopenedEvent", "2026-09-22T11:00:39Z"),
        item("MergedEvent", "2026-09-22T11:00:40Z"),
        item("ClosedEvent", "2026-09-22T11:00:41Z"),
      ],
      [item("ClosedEvent", "2026-09-22T11:00:00Z")],
      [
        item("ClosedEvent", "2026-09-22T10:59:58Z", { actor: user("bob") }),
        item("MergedEvent", "2026-09-22T11:00:00Z"),
        item("ClosedEvent", "2026-09-22T11:00:01Z"),
      ],
      [
        item("MergedEvent", "2026-09-22T11:00:00Z"),
        item("ClosedEvent", "2026-09-22T11:00:10Z", { actor: user("bob") }),
      ],
      [
        item("ClosedEvent", "2026-09-22T11:00:39Z", { actor: user("bob") }),
        item("ReopenedEvent", "2026-09-22T11:00:39Z"),
        item("MergedEvent", "2026-09-22T11:00:40Z"),
      ],
    );
    expect(await endings()).toEqual([
      [2, "closed", "bob", "11:00", "closed"],
      [2, "reopened", "alice", "11:00"],
      [2, "merged", "alice", "11:00"],
      [3, "closed", "alice", "11:00", "closed"],
      [4, "closed", "bob", "10:59", "closed"],
      [4, "merged", "alice", "11:00"],
      [5, "merged", "alice", "11:00"],
      [5, "closed", "bob", "11:00", "closed"],
      [6, "closed", "bob", "11:00", "closed"],
      [6, "reopened", "alice", "11:00"],
      [6, "merged", "alice", "11:00"],
    ]);
  });

  it("reads failed checks as one event, at the latest failure", async () => {
    const rollup = (state: string, checks: unknown[]) => ({
      nodes: [
        {
          commit: {
            committedDate: "2026-09-22T09:00:00Z",
            author: null,
            statusCheckRollup: { state, contexts: { nodes: checks } },
          },
        },
      ],
    });
    const run = (name: string, conclusion: string, completedAt: string) => ({
      __typename: "CheckRun",
      name,
      status: "COMPLETED",
      conclusion,
      completedAt,
      checkSuite: { app: { slug: "example-ci" } },
    });
    const lint = run("lint", "FAILURE", "2026-09-22T09:05:00Z");
    github.graphql(
      "Events",
      lists(
        [],
        [
          pull({
            head: rollup("FAILURE", [
              lint,
              run("test", "SUCCESS", "2026-09-22T09:06:00Z"),
              {
                __typename: "StatusContext",
                context: "deploy",
                state: "ERROR",
                createdAt: "2026-09-22T09:10:00Z",
                creator: user("bob"),
              },
            ]),
          }),
          pull({
            number: 3,
            head: rollup("FAILURE", [
              run("lint", "FAILURE", "2026-09-21T09:05:00Z"),
            ]),
          }),
          pull({ number: 4, head: rollup("SUCCESS", [lint]) }),
          pull({
            number: 6,
            head: rollup("FAILURE", [
              { ...lint, status: "IN_PROGRESS", completedAt: null },
            ]),
          }),
        ],
        [],
      ),
    );
    github.rest(feed, { body: [] });
    const failed = (await events()).filter(
      ({ kind }) => kind === "checksFailed",
    );
    expect(lines(failed)).toEqual([
      [2, "checksFailed", "bob", "09:10", ["lint", "deploy"]],
    ]);
  });

  it("reads pushes from the activity feed, counted from the pull request's commits", async () => {
    github.graphql(
      "Events",
      lists(
        [],
        [
          pull({ number: 11, createdAt: "2026-09-20T08:00:00Z" }),
          pull({}),
          pull({ number: 7, headRefName: "feat/other" }),
        ],
        [],
      ),
    );
    github.rest(feed, {
      body: [
        feedEntry({
          before: "a1",
          after: "c3",
          timestamp: "2026-09-22T11:00:00Z",
        }),
        feedEntry({
          activity_type: "force_push",
          before: "f0",
          after: "c3",
          timestamp: "2026-09-22T10:00:00Z",
        }),
        feedEntry({
          ref: "refs/heads/main",
          timestamp: "2026-09-22T09:30:00Z",
        }),
        feedEntry({
          ref: "refs/heads/feat/other",
          timestamp: "2026-09-22T07:00:00Z",
        }),
        feedEntry({ timestamp: "2026-09-21T23:00:00Z" }),
      ],
    });
    const pushes = (await events()).filter(({ kind }) => kind === "pushed");
    expect(lines(pushes)).toEqual([
      [2, "pushed", "alice", "11:00", 2],
      [2, "pushed", "alice", "10:00"],
    ]);
  });

  it("dates a fork's latest push by its head commit, uncounted", async () => {
    const head = (committedDate: string, author: unknown) => ({
      nodes: [{ commit: { committedDate, author, statusCheckRollup: null } }],
    });
    github.graphql(
      "Events",
      lists(
        [],
        [
          pull({
            isCrossRepository: true,
            head: head("2026-09-22T10:00:00Z", { user: { login: "dave" } }),
          }),
          pull({
            number: 8,
            isCrossRepository: true,
            head: head("2026-09-21T10:00:00Z", { user: { login: "dave" } }),
          }),
          pull({
            number: 9,
            isCrossRepository: true,
            head: head("2026-09-22T10:00:00Z", null),
          }),
          pull({ number: 10, isCrossRepository: true, head: { nodes: [] } }),
        ],
        [],
      ),
    );
    github.rest(feed, {
      body: [feedEntry({ timestamp: "2026-09-22T10:30:00Z" })],
    });
    const pushes = (await events()).filter(({ kind }) => kind === "pushed");
    expect(lines(pushes)).toEqual([[2, "pushed", "dave", "10:00"]]);
  });

  it("reads a discussion's opening and its comments in the window", async () => {
    github.graphql(
      "Events",
      lists(
        [],
        [],
        [
          opened({
            number: 3,
            comments: {
              nodes: [
                { author: user("bob"), createdAt: "2026-09-21T09:00:00Z" },
                { author: user("alice"), createdAt: "2026-09-22T09:00:00Z" },
              ],
            },
          }),
        ],
      ),
    );
    github.rest(feed, { body: [] });
    expect(lines(await events())).toEqual([
      [3, "opened", "dave", "08:00"],
      [3, "commented", "alice", "09:00"],
    ]);
  });

  it("reads each list's next page until a thread predates the window", async () => {
    github.graphql(
      "Events",
      repository({
        issues: page([opened({})], "issues-1"),
        pullRequests: page(
          [pull({}), pull({ number: 4, updatedAt: "2026-09-21T00:00:00Z" })],
          "pulls-1",
        ),
        discussions: page([]),
      }),
      repository({ issues: page([opened({ number: 5 })]) }),
    );
    github.rest(feed, { body: [] });
    const found = await events();
    expect(github.sent.at(1)?.body?.variables).toMatchObject({
      issuesAfter: "issues-1",
      withIssues: true,
      withPulls: false,
      withDiscussions: false,
    });
    expect([...new Set(found.map(({ thread }) => thread.number))]).toEqual([
      1, 5, 2,
    ]);
  });

  it("reads a thread met on two pages once, in its latest version", async () => {
    const comment = item("IssueComment", "2026-09-22T09:00:00Z", {
      author: user("alice"),
    });
    github.graphql(
      "Events",
      repository({
        issues: page([opened({})], "issues-1"),
        pullRequests: page([]),
        discussions: page([]),
      }),
      repository({
        issues: page([
          opened({
            updatedAt: "2026-09-22T13:00:00Z",
            timelineItems: { nodes: [comment] },
          }),
        ]),
      }),
    );
    github.rest(feed, { body: [] });
    expect(lines(await events())).toEqual([
      [1, "opened", "dave", "08:00"],
      [1, "commented", "alice", "09:00"],
    ]);
  });
});
