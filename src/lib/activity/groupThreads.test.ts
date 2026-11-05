import { describe, expect, it } from "vitest";
import { at, dave, teamSettings, thread } from "../../testing/facts.js";
import type { Repo } from "../config/index.js";
import type { ThreadKind } from "../waits/index.js";
import buildThreadRow from "./buildThreadRow.js";
import groupThreads from "./groupThreads.js";

const now = at("2026-09-28T10:00+02:00");
const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const row = (kind: ThreadKind, repo = "example") => {
  const summary = thread({ kind });
  const event = {
    thread: summary,
    kind: "commented",
    actor: dave,
    at: at("2026-09-28T09:00+02:00"),
    bot: false,
  } as const;
  return buildThreadRow(
    summary,
    repo,
    undefined,
    teamSettings.people,
    [event],
    now,
  );
};
const byAuthor = (
  login: string,
  kind: ThreadKind = "issue",
  repo = "example",
) => {
  const summary = thread({ kind, author: { ...dave, login } });
  const event = {
    thread: summary,
    kind: "commented",
    actor: dave,
    at: at("2026-09-28T09:00+02:00"),
    bot: false,
  } as const;
  return buildThreadRow(
    summary,
    repo,
    summary,
    teamSettings.people,
    [event],
    now,
  );
};
const headings = (groups: ReturnType<typeof groupThreads>) =>
  groups.map(({ heading }) => heading?.text);

describe("groupThreads", () => {
  it("keeps every row in one section without a heading when not grouped", () => {
    const rows = [row("issue"), row("discussion")];
    expect(groupThreads(rows, "none", repos)).toEqual([{ rows }]);
    expect(groupThreads([], "none", repos)).toEqual([]);
  });

  it("orders kinds as issues, pull requests, discussions, skipping empty ones", () => {
    const rows = [row("discussion"), row("issue"), row("discussion")];
    const groups = groupThreads(rows, "kind", repos);
    expect(groups).toEqual([
      { heading: { text: "ISSUES", kind: "words" }, rows: [rows[1]] },
      {
        heading: { text: "DISCUSSIONS", kind: "words" },
        rows: [rows[0], rows[2]],
      },
    ]);
    const all = groupThreads([row("pullRequest"), ...rows], "kind", repos);
    expect(headings(all)).toEqual(["ISSUES", "PULL REQUESTS", "DISCUSSIONS"]);
  });

  it("orders repositories as the configuration lists them", () => {
    const rows = [row("issue", "docs"), row("issue", "example")];
    expect(headings(groupThreads(rows, "repo", repos))).toEqual([
      "example",
      "docs",
    ]);
  });

  it("orders authors alphabetically, keeping the sort inside, and heads each with their group", () => {
    const first = byAuthor("bob");
    const second = byAuthor("alice");
    const third = byAuthor("bob");
    const groups = groupThreads([first, second, third], "author", repos);
    expect(groups).toEqual([
      {
        heading: { text: "alice", kind: "person", group: "team" },
        rows: [second],
      },
      {
        heading: { text: "bob", kind: "person", group: "team" },
        rows: [first, third],
      },
    ]);
    expect(
      headings(
        groupThreads([byAuthor("alice"), byAuthor("bob")], "author", repos),
      ),
    ).toEqual(["alice", "bob"]);
  });

  it("gathers one author written two ways in one section, headed as first written", () => {
    const rows = [byAuthor("Alice"), byAuthor("alice")];
    expect(headings(groupThreads(rows, "author", repos))).toEqual(["Alice"]);
    expect(groupThreads(rows, "author", repos)[0]?.rows).toEqual(rows);
  });

  it("puts threads whose facts were not given under unknown author, last", () => {
    const unknown = row("issue");
    const known = byAuthor("alice");
    const groups = groupThreads([unknown, known], "author", repos);
    expect(headings(groups)).toEqual(["alice", "unknown author"]);
    expect(groups[1]?.heading).toEqual({
      text: "unknown author",
      kind: "words",
    });
    expect(groups[1]?.rows).toEqual([unknown]);
  });
});
