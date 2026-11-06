import { describe, expect, it } from "vitest";
import { draw, hex } from "../../../../testing/terminal.js";
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
    expect(screen.look("3h")?.fg).toBe(hex(tokens["color.text"]));
  });

  it("leaves the unread mark off a read notification", async () => {
    const screen = await draw(<InboxRow {...Read.args} />, 40);
    expect(screen.lines.at(0)?.startsWith("  ")).toBe(true);
  });

  it("says browser only for a subject docket cannot detail", async () => {
    const screen = await draw(<InboxRow {...BrowserOnly.args} />, 40);
    expect(screen.lines.at(0)).toContain("example release browser only");
  });

  it("cuts a long reference and title within the pane", async () => {
    const screen = await draw(<InboxRow {...Long.args} />, 40);
    expect(screen.lines.at(0)?.length).toBeLessThanOrEqual(40);
    expect(screen.lines.at(1)?.length).toBeLessThanOrEqual(40);
    expect(screen.lines.join("\n")).toContain("…");
  });
});
