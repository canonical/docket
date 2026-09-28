import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import KeyBar from "./KeyBar.js";
import { Activity, Owed } from "./KeyBar.stories.js";

describe("KeyBar", () => {
  it("shows each key with a hint, its label after it, at 40 columns", async () => {
    const screen = await draw(<KeyBar {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe("←→ mode ↑↓ sel g grp ?");
  });

  it("draws keys in bold and labels dimmed", async () => {
    const screen = await draw(<KeyBar {...Owed.args} />, 40);
    expect(screen.look("←→")).toMatchObject({
      fg: tokens["color.text"],
      bold: true,
    });
    expect(screen.look("mode")).toMatchObject({
      fg: tokens["color.text.muted"],
      bold: false,
    });
  });

  it("adds the time window in activity, the same at 60 columns", async () => {
    const screen = await draw(<KeyBar {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe("←→ mode g grp t time ?");
  });

  it("cuts the hints that cross a narrow pane with an ellipsis", async () => {
    const screen = await draw(<KeyBar {...Activity.args} width={12} />, 12);
    expect(screen.lines.at(0)).toBe("←→ mode g g…");
  });
});
