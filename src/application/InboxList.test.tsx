import { describe, expect, it } from "vitest";
import type { Repo } from "../lib/config/index.js";
import { listInbox } from "../lib/inbox/index.js";
import { recordedNotifications } from "../testing/inbox.js";
import { draw } from "../testing/terminal.js";
import InboxList from "./InboxList.js";

const repos: Repo[] = [
  { name: "example", repo: "example-org/example-repo", tags: [] },
  { name: "docs", repo: "example-org/example-docs", tags: [] },
];
const now = new Date("2026-09-28T10:00:00Z");
const list = (grouping: "repo" | "none") =>
  listInbox(
    recordedNotifications,
    repos,
    { mode: "inbox", grouping, filter: "all" },
    now,
  );
const drawList = (grouping: "repo" | "none", selected: number, height = 12) =>
  draw(
    <InboxList
      list={list(grouping)}
      selected={selected}
      width={40}
      height={height}
      onShownRows={() => {}}
    />,
    40,
    height,
  );

describe("InboxList", () => {
  it("draws each group's heading and its rows, the selected first row under its heading", async () => {
    const screen = await drawList("repo", 0);
    expect(screen.lines.slice(0, 4)).toEqual([
      "example ────────────────────────────────",
      "● ⇄ example#12 review requested       1h",
      "  Fix the parser",
      "● ◌ example#7 team mention            3h",
    ]);
  });

  it("draws no heading when the inbox is one list, and scrolls to a later selection", async () => {
    const screen = await drawList("none", 2);
    expect(screen.lines[0]).not.toContain("────");
    expect(screen.lines.join("\n")).toContain("example#7");
    expect(screen.lines.join("\n")).toContain("docs#4");
  });
});
