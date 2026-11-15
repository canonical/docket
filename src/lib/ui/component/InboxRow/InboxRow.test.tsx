import { describe, expect, it } from "vitest";
import { notification } from "../../../../testing/inbox.js";
import { draw, hex } from "../../../../testing/terminal.js";
import { buildRow } from "../../../inbox/index.js";
import { tokens } from "../../../tokens/index.js";
import InboxRow from "./InboxRow.js";
import { BrowserOnly, Long, Read, Unread } from "./InboxRow.stories.js";

describe("InboxRow", () => {
  it("heads an unread notification with its mark, reference, reason and age, then its title in italic", async () => {
    const screen = await draw(<InboxRow {...Unread.args} />, 40);
    expect(screen.lines.slice(0, 2)).toEqual([
      "● ⇄ example#12 review requested       3h",
      "  Fix the parser",
    ]);
    expect(screen.look("Fix the parser")?.italic).toBe(true);
    expect(screen.look("3h")?.fg).toBe(hex(tokens["color.text.muted"]));
  });

  it("leaves the unread mark off a read notification", async () => {
    const screen = await draw(<InboxRow {...Read.args} />, 40);
    expect(screen.lines.at(0)?.startsWith("  ")).toBe(true);
  });

  it("says browser only for a subject docket cannot detail", async () => {
    const screen = await draw(<InboxRow {...BrowserOnly.args} />, 40);
    expect(screen.lines.at(0)).toContain("example release browser only");
    expect(screen.look("browser only")?.fg).toBe(
      hex(tokens["color.text.muted"]),
    );
  });

  it("marks a failed workflow's reason in the error colour", async () => {
    const row = buildRow(
      notification({
        reason: "ci_activity",
        workflow: { name: "CI", branch: "main", failed: true },
        subject: {
          title: "CI workflow run failed for main branch",
          kind: "workflow",
          url: "https://github.com/example-org/example-repo/actions",
        },
      }),
      [{ name: "example", repo: "example-org/example-repo", tags: [] }],
      new Date("2026-09-28T12:00:00Z"),
    );
    const screen = await draw(<InboxRow row={row} width={40} />, 40);
    expect(screen.look("CI failed")?.fg).toBe(hex(tokens["color.text.error"]));
  });

  it("counts the runs a workflow row stands for", async () => {
    const row = buildRow(
      notification({
        reason: "ci_activity",
        workflow: { name: "CI", branch: "main", failed: true },
        subject: {
          title: "CI workflow run failed for main branch",
          kind: "workflow",
          url: "https://github.com/example-org/example-repo/actions",
        },
      }),
      [{ name: "example", repo: "example-org/example-repo", tags: [] }],
      new Date("2026-09-28T12:00:00Z"),
    );
    const repeated = {
      ...row,
      notifications: [row.notification, { ...row.notification, id: "2" }],
    };
    const screen = await draw(<InboxRow row={repeated} width={40} />, 40);
    expect(screen.lines.at(0)).toContain("CI failed ×2");
  });

  it("cuts a long reference and title within the pane", async () => {
    const screen = await draw(<InboxRow {...Long.args} />, 40);
    expect(screen.lines.at(0)?.length).toBeLessThanOrEqual(40);
    expect(screen.lines.at(1)?.length).toBeLessThanOrEqual(40);
    expect(screen.lines.join("\n")).toContain("…");
  });
});
