import { describe, expect, it } from "vitest";
import { recordedNotifications } from "../../testing/inbox.js";
import type { Repo } from "../config/index.js";
import buildRow from "./buildRow.js";
import groupRows from "./groupRows.js";

const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const now = new Date("2026-09-28T12:00:00Z");
const rows = recordedNotifications.map((item) => buildRow(item, repos, now));
const headings = (grouping: "repo" | "reason" | "type" | "none") =>
  groupRows(rows, { mode: "inbox", grouping, filter: "all" }, repos).map(
    ({ heading }) => heading?.text,
  );

describe("groupRows", () => {
  it("orders repositories as the configuration lists them, then the others by name", () => {
    const first = recordedNotifications[0];
    if (!first) throw new Error("the recording has notifications");
    const other = buildRow(first, repos, now);
    expect(headings("repo")).toEqual(["example", "docs"]);
    expect(
      groupRows(
        [{ ...other, repo: "z-org/z" }, { ...other, repo: "a-org/a" }, ...rows],
        { mode: "inbox", grouping: "repo", filter: "all" },
        repos,
      ).map(({ heading }) => heading?.text),
    ).toEqual(["example", "docs", "a-org/a", "z-org/z"]);
  });

  it("orders reasons in the fixed order, with an unknown reason under other", () => {
    expect(headings("reason")).toEqual([
      "review requested",
      "mention",
      "team mention",
      "assigned",
      "subscribed",
    ]);
    expect(headings("reason").includes("other")).toBe(false);
  });

  it("orders subject kinds as issues, pull requests, discussions, then the rest", () => {
    expect(headings("type")).toEqual(["issue", "PR", "discussion", "release"]);
  });

  it("keeps one list without a heading, and gives no section when there are no rows", () => {
    expect(
      groupRows(
        rows,
        { mode: "inbox", grouping: "none", filter: "all" },
        repos,
      ),
    ).toEqual([{ rows }]);
    expect(
      groupRows([], { mode: "inbox", grouping: "none", filter: "all" }, repos),
    ).toEqual([]);
  });
});

describe("groupRows, an unknown reason", () => {
  it("puts a reason docket does not know under other, last", () => {
    const first = recordedNotifications[0];
    if (!first) throw new Error("the recording has notifications");
    const row = buildRow({ ...first, reason: "something_new" }, repos, now);
    expect(
      groupRows(
        [row],
        { mode: "inbox", grouping: "reason", filter: "all" },
        repos,
      )[0]?.heading?.text,
    ).toBe("other");
  });
});
