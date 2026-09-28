import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeGitHub,
  issueNode,
  page,
  pullNode,
  repository,
  settle,
  token,
} from "../../testing/github.js";
import createClient from "./createClient.js";
import fetchLists from "./fetchLists.js";

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

const document =
  "query Lists { repository { issues pullRequests discussions } }";
const node = (number: number, updatedAt: string) => ({ number, updatedAt });
const fetch = (since?: Date) =>
  settle(
    fetchLists(
      createClient(token, "github.com", "1.2.3"),
      document,
      { owner: "example-org", name: "example-repo" },
      since,
    ),
  );
/** The paging variables each query sent, without the repository's. */
const paging = () =>
  github.sent.map(({ body }) =>
    Object.fromEntries(
      Object.entries(body?.variables ?? {}).filter(
        ([name]) => name !== "owner" && name !== "name",
      ),
    ),
  );

/** Reads the lists with a page size of 50, gathering the progress heard. */
async function readProgress() {
  const progress: unknown[] = [];
  await settle(
    fetchLists(
      createClient(token, "github.com", "1.2.3"),
      document,
      { size: 50 },
      undefined,
      (step) => progress.push(step),
    ),
  );
  return progress;
}

describe("fetchLists", () => {
  it("reads the three lists together, one query for all of them", async () => {
    github.graphql(
      "Lists",
      repository({
        issues: page([node(1, "2026-09-22T08:00:00Z")]),
        pullRequests: page([node(2, "2026-09-22T08:00:00Z")]),
        discussions: page([node(3, "2026-09-22T08:00:00Z")]),
      }),
    );
    expect(await fetch()).toEqual({
      issues: [node(1, "2026-09-22T08:00:00Z")],
      pullRequests: [node(2, "2026-09-22T08:00:00Z")],
      discussions: [node(3, "2026-09-22T08:00:00Z")],
    });
    expect(github.sent[0]?.body?.variables).toEqual({
      owner: "example-org",
      name: "example-repo",
      issuesAfter: null,
      withIssues: true,
      pullsAfter: null,
      withPulls: true,
      discussionsAfter: null,
      withDiscussions: true,
    });
  });

  it("pages each list on its own and leaves out a list once it is finished", async () => {
    github.graphql(
      "Lists",
      repository({
        issues: page([node(1, "2026-09-22T08:00:00Z")], "i1"),
        pullRequests: page([node(2, "2026-09-22T08:00:00Z")]),
        discussions: page([], "d1"),
      }),
      repository({
        issues: page([node(4, "2026-09-21T08:00:00Z")]),
        discussions: page([node(3, "2026-09-20T08:00:00Z")]),
      }),
    );
    const lists = await fetch();
    expect(lists.issues.map(({ number }) => number)).toEqual([1, 4]);
    expect(lists.pullRequests.map(({ number }) => number)).toEqual([2]);
    expect(lists.discussions.map(({ number }) => number)).toEqual([3]);
    expect(paging()).toEqual([
      {
        issuesAfter: null,
        withIssues: true,
        pullsAfter: null,
        withPulls: true,
        discussionsAfter: null,
        withDiscussions: true,
      },
      {
        issuesAfter: "i1",
        withIssues: true,
        pullsAfter: null,
        withPulls: false,
        discussionsAfter: "d1",
        withDiscussions: true,
      },
    ]);
  });

  it("keeps a thread that comes twice once, in its latest version", async () => {
    github.graphql(
      "Lists",
      repository({
        issues: page([node(1, "2026-09-22T08:00:00Z")], "i1"),
        pullRequests: page([]),
        discussions: page([]),
      }),
      repository({
        issues: page([node(1, "2026-09-23T08:00:00Z")], "i2"),
      }),
      repository({
        issues: page([node(1, "2026-09-21T08:00:00Z")]),
      }),
    );
    expect((await fetch()).issues).toEqual([node(1, "2026-09-23T08:00:00Z")]);
  });

  it("stops a list at the first thread updated before `since`", async () => {
    github.graphql(
      "Lists",
      repository({
        issues: page(
          [node(1, "2026-09-23T08:00:00Z"), node(4, "2026-09-21T08:00:00Z")],
          "i1",
        ),
        pullRequests: page([node(2, "2026-09-22T08:00:00Z")]),
        discussions: page([]),
      }),
    );
    const lists = await fetch(new Date("2026-09-22T08:00:00Z"));
    expect(lists.issues.map(({ number }) => number)).toEqual([1]);
    expect(lists.pullRequests.map(({ number }) => number)).toEqual([2]);
    expect(github.sent).toHaveLength(1);
  });

  describe("progress", () => {
    it("reports each page fetched out of the pages the longest list needs", async () => {
      github.graphql(
        "Lists",
        repository({
          issues: { ...page([issueNode()]), totalCount: 1 },
          pullRequests: { ...page([pullNode()], "pulls-1"), totalCount: 51 },
          discussions: { ...page([]), totalCount: 0 },
        }),
        repository({ pullRequests: page([pullNode({ number: 4 })]) }),
      );
      expect(await readProgress()).toEqual([
        { fetched: 1, total: 2 },
        { fetched: 2, total: 2 },
      ]);
    });

    it("counts the pages read when the lists give no total", async () => {
      github.graphql(
        "Lists",
        repository({
          issues: page([issueNode()], "issues-1"),
          pullRequests: page([]),
          discussions: page([]),
        }),
        repository({ issues: page([issueNode({ number: 5 })]) }),
      );
      expect(await readProgress()).toEqual([
        { fetched: 1, total: 1 },
        { fetched: 2, total: 2 },
      ]);
    });
  });
});
