import { describe, expect, it } from "vitest";
import { recordedNotifications } from "../../testing/inbox.js";
import type { Repo } from "../config/index.js";
import type { InboxGrouping } from "../inbox/index.js";
import { listInbox } from "../inbox/index.js";
import renderInbox from "./renderInbox.js";
import type { Detail, Format, Freshness } from "./types.js";

const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const now = new Date("2026-09-28T10:00:00Z");
const freshness: Freshness = {
  now,
  syncedAt: new Date(now.getTime() - 120_000),
  timezone: "Europe/Paris",
  warnings: [],
  budget: {},
};
const render = (
  format: Format,
  detail: Detail = "standard",
  grouping: InboxGrouping = "repo",
  filter: "unread" | "all" = "all",
) =>
  renderInbox({
    list: listInbox(
      recordedNotifications,
      repos,
      { mode: "inbox", grouping, filter },
      now,
    ),
    freshness,
    format,
    detail,
  }).split("\n");

describe("renderInbox", () => {
  it("gives a person the inbox in sections, unread first, with browser-only subjects named", () => {
    expect(render("plain")).toEqual([
      "inbox · all · by repo",
      "synced 2m ago",
      "4 unread · 1 read",
      "",
      "example",
      "● example#12 · review requested · 1h",
      "  Fix the parser",
      "● example#7 · team mention · 3h",
      "  Tokens page",
      "● example release · browser only · 4h",
      "  Update dependency example-lib to 2.0",
      "  example#15 · assigned · 1d",
      "  Crash on start",
      "",
      "docs",
      "● docs#4 · mention · 2h",
      "  Where do tokens live?",
      "",
    ]);
  });

  it("gives an agent one line per notification, with titles quoted", () => {
    const lines = render("llm");
    expect(lines[0]).toBe("# inbox · all · by repo");
    expect(lines).toContain(
      '- ● example#12 · review requested · 1h · "Fix the parser"',
    );
    expect(lines).toContain(
      '- ● example release · browser only · 4h · "Update dependency example-lib to 2.0"',
    );
  });

  it("gives a program the counts, each section's key and each notification", () => {
    const answer = JSON.parse(render("json").join("\n"));
    expect(answer).toMatchObject({
      mode: "inbox",
      filter: "all",
      grouping: "repo",
      counts: { unread: 4, read: 1 },
    });
    expect(answer.groups[0]).toMatchObject({
      repo: "example",
    });
    expect(answer.groups[0].notifications[0]).toMatchObject({
      id: "1",
      repository: "example-org/example-repo",
      reference: "example#12",
      reason: "review_requested",
      unread: true,
      browserOnly: false,
    });
    expect(answer.groups[1].notifications[0]).toMatchObject({ id: "2" });
  });

  it("names each section of a program's data by its repository, reason or kind", () => {
    const data = (grouping: InboxGrouping) =>
      JSON.parse(render("json", "standard", grouping).join("\n")).groups.map(
        ({ notifications: _notifications, ...key }: Record<string, unknown>) =>
          key,
      );
    expect(data("reason")).toEqual([
      { reason: "review_requested" },
      { reason: "mention" },
      { reason: "team_mention" },
      { reason: "assign" },
      { reason: "subscribed" },
    ]);
    expect(data("type")).toEqual([
      { kind: "issue" },
      { kind: "pullRequest" },
      { kind: "discussion" },
      { kind: "release" },
    ]);
    expect(data("none")).toEqual([{}]);
    const summary = JSON.parse(render("json", "summary", "none").join("\n"));
    expect(summary).not.toHaveProperty("groups");
  });

  it("gives the counts alone at the summary level, and says nothing unread when the filter holds none", () => {
    expect(render("llm", "summary")).toEqual([
      "# inbox · all · by repo",
      "Data from 2026-09-28 11:58 Europe/Paris, 2m old.",
      "4 unread · 1 read",
      "",
    ]);
    expect(render("plain", "standard", "none")[0]).toBe(
      "inbox · all · one list",
    );
    const empty = renderInbox({
      list: listInbox(
        [],
        repos,
        { mode: "inbox", grouping: "none", filter: "unread" },
        now,
      ),
      freshness,
      format: "plain",
      detail: "standard",
    });
    expect(empty).toContain("0 unread");
    expect(empty).toContain("nothing unread");
  });
});
