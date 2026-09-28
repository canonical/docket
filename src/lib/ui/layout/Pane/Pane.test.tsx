import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import Pane from "./Pane.js";
import { Help, NoCounts, NothingOwed } from "./Pane.stories.js";

describe("Pane", () => {
  it("draws the header, the list region, the counts, the status and the keys at 40 columns", async () => {
    const screen = await draw(<Pane {...NothingOwed.args} />, 40, 8);
    expect(screen.lines).toEqual([
      "owed",
      "",
      "  nothing owed",
      "",
      "",
      "0 over · 0 soon · 0 on track",
      "synced 2m ago",
      "←→ mode ↑↓ sel g grp ?",
    ]);
    expect(screen.look("nothing owed")?.bg).toBe(tokens["color.background"]);
  });

  it("gives the list region every line the terminal adds, at 60 columns", async () => {
    const screen = await draw(
      <Pane {...NothingOwed.args} width={60} />,
      60,
      10,
    );
    expect(screen.lines.at(2)).toBe("  nothing owed");
    expect(screen.lines.slice(7)).toEqual([
      "0 over · 0 soon · 0 on track",
      "synced 2m ago",
      "←→ mode ↑↓ sel g grp ?",
    ]);
  });

  it("keeps the counts line's place blank when there is none", async () => {
    const screen = await draw(<Pane {...NoCounts.args} />, 40, 8);
    expect(screen.lines.slice(5)).toEqual([
      "",
      "synced 2m ago",
      "←→ mode ↑↓ sel g grp ?",
    ]);
  });

  it("gives the help everything under the header", async () => {
    const screen = await draw(<Pane {...Help.args} />, 40, 14);
    expect(screen.lines.slice(0, 3)).toEqual(["help", "", "Mode"]);
    expect(screen.lines).not.toContain("←→ mode ↑↓ sel g grp ?");
    expect(screen.lines).not.toContain("synced 2m ago");
  });

  it("shows only the one line below 40 columns, and the screen again once wide enough", async () => {
    const screen = await draw(<Pane {...NothingOwed.args} width={39} />, 39, 8);
    expect(screen.lines.filter(Boolean)).toEqual(["docket needs 40 columns"]);
    const narrow = await draw(<Pane {...NothingOwed.args} width={12} />, 12, 8);
    expect(narrow.lines.filter(Boolean)).toEqual([
      "docket needs",
      "40 columns",
    ]);
    const wide = await draw(<Pane {...NothingOwed.args} width={40} />, 40, 8);
    expect(wide.lines.at(0)).toBe("owed");
  });
});
