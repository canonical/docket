import { describe, expect, it } from "vitest";
import { at, teamSettings, thread, wait } from "../../testing/facts.js";
import type { Repo } from "../config/index.js";
import type { StackEntry } from "../stacks/index.js";
import type { Wait } from "../waits/index.js";
import buildRow from "./buildRow.js";
import describePerson from "./describePerson.js";
import groupRows from "./groupRows.js";

const now = at("2026-09-23T10:00+02:00");
const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const row = (facts: Partial<Wait>, repo = "example") =>
  buildRow(wait(facts), repo, teamSettings.time, now, (account) =>
    describePerson(account, teamSettings.people, undefined),
  );
const entry = (number: number, position: number, size = 5): StackEntry => ({
  number,
  position,
  size,
  base: "main",
});
const pull = (number: number, stack?: StackEntry, repo = repos[0]?.repo) =>
  thread({ kind: "pullRequest", number, stack, repo });
const headings = (groups: ReturnType<typeof groupRows>) =>
  groups.map(({ heading }) => heading?.text);
const references = (groups: ReturnType<typeof groupRows>) =>
  groups.map(({ rows }) => rows.map(({ reference }) => reference.text));

describe("groupRows", () => {
  it("keeps every row in one section without a heading when not grouped", () => {
    const rows = [row({}), row({})];
    expect(groupRows(rows, "none", repos)).toEqual([{ rows }]);
  });

  it("gives no section when there is no row", () => {
    expect(groupRows([], "none", repos)).toEqual([]);
    expect(groupRows([], "stack", repos)).toEqual([]);
  });

  describe("by owner", () => {
    it("orders owners alphabetically whatever their case, with unassigned last", () => {
      const rows = [
        row({ owners: [] }),
        row({ owners: ["bob"] }),
        row({ owners: ["Carol"] }),
        row({ owners: ["alice"] }),
      ];
      expect(headings(groupRows(rows, "owner", repos))).toEqual([
        "alice",
        "bob",
        "Carol",
        "unassigned",
      ]);
    });

    it("puts a wait with two owners under each of them, keeping the sort inside", () => {
      const first = row({ owners: ["bob", "alice"] });
      const second = row({ owners: ["alice"] });
      expect(groupRows([first, second], "owner", repos)).toEqual([
        { heading: { text: "alice", fit: "trimmed" }, rows: [first, second] },
        { heading: { text: "bob", fit: "trimmed" }, rows: [first] },
      ]);
    });
  });

  describe("by repo", () => {
    it("orders repositories as the configuration lists them and skips empty ones", () => {
      const rows = [row({}, "docs"), row({}, "example"), row({}, "docs")];
      const groups = groupRows(rows, "repo", [
        ...repos,
        { name: "other", repo: "example-org/other", tags: [] },
      ]);
      expect(headings(groups)).toEqual(["example", "docs"]);
      expect(groups[1]?.rows).toEqual([rows[0], rows[2]]);
    });
  });

  describe("by stack", () => {
    it("heads each stack with its full size and orders its rows by position, bottom first", () => {
      const rows = [
        row({ thread: pull(1203, entry(12, 4)) }),
        row({ thread: pull(1201, entry(12, 2)) }),
      ];
      expect(groupRows(rows, "stack", repos)).toEqual([
        {
          heading: { text: "example stack 12 · 5 PRs → main", fit: "trimmed" },
          rows: [rows[1], rows[0]],
        },
      ]);
    });

    it("orders stacks by repository then number, with rows in no stack last in sort order", () => {
      const docs = repos[1]?.repo;
      const rows = [
        row({ thread: pull(5) }),
        row({ thread: pull(9, entry(3, 1), docs) }, "docs"),
        row({ thread: pull(8, entry(20, 1)) }),
        row({ thread: pull(4) }),
        row({ thread: pull(7, entry(7, 1)) }),
      ];
      const groups = groupRows(rows, "stack", repos);
      expect(headings(groups)).toEqual([
        "example stack 7 · 5 PRs → main",
        "example stack 20 · 5 PRs → main",
        "docs stack 3 · 5 PRs → main",
        "NOT IN A STACK",
      ]);
      expect(references(groups).at(-1)).toEqual(["example#5", "example#4"]);
    });

    it("writes a stack of one pull request in the singular", () => {
      const rows = [row({ thread: pull(1, entry(2, 1, 1)) })];
      expect(headings(groupRows(rows, "stack", repos))).toEqual([
        "example stack 2 · 1 PR → main",
      ]);
    });

    it("keeps two waits on one pull request in their sort order inside its stack", () => {
      const stacked = pull(3, entry(4, 1));
      const rows = [
        row({ thread: stacked, kind: "review" }),
        row({ thread: stacked }),
      ];
      expect(groupRows(rows, "stack", repos)[0]?.rows).toEqual(rows);
    });
  });
});

describe("groupRows, owners written in two cases", () => {
  it("gathers one owner written two ways in one section, headed as first written", () => {
    const rows = [row({ owners: ["Alice"] }), row({ owners: ["alice"] })];
    expect(groupRows(rows, "owner", repos)).toEqual([
      { heading: { text: "Alice", fit: "trimmed" }, rows },
    ]);
  });
});
