import { describe, expect, it } from "vitest";
import { draw, hex } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import KeyBar from "./KeyBar.js";
import { Activity, Long, Owed } from "./KeyBar.stories.js";

describe("KeyBar", () => {
  it("shows each key with a hint, its label after it, at 40 columns", async () => {
    const screen = await draw(<KeyBar {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe("←→ mode ↑↓ sel g grp ?");
  });

  it("draws keys plain and labels dimmed, neither bold", async () => {
    const screen = await draw(<KeyBar {...Owed.args} />, 40);
    expect(screen.look("←→")).toMatchObject({
      fg: hex(tokens["color.text"]),
      bold: false,
    });
    expect(screen.look("mode")).toMatchObject({
      fg: hex(tokens["color.text.muted"]),
      bold: false,
    });
  });

  it("adds the time window in activity, the same at 60 columns", async () => {
    const screen = await draw(<KeyBar {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe("←→ mode g grp t time ?");
  });

  it("leaves out the last hints whole when they do not all fit, keeping ? to the last", async () => {
    const screen = await draw(<KeyBar {...Long.args} />, 40);
    expect(screen.lines.at(0)).toBe("←→ mode ↑↓ sel ⏎ open g grp t time a r ?");
    const narrow = await draw(<KeyBar {...Activity.args} width={12} />, 12);
    expect(narrow.lines.at(0)).toBe("←→ mode ?");
    const least = await draw(<KeyBar {...Activity.args} width={1} />, 1);
    expect(least.lines.at(0)).toBe("?");
  });

  it("draws nothing when not even ? fits", async () => {
    const screen = await draw(<KeyBar {...Activity.args} width={0} />, 1);
    expect(screen.lines.at(0)).toBe("");
  });
});
