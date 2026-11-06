import { describe, expect, it } from "vitest";
import { recordedNotifications } from "../../testing/inbox.js";
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
