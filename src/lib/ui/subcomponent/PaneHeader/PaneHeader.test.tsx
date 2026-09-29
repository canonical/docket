import { describe, expect, it } from "vitest";
import { draw } from "../../../../testing/terminal.js";
import { tokens } from "../../../tokens/index.js";
import PaneHeader from "./PaneHeader.js";
import { Activity, Help, Owed, OwedByOwner } from "./PaneHeader.stories.js";

describe("PaneHeader", () => {
  it("names the mode alone, not bold, when owed has no grouping", async () => {
    const screen = await draw(<PaneHeader {...Owed.args} />, 40);
    expect(screen.lines.at(0)).toBe("owed");
    expect(screen.look("owed")).toMatchObject({
      fg: tokens["color.text"],
      bold: false,
    });
  });

  it("puts the address against the right edge at 40 columns", async () => {
    const screen = await draw(<PaneHeader {...OwedByOwner.args} />, 40);
    expect(screen.lines.at(0)).toBe(`owed${" ".repeat(28)}by owner`);
    expect(screen.look("by owner")?.bold).toBe(false);
  });

  it("keeps the address against the right edge at 60 columns", async () => {
    const screen = await draw(<PaneHeader {...Activity.args} width={60} />, 60);
    expect(screen.lines.at(0)).toBe(`activity${" ".repeat(39)}24h · by kind`);
  });

  it("names help, not bold", async () => {
    const screen = await draw(<PaneHeader {...Help.args} />, 40);
    expect(screen.lines.at(0)).toBe("help");
    expect(screen.look("help")?.bold).toBe(false);
  });

  it("cuts an address that leaves no room with an ellipsis", async () => {
    const screen = await draw(
      <PaneHeader title="activity" address="1w · by repo" width={16} />,
      16,
    );
    expect(screen.lines.at(0)).toBe("activity 1w · b…");
  });
});
