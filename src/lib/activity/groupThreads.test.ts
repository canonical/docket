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
});
