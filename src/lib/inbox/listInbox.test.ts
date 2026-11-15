import { describe, expect, it } from "vitest";
import { notification, recordedNotifications } from "../../testing/inbox.js";
import type { Repo } from "../config/index.js";
import listInbox from "./listInbox.js";

const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const now = new Date("2026-09-28T12:00:00Z");
const address = (
  filter: "unread" | "all",
  grouping: "repo" | "reason" | "type" | "none" = "repo",
) => ({ mode: "inbox" as const, filter, grouping });

describe("listInbox", () => {
  it("keeps unread only, unread first then newest, with the whole inbox's counts", () => {
    const list = listInbox(
      recordedNotifications,
      repos,
      address("unread"),
      now,
    );
    expect(list.counts).toEqual({ unread: 4, read: 1 });
    expect(
      list.groups.flatMap(({ rows }) => rows.map((row) => row.notification.id)),
    ).toEqual(["1", "4", "5", "2"]);
    expect(list.summary.fields.map(({ text }) => text)).toEqual(["4 unread"]);
  });

  it("gathers a workflow's runs on one branch under its newest run", () => {
    const run = (id: string, at: Date, branch: string) =>
      notification({
        id,
        reason: "ci_activity",
        workflow: { name: "CI", branch, failed: true },
        subject: {
          title: `CI workflow run failed for ${branch} branch`,
          kind: "workflow",
          url: "https://github.com/example-org/example-repo/actions",
        },
        updatedAt: at,
      });
    const older = run("1", new Date("2026-09-28T10:00:00Z"), "main");
    const newer = run("2", new Date("2026-09-28T11:00:00Z"), "main");
    const other = run("3", new Date("2026-09-28T09:00:00Z"), "next");
    const list = listInbox(
      [older, newer, other],
      repos,
      address("unread"),
      now,
    );
    const rows = list.groups.flatMap(({ rows }) => rows);
    expect(rows).toHaveLength(2);
    expect(rows.at(0)?.notification.id).toBe("2");
    expect(rows.at(0)?.notifications.map(({ id }) => id)).toEqual(["2", "1"]);
    expect(rows.at(1)?.notification.id).toBe("3");
  });

  it("shows the whole inbox with unread first and read rows after", () => {
    const list = listInbox(recordedNotifications, repos, address("all"), now);
    expect(
      list.groups.flatMap(({ rows }) => rows.map((row) => row.notification.id)),
    ).toEqual(["1", "4", "5", "3", "2"]);
    expect(list.summary.fields.map(({ text }) => text)).toEqual([
      "4 unread",
      "1 read",
    ]);
  });
});
